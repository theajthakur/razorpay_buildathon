from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, model_validator

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
    path: str = ""
    auth_url: Optional[str] = None
    method: str  # GET/POST/PUT/PATCH
    identifier_field: str
    identifier_type: str  # "email" | "mobile" | "text"
    password_field: str
    token_path: str
    token_delivery: TokenDeliveryConfig

    @model_validator(mode="before")
    @classmethod
    def ensure_path(cls, data: Any) -> Any:
        if isinstance(data, dict):
            p = data.get("path") or data.get("auth_url") or ""
            data["path"] = p
            data["auth_url"] = p
        elif hasattr(data, "__dict__"):
            p = getattr(data, "path", None) or getattr(data, "auth_url", None) or ""
            setattr(data, "path", p)
            setattr(data, "auth_url", p)
        return data

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
    array_path: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = None
    fields: Optional[Dict[str, str]] = None

    model_config = ConfigDict(extra="allow")

class CustomerProfileConfigSchema(BaseModel):
    path: str
    method: str = "GET"
    response_object_path: Optional[str] = None
    response_key: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = None
    fields: Optional[Dict[str, str]] = None

    model_config = ConfigDict(extra="allow")

class AdditionalFieldSchema(BaseModel):
    key: str
    value: str

class AddressFetchConfig(BaseModel):
    path: str
    method: str = "GET"
    response_key: Optional[str] = None
    id_field: Optional[str] = "id"

class AddressCreateConfig(BaseModel):
    path: str
    method: str = "POST"
    field_mapping: List[str]

class AddressesConfigSchema(BaseModel):
    supports_creation: Optional[bool] = False
    fetch: Optional[AddressFetchConfig] = None
    create: Optional[AddressCreateConfig] = None

class CreateOrderConfigSchema(BaseModel):
    path: str
    method: str = "POST"
    cart_key: str = "cart"
    item_id_field: str
    price_field: str
    quantity_field: str
    address_id_field: Optional[str] = "address_id"
    additional_fields: Optional[List[AdditionalFieldSchema]] = []

class VerifyOrderConfigSchema(BaseModel):
    path: str
    method: str = "POST"
    order_id_field: str = "merchantOrderId"
    response_price_field: str = "price"

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
    verify_order_config: Optional[VerifyOrderConfigSchema] = None
    
    bank_account: Optional[str] = None
    ifsc: Optional[str] = None
    branch_name: Optional[str] = None
    
    # Branding & Webhook
    branding_config: Optional[BrandingConfigSchema] = None
    webhook_url: Optional[str] = None
    webhook_path: Optional[str] = None

class OnboardingPartialUpdateRequest(BaseModel):
    base_url: Optional[str] = None
    auth_enabled: Optional[bool] = None
    auth_disabled_ack: Optional[bool] = None
    auth_config: Optional[AuthConfigSchema] = None
    
    products_config: Optional[ProductsConfigSchema] = None
    order_history_config: Optional[OrderHistoryConfigSchema] = None
    customer_profile_config: Optional[CustomerProfileConfigSchema] = None
    addresses_config: Optional[AddressesConfigSchema] = None
    create_order_config: Optional[CreateOrderConfigSchema] = None
    verify_order_config: Optional[VerifyOrderConfigSchema] = None
    
    bank_account: Optional[str] = None
    ifsc: Optional[str] = None
    branch_name: Optional[str] = None
    
    branding_config: Optional[BrandingConfigSchema] = None
    webhook_url: Optional[str] = None
    webhook_path: Optional[str] = None

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
    verify_order_config: Optional[VerifyOrderConfigSchema] = None
    
    bank_account: Optional[str] = None
    ifsc: Optional[str] = None
    branch_name: Optional[str] = None
    
    branding_config: Optional[BrandingConfigSchema] = None
    webhook_url: Optional[str] = None
    webhook_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def normalize_empty_configs(cls, data: Any) -> Any:
        config_fields = [
            "auth_config",
            "products_config",
            "order_history_config",
            "customer_profile_config",
            "addresses_config",
            "create_order_config",
            "verify_order_config",
            "branding_config",
        ]
        if isinstance(data, dict):
            for field in config_fields:
                val = data.get(field)
                if val == {} or (isinstance(val, dict) and not any(val.values())):
                    data[field] = None
        elif hasattr(data, "__dict__"):
            for field in config_fields:
                val = getattr(data, field, None)
                if val == {} or (isinstance(val, dict) and not any(val.values())):
                    setattr(data, field, None)
        return data

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
    base_url: Optional[str] = None
    auth_url: Optional[str] = None
    auth_path: Optional[str] = None
    auth_method: str
    payload: Dict[str, Any]
