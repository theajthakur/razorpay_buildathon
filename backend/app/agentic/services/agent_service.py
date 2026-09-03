import sys
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.system.models import Conversation
from app.core.config import get_settings as default_get_settings
from app.core.logging_config import get_logger
import vertexai as default_vertexai
from vertexai.generative_models import GenerativeModel as default_GenerativeModel

default_agent_logger = get_logger("agent")

def _getattr(name, default):
    mod = sys.modules.get("app.agentic.router")
    return getattr(mod, name, default) if mod else default

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

    agent_logger = _getattr("agent_logger", default_agent_logger)
    get_settings = _getattr("get_settings", default_get_settings)
    vertexai = _getattr("vertexai", default_vertexai)
    GenerativeModel = _getattr("GenerativeModel", default_GenerativeModel)

    settings = get_settings()
    try:
        vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_LOCATION)
        model = GenerativeModel(
            settings.GEMINI_MODEL,
            system_instruction=(
                "Generate a short, descriptive title summarizing what this message is about. "
                "Maximum 6 words. No quotation marks, no trailing punctuation, no preamble — "
                "reply with only the title text itself."
            ),
        )
        response = await model.generate_content_async(user_message)
        title_text = response.text
    except Exception as e:
        agent_logger.warning(f"Failed to generate title: {e}")
        title_text = "Untitled"

    return await set_conversation_title(conversation_id, title_text, db)
