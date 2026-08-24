from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.system.router import router as system_router
from app.agentic.router import router as agentic_router
from app.dashboard.router import router as dashboard_router

settings = get_settings()

app = FastAPI(title="Razorpay Buildathon Backend")

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
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])

@app.get("/")
def read_root():
    return {"status": "healthy", "service": "Razorpay Buildathon API"}
