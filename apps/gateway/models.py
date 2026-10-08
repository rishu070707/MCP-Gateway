import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Text, Index
from sqlalchemy.orm import relationship
from apps.gateway.database import Base

class UserRole:
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"

class ServerStatus:
    CONNECTED = "CONNECTED"
    UNREACHABLE = "UNREACHABLE"
    DISABLED = "DISABLED"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default=UserRole.MEMBER, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")

class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), default="Default Key", nullable=False)
    key_prefix = Column(String(20), nullable=False)  # e.g., umcp_ab12...
    key_hash = Column(String(128), unique=True, index=True, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    revoked_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="api_keys")

class UpstreamServer(Base):
    __tablename__ = "upstream_servers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    slug = Column(String(50), unique=True, index=True, nullable=False) # e.g. 'woo', 'inventory'
    url = Column(String(500), nullable=False)
    auth_credential = Column(String(500), nullable=True) # Kept strictly server-side
    status = Column(String(50), default=ServerStatus.CONNECTED, nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    last_checked = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    tools = relationship("Tool", back_populates="server", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="server")

class Tool(Base):
    __tablename__ = "tools"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("upstream_servers.id"), nullable=False, index=True)
    original_name = Column(String(100), nullable=False)
    namespaced_name = Column(String(150), unique=True, index=True, nullable=False) # <server_slug>__<tool_name>
    description = Column(Text, nullable=True)
    schema_json = Column(Text, nullable=False) # JSON schema for tool inputs
    is_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    server = relationship("UpstreamServer", back_populates="tools")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    user_email = Column(String(255), nullable=True)
    server_id = Column(Integer, ForeignKey("upstream_servers.id"), nullable=True, index=True)
    server_name = Column(String(100), nullable=True)
    tool_name = Column(String(150), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    duration_ms = Column(Float, nullable=False)
    success = Column(Boolean, nullable=False, index=True)
    error_message = Column(Text, nullable=True)
    request_meta = Column(Text, nullable=True) # Redacted safe metadata
    response_meta = Column(Text, nullable=True) # Redacted safe metadata

    user = relationship("User", back_populates="audit_logs")
    server = relationship("UpstreamServer", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_user_timestamp", "user_id", "timestamp"),
        Index("ix_audit_server_timestamp", "server_id", "timestamp"),
    )

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), default="New Chat", nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.id")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    role = Column(String(50), nullable=False) # user, assistant, system
    content = Column(Text, nullable=False)
    tool_calls_json = Column(Text, nullable=True)
    tool_results_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    session = relationship("ChatSession", back_populates="messages")
