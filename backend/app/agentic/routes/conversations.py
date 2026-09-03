from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.system.models import Conversation, ConversationMessage
from app.agentic.deps import get_current_session
from app.agentic.schemas.chat import ConversationListResponse, MessageListResponse
from app.agentic.services.payment_service import hydrate_payment_metadata

router = APIRouter()

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
        hydrated_meta = hydrate_payment_metadata(m.msg_metadata, db) if m.msg_metadata else None
        messages_data.append({
            "message_id": m.message_id,
            "conversation_id": m.conversation_id,
            "sender": m.sender,
            "message": m.message,
            "created_at": m.created_at,
            "products": hydrated_meta.get("products") if hydrated_meta else None,
            "metadata": hydrated_meta
        })

    return {
        "title": convo.title,
        "messages": messages_data
    }
