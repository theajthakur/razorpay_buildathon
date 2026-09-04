import os
import json
from functools import lru_cache
from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

def load_gcp_secrets():
    """
    Attempts to fetch GCP Secret Manager payload for 'shopagent' in project '945904246509'
    (or GCP_SECRET_NAME / GCP_PROJECT_ID env vars) and inject keys into os.environ.
    Fails gracefully in offline or local dev environments.
    """
    secret_name = os.environ.get("GCP_SECRET_NAME", "shopagent")
    project_id = os.environ.get("GCP_PROJECT_ID", "945904246509")
    try:
        # pyrefly: ignore [missing-import]
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{project_id}/secrets/{secret_name}/versions/latest"
        response = client.access_secret_version(request={"name": name})
        payload = response.payload.data.decode("UTF-8")
        
        # 1. Try JSON parsing
        try:
            data = json.loads(payload)
            if isinstance(data, dict):
                for k, v in data.items():
                    if k and k not in os.environ:
                        os.environ[k] = str(v)
                return
        except (json.JSONDecodeError, TypeError):
            pass

        # 2. Fallback: Parse KEY=VALUE lines (.env format)
        for line in payload.splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = val
    except Exception:
        pass

load_gcp_secrets()

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
