import uuid
import enum
from sqlalchemy import Column, String, DateTime, func, ForeignKey, Boolean, JSON, UniqueConstraint, Index, Text, Numeric, Integer, Enum as SqlEnum
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    # We use the Clerk User ID (e.g. "user_2ab...") as the primary key
    id = Column(String, primary_key=True, index=True)
    store_name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    created_on = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending | blocked | approved

    # 1-1 relationship with Onboarding
    onboarding = relationship(
        "Onboarding",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    # 1-N relationship with API Keys
    api_keys = relationship(
        "APIKey",
        back_populates="user",
        cascade="all, delete-orphan"
    )

class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    key_prefix = Column(String, nullable=False, index=True)
    key_hash = Column(String, nullable=False)
    status = Column(String, default="active", nullable=False)  # active | paused
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship to User
    user = relationship("User", back_populates="api_keys")

    __table_args__ = (
        UniqueConstraint("customer_id", "name", name="uq_customer_id_name"),
        Index("idx_customer_id_status", "customer_id", "status"),
    )

class Onboarding(Base):
    __tablename__ = "onboardings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    base_url = Column(String, nullable=False)
    auth_enabled = Column(Boolean, default=True, nullable=False)
    auth_disabled_ack = Column(Boolean, default=False, nullable=False)
    auth_config = Column(JSON, nullable=True, default=dict)
    
    # Scoped resource API JSON configuration columns
    products_config = Column(JSON, nullable=True, default=dict)
    order_history_config = Column(JSON, nullable=True, default=dict)
    customer_profile_config = Column(JSON, nullable=True, default=dict)
    addresses_config = Column(JSON, nullable=True, default=dict)
    create_order_config = Column(JSON, nullable=True, default=dict)
    verify_order_config = Column(JSON, nullable=True, default=dict)

    # Branding & Webhook Columns
    branding_config = Column(JSON, nullable=True, default=dict)
    webhook_url = Column(String, nullable=True)
    webhook_path = Column(String, nullable=True)
    
    # Settlement Bank Details
    bank_account = Column(String, nullable=True)
    ifsc = Column(String, nullable=True)
    branch_name = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationship link back to User
    user = relationship("User", back_populates="onboarding")

    # Relationship to Domain Mappings
    domain_mappings = relationship(
        "DomainMapping",
        back_populates="onboarding",
        cascade="all, delete-orphan"
    )


class DomainMapping(Base):
    __tablename__ = "domain_mappings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    onboarding_id = Column(String, ForeignKey("onboardings.id", ondelete="CASCADE"), index=True, nullable=False)
    domain = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="PENDING", nullable=False)
    dns_details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    onboarding = relationship("Onboarding", back_populates="domain_mappings")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_email = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False, server_default="Untitled", default="Untitled")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True)



class MerchantUserSession(Base):
    __tablename__ = "merchant_user_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_ref = Column(String, nullable=False)
    email = Column(String, nullable=False)
    merchant_token_encrypted = Column(String, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_merchant_customer", "merchant_id", "customer_ref"),
    )


class MessageSender(str, enum.Enum):
    USER = "user"
    AGENT = "agent"


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    message_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender = Column(SqlEnum(MessageSender), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    msg_metadata = Column("metadata", JSON, nullable=True, default=dict)

    __table_args__ = (
        Index("idx_convo_created", "conversation_id", "created_at"),
    )


class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_email = Column(String, nullable=False, index=True)
    product_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    thumbnail_url = Column(String, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("merchant_id", "customer_email", "product_id", name="uq_cart_merchant_customer_product"),
        Index("idx_cart_merchant_customer", "merchant_id", "customer_email"),
    )


class AgentOrderStatus(str, enum.Enum):
    INITIATED = "initiated"
    MERCHANT_ORDER_CREATED = "merchant_order_created"
    AWAITING_PAYMENT = "awaiting_payment"
    PAYMENT_CAPTURED = "payment_captured"
    FAILED = "failed"


class AgentOrder(Base):
    __tablename__ = "agent_orders"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_ref = Column(String, nullable=False)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True)
    
    items = Column(JSON, nullable=False)
    merchant_order_id = Column(String, nullable=True, index=True)
    unit_price = Column(Numeric(10, 2), nullable=True)
    order_total = Column(Numeric(10, 2), nullable=True)
    currency = Column(String, default="INR", nullable=False)
    
    razorpay_order_id = Column(String, nullable=True, unique=True)
    razorpay_payment_id = Column(String, nullable=True)
    
    status = Column(String, nullable=False, default=AgentOrderStatus.INITIATED.value)
    failure_reason = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_agent_orders_merchant_customer", "merchant_id", "customer_ref"),
    )


