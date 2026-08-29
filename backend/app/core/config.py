from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    API_KEY_HMAC_SECRET: str
    JWT_SECRET: str
    MERCHANT_TOKEN_ENCRYPTION_KEY: str

    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"
    RAZORPAY_SECRET_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""
    CLERK_JWKS_URL: str = "https://pumped-caiman-79.clerk.accounts.dev/.well-known/jwks.json"

    # AWS S3 Settings
    AWS_ACCESS_KEY: str = ""
    AWS_SECRET_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "shopagent-razorpay"

    # GCP and Gemini SDK Settings
    GCP_PROJECT_ID: str = "learncloud-501101"
    GCP_LOCATION: str = "us-central1"
    GEMINI_MODEL: str = "gemini-2.5-flash"



    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
