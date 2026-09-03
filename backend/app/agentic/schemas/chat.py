from datetime import datetime
import enum
from enum import Enum as PyEnum
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

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
    metadata: Optional[dict] = None

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
