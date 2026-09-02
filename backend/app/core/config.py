from functools import lru_cache
from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "1234"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: str = "5433"
    POSTGRES_DB: str = "razorpay"

    DATABASE_URL: str = ""
    API_KEY_HMAC_SECRET: str
    JWT_SECRET: str
    MERCHANT_TOKEN_ENCRYPTION_KEY: str

    @model_validator(mode="after")
    def assemble_db_url(self) -> "Settings":
        if not self.DATABASE_URL:
            self.DATABASE_URL = (
                f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
                f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        return self

    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"
    RAZORPAY_SECRET_KEY: str = ""
    RAZORPAY_CLIENT_ID: str = ""
    RAZORPAY_CLIENT_SECRET: str = ""
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
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
    GEMINI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""

    @property
    def effective_gemini_api_key(self) -> str:
        import os
        return self.GEMINI_API_KEY or self.GOOGLE_API_KEY or os.environ.get("GEMINI_API_KEY", "") or os.environ.get("GOOGLE_API_KEY", "")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def razorpay_key_id(self) -> str:
        return self.RAZORPAY_KEY_ID or self.RAZORPAY_CLIENT_ID

    @property
    def razorpay_key_secret(self) -> str:
        return self.RAZORPAY_KEY_SECRET or self.RAZORPAY_SECRET_KEY or self.RAZORPAY_CLIENT_SECRET

@lru_cache
def get_settings() -> Settings:
    return Settings()
