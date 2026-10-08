import pytest
from apps.gateway.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
    generate_api_key,
    hash_api_key,
    validate_mcp_url
)
from apps.gateway.config import settings

def test_password_hashing_and_verification():
    plain = "SuperSecretPassword123!"
    h = get_password_hash(plain)
    assert h != plain
    assert verify_password(plain, h) is True
    assert verify_password("WrongPassword!", h) is False

def test_jwt_token_flow():
    payload = {"sub": "42", "email": "test@urumi.local", "role": "MEMBER"}
    token = create_access_token(payload)
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "42"
    assert decoded["email"] == "test@urumi.local"
    assert decoded["role"] == "MEMBER"

def test_api_key_format_and_hashing():
    raw_key, prefix, key_hash = generate_api_key()
    assert raw_key.startswith("umcp_")
    assert len(raw_key) > 20
    assert prefix == raw_key[:12]
    # Check SHA-256 hash
    expected_hash = hash_api_key(raw_key)
    assert key_hash == expected_hash
    # Check uniqueness
    raw_key2, _, key_hash2 = generate_api_key()
    assert raw_key != raw_key2
    assert key_hash != key_hash2

def test_ssrf_blocking_cloud_metadata():
    # AWS / GCP / Azure metadata IP
    is_valid, msg = validate_mcp_url("http://169.254.169.254/latest/meta-data/")
    assert is_valid is False
    assert "strictly prohibited" in msg

    # Google internal metadata hostname
    is_valid2, msg2 = validate_mcp_url("http://metadata.google.internal/computeMetadata/v1/")
    assert is_valid2 is False

def test_ssrf_blocking_kubernetes_control_plane():
    is_valid, msg = validate_mcp_url("https://kubernetes.default.svc/api/v1/secrets")
    assert is_valid is False
    assert "Kubernetes control plane" in msg

    is_valid2, msg2 = validate_mcp_url("https://10.96.0.1:6443/api/v1/pods")
    assert is_valid2 is False

def test_ssrf_allowed_internal_services():
    # Valid k8s internal services
    is_valid, _ = validate_mcp_url("http://woo-mcp:8001/mcp")
    assert is_valid is True

    is_valid2, _ = validate_mcp_url("http://inventory-mcp:8002/mcp")
    assert is_valid2 is True

    is_valid3, _ = validate_mcp_url("http://analytics-mcp:8003/mcp")
    assert is_valid3 is True
