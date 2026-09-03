from fastapi import APIRouter
from app.agentic.routes.auth import router as auth_router, public_router as auth_public_router
from app.agentic.routes.conversations import router as conversations_router
from app.agentic.routes.chat import router as chat_router
from app.agentic.routes.payment import router as payment_router

router = APIRouter()
public_router = APIRouter()

# Include sub-routers into master router and public_router
router.include_router(auth_router)
router.include_router(conversations_router)
router.include_router(chat_router)
router.include_router(payment_router)

public_router.include_router(auth_public_router)

__all__ = ["router", "public_router"]
