from typing import Optional, List
from pydantic import BaseModel

class CartItemResponse(BaseModel):
    product_id: str
    name: str
    thumbnail_url: Optional[str] = None
    price: float
    quantity: int

class CartResponse(BaseModel):
    items: List[CartItemResponse]
    count: int
    subtotal: float
