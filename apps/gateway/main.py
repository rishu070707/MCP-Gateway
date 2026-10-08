import asyncio
import datetime
import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from apps.gateway.config import settings
from apps.gateway.database import Base, engine, get_db, SessionLocal
from apps.gateway.models import User, APIKey, UpstreamServer, Tool, AuditLog, ChatSession, ChatMessage, UserRole, ServerStatus
from apps.gateway.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
    generate_api_key,
    hash_api_key,
    validate_mcp_url
)
from apps.gateway.mcp_client import UpstreamMCPClient
from apps.gateway.mcp_router import MCPRouter
from apps.gateway.agent import AIChatAgent

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("gateway.main")

# Initialize database schema
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Urumi AI — Team MCP Gateway",
    description="Production-grade Kubernetes MCP Gateway aggregating WooCommerce, Inventory, and Analytics tools with RBAC and Audit logging",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security_bearer = HTTPBearer(auto_error=False)

# -----------------------------------------------------------------------------
# Dependency: Authentication & RBAC
# -----------------------------------------------------------------------------

def get_current_user_from_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> User:
    """Authenticates request via Bearer JWT token or Bearer API key (umcp_...)."""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    
    token = credentials.credentials.strip()

    # Check if API Key format: umcp_...
    if token.startswith("umcp_"):
        key_hash = hash_api_key(token)
        api_key = db.query(APIKey).filter(APIKey.key_hash == key_hash, APIKey.active == True).first()
        if not api_key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or revoked API key")
        
        user = db.query(User).filter(User.id == api_key.user_id, User.active == True).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User associated with API key not found or inactive")
        return user

    # Otherwise treat as JWT token
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token")
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id), User.active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account disabled or not found")
    return user

def require_admin(current_user: User = Depends(get_current_user_from_auth)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator privileges required")
    return current_user

# -----------------------------------------------------------------------------
# Schemas
# -----------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: str = UserRole.MEMBER

class ServerCreate(BaseModel):
    name: str
    slug: str
    url: str
    auth_credential: Optional[str] = None

class ServerUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    auth_credential: Optional[str] = None
    is_enabled: Optional[bool] = None

class APIKeyCreate(BaseModel):
    name: str = "My Gateway Key"

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[int] = None

def seed_defaults():
    db = SessionLocal()
    try:
        # 1. Seed Admin
        admin = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
        if not admin:
            admin = User(
                email=settings.ADMIN_EMAIL,
                name=settings.ADMIN_NAME,
                password_hash=get_password_hash(settings.ADMIN_PASSWORD),
                role=UserRole.ADMIN,
                active=True
            )
            db.add(admin)
            db.commit()
            logger.info(f"Seeded Admin user: {admin.email}")

        # 2. Seed Default Upstream Servers
        default_servers = [
            {"name": "WooCommerce Store", "slug": "woo", "url": settings.WOO_MCP_URL},
            {"name": "Warehouse Inventory", "slug": "inventory", "url": settings.INVENTORY_MCP_URL},
            {"name": "Sales Analytics", "slug": "analytics", "url": settings.ANALYTICS_MCP_URL},
        ]
        for s_data in default_servers:
            existing = db.query(UpstreamServer).filter(UpstreamServer.slug == s_data["slug"]).first()
            if not existing:
                srv = UpstreamServer(
                    name=s_data["name"],
                    slug=s_data["slug"],
                    url=s_data["url"],
                    is_enabled=True,
                    status=ServerStatus.CONNECTED
                )
                db.add(srv)
                db.commit()
                logger.info(f"Seeded upstream server: {srv.name} ({srv.slug}) at {srv.url}")
    finally:
        db.close()

seed_defaults()

@app.on_event("startup")
async def startup_event():
    seed_defaults()
    db = SessionLocal()
    try:
        asyncio.create_task(MCPRouter.sync_all_servers(db))
    finally:
        db.close()

# -----------------------------------------------------------------------------
# Health Check
# -----------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "urumi-mcp-gateway",
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

# -----------------------------------------------------------------------------
# Auth API
# -----------------------------------------------------------------------------

@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    
    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role
        }
    }

@app.get("/api/auth/me")
def get_me(user: User = Depends(get_current_user_from_auth)):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role
    }

# -----------------------------------------------------------------------------
# Upstream Server Management (Admin only)
# -----------------------------------------------------------------------------

@app.get("/api/servers")
def list_servers(
    user: User = Depends(get_current_user_from_auth),
    db: Session = Depends(get_db)
):
    servers = db.query(UpstreamServer).all()
    results = []
    for s in servers:
        tool_count = db.query(Tool).filter(Tool.server_id == s.id).count()
        results.append({
            "id": s.id,
            "name": s.name,
            "slug": s.slug,
            "url": s.url,
            "status": s.status,
            "is_enabled": s.is_enabled,
            "tools_count": tool_count,
            "has_auth": bool(s.auth_credential),
            "last_checked": s.last_checked.isoformat() if s.last_checked else None,
            "created_at": s.created_at.isoformat()
        })
    return results

@app.post("/api/servers")
async def create_server(
    req: ServerCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    # SSRF Validation
    is_valid, msg = validate_mcp_url(req.url)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"SSRF validation failed: {msg}")

    # Check slug collision
    if db.query(UpstreamServer).filter((UpstreamServer.slug == req.slug) | (UpstreamServer.name == req.name)).first():
        raise HTTPException(status_code=400, detail="Server name or slug already exists")

    server = UpstreamServer(
        name=req.name,
        slug=req.slug.lower().strip(),
        url=req.url.strip(),
        auth_credential=req.auth_credential,
        status=ServerStatus.CONNECTED,
        is_enabled=True
    )
    db.add(server)
    db.commit()
    db.refresh(server)

    # Sync tools immediately
    await MCPRouter.sync_server_tools(db, server)

    return {"message": "Server created successfully", "id": server.id, "slug": server.slug}

@app.patch("/api/servers/{server_id}/toggle")
async def toggle_server(
    server_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    server = db.query(UpstreamServer).filter(UpstreamServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    server.is_enabled = not server.is_enabled
    if not server.is_enabled:
        server.status = ServerStatus.DISABLED
    else:
        server.status = ServerStatus.CONNECTED
        await MCPRouter.sync_server_tools(db, server)

    db.commit()
    return {"id": server.id, "is_enabled": server.is_enabled, "status": server.status}

@app.delete("/api/servers/{server_id}")
def delete_server(
    server_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    server = db.query(UpstreamServer).filter(UpstreamServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    db.delete(server)
    db.commit()
    return {"message": "Server deleted successfully"}

@app.post("/api/servers/{server_id}/test")
async def test_server_connection(
    server_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    server = db.query(UpstreamServer).filter(UpstreamServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    tools = await MCPRouter.sync_server_tools(db, server)
    return {
        "status": server.status,
        "tools_discovered": len(tools),
        "last_checked": server.last_checked.isoformat() if server.last_checked else None
    }

# -----------------------------------------------------------------------------
# Tools API
# -----------------------------------------------------------------------------

@app.get("/api/tools")
def get_tools(
    user: User = Depends(get_current_user_from_auth),
    db: Session = Depends(get_db)
):
    tools = MCPRouter.get_available_tools(db, user)
    return tools

# -----------------------------------------------------------------------------
# Team Management (Admin only)
# -----------------------------------------------------------------------------

@app.get("/api/team")
def get_team(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    results = []
    for u in users:
        key_count = db.query(APIKey).filter(APIKey.user_id == u.id, APIKey.active == True).count()
        results.append({
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "active": u.active,
            "active_keys": key_count,
            "created_at": u.created_at.isoformat()
        })
    return results

@app.post("/api/team")
def create_team_member(
    req: UserCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=req.email,
        name=req.name,
        password_hash=get_password_hash(req.password),
        role=req.role if req.role in (UserRole.ADMIN, UserRole.MEMBER) else UserRole.MEMBER,
        active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"id": new_user.id, "email": new_user.email, "name": new_user.name, "role": new_user.role}

# -----------------------------------------------------------------------------
# API Keys (Per-user, cryptographic hashing, reveal raw key once)
# -----------------------------------------------------------------------------

@app.get("/api/keys")
def list_api_keys(
    user: User = Depends(get_current_user_from_auth),
    db: Session = Depends(get_db)
):
    keys = db.query(APIKey).filter(APIKey.user_id == user.id).order_by(APIKey.created_at.desc()).all()
    return [
        {
            "id": k.id,
            "name": k.name,
            "prefix": k.key_prefix,
            "active": k.active,
            "created_at": k.created_at.isoformat(),
            "revoked_at": k.revoked_at.isoformat() if k.revoked_at else None
        }
        for k in keys
    ]

@app.post("/api/keys")
def create_api_key(
    req: APIKeyCreate,
    user: User = Depends(get_current_user_from_auth),
    db: Session = Depends(get_db)
):
    raw_key, prefix, key_hash = generate_api_key()
    api_key_rec = APIKey(
        user_id=user.id,
        name=req.name,
        key_prefix=prefix,
        key_hash=key_hash,
        active=True
    )
    db.add(api_key_rec)
    db.commit()
    db.refresh(api_key_rec)

    # Raw key is ONLY shown once upon creation!
    return {
        "id": api_key_rec.id,
        "name": api_key_rec.name,
        "raw_key": raw_key,
        "prefix": prefix,
        "message": "Copy this key now. It will never be shown again!"
    }

@app.delete("/api/keys/{key_id}")
def revoke_api_key(
    key_id: int,
    user: User = Depends(get_current_user_from_auth),
    db: Session = Depends(get_db)
):
    api_key = db.query(APIKey).filter(APIKey.id == key_id, APIKey.user_id == user.id).first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API Key not found")

    api_key.active = False
    api_key.revoked_at = datetime.datetime.utcnow()
    db.commit()
    return {"message": "API Key revoked successfully"}

# -----------------------------------------------------------------------------
# Audit Logs
# -----------------------------------------------------------------------------

@app.get("/api/audit")
def list_audit_logs(
    user_id: Optional[int] = None,
    server_slug: Optional[str] = None,
    tool_name: Optional[str] = None,
    status_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: User = Depends(get_current_user_from_auth),
    db: Session = Depends(get_db)
):
    # Member only views their own audit records, Admin can view all
    query = db.query(AuditLog)
    if user.role != UserRole.ADMIN:
        query = query.filter(AuditLog.user_id == user.id)
    elif user_id:
        query = query.filter(AuditLog.user_id == user_id)

    if tool_name:
        query = query.filter(AuditLog.tool_name.contains(tool_name))
    if status_filter == "success":
        query = query.filter(AuditLog.success == True)
    elif status_filter == "failed":
        query = query.filter(AuditLog.success == False)

    total = query.count()
    logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "items": [
            {
                "id": l.id,
                "timestamp": l.timestamp.isoformat(),
                "user_email": l.user_email,
                "server_name": l.server_name,
                "tool_name": l.tool_name,
                "duration_ms": l.duration_ms,
                "success": l.success,
                "error_message": l.error_message,
                "request_meta": l.request_meta,
                "response_meta": l.response_meta
            }
            for l in logs
        ]
    }

@app.get("/api/audit/stats")
def audit_stats(
    user: User = Depends(get_current_user_from_auth),
    db: Session = Depends(get_db)
):
    today = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_calls = db.query(AuditLog).filter(AuditLog.timestamp >= today).count()
    today_failed = db.query(AuditLog).filter(AuditLog.timestamp >= today, AuditLog.success == False).count()
    total_tools = db.query(Tool).filter(Tool.is_enabled == True).count()
    connected_servers = db.query(UpstreamServer).filter(UpstreamServer.status == ServerStatus.CONNECTED).count()
    team_members = db.query(User).filter(User.active == True).count()

    return {
        "connected_servers": connected_servers,
        "total_tools": total_tools,
        "team_members": team_members,
        "calls_today": today_calls,
        "failed_calls_today": today_failed
    }

# -----------------------------------------------------------------------------
# AI Chat Agent
# -----------------------------------------------------------------------------

@app.post("/api/chat")
async def chat_turn(
    req: ChatRequest,
    user: User = Depends(get_current_user_from_auth),
    db: Session = Depends(get_db)
):
    session = None
    if req.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == req.session_id, ChatSession.user_id == user.id).first()
    
    if not session:
        title = req.message[:40] + ("..." if len(req.message) > 40 else "")
        session = ChatSession(user_id=user.id, title=title)
        db.add(session)
        db.commit()
        db.refresh(session)

    # Save user message
    user_msg_rec = ChatMessage(session_id=session.id, role="user", content=req.message)
    db.add(user_msg_rec)
    db.commit()

    # Load history
    history = [
        {"role": m.role, "content": m.content}
        for m in session.messages if m.id != user_msg_rec.id
    ]

    agent = AIChatAgent(db, user)
    agent_result = await agent.run_turn(req.message, chat_history=history)

    # Save assistant message
    tool_calls_json = json.dumps(agent_result.get("tool_calls", []))
    asst_msg_rec = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=agent_result.get("content", ""),
        tool_calls_json=tool_calls_json
    )
    db.add(asst_msg_rec)
    db.commit()

    return {
        "session_id": session.id,
        "reply": agent_result.get("content"),
        "tool_calls": agent_result.get("tool_calls", [])
    }

@app.get("/api/chat/sessions")
def list_chat_sessions(
    user: User = Depends(get_current_user_from_auth),
    db: Session = Depends(get_db)
):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == user.id).order_by(ChatSession.created_at.desc()).all()
    return [
        {"id": s.id, "title": s.title, "created_at": s.created_at.isoformat()}
        for s in sessions
    ]

@app.get("/api/chat/sessions/{session_id}")
def get_chat_session(
    session_id: int,
    user: User = Depends(get_current_user_from_auth),
    db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    messages = []
    for m in session.messages:
        tool_calls = json.loads(m.tool_calls_json) if m.tool_calls_json else []
        messages.append({
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "tool_calls": tool_calls,
            "created_at": m.created_at.isoformat()
        })
    return {"id": session.id, "title": session.title, "messages": messages}

# -----------------------------------------------------------------------------
# Gateway MCP Protocol Endpoint (Streamable HTTP / JSON-RPC 2.0)
# Supports MCP Inspector, Claude Code, Cursor with Gateway URL + API Key
# -----------------------------------------------------------------------------

@app.get("/mcp")
def mcp_server_info():
    return {
        "protocol": "mcp",
        "version": "1.0",
        "service": "urumi-team-mcp-gateway",
        "transport": "streamable-http",
        "auth_required": True
    }

@app.post("/mcp")
async def gateway_mcp_rpc(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Standard MCP Streamable HTTP endpoint for external clients.
    Authenticates via Authorization: Bearer <API_KEY> or Bearer <JWT>.
    Routes tools/call to upstream servers with full RBAC, namespacing, and auditing.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return {
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32000, "message": "Unauthorized. Bearer API key or token required"}
        }

    token = authorization.replace("Bearer ", "").strip()
    user = None

    if token.startswith("umcp_"):
        key_hash = hash_api_key(token)
        api_key = db.query(APIKey).filter(APIKey.key_hash == key_hash, APIKey.active == True).first()
        if not api_key:
            return {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32000, "message": "Invalid or revoked API key"}
            }
        user = db.query(User).filter(User.id == api_key.user_id, User.active == True).first()
    else:
        payload = decode_access_token(token)
        if payload:
            user = db.query(User).filter(User.id == int(payload["sub"]), User.active == True).first()

    if not user:
        return {
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32000, "message": "Unauthorized access"}
        }

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
                    "tools": {"listChanged": True}
                },
                "serverInfo": {
                    "name": "urumi-team-mcp-gateway",
                    "version": "1.0.0"
                }
            }
        }

    elif method == "tools/list":
        tools = MCPRouter.get_available_tools(db, user)
        # Convert to standard MCP tool format
        clean_tools = [
            {
                "name": t["name"],
                "description": t["description"],
                "inputSchema": t["inputSchema"]
            }
            for t in tools
        ]
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": clean_tools
            }
        }

    elif method == "tools/call":
        tool_name = params.get("name")
        arguments = params.get("arguments", {})

        result = await MCPRouter.execute_tool_call(db, user, tool_name, arguments)
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": result
        }

    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "error": {"code": -32601, "message": f"Unsupported method: {method}"}
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.gateway.main:app", host=settings.GATEWAY_HOST, port=settings.GATEWAY_PORT, reload=False)
