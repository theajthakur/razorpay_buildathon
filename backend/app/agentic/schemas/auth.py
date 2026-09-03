from datetime import datetime
from pydantic import BaseModel

class LoginRequest(BaseModel):
    merchant_id: str
    email: str
    password: str

class LoginResponse(BaseModel):
    token: str
    expires_at: datetime
