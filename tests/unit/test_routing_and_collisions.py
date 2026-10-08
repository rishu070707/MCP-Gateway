import json
import pytest
from apps.gateway.mcp_router import sanitize_metadata

def test_metadata_redaction_secrets():
    # Test sensitive keys are masked
    payload = {
        "username": "admin",
        "password": "SuperSecretPassword123!",
        "api_key": "umcp_abcdef1234567890",
        "consumer_key": "ck_urumi_demo_consumer_key_12345",
        "consumer_secret": "cs_urumi_demo_consumer_secret_67890",
        "regular_price": "1499.00"
    }

    sanitized = sanitize_metadata(payload)
    assert "SuperSecretPassword123!" not in sanitized
    assert "ck_urumi_demo_consumer_key_12345" not in sanitized
    assert "cs_urumi_demo_consumer_secret_67890" not in sanitized
    assert "1499.00" in sanitized
    assert "[REDACTED]" in sanitized or "[REDACTED_WC_KEY]" in sanitized

def test_tool_namespace_collision_logic():
    server1_slug = "woo"
    server2_slug = "inventory"
    tool_name = "get_orders"

    namespaced_1 = f"{server1_slug}__{tool_name}"
    namespaced_2 = f"{server2_slug}__{tool_name}"

    assert namespaced_1 == "woo__get_orders"
    assert namespaced_2 == "inventory__get_orders"
    assert namespaced_1 != namespaced_2

    # Verification of slug split
    assert namespaced_1.split("__", 1) == ["woo", "get_orders"]
    assert namespaced_2.split("__", 1) == ["inventory", "get_orders"]
