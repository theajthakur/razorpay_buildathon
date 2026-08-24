from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

class APIKeyCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Friendly label for the API Key")

class APIKeyCreateResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    api_key: str
    status: str
    created_at: datetime
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class APIKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    status: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class APIKeyListResponse(BaseModel):
    keys: List[APIKeyResponse]
    active_count: int
    total_count: int
    max_keys: int
