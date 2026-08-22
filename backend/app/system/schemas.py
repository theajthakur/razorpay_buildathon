from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict

class AccountResponse(BaseModel):
    id: str  # Clerk User ID
    store_name: Optional[str] = None
    email: str
    created_on: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)

class OnboardingUpsertRequest(BaseModel):
    base_url: str
    auth_needed: bool = False
    auth_method: Optional[str] = None
    credential_value: Optional[str] = None
    
    # Store endpoints mapping object (e.g. { "products": { "path": "products", "method": "GET" } })
    endpoints: Dict[str, Any] = {}
    
    bank_account: Optional[str] = None
    ifsc: Optional[str] = None
    branch_name: Optional[str] = None

class OnboardingResponse(OnboardingUpsertRequest):
    user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TestEndpointRequest(BaseModel):
    base_url: str
    auth_needed: bool = False
    auth_method: Optional[str] = None
    credential_value: Optional[str] = None
    path: str
    method: str
