import uuid
from sqlalchemy import Column, String, DateTime, func, ForeignKey, Boolean, JSON, UniqueConstraint, Index
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

    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
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

    # Branding & Webhook Columns
    branding_config = Column(JSON, nullable=True, default=dict)
    webhook_url = Column(String, nullable=True)
    
    # Settlement Bank Details
    bank_account = Column(String, nullable=True)
    ifsc = Column(String, nullable=True)
    branch_name = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationship link back to User
    user = relationship("User", back_populates="onboarding")
