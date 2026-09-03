import sys
import asyncio
from datetime import datetime, timezone
import json
from sqlalchemy.orm import Session
from app.system.models import User, Conversation, ConversationMessage, MessageSender
from app.core.config import get_settings
from app.agentic.llm.prompts import build_system_instruction
from app.agentic.llm.tools import TOOL_TO_STAGE, get_status_payload, build_tools_for_merchant
from app.agentic.tools.products import execute_search_products
from app.agentic.tools.cart import (
    execute_add_to_cart,
    execute_get_cart_items,
    execute_update_cart_item,
    execute_remove_from_cart,
)
from app.agentic.tools.addresses import execute_fetch_addresses, execute_create_address
from app.agentic.tools.orders import execute_create_order, execute_get_order_history
from app.agentic.tools.profile import execute_get_customer_profile
from app.agentic.services.agent_service import set_conversation_title, maybe_generate_initial_title
from app.agentic.services.payment_service import hydrate_payment_metadata, execute_retry_payment
from app.core.logging_config import get_logger
import vertexai as default_vertexai
from vertexai.generative_models import GenerativeModel as default_GenerativeModel, Part, Content

default_agent_logger = get_logger("agent")

def _getattr(name, default):
    mod = sys.modules.get("app.agentic.router")
    return getattr(mod, name, default) if mod else default

def _extract_function_call(response):
    if not response or not response.candidates:
        return None
    content = response.candidates[0].content
    for part in content.parts:
        if part.function_call:
            return part.function_call
    return None

async def message_event_stream(conversation_id: str, user_message: str, session: dict, db: Session):
    agent_logger = _getattr("agent_logger", default_agent_logger)
    vertexai = _getattr("vertexai", default_vertexai)
    GenerativeModel = _getattr("GenerativeModel", default_GenerativeModel)

    agent_logger.info(f"Agent loop started: conversation_id={conversation_id}, customer={session.get('customer_ref')}")
    start_time = datetime.now(timezone.utc)
    tool_call_count = 0

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
    yield json.dumps(get_status_payload("thinking")) + "\n"
    await asyncio.sleep(0.1)

    # Await and yield the auto-generated title if available
    if title_task:
        try:
            new_title = await title_task
            if new_title:
                yield json.dumps({"type": "title", "title": new_title}) + "\n"
        except Exception as e:
            agent_logger.warning(f"Error generating initial title: {e}")

    settings = get_settings()
    try:
        vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_LOCATION)
    except Exception as init_err:
        agent_logger.warning(f"Vertex AI init warning: {init_err}")

    merchant = db.query(User).filter(User.id == session["merchant_id"]).first()
    merchant_name = merchant.store_name if (merchant and merchant.store_name) else "the Merchant"

    merchant_tools = await build_tools_for_merchant(session["merchant_id"], db)

    try:
        model = GenerativeModel(
            settings.GEMINI_MODEL,
            system_instruction=build_system_instruction(merchant_name),
            tools=[merchant_tools],
        )
        chat = model.start_chat(history=history)
    except Exception as e:
        agent_logger.error(f"Failed to instantiate GenerativeModel: {e}")
        chat = None

    collected_products = []
    payment_metadata_to_attach = None
    
    if chat:
        try:
            agent_logger.debug(f"Calling Gemini model {settings.GEMINI_MODEL} for conversation={conversation_id}")
            response = await chat.send_message_async(user_message)
        except Exception as e:
            err_msg = str(e)
            if "credentials" in err_msg.lower():
                agent_logger.error(
                    f"Error calling Gemini: {e}. "
                    "CRITICAL: Application Default Credentials not found. Please set GEMINI_API_KEY in backend/.env "
                    "or configure GOOGLE_APPLICATION_CREDENTIALS."
                )
            else:
                agent_logger.error(f"Error calling Gemini: {e}")
            response = None
    else:
        response = None

    max_iterations = 4
    for iteration in range(max_iterations):
        if not response:
            break
            
        function_call = _extract_function_call(response)
        if not function_call:
            break

        tool_call_count += 1
        agent_logger.info(f"Tool call dispatched: function={function_call.name}, conversation_id={conversation_id}")
        stage = TOOL_TO_STAGE.get(function_call.name, "thinking")
        yield json.dumps(get_status_payload(stage)) + "\n"

        if function_call.name == "search_products":
            
            try:
                args = dict(function_call.args)
                result = await execute_search_products(session["merchant_id"], args, session, db)
                collected_products.extend(result.get("products", []))
            except Exception as e:
                agent_logger.error(f"Search products failed: {e}")
                result = {"error": "search_failed", "products": [], "count": 0}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="search_products", response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with tool response: {e}")
                response = None
                break

        elif function_call.name == "create_conversation_title":
            try:
                args = dict(function_call.args)
                new_title = await set_conversation_title(conversation_id, args["title"], db)
                yield json.dumps({"type": "title", "title": new_title}) + "\n"
                result = {"status": "ok", "title": new_title}
            except Exception as e:
                agent_logger.error(f"Rename conversation failed: {e}")
                result = {"status": "error", "message": str(e)}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="create_conversation_title", response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with rename response: {e}")
                response = None
                break

        elif function_call.name in ("add_to_cart", "get_cart_items", "update_cart_item", "remove_from_cart"):
            try:
                args = dict(function_call.args) if function_call.args else {}
                m_id = session["merchant_id"]
                c_email = session["customer_ref"]

                if function_call.name == "add_to_cart":
                    result = await execute_add_to_cart(m_id, c_email, args, db)
                elif function_call.name == "get_cart_items":
                    result = await execute_get_cart_items(m_id, c_email, db)
                elif function_call.name == "update_cart_item":
                    result = await execute_update_cart_item(m_id, c_email, args, db)
                elif function_call.name == "remove_from_cart":
                    result = await execute_remove_from_cart(m_id, c_email, args, db)

                # Stream event when cart is modified (add/update/remove, NOT plain get_cart_items fetch)
                if function_call.name != "get_cart_items":
                    cart_state = await execute_get_cart_items(m_id, c_email, db)
                    yield json.dumps({
                        "type": "cart_updated",
                        "items": cart_state["items"],
                        "count": cart_state["count"],
                        "subtotal": cart_state["subtotal"]
                    }) + "\n"

            except Exception as e:
                agent_logger.error(f"Cart tool {function_call.name} failed: {e}")
                result = {"error": "cart_operation_failed", "message": str(e)}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name=function_call.name, response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with cart tool response: {e}")
                response = None
                break

        elif function_call.name == "fetch_addresses":
            try:
                result = await execute_fetch_addresses(session["merchant_id"], session, db)
            except Exception as e:
                agent_logger.error(f"fetch_addresses failed: {e}")
                result = {"error": "fetch_addresses_failed", "addresses": [], "count": 0}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="fetch_addresses", response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with fetch_addresses response: {e}")
                response = None
                break

        elif function_call.name == "create_address":
            try:
                args = dict(function_call.args) if function_call.args else {}
                result = await execute_create_address(session["merchant_id"], session, args, db)
            except Exception as e:
                agent_logger.error(f"create_address failed: {e}")
                result = {"error": "create_address_failed", "message": str(e)}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="create_address", response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with create_address response: {e}")
                response = None
                break

        elif function_call.name == "create_order":
            try:
                args = dict(function_call.args) if function_call.args else {}
                m_id = session["merchant_id"]
                result = await execute_create_order(m_id, session, conversation_id, args, db)
                if result.get("payment_metadata"):
                    payment_metadata_to_attach = result["payment_metadata"]
                
                # Stream cart cleared event
                yield json.dumps({
                    "type": "cart_updated",
                    "items": [],
                    "count": 0,
                    "subtotal": 0.0
                }) + "\n"
            except Exception as e:
                agent_logger.error(f"create_order failed: {e}")
                result = {"error": "create_order_failed", "message": str(e)}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="create_order", response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with create_order response: {e}")
                response = None
                break

        elif function_call.name == "get_order_history":
            try:
                result = await execute_get_order_history(session["merchant_id"], session, db)
                if result.get("orders") is not None:
                    payment_metadata_to_attach = {
                        "action": "order_history_card",
                        "orders": result.get("orders", []),
                        "count": result.get("count", 0)
                    }
            except Exception as e:
                agent_logger.error(f"get_order_history failed: {e}")
                result = {"error": "get_order_history_failed", "orders": [], "count": 0}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="get_order_history", response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with get_order_history response: {e}")
                response = None
                break

        elif function_call.name == "get_customer_profile":
            try:
                result = await execute_get_customer_profile(session["merchant_id"], session, db)
                if result.get("profile"):
                    payment_metadata_to_attach = {
                        "action": "profile_card",
                        "profile": result.get("profile")
                    }
            except Exception as e:
                agent_logger.error(f"get_customer_profile failed: {e}")
                result = {"error": "get_customer_profile_failed", "profile": None}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="get_customer_profile", response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with get_customer_profile response: {e}")
                response = None
                break

        elif function_call.name == "retry_payment":
            try:
                args = dict(function_call.args) if function_call.args else {}
                result = await execute_retry_payment(session["merchant_id"], session, conversation_id, args, db)
                if result.get("payment_metadata"):
                    payment_metadata_to_attach = result["payment_metadata"]
            except Exception as e:
                agent_logger.error(f"retry_payment failed: {e}")
                result = {"error": "retry_payment_failed", "message": str(e)}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="retry_payment", response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with retry_payment response: {e}")
                response = None
                break

    yield json.dumps(get_status_payload("final_touches")) + "\n"
    await asyncio.sleep(0.2)

    elapsed_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
    agent_logger.info(f"Agent loop completed in {elapsed_ms}ms, tool_calls={tool_call_count}, conversation_id={conversation_id}")

    if response:
        try:
            final_text = response.text
        except Exception:
            final_text = "Here is what I found for you."
    else:
        final_text = "I'm sorry, I'm having trouble getting a response from Gemini right now. Please try again in a moment."

    # 4. Save agent message to DB
    msg_meta = {"products": collected_products}
    if payment_metadata_to_attach:
        msg_meta.update(payment_metadata_to_attach)

    msg_meta = hydrate_payment_metadata(msg_meta, db)

    agent_msg_row = ConversationMessage(
        conversation_id=conversation_id,
        sender=MessageSender.AGENT,
        message=final_text,
        msg_metadata=msg_meta
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
        "metadata": agent_msg_row.msg_metadata,
        "created_at": agent_msg_row.created_at.isoformat()
    }

    # Yield final results payload
    yield json.dumps({
        "type": "final",
        "user_message": user_serialized,
        "agent_message": agent_serialized
    }) + "\n"
