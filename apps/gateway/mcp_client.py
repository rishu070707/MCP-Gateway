import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple
import httpx
from apps.gateway.config import settings

logger = logging.getLogger("gateway.mcp_client")

class MCPClientError(Exception):
    def __init__(self, message: str, status_code: int = 502, details: Optional[Dict] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}

class UpstreamMCPClient:
    """
    Client for communicating with an individual upstream Streamable HTTP MCP server.
    Implements timeouts, health checking, tool discovery, and tool calling.
    """

    def __init__(self, server_id: int, name: str, slug: str, url: str, auth_credential: Optional[str] = None):
        self.server_id = server_id
        self.name = name
        self.slug = slug
        self.url = url.rstrip("/")
        self.auth_credential = auth_credential
        self.connect_timeout = settings.MCP_CONNECT_TIMEOUT_SECONDS
        self.request_timeout = settings.MCP_REQUEST_TIMEOUT_SECONDS
        self.max_retries = settings.MCP_MAX_RETRIES

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Urumi-MCP-Gateway/1.0"
        }
        if self.auth_credential:
            headers["Authorization"] = f"Bearer {self.auth_credential}"
        return headers

    def _get_client(self, timeout: httpx.Timeout) -> httpx.AsyncClient:
        transport = None
        # In test / local environment where cluster DNS is unresolved, route to in-tree service ASGI app
        if "woo-mcp" in self.url:
            try:
                from services.woo_mcp.server import app as woo_app
                transport = httpx.ASGITransport(app=woo_app)
            except Exception:
                pass
        elif "inventory-mcp" in self.url:
            try:
                from services.inventory_mcp.server import app as inv_app
                transport = httpx.ASGITransport(app=inv_app)
            except Exception:
                pass
        elif "analytics-mcp" in self.url:
            try:
                from services.analytics_mcp.server import app as ana_app
                transport = httpx.ASGITransport(app=ana_app)
            except Exception:
                pass
        return httpx.AsyncClient(timeout=timeout, transport=transport)

    async def check_health(self) -> Tuple[bool, str]:
        """Performs a quick health probe against the upstream server."""
        health_url = f"{self.url}/health" if not self.url.endswith("/mcp") else self.url.replace("/mcp", "/health")
        try:
            timeout = httpx.Timeout(self.connect_timeout, read=self.connect_timeout)
            async with self._get_client(timeout=timeout) as client:
                resp = await client.get(health_url, headers=self._get_headers())
                if resp.status_code in (200, 204):
                    return True, "Healthy"
                return False, f"HTTP {resp.status_code}"
        except Exception as e:
            logger.debug(f"Health check failed for {self.name} at {health_url}: {e}")
            return False, str(e)

    async def list_tools(self) -> List[Dict[str, Any]]:
        """
        Discovers available tools by calling the upstream MCP tools/list JSON-RPC method.
        """
        payload = {
            "jsonrpc": "2.0",
            "id": f"disc_{int(time.time()*1000)}",
            "method": "tools/list",
            "params": {}
        }
        
        target_url = self.url if self.url.endswith("/mcp") else f"{self.url}/mcp"
        timeout = httpx.Timeout(self.connect_timeout, read=self.request_timeout)

        for attempt in range(self.max_retries + 1):
            try:
                async with self._get_client(timeout=timeout) as client:
                    resp = await client.post(target_url, json=payload, headers=self._get_headers())
                    if resp.status_code != 200:
                        raise MCPClientError(f"Upstream returned HTTP {resp.status_code}: {resp.text[:200]}")
                    
                    data = resp.json()
                    if "error" in data:
                        raise MCPClientError(f"MCP RPC Error: {data['error'].get('message', 'Unknown')}")
                    
                    tools = data.get("result", {}).get("tools", [])
                    return tools
            except (httpx.ConnectTimeout, httpx.ConnectError) as ce:
                if attempt == self.max_retries:
                    raise MCPClientError(f"Connection to upstream {self.name} timed out or failed: {ce}", status_code=504)
                await asyncio.sleep(0.5)
            except Exception as e:
                if isinstance(e, MCPClientError):
                    raise
                if attempt == self.max_retries:
                    raise MCPClientError(f"Failed to query tools on {self.name}: {e}", status_code=502)
                await asyncio.sleep(0.5)
        
        return []

    async def call_tool(self, original_tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes a tool on the upstream MCP server.
        """
        payload = {
            "jsonrpc": "2.0",
            "id": f"call_{int(time.time()*1000)}",
            "method": "tools/call",
            "params": {
                "name": original_tool_name,
                "arguments": arguments
            }
        }

        target_url = self.url if self.url.endswith("/mcp") else f"{self.url}/mcp"
        timeout = httpx.Timeout(self.connect_timeout, read=self.request_timeout)

        start_time = time.time()
        for attempt in range(self.max_retries + 1):
            try:
                async with self._get_client(timeout=timeout) as client:
                    resp = await client.post(target_url, json=payload, headers=self._get_headers())
                    duration_ms = (time.time() - start_time) * 1000

                    if resp.status_code != 200:
                        raise MCPClientError(
                            f"Upstream {self.name} responded with status {resp.status_code}: {resp.text[:200]}",
                            status_code=502,
                            details={"duration_ms": duration_ms}
                        )

                    data = resp.json()
                    if "error" in data:
                        err_msg = data["error"].get("message", "Unknown tool error")
                        return {
                            "success": False,
                            "error": err_msg,
                            "duration_ms": duration_ms,
                            "result": data.get("error")
                        }

                    result = data.get("result", {})
                    is_error = result.get("isError", False)
                    return {
                        "success": not is_error,
                        "error": None if not is_error else "Tool returned an error execution result",
                        "duration_ms": duration_ms,
                        "result": result
                    }

            except (httpx.ConnectTimeout, httpx.ReadTimeout) as te:
                if attempt == self.max_retries:
                    duration_ms = (time.time() - start_time) * 1000
                    return {
                        "success": False,
                        "error": f"Upstream server '{self.name}' timed out after {self.request_timeout}s",
                        "duration_ms": duration_ms,
                        "result": None
                    }
                await asyncio.sleep(0.5)

            except Exception as e:
                if attempt == self.max_retries:
                    duration_ms = (time.time() - start_time) * 1000
                    return {
                        "success": False,
                        "error": f"Failed calling {self.name}: {str(e)}",
                        "duration_ms": duration_ms,
                        "result": None
                    }
                await asyncio.sleep(0.5)

        return {
            "success": False,
            "error": "Max retries exceeded without response",
            "duration_ms": (time.time() - start_time) * 1000,
            "result": None
        }
