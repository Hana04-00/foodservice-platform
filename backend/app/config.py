"""Application settings, loaded from the environment (12-factor style)."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Database ---
    database_url: str = "postgresql+psycopg://tiffin:tiffin@localhost:5432/gharse_tiffin"

    # --- Auth ---
    jwt_secret: str = "change-me-in-production-please"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720
    admin_username: str = "admin"
    admin_password: str = "admin123"

    # --- Clock ---
    app_timezone: str = "Asia/Kolkata"

    # --- CORS ---
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
