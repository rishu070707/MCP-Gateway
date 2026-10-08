import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GATEWAY_HOST: str = "0.0.0.0"
    GATEWAY_PORT: int = 8000
    GATEWAY_SECRET_KEY: str = "urumi-super-secure-production-jwt-secret-key-32chars"
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "*"

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./gateway.db")

    # Initial Admin Seed
    ADMIN_EMAIL: str = "admin@urumi.local"
    ADMIN_NAME: str = "Platform Admin"
    ADMIN_PASSWORD: str = "AdminSecurePass123!"

    # LLM / AI Configuration
    LLM_PROVIDER: str = "openai"
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_TEMPERATURE: float = 0.2
    AI_SIMULATION_FALLBACK: bool = True

    # Upstream MCP defaults
    MCP_CONNECT_TIMEOUT_SECONDS: float = 3.0
    MCP_REQUEST_TIMEOUT_SECONDS: float = 15.0
    MCP_MAX_RETRIES: int = 2

    # SSRF Protection
    SSRF_ALLOWED_INTERNAL_HOSTS: str = "woo-mcp,inventory-mcp,analytics-mcp,localhost,127.0.0.1,testserver"
    SSRF_STRICT_MODE: bool = False

    # Seed Upstream Servers
    WOO_MCP_URL: str = os.getenv("WOO_MCP_URL", "http://woo-mcp:8001/mcp")
    INVENTORY_MCP_URL: str = os.getenv("INVENTORY_MCP_URL", "http://inventory-mcp:8002/mcp")
    ANALYTICS_MCP_URL: str = os.getenv("ANALYTICS_MCP_URL", "http://analytics-mcp:8003/mcp")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
