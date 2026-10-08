import pytest
from starlette.testclient import TestClient

from apps.gateway.main import app
from apps.gateway.config import settings

def test_fourteen_step_e2e_verification():
    client = TestClient(app)

    # 1. Admin login
    res = client.post("/api/auth/login", json={
        "email": settings.ADMIN_EMAIL,
        "password": settings.ADMIN_PASSWORD
    })
    assert res.status_code == 200
    admin_token = res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. See Woo server
    srv_res = client.get("/api/servers", headers=admin_headers)
    assert srv_res.status_code == 200
    servers = srv_res.json()
    assert any(s["slug"] == "woo" for s in servers)

    # 3. Add MCP server
    add_res = client.post("/api/servers", headers=admin_headers, json={
        "name": "Custom Test MCP",
        "slug": "custom_test",
        "url": "http://inventory-mcp:8002/mcp"
    })
    assert add_res.status_code in (200, 400) # 400 if already exists

    # 4. Enable / Disable server
    woo_srv = next(s for s in servers if s["slug"] == "woo")
    toggle_res = client.patch(f"/api/servers/{woo_srv['id']}/toggle", headers=admin_headers)
    assert toggle_res.status_code == 200
    # Toggle back to enabled
    client.patch(f"/api/servers/{woo_srv['id']}/toggle", headers=admin_headers)

    # 5. Create member (User B)
    client.post("/api/team", headers=admin_headers, json={
        "email": "user_e2e@urumi.local",
        "name": "User E2E",
        "password": "Password123!",
        "role": "MEMBER"
    })

    # 6. Login member
    login_b = client.post("/api/auth/login", json={
        "email": "user_e2e@urumi.local",
        "password": "Password123!"
    })
    assert login_b.status_code == 200
    b_token = login_b.json()["access_token"]
    b_headers = {"Authorization": f"Bearer {b_token}"}

    # 7. Generate API key for User B
    key_gen = client.post("/api/keys", headers=b_headers, json={"name": "E2E Key"})
    assert key_gen.status_code == 200
    key_info = key_gen.json()
    b_api_key = key_info["raw_key"]
    b_key_id = key_info["id"]

    # 8. Connect external MCP client with gateway URL + API key
    ext_headers = {"Authorization": f"Bearer {b_api_key}"}
    init_res = client.post("/mcp", headers=ext_headers, json={
        "jsonrpc": "2.0",
        "id": "e2e-1",
        "method": "initialize",
        "params": {}
    })
    assert init_res.status_code == 200

    # 9. Discover tools
    tools_res = client.post("/mcp", headers=ext_headers, json={
        "jsonrpc": "2.0",
        "id": "e2e-2",
        "method": "tools/list",
        "params": {}
    })
    assert tools_res.status_code == 200

    # 10. Call tools through Gateway
    call_res = client.post("/mcp", headers=ext_headers, json={
        "jsonrpc": "2.0",
        "id": "e2e-3",
        "method": "tools/call",
        "params": {
            "name": "inventory__list_inventory",
            "arguments": {"low_stock_only": False}
        }
    })
    assert call_res.status_code == 200

    # 11. Revoke key
    rev_res = client.delete(f"/api/keys/{b_key_id}", headers=b_headers)
    assert rev_res.status_code == 200

    # 12. Confirm rejection
    rej_res = client.post("/mcp", headers=ext_headers, json={
        "jsonrpc": "2.0",
        "id": "e2e-4",
        "method": "tools/list",
        "params": {}
    })
    assert rej_res.status_code == 200
    assert "error" in rej_res.json()

    # 13. Chat tool loop (e.g. multi-server query)
    chat_res = client.post("/api/chat", headers=b_headers, json={
        "message": "Which products sold today are low in inventory?"
    })
    assert chat_res.status_code == 200
    assert len(chat_res.json()["reply"]) > 0

    # 14. Audit verification
    audit_res = client.get("/api/audit", headers=admin_headers)
    assert audit_res.status_code == 200
    items = audit_res.json()["items"]
    assert len(items) > 0
    # Every audit item has user, server, tool, duration, outcome
    latest = items[0]
    assert "user_email" in latest
    assert "duration_ms" in latest
    assert "tool_name" in latest
    assert "success" in latest
