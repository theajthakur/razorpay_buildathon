from typing import Optional
from pydantic import BaseModel

class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str

class RetryPaymentApiRequest(BaseModel):
    agent_order_id: Optional[str] = None
