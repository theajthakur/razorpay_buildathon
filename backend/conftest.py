import os
import sys
from pathlib import Path
# pyrefly: ignore [missing-import]
import pytest

# Set test environment defaults before importing app settings
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("API_KEY_HMAC_SECRET", "test_secret_hmac_12345678901234567890123456789012")
os.environ.setdefault("JWT_SECRET", "test_jwt_secret_12345678901234567890123456789012")
os.environ.setdefault("MERCHANT_TOKEN_ENCRYPTION_KEY", "Y4j_PL8CU6g4fFlJTSOA1zs3VWh2nV6Jd3hs-sLNRY8=")
os.environ.setdefault("RAZORPAY_KEY_ID", "rzp_test_mockkey123")
os.environ.setdefault("RAZORPAY_KEY_SECRET", "mock_secret_key_123456")

# Ensure backend root directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.database import engine, Base, SessionLocal
from app.system.models import User, Onboarding  # noqa

# Create all database tables immediately at module load for in-memory SQLite / unittest.TestCase classes
Base.metadata.create_all(bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """
    Ensures all database tables exist throughout the test session.
    """
    Base.metadata.create_all(bind=engine)
    yield

@pytest.fixture
def db_session():
    """
    Provides a clean SQLAlchemy Session for test functions.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def test_merchant(db_session):
    """
    Provides a mock merchant user with onboarding configuration.
    """
    user = db_session.query(User).filter(User.id == "user_test_merchant_999").first()
    if not user:
        user = User(
            id="user_test_merchant_999",
            email="testmerchant@example.com",
            store_name="Test Merchant Store",
            status="approved"
        )
        db_session.add(user)

    onboarding = db_session.query(Onboarding).filter(Onboarding.user_id == "user_test_merchant_999").first()
    if not onboarding:
        onboarding = Onboarding(
            user_id="user_test_merchant_999",
            base_url="https://api.teststore.com",
            auth_enabled=True,
            auth_disabled_ack=False,
            addresses_config={"path": "user/addresses"},
            create_order_config={"path": "orders", "method": "POST"}
        )
        db_session.add(onboarding)

    db_session.commit()
    return user

@pytest.fixture
def test_customer_user(db_session):
    """
    Provides a mock customer user.
    """
    customer = db_session.query(User).filter(User.id == "user_test_customer_111").first()
    if not customer:
        customer = User(
            id="user_test_customer_111",
            email="customer_test@example.com",
            store_name="Customer User",
            status="approved"
        )
        db_session.add(customer)
        db_session.commit()
    return customer
