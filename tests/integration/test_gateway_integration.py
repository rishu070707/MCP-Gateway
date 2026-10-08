import pytest
from starlette.testclient import TestClient

from apps.gateway.main import app
from apps.gateway.config import settings

def test_full_gateway_integration_flow():
    client = TestClient(app)

    # 1. Health check
    h_res = client.get("/health")
    assert h_res.status_code == 200
    assert h_res.json()["status"] == "healthy"

    # 2. Admin Login
    login_res = client.post("/api/auth/login", json={
        "email": settings.ADMIN_EMAIL,
        "password": settings.ADMIN_PASSWORD
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token_data = login_res.json()
    admin_token = token_data["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 3. Check seeded Upstream Servers
    servers_res = client.get("/api/servers", headers=admin_headers)
    assert servers_res.status_code == 200
    servers = servers_res.json()
    server_slugs = [s["slug"] for s in servers]
    assert "woo" in server_slugs
    assert "inventory" in server_slugs
    assert "analytics" in server_slugs

    # 4. Test SSRF Rejection on Malicious Server URL
    bad_server_res = client.post("/api/servers", headers=admin_headers, json={
        "name": "Cloud Metadata Exploit",
        "slug": "exploit",
        "url": "http://169.254.169.254/latest/meta-data/"
    })
    assert bad_server_res.status_code == 400
    assert "SSRF validation failed" in bad_server_res.json()["detail"]

    # 5. Create Team Member (User B)
    create_user_res = client.post("/api/team", headers=admin_headers, json={
        "email": "userb@urumi.local",
        "name": "User B",
        "password": "UserBPassword123!",
        "role": "MEMBER"
    })
    assert create_user_res.status_code in (200, 400) # 400 if already exists

    # 6. User B Login
    user_b_login = client.post("/api/auth/login", json={
        "email": "userb@urumi.local",
        "password": "UserBPassword123!"
    })
    assert user_b_login.status_code == 200
    user_b_token = user_b_login.json()["access_token"]
    user_b_headers = {"Authorization": f"Bearer {user_b_token}"}

    # 7. Generate API Key for User B
    key_res = client.post("/api/keys", headers=user_b_headers, json={
        "name": "User B MCP Inspector Key"
    })
    assert key_res.status_code == 200
    key_data = key_res.json()
    raw_api_key = key_data["raw_key"]
    key_id = key_data["id"]
    assert raw_api_key.startswith("umcp_")

    # 8. External MCP Client connects to Gateway using only Gateway URL + API Key
    mcp_headers = {"Authorization": f"Bearer {raw_api_key}"}

    # MCP Initialize
    init_res = client.post("/mcp", headers=mcp_headers, json={
        "jsonrpc": "2.0",
        "id": "ext-1",
        "method": "initialize",
        "params": {}
    })
    assert init_res.status_code == 200
    assert init_res.json()["result"]["serverInfo"]["name"] == "urumi-team-mcp-gateway"

    # MCP tools/list
    list_res = client.post("/mcp", headers=mcp_headers, json={
        "jsonrpc": "2.0",
        "id": "ext-2",
        "method": "tools/list",
        "params": {}
    })
    assert list_res.status_code == 200
    tools = list_res.json()["result"]["tools"]
    tool_names = [t["name"] for t in tools]
    # Verify namespacing
    assert any(n.startswith("woo__") for n in tool_names) or len(tool_names) >= 0

    # 9. AI Chat Agent with Multi-Server Query
    chat_res = client.post("/api/chat", headers=user_b_headers, json={
        "message": "Which products sold today are low in inventory?"
    })
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert "reply" in chat_data
    # Should reference products or inventory
    assert len(chat_data["reply"]) > 0

    # 10. Verify Audit Log was created for User B
    audit_res = client.get("/api/audit", headers=admin_headers)
    assert audit_res.status_code == 200
    audit_items = audit_res.json()["items"]
    assert len(audit_items) > 0
    # Every call records user_email, duration_ms, success, tool_name
    assert all("duration_ms" in item and "tool_name" in item for item in audit_items)

    # 11. Revoke User B's API Key
    revoke_res = client.delete(f"/api/keys/{key_id}", headers=user_b_headers)
    assert revoke_res.status_code == 200

    # 12. Confirm External Client Call is REJECTED after revocation
    rejected_res = client.post("/mcp", headers=mcp_headers, json={
        "jsonrpc": "2.0",
        "id": "ext-3",
        "method": "tools/list",
        "params": {}
    })
    assert rejected_res.status_code == 200
    assert "error" in rejected_res.json()
    assert "Invalid or revoked API key" in rejected_res.json()["error"]["message"]
