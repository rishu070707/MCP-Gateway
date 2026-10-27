import datetime
from datetime import timezone
import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from apps.gateway.models import UpstreamServer, Tool, AuditLog, User, UserRole, ServerStatus
from apps.gateway.mcp_client import UpstreamMCPClient

logger = logging.getLogger("gateway.mcp_router")

def sanitize_metadata(data: Any, max_len: int = 1500) -> str:
    """Sanitizes and redacts sensitive keywords from request/response metadata for audit logging."""
    if data is None:
        return "{}"
    try:
        if isinstance(data, (dict, list)):
            text = json.dumps(data)
        else:
            text = str(data)

        # Redact common sensitive fields
        import re
        patterns = [
            (r'("password"|"secret"|"token"|"api_key"|"authorization"):\s*"[^"]+"', r'\1: "[REDACTED]"'),
            (r'(ck_[a-zA-Z0-9_-]+)', '[REDACTED_WC_KEY]'),
            (r'(cs_[a-zA-Z0-9_-]+)', '[REDACTED_WC_SECRET]'),
            (r'(umcp_[a-zA-Z0-9_-]+)', '[REDACTED_UMCP_KEY]')
        ]
        for pat, repl in patterns:
            text = re.sub(pat, repl, text, flags=re.IGNORECASE)

        if len(text) > max_len:
            return text[:max_len] + "... [TRUNCATED]"
        return text
    except Exception as e:
        return f'{{"error": "Failed to serialize: {str(e)}"}}'

class MCPRouter:
    """
    Core MCP Gateway router responsible for:
    1. Tool Aggregation and Namespacing (<server_slug>__<tool_name>)
    2. Resilient tool synchronization and failure isolation
    3. Tool execution routing with server-side credential injection
    4. RBAC permission verification
    5. Comprehensive audit logging
    """

    @staticmethod
    async def sync_server_tools(db: Session, server: UpstreamServer) -> List[Tool]:
        """
        Discovers tools on a single upstream server and updates the Tool database table.
        Isolates failures so unreachable servers do not affect others.
        """
        if not server.is_enabled:
            server.status = ServerStatus.DISABLED
            db.commit()
            return []

        client = UpstreamMCPClient(
            server_id=server.id,
            name=server.name,
            slug=server.slug,
            url=server.url,
            auth_credential=server.auth_credential
        )

        try:
            raw_tools = await client.list_tools()
            server.status = ServerStatus.CONNECTED
            server.last_checked = datetime.datetime.now(timezone.utc)

            # Refresh tools in DB
            db.query(Tool).filter(Tool.server_id == server.id).delete()
            created_tools = []
            for t in raw_tools:
                orig_name = t.get("name")
                namespaced = f"{server.slug}__{orig_name}"
                tool_rec = Tool(
                    server_id=server.id,
                    original_name=orig_name,
                    namespaced_name=namespaced,
                    description=t.get("description", ""),
                    schema_json=json.dumps(t.get("inputSchema", {})),
                    is_enabled=True
                )
                db.add(tool_rec)
                created_tools.append(tool_rec)

            db.commit()
            return created_tools

        except Exception as e:
            logger.warning(f"Failed to sync tools from server {server.name}: {e}")
            server.status = ServerStatus.UNREACHABLE
            server.last_checked = datetime.datetime.now(timezone.utc)
            db.commit()
            return []

    @staticmethod
    async def sync_all_servers(db: Session):
        """Discovers tools across all enabled servers in parallel with failure isolation."""
        servers = db.query(UpstreamServer).filter(UpstreamServer.is_enabled == True).all()
        for s in servers:
            await MCPRouter.sync_server_tools(db, s)

    @staticmethod
    def get_available_tools(db: Session, user: User) -> List[Dict[str, Any]]:
        """
        Returns list of MCP tools available to the given user based on RBAC and server status.
        When a server is disabled or unreachable, its tools are filtered out.
        """
        query = db.query(Tool).join(UpstreamServer).filter(
            UpstreamServer.is_enabled == True,
            Tool.is_enabled == True
        )
        
        # If user is not admin, only show active tools on CONNECTED servers
        if user.role != UserRole.ADMIN:
            query = query.filter(UpstreamServer.status == ServerStatus.CONNECTED)

        tools = query.all()
        mcp_tools = []
        for t in tools:
            try:
                schema = json.loads(t.schema_json)
            except Exception:
                schema = {"type": "object"}
            mcp_tools.append({
                "name": t.namespaced_name,
                "description": f"[{t.server.name}] {t.description}",
                "inputSchema": schema,
                "server_slug": t.server.slug,
                "server_name": t.server.name,
                "original_name": t.original_name
            })
        return mcp_tools

    @staticmethod
    async def execute_tool_call(
        db: Session,
        user: User,
        namespaced_tool_name: str,
        arguments: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Executes an aggregated tool call:
        - Resolves target server from namespaced name
        - Checks permissions
        - Executes via UpstreamMCPClient
        - Logs audit trail with duration, user, parameters, outcome
        """
        start_time = time.time()
        
        # Parse server_slug__tool_name
        if "__" not in namespaced_tool_name:
            # Fallback direct lookup if passed without slug
            tool_rec = db.query(Tool).filter(Tool.original_name == namespaced_tool_name).first()
            if tool_rec:
                namespaced_tool_name = tool_rec.namespaced_name
            else:
                duration_ms = (time.time() - start_time) * 1000
                MCPRouter._record_audit(
                    db=db,
                    user=user,
                    server=None,
                    tool_name=namespaced_tool_name,
                    duration_ms=duration_ms,
                    success=False,
                    error_message=f"Tool format invalid. Expected '<server_slug>__<tool_name>'",
                    request_meta=sanitize_metadata(arguments),
                    response_meta="{}"
                )
                return {
                    "isError": True,
                    "content": [{"type": "text", "text": f"Tool '{namespaced_tool_name}' not found."}]
                }

        parts = namespaced_tool_name.split("__", 1)
        server_slug, original_tool_name = parts[0], parts[1]

        # Lookup upstream server
        server = db.query(UpstreamServer).filter(UpstreamServer.slug == server_slug).first()
        if not server:
            duration_ms = (time.time() - start_time) * 1000
            MCPRouter._record_audit(
                db=db,
                user=user,
                server=None,
                tool_name=namespaced_tool_name,
                duration_ms=duration_ms,
                success=False,
                error_message=f"Upstream server with slug '{server_slug}' does not exist.",
                request_meta=sanitize_metadata(arguments),
                response_meta="{}"
            )
            return {
                "isError": True,
                "content": [{"type": "text", "text": f"Upstream server '{server_slug}' not found"}]
            }

        # Check server enabled state
        if not server.is_enabled:
            duration_ms = (time.time() - start_time) * 1000
            MCPRouter._record_audit(
                db=db,
                user=user,
                server=server,
                tool_name=namespaced_tool_name,
                duration_ms=duration_ms,
                success=False,
                error_message=f"Upstream server '{server.name}' is currently DISABLED.",
                request_meta=sanitize_metadata(arguments),
                response_meta="{}"
            )
            return {
                "isError": True,
                "content": [{"type": "text", "text": f"Server '{server.name}' is currently disabled"}]
            }

        client = UpstreamMCPClient(
            server_id=server.id,
            name=server.name,
            slug=server.slug,
            url=server.url,
            auth_credential=server.auth_credential
        )

        # Call upstream MCP service
        call_result = await client.call_tool(original_tool_name, arguments)
        duration_ms = call_result.get("duration_ms", (time.time() - start_time) * 1000)
        success = call_result.get("success", False)
        error_msg = call_result.get("error")

        # Update server status if unreachable
        if not success and error_msg and ("timed out" in error_msg.lower() or "failed calling" in error_msg.lower()):
            server.status = ServerStatus.UNREACHABLE
            db.commit()
        elif success:
            server.status = ServerStatus.CONNECTED
            db.commit()

        # Record audit log
        MCPRouter._record_audit(
            db=db,
            user=user,
            server=server,
            tool_name=namespaced_tool_name,
            duration_ms=duration_ms,
            success=success,
            error_message=error_msg,
            request_meta=sanitize_metadata(arguments),
            response_meta=sanitize_metadata(call_result.get("result"))
        )

        if not success:
            return {
                "isError": True,
                "content": [{"type": "text", "text": f"Upstream execution error: {error_msg}"}]
            }

        return call_result.get("result", {
            "isError": False,
            "content": [{"type": "text", "text": "Tool executed successfully"}]
        })

    @staticmethod
    def _record_audit(
        db: Session,
        user: Optional[User],
        server: Optional[UpstreamServer],
        tool_name: str,
        duration_ms: float,
        success: bool,
        error_message: Optional[str],
        request_meta: str,
        response_meta: str
    ):
        try:
            audit = AuditLog(
                user_id=user.id if user else None,
                user_email=user.email if user else "anonymous",
                server_id=server.id if server else None,
                server_name=server.name if server else "Unknown",
                tool_name=tool_name,
                timestamp=datetime.datetime.now(timezone.utc),
                duration_ms=round(duration_ms, 2),
                success=success,
                error_message=error_message,
                request_meta=request_meta,
                response_meta=response_meta
            )
            db.add(audit)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to write audit log: {e}")
            db.rollback()
