import os
import sys
import time
import logging
from typing import Any, Dict, List, Optional
import httpx
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("woo-mcp")

app = FastAPI(
    title="Urumi WooCommerce MCP Server",
    description="Streamable HTTP MCP Server interfacing with WooCommerce REST API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WOO_URL = os.getenv("WOOCOMMERCE_URL", "http://wordpress:80").rstrip("/")
WOO_KEY = os.getenv("WOOCOMMERCE_CONSUMER_KEY", "ck_urumi_demo_consumer_key_12345")
WOO_SECRET = os.getenv("WOOCOMMERCE_CONSUMER_SECRET", "cs_urumi_demo_consumer_secret_67890")
MOCK_FALLBACK = os.getenv("WOOCOMMERCE_MOCK_FALLBACK", "true").lower() in ("1", "true", "yes")

# In-memory realistic store state for sandbox / fallback / instant seeding
DEMO_PRODUCTS = [
    {
        "id": 101,
        "name": "Ergonomic Mechanical Keyboard",
        "slug": "ergonomic-mechanical-keyboard",
        "price": "1499.00",
        "regular_price": "1499.00",
        "status": "publish",
        "sku": "KB-MECH-01",
        "stock_quantity": 42,
        "description": "High-performance hot-swappable mechanical keyboard with RGB backlighting."
    },
    {
        "id": 102,
        "name": "Wireless Ultra Mouse",
        "slug": "wireless-ultra-mouse",
        "price": "799.00",
        "regular_price": "799.00",
        "status": "publish",
        "sku": "MS-WRLS-02",
        "stock_quantity": 8,
        "description": "Ultra-lightweight wireless gaming and productivity mouse."
    },
    {
        "id": 103,
        "name": "USB-C Multiport Hub",
        "slug": "usb-c-multiport-hub",
        "price": "499.00",
        "regular_price": "499.00",
        "status": "publish",
        "sku": "HUB-USBC-03",
        "stock_quantity": 25,
        "description": "7-in-1 aluminium USB-C hub with 4K HDMI and 100W Power Delivery."
    }
]

DEMO_ORDERS = [
    {
        "id": 5001,
        "status": "processing",
        "currency": "INR",
        "date_created": "2026-10-08T10:15:00",
        "total": "2298.00",
        "payment_method": "cod",
        "payment_method_title": "Cash on Delivery",
        "billing": {
            "first_name": "Rishabh",
            "last_name": "Sharma",
            "email": "customer1@example.com",
            "phone": "+919876543210",
            "city": "Bengaluru",
            "country": "IN"
        },
        "line_items": [
            {
                "id": 1,
                "name": "Ergonomic Mechanical Keyboard",
                "product_id": 101,
                "quantity": 1,
                "total": "1499.00",
                "sku": "KB-MECH-01"
            },
            {
                "id": 2,
                "name": "Wireless Ultra Mouse",
                "product_id": 102,
                "quantity": 1,
                "total": "799.00",
                "sku": "MS-WRLS-02"
            }
        ]
    },
    {
        "id": 5002,
        "status": "completed",
        "currency": "INR",
        "date_created": "2026-10-08T11:45:00",
        "total": "499.00",
        "payment_method": "cod",
        "payment_method_title": "Cash on Delivery",
        "billing": {
            "first_name": "Ananya",
            "last_name": "Patel",
            "email": "ananya@example.com",
            "phone": "+919811122233",
            "city": "Mumbai",
            "country": "IN"
        },
        "line_items": [
            {
                "id": 3,
                "name": "USB-C Multiport Hub",
                "product_id": 103,
                "quantity": 1,
                "total": "499.00",
                "sku": "HUB-USBC-03"
            }
        ]
    }
]

TOOLS_DEFINITIONS = [
    {
        "name": "list_products",
        "description": "List products from the WooCommerce catalog with optional status and search filtering.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "description": "Product status filter (publish, draft, pending, any)",
                    "default": "publish"
                },
                "search": {
                    "type": "string",
                    "description": "Search keyword for product name or sku"
                },
                "per_page": {
                    "type": "integer",
                    "description": "Number of items to retrieve (default 10)",
                    "default": 10
                }
            }
        }
    },
    {
        "name": "create_product",
        "description": "Create a new product in the WooCommerce store catalog.",
        "inputSchema": {
            "type": "object",
            "required": ["name", "regular_price"],
            "properties": {
                "name": {"type": "string", "description": "Title/Name of the product"},
                "regular_price": {"type": "string", "description": "Product price in store currency (e.g. '1499')"},
                "description": {"type": "string", "description": "HTML or plain text product description"},
                "sku": {"type": "string", "description": "Unique Stock Keeping Unit code"},
                "stock_quantity": {"type": "integer", "description": "Initial stock quantity", "default": 50}
            }
        }
    },
    {
        "name": "list_orders",
        "description": "Retrieve recent customer orders from WooCommerce.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "description": "Order status filter (processing, completed, pending, cancelled, any)",
                    "default": "any"
                },
                "per_page": {
                    "type": "integer",
                    "description": "Number of orders to retrieve",
                    "default": 10
                }
            }
        }
    },
    {
        "name": "get_order",
        "description": "Fetch detailed information for a specific WooCommerce order by order ID.",
        "inputSchema": {
            "type": "object",
            "required": ["order_id"],
            "properties": {
                "order_id": {"type": "integer", "description": "The unique numerical WooCommerce order ID"}
            }
        }
    },
    {
        "name": "update_order_status",
        "description": "Update the operational status of an existing WooCommerce order.",
        "inputSchema": {
            "type": "object",
            "required": ["order_id", "status"],
            "properties": {
                "order_id": {"type": "integer", "description": "The numerical ID of the order to update"},
                "status": {
                    "type": "string",
                    "description": "New status for the order (pending, processing, on-hold, completed, cancelled, refunded, failed)",
                    "enum": ["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"]
                }
            }
        }
    }
]

async def _call_woocommerce_api(method: str, path: str, json_data: Optional[Dict] = None, params: Optional[Dict] = None) -> Any:
    """Attempts to call real WooCommerce REST API with fallback to local state if unavailable."""
    url = f"{WOO_URL}/wp-json/wc/v3{path}"
    auth = (WOO_KEY, WOO_SECRET)
    
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.request(method, url, auth=auth, json=json_data, params=params)
            if resp.status_code in (200, 201):
                return resp.json()
            logger.warning(f"WooCommerce API returned {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.warning(f"Could not connect to WooCommerce REST API ({e}). Falling back to local state.")

    if not MOCK_FALLBACK:
        raise HTTPException(status_code=502, detail=f"Failed to communicate with WooCommerce at {url}")
    return None

async def execute_list_products(args: Dict[str, Any]) -> List[Dict[str, Any]]:
    remote = await _call_woocommerce_api("GET", "/products", params=args)
    if remote is not None:
        return remote
    
    query = args.get("search", "").lower() if args.get("search") else ""
    status = args.get("status", "publish")
    limit = int(args.get("per_page", 10))
    
    results = []
    for p in DEMO_PRODUCTS:
        if status != "any" and p.get("status") != status:
            continue
        if query and query not in p["name"].lower() and query not in p.get("sku", "").lower():
            continue
        results.append(p)
    return results[:limit]

async def execute_create_product(args: Dict[str, Any]) -> Dict[str, Any]:
    remote = await _call_woocommerce_api("POST", "/products", json_data=args)
    if remote is not None:
        return remote
    
    new_id = max([p["id"] for p in DEMO_PRODUCTS], default=100) + 1
    new_prod = {
        "id": new_id,
        "name": args["name"],
        "slug": args["name"].lower().replace(" ", "-"),
        "price": str(args["regular_price"]),
        "regular_price": str(args["regular_price"]),
        "status": "publish",
        "sku": args.get("sku", f"SKU-{new_id}"),
        "stock_quantity": int(args.get("stock_quantity", 50)),
        "description": args.get("description", "Created via Urumi AI Gateway")
    }
    DEMO_PRODUCTS.append(new_prod)
    return new_prod

async def execute_list_orders(args: Dict[str, Any]) -> List[Dict[str, Any]]:
    remote = await _call_woocommerce_api("GET", "/orders", params=args)
    if remote is not None:
        return remote
    
    status = args.get("status", "any")
    limit = int(args.get("per_page", 10))
    results = [o for o in DEMO_ORDERS if (status == "any" or o["status"] == status)]
    return results[:limit]

async def execute_get_order(args: Dict[str, Any]) -> Dict[str, Any]:
    order_id = int(args["order_id"])
    remote = await _call_woocommerce_api("GET", f"/orders/{order_id}")
    if remote is not None:
        return remote
    
    for o in DEMO_ORDERS:
        if o["id"] == order_id:
            return o
    raise ValueError(f"Order #{order_id} not found")

async def execute_update_order_status(args: Dict[str, Any]) -> Dict[str, Any]:
    order_id = int(args["order_id"])
    new_status = args["status"]
    remote = await _call_woocommerce_api("PUT", f"/orders/{order_id}", json_data={"status": new_status})
    if remote is not None:
        return remote
    
    for o in DEMO_ORDERS:
        if o["id"] == order_id:
            o["status"] = new_status
            return {"id": order_id, "status": new_status, "updated": True}
    raise ValueError(f"Order #{order_id} not found")

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "woo-mcp",
        "woocommerce_url": WOO_URL,
        "mock_fallback": MOCK_FALLBACK
    }

@app.get("/mcp")
def mcp_info():
    """Information endpoint for streamable HTTP MCP discovery."""
    return {
        "protocol": "mcp",
        "version": "1.0",
        "service": "woo-mcp",
        "transport": "streamable-http",
        "tools_count": len(TOOLS_DEFINITIONS)
    }

@app.post("/mcp")
async def mcp_streamable_rpc(request: Request):
    """
    Standard MCP Streamable HTTP / JSON-RPC 2.0 handler.
    Handles initialize, tools/list, and tools/call.
    """
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
                "capabilities": {
                    "tools": {"listChanged": False}
                },
                "serverInfo": {
                    "name": "woo-mcp",
                    "version": "1.0.0"
                }
            }
        }
    
    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": TOOLS_DEFINITIONS
            }
        }
    
    elif method == "tools/call":
        tool_name = params.get("name")
        args = params.get("arguments", {})
        
        try:
            if tool_name == "list_products":
                content = await execute_list_products(args)
            elif tool_name == "create_product":
                content = await execute_create_product(args)
            elif tool_name == "list_orders":
                content = await execute_list_orders(args)
            elif tool_name == "get_order":
                content = await execute_get_order(args)
            elif tool_name == "update_order_status":
                content = await execute_update_order_status(args)
            else:
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {
                        "code": -32601,
                        "message": f"Tool '{tool_name}' not found on WooCommerce MCP server"
                    }
                }
            
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": str(content) if not isinstance(content, (dict, list)) else None,
                            "structured": content
                        }
                    ],
                    "isError": False
                }
            }
        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}")
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": f"Error: {str(e)}"}],
                    "isError": True
                }
            }
    
    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "error": {
            "code": -32601,
            "message": f"Unsupported MCP method: {method}"
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
