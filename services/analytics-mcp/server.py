import os
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("analytics-mcp")

app = FastAPI(
    title="Urumi Analytics MCP Server",
    description="Streamable HTTP MCP Server delivering sales analytics, conversion rates, and revenue trends",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANALYTICS_DATA = {
    "summary": {
        "total_revenue": 148920.00,
        "total_orders": 314,
        "average_order_value": 474.26,
        "conversion_rate_percent": 3.82,
        "currency": "INR",
        "period": "Last 30 Days"
    },
    "daily_metrics": [
        {"date": "2026-10-04", "revenue": 4520.00, "orders": 12, "visitors": 340},
        {"date": "2026-10-05", "revenue": 5890.00, "orders": 15, "visitors": 410},
        {"date": "2026-10-06", "revenue": 6240.00, "orders": 14, "visitors": 395},
        {"date": "2026-10-07", "revenue": 7180.00, "orders": 18, "visitors": 450},
        {"date": "2026-10-08", "revenue": 2797.00, "orders": 2, "visitors": 210}
    ],
    "top_products": [
        {"product_id": 101, "sku": "KB-MECH-01", "name": "Ergonomic Mechanical Keyboard", "units_sold": 84, "revenue": 125916.00},
        {"product_id": 102, "sku": "MS-WRLS-02", "name": "Wireless Ultra Mouse", "units_sold": 62, "revenue": 49538.00},
        {"product_id": 103, "sku": "HUB-USBC-03", "name": "USB-C Multiport Hub", "units_sold": 55, "revenue": 27445.00}
    ]
}

TOOLS_DEFINITIONS = [
    {
        "name": "get_sales_summary",
        "description": "Get high-level e-commerce revenue, order count, and average order value metrics.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "period": {
                    "type": "string",
                    "description": "Period to summarize (today, 7days, 30days)",
                    "default": "30days"
                }
            }
        }
    },
    {
        "name": "get_daily_metrics",
        "description": "Retrieve day-by-day revenue, order volume, and store visitor traffic.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "Number of recent days to return (1-30)",
                    "default": 5
                }
            }
        }
    },
    {
        "name": "get_top_products",
        "description": "Fetch top-selling products ranked by units sold and generated revenue.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of top products to return",
                    "default": 5
                }
            }
        }
    }
]

@app.get("/health")
def health():
    return {"status": "healthy", "service": "analytics-mcp", "last_updated": datetime.now(timezone.utc).isoformat()}

@app.get("/mcp")
def mcp_info():
    return {
        "protocol": "mcp",
        "version": "1.0",
        "service": "analytics-mcp",
        "transport": "streamable-http",
        "tools_count": len(TOOLS_DEFINITIONS)
    }

@app.post("/mcp")
async def mcp_rpc(request: Request):
    body = await request.json()
    req_id = body.get("id")
    method = body.get("method")
    params = body.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {"name": "analytics-mcp", "version": "1.0.0"}
            }
        }

    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {"tools": TOOLS_DEFINITIONS}
        }

    elif method == "tools/call":
        tool_name = params.get("name")
        args = params.get("arguments", {})

        try:
            if tool_name == "get_sales_summary":
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "structured": ANALYTICS_DATA["summary"]}],
                        "isError": False
                    }
                }

            elif tool_name == "get_daily_metrics":
                days = int(args.get("days", 5))
                metrics = ANALYTICS_DATA["daily_metrics"][-days:]
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "structured": metrics}],
                        "isError": False
                    }
                }

            elif tool_name == "get_top_products":
                limit = int(args.get("limit", 5))
                products = ANALYTICS_DATA["top_products"][:limit]
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "structured": products}],
                        "isError": False
                    }
                }

            else:
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32601, "message": f"Tool '{tool_name}' not found on Analytics MCP"}
                }
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"content": [{"type": "text", "text": str(e)}], "isError": True}
            }

    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Unsupported method: {method}"}}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8003"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
