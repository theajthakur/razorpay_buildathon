import asyncio
from datetime import datetime, timezone
import enum
from enum import Enum as PyEnum
import json
import httpx
import jwt
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import get_settings
from app.system.models import User, Onboarding, MerchantUserSession, Conversation, ConversationMessage, MessageSender
import vertexai
from vertexai.generative_models import GenerativeModel, Part, Content, FunctionDeclaration, Tool
from app.agentic.dependencies import resolve_merchant_by_host
from app.agentic.crypto import encrypt_merchant_token
from app.agentic.auth_utils import resolve_session_expiry, get_value_by_path
from app.agentic.deps import get_current_session, get_merchant_token, get_merchant_auth_headers

router = APIRouter()
public_router = APIRouter()

class LoginRequest(BaseModel):
    merchant_id: str
    email: str
    password: str

class LoginResponse(BaseModel):
    token: str
    expires_at: datetime


class LoginResponse(BaseModel):
    token: str
    expires_at: datetime


class MessageSenderEnum(str, PyEnum):
    USER = "user"
    AGENT = "agent"


class MessageCreateRequest(BaseModel):
    sender: MessageSenderEnum
    message: str


class ProductSchema(BaseModel):
    id: str
    thumbnailUrl: str
    name: str
    description: str
    price: float
    currency: str


class MessageResponse(BaseModel):
    message_id: str
    conversation_id: str
    sender: MessageSenderEnum
    message: str
    created_at: datetime
    products: Optional[List[ProductSchema]] = None

    model_config = ConfigDict(from_attributes=True)


class MessageListResponse(BaseModel):
    title: str
    messages: List[MessageResponse]


class ConversationListEntry(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class ConversationListResponse(BaseModel):
    conversations: List[ConversationListEntry]


class SendMessageRequest(BaseModel):
    message: str


class AgentStage(str, enum.Enum):
    THINKING = "thinking"
    SEARCHING_PRODUCTS = "searching_products"
    FINAL_TOUCHES = "final_touches"


search_products_func = FunctionDeclaration(
    name="search_products",
    description=(
        "Search the merchant's product catalog. Use this whenever the customer "
        "asks about products, wants recommendations, or wants to compare options. "
        "Do not guess or invent product details — always call this function rather "
        "than answering from general knowledge."
    ),
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search terms describing what the customer is looking for.",
            },
            "max_price": {
                "type": "number",
                "description": "Optional upper price bound, if the customer mentioned a budget.",
            },
            "category": {
                "type": "string",
                "description": "Optional category filter, if evident from the conversation.",
            },
        },
        "required": ["query"],
    },
)

create_conversation_title_func = FunctionDeclaration(
    name="create_conversation_title",
    description=(
        "Set or change the conversation's title. Only call this when the user explicitly "
        "asks to rename, retitle, or change the name of this conversation — do not call it "
        "on your own initiative or in response to the content of a normal message; initial "
        "titling is handled automatically elsewhere."
    ),
    parameters={
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "The new title, max 6 words, no quotes or trailing punctuation.",
            },
        },
        "required": ["title"],
    },
)

product_search_tool = Tool(function_declarations=[search_products_func, create_conversation_title_func])

FIELD_CANDIDATES = {
    "id": ["id", "_id", "product_id"],
    "name": ["name", "title", "itemName"],
    "description": ["description", "desc", "summary"],
    "price": ["price", "unit_price", "amount"],
    "thumbnail": ["thumbnail", "thumbnailUrl", "image", "imageUrl", "image_url"],
}

def _pick(item: dict, candidates: list[str], field_label: str):
    for key in candidates:
        if key in item and item[key] is not None:
            return item[key]
    raise KeyError(f"none of {candidates} found for '{field_label}' in product item: {item!r}")

async def execute_search_products(merchant_id: str, args: dict, session: dict, db: Session) -> dict:
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == merchant_id).first()
    if not onboarding or not onboarding.products_config:
        return {"error": "onboarding_config_not_found", "products": [], "count": 0}

    config = onboarding.products_config  # {"path": "products", "method": "GET", "payload_key": "query", "response_key": "products"}

    url = f"{onboarding.base_url.rstrip('/')}/{config['path'].lstrip('/')}"
    params = {config["payload_key"]: args["query"]}

    headers = {}
    if onboarding.auth_enabled:
        try:
            from app.agentic.deps import get_merchant_auth_headers
            headers = get_merchant_auth_headers(session=session, db=db)
        except Exception as e:
            print(f"Failed to resolve auth headers for product search: {e}")

    async with httpx.AsyncClient() as client:
        resp = await client.request(config["method"], url, params=params, headers=headers)
    resp.raise_for_status()

    json_data = resp.json()
    response_key = config.get("response_key", "products")
    raw_items = []

    # Defensively extract product list (supports dot notation, top-level, and nested data structure)
    if "." in response_key:
        try:
            current = json_data
            for part in response_key.split("."):
                current = current[part]
            raw_items = current
        except Exception:
            pass
    else:
        if response_key in json_data:
            raw_items = json_data[response_key]
        elif "data" in json_data and isinstance(json_data["data"], dict) and response_key in json_data["data"]:
            raw_items = json_data["data"][response_key]
        elif "data" in json_data and isinstance(json_data["data"], dict) and "products" in json_data["data"]:
            raw_items = json_data["data"]["products"]
        else:
            raw_items = json_data.get("products", [])

    if not isinstance(raw_items, list):
        raw_items = []

    products = []
    for item in raw_items:
        try:
            # ID and Name are essential
            prod_id = str(_pick(item, FIELD_CANDIDATES["id"], "id"))
            prod_name = str(_pick(item, FIELD_CANDIDATES["name"], "name"))

            # Description, price, and thumbnail can fall back gracefully
            try:
                prod_desc = str(_pick(item, FIELD_CANDIDATES["description"], "description"))
            except KeyError:
                prod_desc = ""

            try:
                prod_price = float(_pick(item, FIELD_CANDIDATES["price"], "price"))
            except KeyError:
                prod_price = 0.0

            try:
                prod_thumb = str(_pick(item, FIELD_CANDIDATES["thumbnail"], "thumbnail"))
            except KeyError:
                prod_thumb = ""

            products.append({
                "id": prod_id,
                "name": prod_name,
                "description": prod_desc,
                "price": prod_price,
                "thumbnailUrl": prod_thumb,
                "currency": "INR",  # default
            })
        except KeyError as e:
            print(f"Skipping malformed product item: {e}")
            continue

    # Client-side filters
    if args.get("max_price") is not None:
        try:
            max_price = float(args["max_price"])
            products = [p for p in products if p["price"] <= max_price]
        except Exception:
            pass

    return {"products": products, "count": len(products)}

def build_system_instruction(merchant_name: str) -> str:
    return f"""You are the sales representative and shopping assistant for {merchant_name}. 

Your primary goal is to help customers find products, enthusiastically promote our catalog, and drive sales. You should never respond neutrally or say you "cannot offer personal opinions" or refer to yourself as "an AI assistant" or say "as an AI...". You represent {merchant_name} directly and are biased toward highlighting how amazing, delicious, or valuable our products are.

Rules:
- Act like a passionate salesperson: if a customer asks if a product is "worth it" or is good, speak highly of its qualities, describe its taste/appeal/utility enthusiastically, and encourage them to try it!
- Always use the search_products function to find real products — never invent product names, prices, or descriptions.
- When you mention specific products in your reply, don't repeat their full details in text (name, price, description) — the product cards render separately below your message. Just reference them naturally, e.g. "You'll love these options:".
- If a search returns no results, say so plainly and suggest the customer try different terms — don't fabricate alternatives.
- Keep replies conversational, persuasive, and short. A sentence or two of high-energy framing is usually enough; let the product cards do the rest.
"""

def _extract_function_call(response):
    if not response.candidates:
        return None
    content = response.candidates[0].content
    for part in content.parts:
        if part.function_call:
            return part.function_call
    return None


async def set_conversation_title(conversation_id: str, title: str, db: Session) -> str:
    title = title.strip().strip('"').strip("'")[:80]
    if not title:
        title = "Untitled"
    convo = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if convo:
        convo.title = title
        convo.updated_at = datetime.now(timezone.utc)
        db.commit()
    return title

async def maybe_generate_initial_title(conversation_id: str, user_message: str, is_first_message: bool, db: Session) -> str | None:
    if not is_first_message:
        return None

    settings = get_settings()
    vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_LOCATION)

    model = GenerativeModel(
        settings.GEMINI_MODEL,
        system_instruction=(
            "Generate a short, descriptive title summarizing what this message is about. "
            "Maximum 6 words. No quotation marks, no trailing punctuation, no preamble — "
            "reply with only the title text itself."
        ),
    )
    try:
        response = await model.generate_content_async(user_message)
        title_text = response.text
    except Exception as e:
        print(f"Failed to generate title: {e}")
        title_text = "Untitled"

    return await set_conversation_title(conversation_id, title_text, db)

@router.get("/conversations", response_model=ConversationListResponse)
def list_conversations(
    session: dict = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """
    List all conversations belonging to the logged-in customer for the current merchant.
    """
    convos = db.query(Conversation).filter(
        Conversation.user_email == session["customer_ref"],
        Conversation.merchant_id == session["merchant_id"]
    ).order_by(Conversation.created_at.desc()).all()

    return {
        "conversations": [
            {
                "id": c.id,
                "title": c.title,
                "created_at": c.created_at,
                "updated_at": c.updated_at
            }
            for c in convos
        ]
    }


async def message_event_stream(conversation_id: str, user_message: str, session: dict, db: Session):
    # 1. Fetch previous history messages from DB for the model (before inserting the new user message)
    previous_messages = db.query(ConversationMessage).filter(
        ConversationMessage.conversation_id == conversation_id
    ).order_by(ConversationMessage.created_at.asc()).all()

    is_first_message = len(previous_messages) == 0

    # Convert to Vertex Content format
    history = []
    for msg in previous_messages:
        role = "user" if msg.sender == MessageSender.USER else "model"
        history.append(Content(role=role, parts=[Part.from_text(msg.message)]))

    # 2. Persist user message in DB immediately
    user_msg_row = ConversationMessage(
        conversation_id=conversation_id,
        sender=MessageSender.USER,
        message=user_message
    )
    db.add(user_msg_row)
    
    # Bump conversations.updated_at
    convo = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if convo:
        convo.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user_msg_row)

    # Start title task concurrently in the background if it's the first message
    title_task = None
    if is_first_message:
        title_task = asyncio.create_task(
            maybe_generate_initial_title(conversation_id, user_message, is_first_message, db)
        )

    # Yield Thinking state
    yield json.dumps({"type": "status", "stage": "thinking"}) + "\n"
    await asyncio.sleep(0.1)

    # Await and yield the auto-generated title if available
    if title_task:
        try:
            new_title = await title_task
            if new_title:
                yield json.dumps({"type": "title", "title": new_title}) + "\n"
        except Exception as e:
            print(f"Error generating initial title: {e}")

    settings = get_settings()
    vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_LOCATION)

    merchant = db.query(User).filter(User.id == session["merchant_id"]).first()
    merchant_name = merchant.store_name if (merchant and merchant.store_name) else "the Merchant"

    model = GenerativeModel(
        settings.GEMINI_MODEL,
        system_instruction=build_system_instruction(merchant_name),
        tools=[product_search_tool],
    )

    chat = model.start_chat(history=history)
    collected_products = []
    
    try:
        response = await chat.send_message_async(user_message)
    except Exception as e:
        print(f"Error calling Gemini: {e}")
        response = None

    max_iterations = 4
    for iteration in range(max_iterations):
        if not response:
            break
            
        function_call = _extract_function_call(response)
        if not function_call:
            break

        if function_call.name == "search_products":
            yield json.dumps({"type": "status", "stage": "searching_products"}) + "\n"
            
            try:
                args = dict(function_call.args)
                result = await execute_search_products(session["merchant_id"], args, session, db)
                collected_products.extend(result.get("products", []))
            except Exception as e:
                print(f"Search products failed: {e}")
                result = {"error": "search_failed", "products": [], "count": 0}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="search_products", response=result)
                )
            except Exception as e:
                print(f"Error calling Gemini with tool response: {e}")
                response = None
                break

        elif function_call.name == "create_conversation_title":
            try:
                args = dict(function_call.args)
                new_title = await set_conversation_title(conversation_id, args["title"], db)
                yield json.dumps({"type": "title", "title": new_title}) + "\n"
                result = {"status": "ok", "title": new_title}
            except Exception as e:
                print(f"Rename conversation failed: {e}")
                result = {"status": "error", "message": str(e)}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="create_conversation_title", response=result)
                )
            except Exception as e:
                print(f"Error calling Gemini with rename response: {e}")
                response = None
                break

    yield json.dumps({"type": "status", "stage": "final_touches"}) + "\n"
    await asyncio.sleep(0.2)

    if response:
        try:
            final_text = response.text
        except Exception:
            final_text = "Here is what I found for you."
    else:
        final_text = "I'm sorry, I'm having trouble getting a response. Can you try again?"

    # 4. Save agent message to DB
    agent_msg_row = ConversationMessage(
        conversation_id=conversation_id,
        sender=MessageSender.AGENT,
        message=final_text,
        msg_metadata={"products": collected_products}
    )
    db.add(agent_msg_row)
    if convo:
        convo.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(agent_msg_row)

    # 5. Serialize results
    user_serialized = {
        "message_id": user_msg_row.message_id,
        "conversation_id": user_msg_row.conversation_id,
        "sender": "user",
        "message": user_msg_row.message,
        "created_at": user_msg_row.created_at.isoformat()
    }
    agent_serialized = {
        "message_id": agent_msg_row.message_id,
        "conversation_id": agent_msg_row.conversation_id,
        "sender": "agent",
        "message": agent_msg_row.message,
        "products": collected_products,
        "created_at": agent_msg_row.created_at.isoformat()
    }

    # Yield final results payload
    yield json.dumps({
        "type": "final",
        "user_message": user_serialized,
        "agent_message": agent_serialized
    }) + "\n"

@public_router.get("/branding")
def get_public_branding(
    onboarding: Onboarding = Depends(resolve_merchant_by_host)
):
    """
    Exposes the resolved merchant's public branding configuration.
    Requires no auth headers. Resolves merchant context from Host header.
    """
    branding_config = onboarding.branding_config
    if not branding_config or not isinstance(branding_config, dict):
        raise HTTPException(
            status_code=404,
            detail="Branding configuration not found for this merchant."
        )
    return {
        **branding_config,
        "merchant_id": onboarding.user_id
    }


def extract_by_path(data: dict, path: str):
    """Resolve a dot-notation path like 'data.token' against a JSON response."""
    if not path:
        raise HTTPException(status_code=502, detail="merchant_response_shape_mismatch")
    current = data
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            raise HTTPException(status_code=502, detail="merchant_response_shape_mismatch")
        current = current[part]
    return current


@public_router.post("/auth/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Customer Login for the Agentic module.
    Authenticates against the merchant's login API dynamically and returns a ShopAgent JWT.
    """
    settings = get_settings()

    # 1. Fetch onboarding configuration
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == payload.merchant_id).first()
    if not onboarding or not onboarding.auth_config:
        raise HTTPException(status_code=404, detail="merchant_not_found")

    auth_config = onboarding.auth_config

    # 2. Extract mappings and prepare endpoint URL
    auth_url = auth_config.get("auth_url")
    if not auth_url:
        raise HTTPException(status_code=404, detail="merchant_not_found")

    # Resolve relative URL
    if not auth_url.startswith(("http://", "https://")):
        base = onboarding.base_url.rstrip("/")
        path = auth_url.lstrip("/")
        auth_url = f"{base}/{path}"

    method = (auth_config.get("method") or "POST").upper()
    identifier_field = auth_config.get("identifier_field") or "email"
    password_field = auth_config.get("password_field") or "password"
    token_path = auth_config.get("token_path") or "token"

    # 3. Call the merchant's login API
    request_body = {
        identifier_field: payload.email,
        password_field: payload.password
    }

    try:
        async with httpx.AsyncClient() as client:
            if method == "GET":
                resp = await client.get(
                    auth_url,
                    params=request_body,
                    timeout=10.0
                )
            else:
                resp = await client.request(
                    method,
                    auth_url,
                    json=request_body,
                    timeout=10.0
                )
    except Exception:
        # Generic 401 on connection failure
        raise HTTPException(status_code=401, detail="invalid_credentials")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="invalid_credentials")

    merchant_data = resp.json()

    # Extract token
    try:
        merchant_token = extract_by_path(merchant_data, token_path)
    except HTTPException:
        # Pass 502 straight through
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="merchant_response_shape_mismatch")

    if not merchant_token:
        raise HTTPException(status_code=502, detail="merchant_response_shape_mismatch")

    # Extract customer reference
    customer_ref = (
        get_value_by_path(merchant_data, "user_id") or
        get_value_by_path(merchant_data, "id") or
        get_value_by_path(merchant_data, "customer_id") or
        get_value_by_path(merchant_data, "user.id") or
        get_value_by_path(merchant_data, "customer.id") or
        get_value_by_path(merchant_data, "data.user_id") or
        get_value_by_path(merchant_data, "data.id")
    )
    if not customer_ref:
        customer_ref = payload.email
    else:
        customer_ref = str(customer_ref)

    # 4. Resolve session expiry and create session
    expires_at = resolve_session_expiry(merchant_token, merchant_data)

    session = MerchantUserSession(
        merchant_id=payload.merchant_id,
        customer_ref=customer_ref,
        email=payload.email,
        merchant_token_encrypted=encrypt_merchant_token(merchant_token),
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # 5. Encode our JWT
    our_jwt = jwt.encode(
        {
            "sub": str(session.id),
            "merchant_id": str(payload.merchant_id),
            "customer_ref": customer_ref,
            "iat": int(datetime.now(timezone.utc).timestamp()),
            "exp": int(expires_at.timestamp()),
        },
        settings.JWT_SECRET,
        algorithm="HS256",
    )

    return LoginResponse(token=our_jwt, expires_at=expires_at)




@router.post("/conversations")
def create_conversation(
    session: dict = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """
    Creates a new conversation for the authenticated customer.
    """
    merchant_id = session["merchant_id"]
    user_email = session["customer_ref"]

    convo = Conversation(
        merchant_id=merchant_id,
        user_email=user_email
    )
    db.add(convo)
    db.commit()
    db.refresh(convo)

    return {"conversation_id": convo.id}


@router.post("/auth/logout")
def logout(
    session: dict = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """
    Customer Logout for the Agentic module.
    Deletes the customer's session row in the database, invalidating it server-side.
    """
    row = db.query(MerchantUserSession).filter(MerchantUserSession.id == session["session_id"]).first()
    if row:
        db.delete(row)
        db.commit()
    return {"status": "success"}


@router.get("/conversations/{conversation_id}/messages", response_model=MessageListResponse)
def get_conversation_messages(
    conversation_id: str,
    session: dict = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """
    Fetches the history of messages for a conversation, ordered chronologically.
    Verifies that the conversation belongs to the authenticated customer session.
    """
    convo = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()
    
    if not convo:
        raise HTTPException(status_code=404, detail="conversation_not_found")
        
    if convo.user_email != session["customer_ref"] or convo.merchant_id != session["merchant_id"]:
        raise HTTPException(status_code=404, detail="conversation_not_found")

    messages = db.query(ConversationMessage).filter(
        ConversationMessage.conversation_id == conversation_id
    ).order_by(ConversationMessage.created_at.asc()).all()

    messages_data = []
    for m in messages:
        messages_data.append({
            "message_id": m.message_id,
            "conversation_id": m.conversation_id,
            "sender": m.sender,
            "message": m.message,
            "created_at": m.created_at,
            "products": m.msg_metadata.get("products") if m.msg_metadata else None
        })

    return {
        "title": convo.title,
        "messages": messages_data
    }


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    payload: SendMessageRequest,
    session: dict = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """
    Accepts a user message, stores it in database, and streams status stages
    followed by the final generated assistant response (NDJSON).
    """
    convo = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()
    
    if not convo:
        raise HTTPException(status_code=404, detail="conversation_not_found")
        
    if convo.user_email != session["customer_ref"] or convo.merchant_id != session["merchant_id"]:
        raise HTTPException(status_code=404, detail="conversation_not_found")

    return StreamingResponse(
        message_event_stream(conversation_id, payload.message, session, db),
        media_type="application/x-ndjson"
    )


