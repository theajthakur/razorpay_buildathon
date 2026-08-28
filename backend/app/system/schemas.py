from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict

class AccountResponse(BaseModel):
    id: str  # Clerk User ID
    store_name: Optional[str] = None
    email: str
    created_on: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)

class TokenDeliveryConfig(BaseModel):
    method: str  # "header" | "cookie"
    header_name: Optional[str] = None
    bearer_prefix: Optional[bool] = None
    cookie_name: Optional[str] = None

class AuthConfigSchema(BaseModel):
    auth_url: str
    method: str  # GET/POST/PUT/PATCH
    identifier_field: str
    identifier_type: str  # "email" | "mobile" | "text"
    password_field: str
    token_path: str
    token_delivery: TokenDeliveryConfig

# STEP 2 PER-RESOURCE CONFIG SCHEMAS
class ProductsConfigSchema(BaseModel):
    path: str
    method: str = "GET"
    payload_key: str
    response_key: str

class OrderHistoryConfigSchema(BaseModel):
    path: str
    method: str = "GET"
    response_key: Optional[str] = None

class CustomerProfileConfigSchema(BaseModel):
    path: str
    method: str = "GET"

class AddressFetchConfig(BaseModel):
    path: str
    method: str = "GET"
    response_key: Optional[str] = None

class AddressCreateConfig(BaseModel):
    path: str
    method: str = "POST"
    field_mapping: List[str]

class AddressesConfigSchema(BaseModel):
    fetch: AddressFetchConfig
    create: AddressCreateConfig

class CreateOrderConfigSchema(BaseModel):
    path: str
    method: str = "POST"
    cart_key: str = "cart"
    item_id_field: str
    price_field: str
    quantity_field: str

class BrandingConfigSchema(BaseModel):
    brand_color: Optional[str] = None
    logo_url: Optional[str] = None

class OnboardingUpsertRequest(BaseModel):
    base_url: str
    auth_enabled: bool = True
    auth_disabled_ack: bool = False
    auth_config: Optional[AuthConfigSchema] = None
    
    # Scoped resource endpoints configs
    products_config: Optional[ProductsConfigSchema] = None
    order_history_config: Optional[OrderHistoryConfigSchema] = None
    customer_profile_config: Optional[CustomerProfileConfigSchema] = None
    addresses_config: Optional[AddressesConfigSchema] = None
    create_order_config: Optional[CreateOrderConfigSchema] = None
    
    bank_account: Optional[str] = None
    ifsc: Optional[str] = None
    branch_name: Optional[str] = None
    
    # Branding & Webhook
    branding_config: Optional[BrandingConfigSchema] = None
    webhook_url: Optional[str] = None

class OnboardingResponse(BaseModel):
    user_id: str
    base_url: str
    auth_enabled: bool
    auth_disabled_ack: bool
    auth_config: Optional[AuthConfigSchema] = None
    
    products_config: Optional[ProductsConfigSchema] = None
    order_history_config: Optional[OrderHistoryConfigSchema] = None
    customer_profile_config: Optional[CustomerProfileConfigSchema] = None
    addresses_config: Optional[AddressesConfigSchema] = None
    create_order_config: Optional[CreateOrderConfigSchema] = None
    
    bank_account: Optional[str] = None
    ifsc: Optional[str] = None
    branch_name: Optional[str] = None
    
    branding_config: Optional[BrandingConfigSchema] = None
    webhook_url: Optional[str] = None
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
    token_delivery_method: Optional[str] = None # "header" | "cookie"
    token_delivery_name: Optional[str] = None
    token_delivery_bearer: Optional[bool] = None
    payload: Optional[Dict[str, Any]] = None

class TestCustomerAuthRequest(BaseModel):
    auth_url: str
    auth_method: str
    payload: Dict[str, Any]
