import os
import logging
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("inventory-mcp")

app = FastAPI(
    title="Urumi Inventory MCP Server",
    description="Streamable HTTP MCP Server managing warehouse inventory and stock thresholds",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INVENTORY_DB = {
    "KB-MECH-01": {
        "sku": "KB-MECH-01",
        "product_id": 101,
        "product_name": "Ergonomic Mechanical Keyboard",
        "stock_quantity": 42,
        "reserved_quantity": 3,
        "available_quantity": 39,
        "low_stock_threshold": 10,
        "warehouse_location": "Aisle-4-Shelf-B",
        "is_low_stock": False
    },
    "MS-WRLS-02": {
        "sku": "MS-WRLS-02",
        "product_id": 102,
        "product_name": "Wireless Ultra Mouse",
        "stock_quantity": 8,
        "reserved_quantity": 2,
        "available_quantity": 6,
        "low_stock_threshold": 15,
        "warehouse_location": "Aisle-2-Shelf-A",
        "is_low_stock": True
    },
    "HUB-USBC-03": {
        "sku": "HUB-USBC-03",
        "product_id": 103,
        "product_name": "USB-C Multiport Hub",
        "stock_quantity": 25,
        "reserved_quantity": 1,
        "available_quantity": 24,
        "low_stock_threshold": 10,
        "warehouse_location": "Aisle-3-Shelf-C",
        "is_low_stock": False
    }
}

TOOLS_DEFINITIONS = [
    {
        "name": "list_inventory",
        "description": "List all warehouse inventory items with stock levels, reserved counts, and low stock warnings.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "low_stock_only": {
                    "type": "boolean",
                    "description": "If true, only returns items whose available stock is at or below the low stock threshold",
                    "default": False
                }
            }
        }
    },
    {
        "name": "get_inventory",
        "description": "Get detailed inventory metadata for a specific SKU or product ID.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sku": {"type": "string", "description": "Stock keeping unit identifier"},
                "product_id": {"type": "integer", "description": "Associated store product ID"}
            }
        }
    },
    {
        "name": "update_inventory",
        "description": "Update warehouse stock quantity or location for an item.",
        "inputSchema": {
            "type": "object",
            "required": ["sku"],
            "properties": {
                "sku": {"type": "string", "description": "Stock keeping unit identifier to update"},
                "quantity_adjustment": {"type": "integer", "description": "Delta to add or subtract (e.g. +10, -5)"},
                "new_stock_quantity": {"type": "integer", "description": "Directly override stock quantity"},
                "warehouse_location": {"type": "string", "description": "Updated bin or shelf location"}
            }
        }
    }
]

@app.get("/health")
def health():
    return {"status": "healthy", "service": "inventory-mcp", "tracked_skus": len(INVENTORY_DB)}

@app.get("/mcp")
def mcp_info():
    return {
        "protocol": "mcp",
        "version": "1.0",
        "service": "inventory-mcp",
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
                "serverInfo": {"name": "inventory-mcp", "version": "1.0.0"}
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
            if tool_name == "list_inventory":
                low_only = args.get("low_stock_only", False)
                items = list(INVENTORY_DB.values())
                if low_only:
                    items = [i for i in items if i["is_low_stock"]]
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "structured": items}],
                        "isError": False
                    }
                }

            elif tool_name == "get_inventory":
                sku = args.get("sku")
                product_id = args.get("product_id")
                found = None
                if sku and sku in INVENTORY_DB:
                    found = INVENTORY_DB[sku]
                elif product_id:
                    for item in INVENTORY_DB.values():
                        if item.get("product_id") == int(product_id):
                            found = item
                            break
                if not found:
                    return {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {
                            "content": [{"type": "text", "text": f"Inventory item not found for sku={sku}, product_id={product_id}"}],
                            "isError": True
                        }
                    }
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "structured": found}],
                        "isError": False
                    }
                }

            elif tool_name == "update_inventory":
                sku = args.get("sku")
                if not sku or sku not in INVENTORY_DB:
                    return {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {
                            "content": [{"type": "text", "text": f"SKU {sku} not found"}],
                            "isError": True
                        }
                    }
                item = INVENTORY_DB[sku]
                if "new_stock_quantity" in args:
                    item["stock_quantity"] = int(args["new_stock_quantity"])
                elif "quantity_adjustment" in args:
                    item["stock_quantity"] += int(args["quantity_adjustment"])
                if "warehouse_location" in args:
                    item["warehouse_location"] = args["warehouse_location"]
                
                item["available_quantity"] = max(0, item["stock_quantity"] - item["reserved_quantity"])
                item["is_low_stock"] = item["available_quantity"] <= item["low_stock_threshold"]

                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "structured": item}],
                        "isError": False
                    }
                }

            else:
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32601, "message": f"Tool '{tool_name}' not found on Inventory MCP"}
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
    port = int(os.getenv("PORT", "8002"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
