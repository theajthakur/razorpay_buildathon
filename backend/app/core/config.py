from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"
    RAZORPAY_SECRET_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""
    CLERK_JWKS_URL: str = "https://pumped-caiman-79.clerk.accounts.dev/.well-known/jwks.json"
    API_KEY_HMAC_SECRET: str = "default_development_hmac_secret_key_1234567890"

    # AWS S3 Settings
    AWS_ACCESS_KEY: str = ""
    AWS_SECRET_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "shopagent-razorpay"

    # Agent Auth & Encryption Settings
    JWT_SECRET: str = "default_jwt_secret_change_me_in_production"
    MERCHANT_TOKEN_ENCRYPTION_KEY: str = "AXkCY4yKn_YEyqts-4QaHHUxN85kVLFix20rHxC_k1I="


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
