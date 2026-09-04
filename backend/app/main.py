from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import get_settings
from app.core.database import engine, Base
import app.system.models  # Registers models with Base metadata
from app.core.logging_config import setup_logging, get_logger
from app.system.router import router as system_router
from app.agentic.router import router as agentic_router, public_router
from app.dashboard.router import router as dashboard_router
from app.merchant.router import router as merchant_router
from app.onboarding.router import router as onboarding_router

setup_logging()
logger = get_logger("main")

settings = get_settings()

app = FastAPI(title="Razorpay Buildathon Backend")

@app.on_event("startup")
def on_startup():
    logger.info("ShopAgent Backend initialized successfully")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified successfully.")
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE onboardings ADD COLUMN IF NOT EXISTS id VARCHAR;"))
            conn.execute(text("UPDATE onboardings SET id = user_id WHERE id IS NULL;"))
            conn.execute(text("ALTER TABLE domain_mappings DROP COLUMN IF EXISTS slug CASCADE;"))
            conn.execute(text("ALTER TABLE onboardings DROP COLUMN IF EXISTS slug CASCADE;"))
            conn.execute(text("ALTER TABLE onboardings ADD COLUMN IF NOT EXISTS verify_order_config JSON;"))
            conn.execute(text("ALTER TABLE onboardings ADD COLUMN IF NOT EXISTS webhook_path VARCHAR;"))

            conn.execute(text("ALTER TABLE domain_mappings ADD COLUMN IF NOT EXISTS onboarding_id VARCHAR;"))
            conn.execute(text("ALTER TABLE domain_mappings ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'PENDING';"))
            conn.execute(text("ALTER TABLE domain_mappings ADD COLUMN IF NOT EXISTS dns_details JSON;"))
        logger.info("Database schema columns verified (onboardings.id, verify_order_config, webhook_path, domain_mappings).")
    except Exception as e:
        logger.warning(f"Startup DB column verification warning: {e}")

# Configure CORS Middleware for production & dynamic custom domains
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount APIRouters
app.include_router(system_router, prefix="/system", tags=["System"])
app.include_router(agentic_router, prefix="/agentic", tags=["Agentic"])
app.include_router(public_router, prefix="/api/public", tags=["Public"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(merchant_router, prefix="/merchant", tags=["Merchant API"])
app.include_router(merchant_router, prefix="/api/merchant", tags=["Merchant API"])
app.include_router(onboarding_router, prefix="/onboarding", tags=["Onboarding API"])
app.include_router(onboarding_router, prefix="/api/onboarding", tags=["Onboarding API"])

@app.get("/")
def read_root():
    return {"status": "healthy", "service": "Razorpay Buildathon API"}
