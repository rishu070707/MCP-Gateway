import hashlib
import hmac
import ipaddress
import re
import secrets
import socket
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from urllib.parse import urlparse
from jose import JWTError, jwt
import logging
from passlib.context import CryptContext
from apps.gateway.config import settings

logging.getLogger("passlib").setLevel(logging.ERROR)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # Fallback for plain SHA256 hashed passwords in testing environments
        if hashed_password.startswith("sha256$"):
            salt, h = hashed_password.split("$")[1:3]
            check = hashlib.sha256((salt + plain_password).encode("utf-8")).hexdigest()
            return hmac.compare_digest(check, h)
        return False

def get_password_hash(password: str) -> str:
    try:
        return pwd_context.hash(password)
    except Exception:
        # Fallback if bcrypt native module has issue on Windows
        salt = secrets.token_hex(8)
        h = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
        return f"sha256${salt}${h}"

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.GATEWAY_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.GATEWAY_SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

def generate_api_key() -> Tuple[str, str, str]:
    """
    Generates a secure API key in format:
    umcp_<random_secure_hex>
    Returns: (raw_key, key_prefix, key_hash)
    """
    token = secrets.token_hex(24)
    raw_key = f"umcp_{token}"
    prefix = raw_key[:12] # e.g. umcp_a1b2c3d4
    key_hash = hash_api_key(raw_key)
    return raw_key, prefix, key_hash

def hash_api_key(raw_key: str) -> str:
    """Computes SHA-256 hash of the API key for safe storage."""
    return hashlib.sha256(raw_key.strip().encode("utf-8")).hexdigest()

# SSRF Protection Engine
CLOUD_METADATA_HOSTS = {
    "169.254.169.254",          # AWS / GCP / Azure / OpenStack metadata
    "metadata.google.internal", # GCP
    "100.100.100.200",          # Alibaba
    "fd00:ec2::254",            # AWS IPv6 metadata
}

BLOCKED_INTERNAL_KEYWORDS = [
    "kubernetes.default",
    "kubernetes.default.svc",
    ":6443", # standard k8s api port
]

def validate_mcp_url(url: str) -> Tuple[bool, str]:
    """
    Validates upstream MCP server URLs against SSRF vulnerabilities.
    Enforces scheme, hostname, cloud metadata, and internal API restrictions.
    """
    if not url or not isinstance(url, str):
        return False, "URL is empty or invalid"

    parsed = urlparse(url.strip())
    if parsed.scheme.lower() not in ("http", "https"):
        return False, f"Invalid scheme '{parsed.scheme}'. Only http and https are allowed."

    hostname = parsed.hostname
    if not hostname:
        return False, "URL does not contain a valid hostname"

    # Block k8s API server
    for blocked in BLOCKED_INTERNAL_KEYWORDS:
        if blocked in url.lower():
            return False, f"Access to Kubernetes control plane '{blocked}' is prohibited"

    # Cloud metadata endpoints
    if hostname.lower() in CLOUD_METADATA_HOSTS:
        return False, f"Access to cloud metadata service '{hostname}' is strictly prohibited"

    # Check allowed internal hosts for Kubernetes service discovery (e.g., woo-mcp, inventory-mcp, etc.)
    allowed_internal = [h.strip().lower() for h in settings.SSRF_ALLOWED_INTERNAL_HOSTS.split(",") if h.strip()]
    if hostname.lower() in allowed_internal:
        return True, "Valid internal service"

    # Strict mode loopback and link-local check
    if hostname.lower() in ("localhost", "0.0.0.0", "::1", "127.0.0.1"):
        if settings.SSRF_STRICT_MODE:
            return False, f"Loopback address '{hostname}' is forbidden in strict mode"
        return True, "Allowed loopback in development mode"

    # Check if IP address is in private/link-local ranges
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_loopback:
            if settings.SSRF_STRICT_MODE:
                return False, "Loopback IP addresses are prohibited"
            return True, "Allowed in development"
        if ip.is_link_local:
            return False, "Link-local addresses (including cloud metadata) are prohibited"
        if ip.is_private and settings.SSRF_STRICT_MODE:
            return False, f"Private network IP '{hostname}' is forbidden"
    except ValueError:
        # It is a domain name
        pass

    return True, "URL is valid"
