from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import get_settings
from app.core.database import engine
from app.core.logging_config import setup_logging, get_logger
from app.system.router import router as system_router
from app.agentic.router import router as agentic_router, public_router
from app.dashboard.router import router as dashboard_router
from app.merchant.router import router as merchant_router

setup_logging()
logger = get_logger("main")

settings = get_settings()

app = FastAPI(title="Razorpay Buildathon Backend")

@app.on_event("startup")
def on_startup():
    logger.info("ShopAgent Backend initialized successfully")
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE onboardings ADD COLUMN IF NOT EXISTS verify_order_config JSON;"))
            conn.execute(text("ALTER TABLE onboardings ADD COLUMN IF NOT EXISTS webhook_path VARCHAR;"))
        logger.info("Database schema columns verified (verify_order_config, webhook_path).")
    except Exception as e:
        logger.warning(f"Startup DB column verification warning: {e}")

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
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

@app.get("/")
def read_root():
    return {"status": "healthy", "service": "Razorpay Buildathon API"}
