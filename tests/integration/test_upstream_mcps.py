import pytest
from starlette.testclient import TestClient

from services.woo_mcp.server import app as woo_app
from services.inventory_mcp.server import app as inventory_app
from services.analytics_mcp.server import app as analytics_app

def test_woo_mcp_streamable_protocol():
    client = TestClient(woo_app)

    # 1. Health check
    h_resp = client.get("/health")
    assert h_resp.status_code == 200
    assert h_resp.json()["status"] == "healthy"

    # 2. MCP Initialize
    init_resp = client.post("/mcp", json={
        "jsonrpc": "2.0",
        "id": "1",
        "method": "initialize",
        "params": {}
    })
    assert init_resp.status_code == 200
    assert init_resp.json()["result"]["serverInfo"]["name"] == "woo-mcp"

    # 3. Tools list
    list_resp = client.post("/mcp", json={
        "jsonrpc": "2.0",
        "id": "2",
        "method": "tools/list",
        "params": {}
    })
    assert list_resp.status_code == 200
    tool_names = [t["name"] for t in list_resp.json()["result"]["tools"]]
    assert "list_products" in tool_names
    assert "create_product" in tool_names
    assert "list_orders" in tool_names
    assert "get_order" in tool_names
    assert "update_order_status" in tool_names

    # 4. Call list_products
    call_resp = client.post("/mcp", json={
        "jsonrpc": "2.0",
        "id": "3",
        "method": "tools/call",
        "params": {"name": "list_products", "arguments": {"per_page": 2}}
    })
    assert call_resp.status_code == 200
    products = call_resp.json()["result"]["content"][0]["structured"]
    assert len(products) > 0
    assert "name" in products[0]

    # 5. Call create_product
    create_resp = client.post("/mcp", json={
        "jsonrpc": "2.0",
        "id": "4",
        "method": "tools/call",
        "params": {"name": "create_product", "arguments": {"name": "Test Wireless Mouse", "regular_price": "899.00"}}
    })
    assert create_resp.status_code == 200
    created = create_resp.json()["result"]["content"][0]["structured"]
    assert created["name"] == "Test Wireless Mouse"
    assert created["price"] == "899.00"

def test_inventory_mcp_streamable_protocol():
    client = TestClient(inventory_app)

    # Tools list
    list_resp = client.post("/mcp", json={
        "jsonrpc": "2.0",
        "id": "1",
        "method": "tools/list",
        "params": {}
    })
    assert list_resp.status_code == 200
    tool_names = [t["name"] for t in list_resp.json()["result"]["tools"]]
    assert "list_inventory" in tool_names
    assert "get_inventory" in tool_names
    assert "update_inventory" in tool_names

    # Call list_inventory (check low stock item)
    call_resp = client.post("/mcp", json={
        "jsonrpc": "2.0",
        "id": "2",
        "method": "tools/call",
        "params": {"name": "list_inventory", "arguments": {"low_stock_only": True}}
    })
    assert call_resp.status_code == 200
    low_items = call_resp.json()["result"]["content"][0]["structured"]
    assert len(low_items) >= 1
    assert any(i["sku"] == "MS-WRLS-02" for i in low_items)

def test_analytics_mcp_streamable_protocol():
    client = TestClient(analytics_app)

    # Tools list
    list_resp = client.post("/mcp", json={
        "jsonrpc": "2.0",
        "id": "1",
        "method": "tools/list",
        "params": {}
    })
    assert list_resp.status_code == 200
    tool_names = [t["name"] for t in list_resp.json()["result"]["tools"]]
    assert "get_sales_summary" in tool_names
    assert "get_daily_metrics" in tool_names
    assert "get_top_products" in tool_names

    # Call get_sales_summary
    call_resp = client.post("/mcp", json={
        "jsonrpc": "2.0",
        "id": "2",
        "method": "tools/call",
        "params": {"name": "get_sales_summary", "arguments": {}}
    })
    assert call_resp.status_code == 200
    summary = call_resp.json()["result"]["content"][0]["structured"]
    assert summary["total_orders"] == 314
    assert summary["currency"] == "INR"
