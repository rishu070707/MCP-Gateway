import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GATEWAY_HOST: str = "0.0.0.0"
    GATEWAY_PORT: int = 8000
    GATEWAY_SECRET_KEY: str = os.getenv("GATEWAY_SECRET_KEY", "change-me-in-production")
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "*"

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./gateway.db")

    # Initial Admin Seed
    ADMIN_EMAIL: str = "admin@urumi.local"
    ADMIN_NAME: str = "Platform Admin"
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "change-me-in-production")

    # LLM / AI Configuration (Groq OpenAI-compatible)
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "groq")
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")  # Set in .env
    LLM_MODEL: str = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")  # Groq model
    LLM_TEMPERATURE: float = 0.2
    AI_SIMULATION_FALLBACK: bool = True  # Falls back to deterministic real-time engine when LLM_API_KEY is absent

    # Upstream MCP defaults
    MCP_CONNECT_TIMEOUT_SECONDS: float = 3.0
    MCP_REQUEST_TIMEOUT_SECONDS: float = 15.0
    MCP_MAX_RETRIES: int = 2

    # SSRF Protection
    SSRF_ALLOWED_INTERNAL_HOSTS: str = "woo-mcp,inventory-mcp,analytics-mcp,localhost,127.0.0.1,testserver"
    SSRF_STRICT_MODE: bool = False

    # Seed Upstream Servers (defaults to localhost for local dev)
    WOO_MCP_URL: str = os.getenv("WOO_MCP_URL", "http://localhost:8001/mcp")
    INVENTORY_MCP_URL: str = os.getenv("INVENTORY_MCP_URL", "http://localhost:8002/mcp")
    ANALYTICS_MCP_URL: str = os.getenv("ANALYTICS_MCP_URL", "http://localhost:8003/mcp")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
