from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.system.models import Conversation
from app.agentic.deps import get_current_session
from app.agentic.schemas.chat import SendMessageRequest
from app.agentic.llm.orchestrator import message_event_stream

router = APIRouter()

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
