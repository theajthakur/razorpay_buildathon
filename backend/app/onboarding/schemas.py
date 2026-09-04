from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any
from datetime import datetime


class DomainCreateRequest(BaseModel):
    domain: str = Field(..., description="The custom domain name (e.g. agent.merchant.com)")


class DomainResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    domain: str
    status: str
    dns_details: Optional[Any] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class DomainListResponse(BaseModel):
    domains: List[DomainResponse]
    total_count: int
