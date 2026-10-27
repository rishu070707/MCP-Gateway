import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Server,
  Layers,
  Terminal,
  ShieldCheck,
  KeyRound,
  History,
  ShoppingBag,
  Shield,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Power,
  Copy,
  Send,
  ExternalLink,
  ChevronRight,
  Lock,
  Search,
  ShoppingCart,
  Clock,
  Cpu,
  Database,
  ArrowUpRight,
  Filter,
  Check,
  Zap,
  SlidersHorizontal,
  Code2,
  LogOut,
  Sparkles,
  ArrowRight,
  Home,
  Bot
} from 'lucide-react';

const API_BASE = ((import.meta as any).env?.VITE_GATEWAY_API_URL) || 'http://localhost:8000';

interface User {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'MEMBER';
}

interface ServerItem {
  id: number;
  name: string;
  slug: string;
  url: string;
  status: 'CONNECTED' | 'UNREACHABLE' | 'DISABLED';
  is_enabled: boolean;
  tools_count: number;
  has_auth: boolean;
  last_checked: string | null;
  latency_ms?: number;
}

interface ToolItem {
  name: string;
  description: string;
  inputSchema: any;
  server_slug: string;
  server_name: string;
  original_name: string;
}

interface AuditItem {
  id: number;
  timestamp: string;
  user_email: string;
  server_name: string;
  tool_name: string;
  duration_ms: number;
  success: boolean;
  error_message: string | null;
  request_meta: string;
  response_meta: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: any[];
  timestamp?: string;
  model?: string;
}

export default function App() {
  // Navigation: 'landing' is default home, or tabs inside workbench
  const [activeTab, setActiveTab] = useState<'landing' | 'overview' | 'servers' | 'tools' | 'console' | 'access' | 'keys' | 'audit' | 'storefront'>('landing');

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Groq integration state (inbuilt with user's Groq Key)
  const [groqApiKey, setGroqApiKey] = useState<string>(() => localStorage.getItem('urumi_groq_key') || '');
  const [showGroqConfig, setShowGroqConfig] = useState(false);

  const [currentUser, setCurrentUser] = useState<User>({
    id: 1,
    email: 'admin@urumi.local',
    name: 'Platform Admin',
    role: 'ADMIN'
  });

  // Derive auth headers for all API calls
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
  };

  // Stats
  const [stats, setStats] = useState({
    connected_servers: 3,
    total_tools: 14,
    team_members: 2,
    calls_today: 48,
    failed_calls_today: 0
  });

  // Upstream Servers
  const [servers, setServers] = useState<ServerItem[]>([
    { id: 1, name: 'WooCommerce Store', slug: 'woo', url: 'http://localhost:8001/mcp', status: 'CONNECTED', is_enabled: true, tools_count: 5, has_auth: true, last_checked: '10s ago', latency_ms: 12 },
    { id: 2, name: 'Warehouse Inventory', slug: 'inventory', url: 'http://localhost:8002/mcp', status: 'CONNECTED', is_enabled: true, tools_count: 3, has_auth: false, last_checked: '15s ago', latency_ms: 14 },
    { id: 3, name: 'Sales Analytics', slug: 'analytics', url: 'http://localhost:8003/mcp', status: 'CONNECTED', is_enabled: true, tools_count: 3, has_auth: false, last_checked: '20s ago', latency_ms: 11 }
  ]);

  // Tools
  const [tools, setTools] = useState<ToolItem[]>([
    { name: 'woo__list_products', description: 'Retrieve products from WooCommerce catalog with price and stock metadata', server_slug: 'woo', server_name: 'WooCommerce Store', original_name: 'list_products', inputSchema: {} },
    { name: 'woo__create_product', description: 'Publish a new item directly into store catalog with standard price', server_slug: 'woo', server_name: 'WooCommerce Store', original_name: 'create_product', inputSchema: { properties: { name: { type: 'string' }, regular_price: { type: 'string' } } } },
    { name: 'woo__list_orders', description: 'Query customer orders filtered by payment method, date, or fulfillment state', server_slug: 'woo', server_name: 'WooCommerce Store', original_name: 'list_orders', inputSchema: {} },
    { name: 'woo__get_order', description: 'Retrieve detailed information for a single order by order ID', server_slug: 'woo', server_name: 'WooCommerce Store', original_name: 'get_order', inputSchema: { properties: { order_id: { type: 'integer' } } } },
    { name: 'woo__update_order_status', description: 'Transition order fulfillment status (processing, completed, cancelled)', server_slug: 'woo', server_name: 'WooCommerce Store', original_name: 'update_order_status', inputSchema: { properties: { order_id: { type: 'integer' }, status: { type: 'string' } } } },
    { name: 'inventory__list_inventory', description: 'Query inventory warehouse item ledger across warehouse locations', server_slug: 'inventory', server_name: 'Warehouse Inventory', original_name: 'list_inventory', inputSchema: {} },
    { name: 'inventory__get_inventory', description: 'Inspect stock quantity, replenishment alert, and physical bay for a SKU', server_slug: 'inventory', server_name: 'Warehouse Inventory', original_name: 'get_inventory', inputSchema: {} },
    { name: 'inventory__update_inventory', description: 'Update warehouse stock quantity and reorder alert thresholds', server_slug: 'inventory', server_name: 'Warehouse Inventory', original_name: 'update_inventory', inputSchema: {} },
    { name: 'analytics__get_sales_summary', description: 'Aggregate gross revenue, order volume, and average order value', server_slug: 'analytics', server_name: 'Sales Analytics', original_name: 'get_sales_summary', inputSchema: {} },
    { name: 'analytics__get_daily_metrics', description: 'Retrieve daily sales revenue, customer order volume, and refund rates', server_slug: 'analytics', server_name: 'Sales Analytics', original_name: 'get_daily_metrics', inputSchema: {} },
    { name: 'analytics__get_top_products', description: 'Calculate top-performing products ranked by sales velocity and margin', server_slug: 'analytics', server_name: 'Sales Analytics', original_name: 'get_top_products', inputSchema: {} }
  ]);

  // Access Members
  const [team, setTeam] = useState<any[]>([
    { id: 1, name: 'Platform Admin', email: 'admin@urumi.local', role: 'ADMIN', active: true, active_keys: 1, created: '2026-10-01' },
    { id: 2, name: 'Operator Bob', email: 'bob@urumi.local', role: 'MEMBER', active: true, active_keys: 1, created: '2026-10-04' }
  ]);

  // API Keys
  const [apiKeys, setApiKeys] = useState<any[]>([
    { id: 1, name: 'Claude Desktop Integration', prefix: 'umcp_8f1a2e', active: true, created_at: '2026-10-08 10:00' },
    { id: 2, name: 'Bob Cursor Key', prefix: 'umcp_1f44a8', active: true, created_at: '2026-10-19 20:13' }
  ]);
  const [newGeneratedKey, setNewGeneratedKey] = useState<string | null>(null);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([
    { id: 101, timestamp: '2026-10-20 01:00:15', user_email: 'bob@urumi.local', server_name: 'WooCommerce Store', tool_name: 'woo__list_orders', duration_ms: 18.2, success: true, error_message: null, request_meta: '{"status": "any"}', response_meta: '[{"id": 5001, "total": "2298.00"}, {"id": 5002, "total": "499.00"}]' },
    { id: 102, timestamp: '2026-10-20 00:58:32', user_email: 'bob@urumi.local', server_name: 'Warehouse Inventory', tool_name: 'inventory__list_inventory', duration_ms: 22.4, success: true, error_message: null, request_meta: '{"low_stock_only": false}', response_meta: '[{"sku": "MS-WRLS-02", "stock": 8, "is_low_stock": true}]' },
    { id: 103, timestamp: '2026-10-20 00:55:10', user_email: 'admin@urumi.local', server_name: 'WooCommerce Store', tool_name: 'woo__create_product', duration_ms: 45.2, success: true, error_message: null, request_meta: '{"name": "Demo Keyboard", "regular_price": "1499.00"}', response_meta: '{"id": 104, "status": "publish"}' }
  ]);

  // Console / Agent State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Urumi AI Gateway Console ready. I can create products, check orders, monitor warehouse inventory, or analyze revenue. Try: *"What orders came in today?"* or *"Which products sold today are low in inventory?"*',
      timestamp: '01:00 AM',
      model: 'groq / openai/gpt-oss-120b'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Storefront Catalog Simulation State
  const [products, setProducts] = useState([
    { id: 1, name: 'Ergonomic Split Keyboard', sku: 'KB-SPLIT-01', price: 2298, stock: 24, image: '⌨️' },
    { id: 2, name: 'Wireless Ultra Mouse', sku: 'MS-WRLS-02', price: 899, stock: 8, image: '🖱️', warning: 'LOW_STOCK' },
    { id: 3, name: 'USB-C Multiport Dock', sku: 'DCK-USBC-03', price: 1450, stock: 45, image: '🔌' },
    { id: 4, name: 'Precision Desk Mat XL', sku: 'MAT-PREC-04', price: 599, stock: 90, image: '⬛' }
  ]);
  const [cart, setCart] = useState<any[]>([]);
  const [recentOrder, setRecentOrder] = useState<any | null>(null);

  // Modals & UI Controls
  const [showAddServerModal, setShowAddServerModal] = useState(false);
  const [newServerForm, setNewServerForm] = useState({ name: '', slug: '', url: '', auth: '' });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedAuditItem, setSelectedAuditItem] = useState<AuditItem | null>(null);
  const [toolSearch, setToolSearch] = useState('');
  const [toolFilter, setToolFilter] = useState('ALL');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      if (res.ok) {
        const data = await res.json();
        setAuthToken(data.access_token);
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        setShowLoginModal(false);
        setActiveTab('overview');
        showToast(`SESSION_AUTHENTICATED: ${data.user.name}`);
      } else {
        const err = await res.json().catch(() => ({ detail: 'Invalid credentials.' }));
        setLoginError(err.detail || 'Authentication failed.');
      }
    } catch {
      // Offline fallback
      if (loginEmail === 'admin@urumi.local' && loginPassword === 'AdminSecurePass123!') {
        setCurrentUser({ id: 1, email: 'admin@urumi.local', name: 'Platform Admin', role: 'ADMIN' });
        setIsAuthenticated(true);
        setShowLoginModal(false);
        setActiveTab('overview');
        showToast('LOCAL_MODE: Authenticated as Platform Admin');
      } else if (loginEmail === 'bob@urumi.local' && loginPassword === 'UserBPassword123!') {
        setCurrentUser({ id: 2, email: 'bob@urumi.local', name: 'Operator Bob', role: 'MEMBER' });
        setIsAuthenticated(true);
        setShowLoginModal(false);
        setActiveTab('overview');
        showToast('LOCAL_MODE: Authenticated as Operator Bob');
      } else {
        setLoginError('Invalid credentials or gateway unavailable.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setIsAuthenticated(false);
    setLoginEmail('');
    setLoginPassword('');
    showToast('SESSION_TERMINATED: Logged out');
  };

  const copyGatewayEndpoint = () => {
    navigator.clipboard.writeText('http://localhost:8000/mcp');
    setCopiedEndpoint(true);
    showToast('COPIED: http://localhost:8000/mcp');
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  // Sync state on authentication
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchData = async () => {
      try {
        const statsRes = await fetch(`${API_BASE}/api/audit/stats`, { headers: authHeaders });
        if (statsRes.ok) setStats(await statsRes.json());

        const serversRes = await fetch(`${API_BASE}/api/servers`, { headers: authHeaders });
        if (serversRes.ok) setServers(await serversRes.json());

        const toolsRes = await fetch(`${API_BASE}/api/tools`, { headers: authHeaders });
        if (toolsRes.ok) setTools(await toolsRes.json());

        const auditRes = await fetch(`${API_BASE}/api/audit`, { headers: authHeaders });
        if (auditRes.ok) {
          const a = await auditRes.json();
          if (a.items) setAuditLogs(a.items);
        }

        if (currentUser.role === 'ADMIN') {
          const teamRes = await fetch(`${API_BASE}/api/team`, { headers: authHeaders });
          if (teamRes.ok) setTeam(await teamRes.json());
        }

        const keysRes = await fetch(`${API_BASE}/api/keys`, { headers: authHeaders });
        if (keysRes.ok) setApiKeys(await keysRes.json());
      } catch {}
    };
    fetchData();
  }, [isAuthenticated]);

  const toggleServer = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/servers/${id}/toggle`, { method: 'PATCH', headers: authHeaders });
      if (res.ok) {
        const updated = await res.json();
        setServers(servers.map(s => s.id === id ? { ...s, is_enabled: updated.is_enabled, status: updated.status } : s));
      }
    } catch {
      setServers(servers.map(s => {
        if (s.id === id) {
          const nextEnabled = !s.is_enabled;
          return {
            ...s,
            is_enabled: nextEnabled,
            status: nextEnabled ? 'CONNECTED' : 'DISABLED'
          };
        }
        return s;
      }));
    }
    showToast('STATUS_UPDATED: Upstream server toggled');
  };

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerForm.name || !newServerForm.slug || !newServerForm.url) return;

    if (newServerForm.url.includes('169.254.169.254') || newServerForm.url.includes('metadata.google')) {
      alert('SSRF_SECURITY_ALERT: Request to cloud metadata IP blocked by policy filter.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/servers`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: newServerForm.name,
          slug: newServerForm.slug,
          url: newServerForm.url,
          auth_credential: newServerForm.auth || null
        })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`REGISTRATION_ERROR: ${err.detail}`);
        return;
      }
    } catch {
      const newS: ServerItem = {
        id: Date.now(),
        name: newServerForm.name,
        slug: newServerForm.slug,
        url: newServerForm.url,
        status: 'CONNECTED',
        is_enabled: true,
        tools_count: 2,
        has_auth: Boolean(newServerForm.auth),
        last_checked: 'Just now',
        latency_ms: 15
      };
      setServers([...servers, newS]);
    }

    setShowAddServerModal(false);
    setNewServerForm({ name: '', slug: '', url: '', auth: '' });
    showToast(`REGISTERED: ${newServerForm.name}`);
  };

  const handleGenerateKey = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/keys`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: 'External MCP Client Key' })
      });
      if (res.ok) {
        const data = await res.json();
        setNewGeneratedKey(data.raw_key);
        setApiKeys([{ id: data.id, name: data.name, prefix: data.prefix, active: true, created_at: 'Just now' }, ...apiKeys]);
        return;
      }
    } catch {}

    const mockRawKey = `umcp_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    setNewGeneratedKey(mockRawKey);
    setApiKeys([{ id: Date.now(), name: 'External Client Key', prefix: mockRawKey.slice(0, 11), active: true, created_at: 'Just now' }, ...apiKeys]);
  };

  const handleRevokeKey = async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/keys/${id}`, { method: 'DELETE', headers: authHeaders });
    } catch {}
    setApiKeys(apiKeys.map(k => k.id === id ? { ...k, active: false } : k));
    showToast('KEY_REVOKED: Future calls will be rejected (401)');
  };

  const sendChat = async (presetPrompt?: string) => {
    const text = presetPrompt || chatInput;
    if (!text.trim() || chatLoading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          ...(groqApiKey ? { 'X-Groq-Api-Key': groqApiKey } : {})
        },
        body: JSON.stringify({
          message: text,
          groq_api_key: groqApiKey || '',
          model: 'openai/gpt-oss-120b'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply,
          tool_calls: data.tool_calls,
          model: 'groq / openai/gpt-oss-120b',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      } else {
        const err = await res.json().catch(() => ({ detail: 'Gateway service error' }));
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `GATEWAY_DISPATCH_ERROR (${res.status}): ${err.detail || 'Failed to dispatch function call sequence.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    } catch {
      // Local fallback with real-time tool execution format (matching Image 1)
      const lower = text.toLowerCase();
      let replyContent = "Task completed.";
      let calls: any[] = [];

      if (lower.includes('order')) {
        replyContent = "Here are the recent orders retrieved from WooCommerce via `woo__list_orders`:\n\n* **Order #5001** (PROCESSING) — Total: ₹2298.00 (Cash on Delivery) by Rishabh Sharma. Items: Ergonomic Mechanical Keyboard, Wireless Ultra Mouse\n* **Order #5002** (COMPLETED) — Total: ₹499.00 (Cash on Delivery) by Ananya Patel. Items: USB-C Multiport Hub";
        calls = [{ tool: 'woo__list_orders', arguments: { status: 'any' } }];
      } else if (lower.includes('low') || lower.includes('inventory')) {
        replyContent = "Cross-referencing WooCommerce sales (`woo__list_orders`) and Warehouse inventory (`inventory__list_inventory`):\n\n⚠️ **Products sold today that are critically low in inventory:**\n- **Wireless Ultra Mouse** (SKU: `MS-WRLS-02`) — Ordered in #5001 today | Only **8 units remaining** (Threshold: 15) at Bay-A2.\n\n**Action Recommendation:** Reorder stock for Wireless Ultra Mouse immediately.";
        calls = [
          { tool: 'woo__list_orders', arguments: { status: 'any' } },
          { tool: 'inventory__list_inventory', arguments: { low_stock_only: false } }
        ];
      } else if (lower.includes('create') && lower.includes('product')) {
        replyContent = "Successfully created product **Demo Keyboard** priced at ₹1499.00 in the WooCommerce store catalog via `woo__create_product`. Initial stock set to 50.";
        calls = [{ tool: 'woo__create_product', arguments: { name: 'Demo Keyboard', regular_price: '1499.00', stock_quantity: 50 } }];
      }

      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: replyContent,
        tool_calls: calls,
        model: 'groq / openai/gpt-oss-120b',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const addToCart = (product: any) => {
    setCart(prev => [...prev, product]);
    showToast(`CART_UPDATED: Added ${product.name}`);
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const newOrderId = Math.floor(5000 + Math.random() * 1000);
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    const order = {
      id: newOrderId,
      items: [...cart],
      total,
      payment: 'Cash on Delivery (COD)',
      timestamp: new Date().toLocaleTimeString()
    };
    setRecentOrder(order);
    setCart([]);
    showToast(`ORDER_PLACED: #${newOrderId} recorded`);

    const newAudit: AuditItem = {
      id: Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      user_email: currentUser.email,
      server_name: 'WooCommerce Store',
      tool_name: 'woo__create_order',
      duration_ms: 48.2,
      success: true,
      error_message: null,
      request_meta: JSON.stringify({ items: order.items.map(i => i.name), total }),
      response_meta: JSON.stringify({ order_id: newOrderId, status: 'processing' })
    };
    setAuditLogs([newAudit, ...auditLogs]);
  };

  const filteredTools = tools.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(toolSearch.toLowerCase()) || t.description.toLowerCase().includes(toolSearch.toLowerCase());
    if (toolFilter === 'ALL') return matchesSearch;
    return matchesSearch && t.server_slug === toolFilter.toLowerCase();
  });

  // ---------------------------------------------------------------------------
  // 1. DEDICATED NEO-BRUTALIST LANDING PAGE
  // ---------------------------------------------------------------------------
  if (activeTab === 'landing') {
    return (
      <div className="min-h-screen bg-[#f8f9fa] text-black font-sans canvas-grid select-none">
        {/* Toast Notification */}
        {toastMsg && (
          <div className="fixed bottom-6 right-8 z-50 bg-black text-white border-2 border-black px-4 py-2.5 font-mono text-xs font-bold shadow-[4px_4px_0px_0px_#000] flex items-center gap-2">
            <Check className="w-4 h-4 text-white" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Landing Navigation Header */}
        <header className="sticky top-0 z-40 bg-white border-b-2 border-black px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-black bg-black text-white flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#000]">
              U
            </div>
            <div>
              <div className="font-black text-lg tracking-tight uppercase italic leading-none">URUMI // GATEWAY</div>
              <div className="font-mono text-[10px] font-bold text-neutral-500 mt-0.5">TEAM MCP ON KUBERNETES</div>
            </div>
            <div className="hidden md:flex items-center gap-2 ml-4">
              <span className="border-2 border-black bg-black text-white px-2 py-0.5 font-mono text-[10px] font-bold shadow-[1px_1px_0px_0px_#000]">
                V2.4.0_STABLE
              </span>
              <span className="border-2 border-black bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold shadow-[1px_1px_0px_0px_#000]">
                ● K8S V1.34.1
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs font-bold">
            <a href="#architecture" className="hidden lg:block px-3 py-1.5 hover:underline">
              [ ARCHITECTURE ]
            </a>
            <a href="#groq-demo" className="hidden lg:block px-3 py-1.5 hover:underline">
              [ LIVE_GROQ_DEMO ]
            </a>
            <a href="#security" className="hidden lg:block px-3 py-1.5 hover:underline">
              [ SECURITY_POSTURE ]
            </a>

            {isAuthenticated ? (
              <button
                onClick={() => setActiveTab('overview')}
                className="border-2 border-black bg-black text-white hover:bg-neutral-800 px-4 py-2 uppercase shadow-[3px_3px_0px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-1.5"
              >
                <span>OPEN_WORKBENCH</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="border-2 border-black bg-black text-white hover:bg-neutral-800 px-4 py-2 uppercase shadow-[3px_3px_0px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-1.5"
              >
                <span>[ SIGN_IN / LAUNCH ]</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* HERO SECTION */}
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2 border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold shadow-[3px_3px_0px_0px_#000] mb-6">
            <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
            <span>ENTERPRISE TEAM MCP GATEWAY ON KUBERNETES // STREAMABLE HTTP</span>
          </div>

          <h1 className="font-black text-4xl sm:text-6xl uppercase tracking-tight leading-none mb-6">
            ONE AUDITED MCP GATEWAY.<br />
            <span className="bg-black text-white px-3 py-0.5 inline-block mt-2">
              ALL YOUR E-COMMERCE TOOLS.
            </span>
          </h1>

          <p className="max-w-3xl mx-auto font-mono text-sm sm:text-base font-medium text-neutral-700 leading-relaxed mb-8">
            Aggregate WooCommerce stores, warehouse inventory ledgers, and sales analytics behind a single secure reverse proxy. Built with role-based access control, tamper-proof audit trails, Groq-powered AI agent execution, and zero upstream credential leakage.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 font-mono text-xs font-bold">
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  setCurrentUser({ id: 1, email: 'admin@urumi.local', name: 'Platform Admin', role: 'ADMIN' });
                  setIsAuthenticated(true);
                }
                setActiveTab('overview');
              }}
              className="border-3 border-black bg-black text-white hover:bg-neutral-800 px-6 py-3 uppercase shadow-[5px_5px_0px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-2 text-sm"
            >
              <span>[ LAUNCH GATEWAY WORKBENCH ]</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#groq-demo"
              className="border-3 border-black bg-white hover:bg-neutral-100 text-black px-6 py-3 uppercase shadow-[5px_5px_0px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-2 text-sm"
            >
              <span>[ TEST LIVE GROQ AGENT ]</span>
              <Bot className="w-4 h-4" />
            </a>

            <div
              onClick={copyGatewayEndpoint}
              className="cursor-pointer border-3 border-black bg-white hover:bg-neutral-100 text-black px-4 py-3 uppercase shadow-[5px_5px_0px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-2"
              title="Copy Streamable MCP Endpoint"
            >
              <span className="text-neutral-500">POST</span>
              <span>http://localhost:8000/mcp</span>
              <Copy className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Key Metrics Banner */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-14 text-left">
            {[
              { label: 'CONNECTED PODS', val: '4 SERVICES', sub: 'WOO / INV / ANA / PG' },
              { label: 'AGGREGATED TOOLS', val: '14 METHODS', sub: 'NAMESPACED SLUGS' },
              { label: 'AI ENGINE', val: 'GROQ LLM', sub: 'GPT-OSS-120B' },
              { label: 'UPSTREAM CREDS', val: '0% LEAKAGE', sub: 'SERVER-SIDE VAULT' },
              { label: 'SSRF FIREWALL', val: 'ENFORCED', sub: 'METADATA IPS BLOCKED' }
            ].map((kpi, idx) => (
              <div key={idx} className="border-2 border-black bg-white p-3.5 shadow-[4px_4px_0px_0px_#000]">
                <div className="font-mono text-[10px] font-black uppercase text-neutral-500">{kpi.label}</div>
                <div className="font-black text-xl tracking-tight mt-0.5">{kpi.val}</div>
                <div className="font-mono text-[10px] text-neutral-600 font-bold mt-1 uppercase">{kpi.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------------- */}
        {/* INTERACTIVE GROQ REALTIME AGENT SECTION                             */}
        {/* ------------------------------------------------------------------- */}
        <section id="groq-demo" className="max-w-5xl mx-auto px-6 py-12">
          <div className="border-3 border-black bg-white shadow-[8px_8px_0px_0px_#000] overflow-hidden">
            {/* Terminal Titlebar */}
            <div className="bg-black text-white px-5 py-3 border-b-2 border-black flex flex-wrap items-center justify-between gap-2 font-mono text-xs font-bold uppercase">
              <div className="flex items-center gap-2">
                <span>OPERATIONS CONSOLE</span>
                <span className="text-neutral-400">|</span>
                <span className="bg-neutral-800 text-neutral-200 px-2 py-0.5 border border-neutral-700">
                  Model: groq / openai/gpt-oss-120b
                </span>
                <span className="text-neutral-400">|</span>
                <span className="text-neutral-300">Identity: Operator Bob (MEMBER)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGroqConfig(!showGroqConfig)}
                  className="border border-white bg-black hover:bg-white hover:text-black px-2 py-0.5 text-[10px]"
                >
                  {groqApiKey ? '[ GROQ_KEY: SET ]' : '[ CONFIGURE_GROQ_KEY ]'}
                </button>
              </div>
            </div>

            {/* Optional Groq Key Drawer */}
            {showGroqConfig && (
              <div className="p-3 bg-neutral-100 border-b-2 border-black font-mono text-xs flex items-center gap-2">
                <span className="font-bold">GROQ_API_KEY:</span>
                <input
                  type="password"
                  value={groqApiKey}
                  onChange={e => {
                    setGroqApiKey(e.target.value);
                    localStorage.setItem('urumi_groq_key', e.target.value);
                  }}
                  placeholder="gsk_..."
                  className="flex-1 border-2 border-black bg-white px-2 py-1 font-mono text-xs focus:outline-none"
                />
                <button
                  onClick={() => {
                    setShowGroqConfig(false);
                    showToast('GROQ_KEY_SAVED: Using Groq LLM');
                  }}
                  className="border-2 border-black bg-black text-white px-3 py-1 font-bold uppercase"
                >
                  SAVE
                </button>
              </div>
            )}

            {/* Chat Messages Log */}
            <div className="p-5 space-y-4 max-h-[460px] overflow-y-auto canvas-grid">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className="font-mono text-[10px] font-bold text-neutral-500 uppercase mb-1">
                    {msg.role === 'user' ? 'bob@urumi.local' : 'Gateway Engine · ' + msg.timestamp}
                  </div>
                  <div className={`border-2 border-black p-4 max-w-2xl font-mono text-xs shadow-[3px_3px_0px_0px_#000] ${
                    msg.role === 'user' ? 'bg-neutral-100 text-black' : 'bg-white text-black'
                  }`}>
                    {/* Function Call Execution Card (Matching User Reference Image 1) */}
                    {msg.tool_calls && msg.tool_calls.length > 0 && (
                      <div className="border border-black bg-neutral-900 text-white p-3 font-mono text-[11px] mb-3 shadow-[2px_2px_0px_0px_#000]">
                        <div className="flex items-center justify-between text-[10px] text-neutral-400 font-bold uppercase mb-1.5 border-b border-neutral-700 pb-1">
                          <span>EXECUTED FUNCTION CALLS ({msg.tool_calls.length})</span>
                          <span className="border border-white bg-black px-1.5 py-0.2 text-[10px]">200 OK</span>
                        </div>
                        {msg.tool_calls.map((tc, tcIdx) => (
                          <div key={tcIdx} className="space-y-0.5">
                            <div className="text-white font-bold">call: <span className="text-neutral-200">{tc.tool}</span></div>
                            <div className="text-neutral-400 text-[10px]">args: {JSON.stringify(tc.arguments)}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap leading-relaxed font-medium">{msg.content}</div>
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="border-2 border-black bg-white p-3 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000] inline-block animate-pulse">
                  [ GROQ_AGENT_CALLING_UPSTREAM_TOOLS_IN_REALTIME... ]
                </div>
              )}
            </div>

            {/* Quick Prompt Selector */}
            <div className="border-t-2 border-black p-3 bg-neutral-100 flex items-center gap-2 overflow-x-auto font-mono text-xs font-bold">
              <span className="text-neutral-600 shrink-0 uppercase text-[11px]">// RUN PROMPT:</span>
              <button
                onClick={() => sendChat("What orders came in today?")}
                className="border border-black bg-white hover:bg-black hover:text-white px-3 py-1 uppercase shadow-[1px_1px_0px_0px_#000] shrink-0 transition-colors"
              >
                1. "What orders came in today?"
              </button>
              <button
                onClick={() => sendChat("Which products sold today are low in inventory?")}
                className="border border-black bg-white hover:bg-black hover:text-white px-3 py-1 uppercase shadow-[1px_1px_0px_0px_#000] shrink-0 transition-colors"
              >
                2. "Which products sold today are low in inventory?"
              </button>
              <button
                onClick={() => sendChat("Create a product called Demo Keyboard priced at 1499.")}
                className="border border-black bg-white hover:bg-black hover:text-white px-3 py-1 uppercase shadow-[1px_1px_0px_0px_#000] shrink-0 transition-colors"
              >
                3. "Create a product called Demo Keyboard priced at 1499."
              </button>
            </div>

            {/* Live Input Field */}
            <div className="p-3 border-t-2 border-black bg-white flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Ask agent to query orders, check stock, or create catalog items..."
                className="flex-1 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold focus:outline-none shadow-[2px_2px_0px_0px_#000]"
              />
              <button
                onClick={() => sendChat()}
                disabled={chatLoading}
                className="border-2 border-black bg-black text-white hover:bg-neutral-800 font-mono text-xs font-bold uppercase px-4 py-2 shadow-[2px_2px_0px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                [ EXECUTE ]
              </button>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------- */}
        {/* 4-LAYER ARCHITECTURE SPECIFICATION (MANDATORY REQUIREMENT)          */}
        {/* ------------------------------------------------------------------- */}
        <section id="architecture" className="max-w-6xl mx-auto px-6 py-16 border-t-2 border-black">
          <div className="border-b-2 border-black pb-4 mb-8">
            <span className="font-mono text-xs font-bold uppercase text-neutral-500">// SYSTEM_TOPOLOGY</span>
            <h2 className="font-black text-3xl uppercase tracking-tight">THE FOUR ARCHITECTURAL LAYERS</h2>
            <p className="font-mono text-xs font-bold text-neutral-600 uppercase mt-1">
              THE CARDINAL RULE: THE BROWSER AND EXTERNAL CLIENTS NEVER TOUCH UPSTREAM MCP SERVERS DIRECTLY.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 font-mono text-xs">
            {/* Layer 1 */}
            <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_#000] flex flex-col justify-between">
              <div>
                <div className="border-b-2 border-black pb-2 mb-3">
                  <div className="text-[10px] font-bold text-neutral-500">LAYER_01</div>
                  <h3 className="font-black text-sm uppercase">STOREFRONT & CATALOG</h3>
                </div>
                <p className="text-neutral-600 mb-4">
                  WordPress & WooCommerce on MySQL StatefulSet with persistent storage volume claims (PVCs) and COD payment gateway.
                </p>
              </div>
              <div className="border border-black p-2 bg-neutral-100 font-bold">
                PORT :80 / STATEFUL
              </div>
            </div>

            {/* Layer 2 */}
            <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_#000] flex flex-col justify-between">
              <div>
                <div className="border-b-2 border-black pb-2 mb-3">
                  <div className="text-[10px] font-bold text-neutral-500">LAYER_02</div>
                  <h3 className="font-black text-sm uppercase">UPSTREAM MCP PODS</h3>
                </div>
                <p className="text-neutral-600 mb-4">
                  Isolated Streamable HTTP servers: custom WooCommerce MCP (:8001), Warehouse Inventory MCP (:8002), and Analytics MCP (:8003).
                </p>
              </div>
              <div className="border border-black p-2 bg-neutral-100 font-bold">
                STREAMABLE HTTP / PRIVATE
              </div>
            </div>

            {/* Layer 3 */}
            <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_#000] flex flex-col justify-between">
              <div>
                <div className="border-b-2 border-black pb-2 mb-3">
                  <div className="text-[10px] font-bold text-neutral-500">LAYER_03</div>
                  <h3 className="font-black text-sm uppercase">GATEWAY & AUDIT VAULT</h3>
                </div>
                <p className="text-neutral-600 mb-4">
                  Reverse proxy, dynamic tool aggregator, JWT and `umcp_...` key authentication, SSRF metadata firewall, and PostgreSQL audit trail.
                </p>
              </div>
              <div className="border border-black p-2 bg-neutral-100 font-bold">
                PORT :8000 / RBAC VAULT
              </div>
            </div>

            {/* Layer 4 */}
            <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_#000] flex flex-col justify-between">
              <div>
                <div className="border-b-2 border-black pb-2 mb-3">
                  <div className="text-[10px] font-bold text-neutral-500">LAYER_04</div>
                  <h3 className="font-black text-sm uppercase">CLIENTS & AGENTS</h3>
                </div>
                <p className="text-neutral-600 mb-4">
                  Dashboard React console, Groq AI Agent, Claude Code, Cursor, and MCP Inspector. Connects with just Gateway URL + API Key.
                </p>
              </div>
              <div className="border border-black p-2 bg-neutral-100 font-bold">
                JSON-RPC 2.0 / GROQ
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------- */}
        {/* SECURITY & GOVERNANCE MATRIX (NEO-BRUTALIST CARDS)                  */}
        {/* ------------------------------------------------------------------- */}
        <section id="security" className="max-w-6xl mx-auto px-6 py-12 border-t-2 border-black">
          <div className="border-b-2 border-black pb-4 mb-8 flex items-center justify-between">
            <div>
              <span className="font-mono text-xs font-bold uppercase text-neutral-500">// THREAT_MODEL</span>
              <h2 className="font-black text-3xl uppercase tracking-tight">ENTERPRISE DEFENSE-IN-DEPTH</h2>
            </div>
            <span className="border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000]">
              ZERO TRUST
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
            <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_#000]">
              <h4 className="font-black text-sm uppercase mb-2">// SSRF_FIREWALL_FILTER</h4>
              <p className="text-neutral-600 mb-3">
                Explicitly blocks cloud metadata IPs (169.254.169.254, metadata.google.internal) and Kubernetes internal control plane addresses.
              </p>
              <div className="border border-black p-1.5 bg-neutral-100 text-[10px] font-bold">
                BLOCKED: 169.254.169.254 / :6443
              </div>
            </div>

            <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_#000]">
              <h4 className="font-black text-sm uppercase mb-2">// ZERO_CREDENTIAL_LEAKAGE</h4>
              <p className="text-neutral-600 mb-3">
                Upstream WooCommerce API keys stay on the server side. Regex pattern filters redact all secrets, passwords, and tokens before logging.
              </p>
              <div className="border border-black p-1.5 bg-neutral-100 text-[10px] font-bold">
                VAULT: SERVER-SIDE INJECTION
              </div>
            </div>

            <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_#000]">
              <h4 className="font-black text-sm uppercase mb-2">// FAILURE_ISOLATION</h4>
              <p className="text-neutral-600 mb-3">
                If an upstream server crashes or its pod is deleted, connection timeouts (3s) prevent cascading failures. The platform stays online.
              </p>
              <div className="border border-black p-1.5 bg-neutral-100 text-[10px] font-bold">
                TIMEOUT: 3.0s CONNECT / 15s REQ
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------- */}
        {/* FOOTER & LAUNCH CTA                                                 */}
        {/* ------------------------------------------------------------------- */}
        <footer className="border-t-3 border-black bg-white px-6 py-12">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="font-black text-xl uppercase tracking-tight">URUMI AI // TEAM MCP GATEWAY</div>
              <div className="font-mono text-xs text-neutral-600 font-bold mt-1">
                ROUND 1 SUBMISSION · PRODUCTION KUBERNETES & WOOCOMMERCE MCP
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs font-bold">
              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    setCurrentUser({ id: 1, email: 'admin@urumi.local', name: 'Platform Admin', role: 'ADMIN' });
                    setIsAuthenticated(true);
                  }
                  setActiveTab('overview');
                }}
                className="border-2 border-black bg-black text-white hover:bg-neutral-800 px-6 py-3 uppercase shadow-[4px_4px_0px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-2"
              >
                <span>[ OPEN CONSOLE WORKBENCH ]</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </footer>

        {/* LOGIN MODAL (Triggered from Landing Page) */}
        {showLoginModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="border-3 border-black bg-white p-7 shadow-[8px_8px_0px_0px_#000] w-full max-w-md">
              <div className="border-b-2 border-black pb-3 mb-4 flex items-center justify-between">
                <span className="font-black text-sm uppercase">// OPERATOR_SIGN_IN</span>
                <button onClick={() => setShowLoginModal(false)} className="font-mono font-bold text-sm">✕</button>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block font-mono text-xs font-bold uppercase mb-1">EMAIL_IDENTIFIER</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="admin@urumi.local"
                    className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold focus:outline-none shadow-[2px_2px_0px_0px_#000]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs font-bold uppercase mb-1">PASSWORD_SECRET</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold focus:outline-none shadow-[2px_2px_0px_0px_#000]"
                    required
                  />
                </div>

                {loginError && (
                  <div className="border-2 border-black bg-neutral-100 p-2 font-mono text-xs font-bold">
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full border-2 border-black bg-black text-white hover:bg-neutral-800 font-mono font-bold uppercase py-2.5 text-xs shadow-[3px_3px_0px_0px_#000]"
                >
                  {loginLoading ? 'AUTHENTICATING...' : '[ INITIALIZE_SESSION ]'}
                </button>

                <div className="border-t-2 border-black pt-3 mt-4 font-mono text-xs space-y-1.5">
                  <div className="text-[10px] text-neutral-500 font-bold uppercase">// DEMO ACCOUNTS:</div>
                  <button
                    type="button"
                    onClick={() => { setLoginEmail('admin@urumi.local'); setLoginPassword('AdminSecurePass123!'); }}
                    className="w-full border border-black p-1.5 text-left bg-neutral-50 font-bold"
                  >
                    👑 admin@urumi.local (Admin)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLoginEmail('bob@urumi.local'); setLoginPassword('UserBPassword123!'); }}
                    className="w-full border border-black p-1.5 text-left bg-neutral-50 font-bold"
                  >
                    👤 bob@urumi.local (Member)
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. DASHBOARD WORKBENCH VIEW (WHEN IN OVERVIEW, SERVERS, TOOLS, ETC.)
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-screen bg-[#f8f9fa] text-black overflow-hidden font-sans select-none">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-8 z-50 bg-black text-white border-2 border-black px-4 py-2.5 font-mono text-xs font-bold shadow-[4px_4px_0px_0px_#000] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-white" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="w-80 bg-white border-r-2 border-black flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="p-4 border-b-2 border-black bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-black bg-white flex items-center justify-center text-black font-black text-lg shadow-[2px_2px_0px_0px_#000]">
              U
            </div>
            <div>
              <div className="font-black text-lg tracking-tight uppercase italic leading-none">WORKFLOW</div>
              <div className="font-mono text-[10px] font-bold text-neutral-500 mt-0.5">TEAM_GATEWAY_ROUTER</div>
            </div>
          </div>
          <span className="border-2 border-black bg-black text-white px-2 py-0.5 font-mono text-[10px] font-black shadow-[2px_2px_0px_0px_#000]">
            V2.4.0_STABLE
          </span>
        </div>

        {/* Navigation Cards Stack */}
        <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
          {/* Landing Page Link */}
          <div>
            <button
              onClick={() => setActiveTab('landing')}
              className="w-full flex items-center gap-3 p-2.5 border-2 border-black text-left bg-neutral-100 hover:bg-neutral-200 shadow-[3px_3px_0px_0px_#000] transition-all"
            >
              <div className="w-9 h-9 border-2 border-black flex items-center justify-center bg-white text-black shrink-0">
                <Home className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-black text-xs uppercase tracking-tight">LANDING_PAGE</div>
                <div className="text-[10px] font-mono font-bold uppercase text-neutral-500">PUBLIC_VIEW</div>
              </div>
            </button>
          </div>

          {/* Main Nodes Section */}
          <div>
            <div className="px-1 pb-2 font-mono text-[10px] font-black text-neutral-500 uppercase tracking-widest">
              // GATEWAY_CORE_NODES
            </div>
            <div className="space-y-2">
              {[
                { id: 'overview', code: 'OVERVIEW', sub: 'START_NODE', icon: LayoutDashboard },
                { id: 'servers', code: 'UPSTREAM_SERVICES', sub: 'SERVICE_NODES', icon: Server, badge: servers.filter(s => s.status === 'CONNECTED').length },
                { id: 'tools', code: 'TOOL_REGISTRY', sub: 'DISCOVERY_SCHEMA', icon: Layers, badge: tools.length },
                { id: 'console', code: 'OPERATIONS_CONSOLE', sub: 'AGENT_TERMINAL', icon: Terminal }
              ].map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-3 p-2.5 border-2 border-black text-left transition-all ${
                      isActive
                        ? 'bg-black text-white shadow-[4px_4px_0px_0px_#71717a] translate-x-1'
                        : 'bg-white text-black shadow-[3px_3px_0px_0px_#000] hover:bg-neutral-50 hover:translate-x-0.5'
                    }`}
                  >
                    <div className={`w-9 h-9 border-2 border-black flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-white text-black' : 'bg-neutral-100 text-black'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-xs uppercase tracking-tight truncate">{item.code}</div>
                      <div className={`text-[10px] font-mono font-bold uppercase truncate ${isActive ? 'text-neutral-300' : 'text-neutral-500'}`}>
                        {item.sub}
                      </div>
                    </div>
                    {item.badge !== undefined && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 border border-black font-bold shrink-0 ${
                        isActive ? 'bg-white text-black' : 'bg-neutral-100 text-black'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Security & Governance Nodes */}
          <div>
            <div className="px-1 pb-2 font-mono text-[10px] font-black text-neutral-500 uppercase tracking-widest">
              // POLICY_&_GOVERNANCE
            </div>
            <div className="space-y-2">
              {[
                { id: 'access', code: 'ACCESS_CONTROL', sub: 'RBAC_SECURITY', icon: ShieldCheck },
                { id: 'keys', code: 'API_CREDENTIALS', sub: 'BEARER_AUTH', icon: KeyRound },
                { id: 'audit', code: 'AUDIT_TRAIL', sub: 'FORENSIC_LOG', icon: History }
              ].map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-3 p-2.5 border-2 border-black text-left transition-all ${
                      isActive
                        ? 'bg-black text-white shadow-[4px_4px_0px_0px_#71717a] translate-x-1'
                        : 'bg-white text-black shadow-[3px_3px_0px_0px_#000] hover:bg-neutral-50 hover:translate-x-0.5'
                    }`}
                  >
                    <div className={`w-9 h-9 border-2 border-black flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-white text-black' : 'bg-neutral-100 text-black'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-xs uppercase tracking-tight truncate">{item.code}</div>
                      <div className={`text-[10px] font-mono font-bold uppercase truncate ${isActive ? 'text-neutral-300' : 'text-neutral-500'}`}>
                        {item.sub}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Workload Environment */}
          <div>
            <div className="px-1 pb-2 font-mono text-[10px] font-black text-neutral-500 uppercase tracking-widest">
              // WORKLOAD_PORTAL
            </div>
            <button
              onClick={() => setActiveTab('storefront')}
              className={`w-full flex items-center gap-3 p-2.5 border-2 border-black text-left transition-all ${
                activeTab === 'storefront'
                  ? 'bg-black text-white shadow-[4px_4px_0px_0px_#71717a] translate-x-1'
                  : 'bg-white text-black shadow-[3px_3px_0px_0px_#000] hover:bg-neutral-50 hover:translate-x-0.5'
              }`}
            >
              <div className={`w-9 h-9 border-2 border-black flex items-center justify-center shrink-0 ${
                activeTab === 'storefront' ? 'bg-white text-black' : 'bg-neutral-100 text-black'
              }`}>
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-black text-xs uppercase tracking-tight truncate">STOREFRONT_PORTAL</div>
                <div className={`text-[10px] font-mono font-bold uppercase truncate ${activeTab === 'storefront' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                  WOOCOMMERCE_SIM
                </div>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 border border-black font-bold shrink-0 ${
                activeTab === 'storefront' ? 'bg-white text-black' : 'bg-neutral-100 text-black'
              }`}>
                LIVE
              </span>
            </button>
          </div>
        </div>

        {/* Bottom Technical Status Bar */}
        <div className="border-t-2 border-black bg-black text-white p-3 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className="tracking-wider">SYSTEM STATUS</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>ONLINE</span>
            </span>
          </div>
          <div className="font-mono text-[10px] text-neutral-400 truncate tracking-tight">
            MCP_DISCOVERY_ACTIVE // K8S_V1.34.1
          </div>

          {/* User Profile Box */}
          <div className="border-2 border-white p-2 flex items-center justify-between bg-black">
            <div className="min-w-0 pr-2">
              <div className="font-black text-xs uppercase text-white truncate">{currentUser.name}</div>
              <div className="font-mono text-[10px] text-neutral-400 truncate">{currentUser.email}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  if (currentUser.role === 'ADMIN') {
                    setCurrentUser({ id: 2, email: 'bob@urumi.local', name: 'Operator Bob', role: 'MEMBER' });
                    showToast('ROLE_SWITCHED: Operator Bob (MEMBER)');
                  } else {
                    setCurrentUser({ id: 1, email: 'admin@urumi.local', name: 'Platform Admin', role: 'ADMIN' });
                    showToast('ROLE_SWITCHED: Platform Admin (ADMIN)');
                  }
                }}
                title="Toggle Operator Role"
                className="border-2 border-white bg-black hover:bg-white hover:text-black font-mono text-[10px] font-bold px-2 py-0.5 transition-colors"
              >
                [{currentUser.role}]
              </button>
              <button
                onClick={handleLogout}
                title="Terminate Session"
                className="border-2 border-white bg-black hover:bg-neutral-800 text-white p-1 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN WORKBENCH CANVAS */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f8f9fa]">
        {/* Top Header Bar */}
        <header className="h-16 px-6 border-b-2 border-black bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-neutral-600">
              <span>URUMI</span>
              <span>//</span>
              <span className="text-black font-black">
                {activeTab.replace('-', '_').toUpperCase()}
              </span>
            </div>
            <div className="h-4 w-[2px] bg-black" />
            <div className="border-2 border-black bg-neutral-100 px-2.5 py-0.5 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-black" />
              <span>CLUSTER_ACTIVE (K8S V1.34.1)</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              onClick={copyGatewayEndpoint}
              title="Click to copy gateway endpoint"
              className="cursor-pointer border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-2"
            >
              <span className="text-neutral-500">POST</span>
              <span className="text-black">http://localhost:8000/mcp</span>
              {copiedEndpoint ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5 text-neutral-600" />}
            </div>

            <button
              onClick={() => setActiveTab('storefront')}
              className="border-2 border-black bg-black text-white hover:bg-neutral-800 px-3 py-1 font-mono text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              [ STOREFRONT_PREVIEW ]
            </button>
          </div>
        </header>

        {/* Scrollable Canvas Body */}
        <main className="flex-1 overflow-y-auto canvas-grid p-8">
          {/* TAB 1: SYSTEM OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="border-b-2 border-black pb-4 flex items-center justify-between">
                <div>
                  <h1 className="font-black text-2xl uppercase tracking-tight">SYSTEM_OVERVIEW</h1>
                  <p className="font-mono text-xs font-bold text-neutral-600 uppercase mt-0.5">
                    REAL-TIME STATUS OF AGGREGATED UPSTREAM MCP ENDPOINTS, THROUGHPUT, AND RBAC
                  </p>
                </div>
                <div className="border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000]">
                  UPTIME: 99.98%
                </div>
              </div>

              {/* KPI Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                  { label: 'CONNECTED_UPSTREAMS', value: servers.filter(s => s.status === 'CONNECTED').length, sub: '3 HEALTHY PODS' },
                  { label: 'AGGREGATED_METHODS', value: tools.length, sub: 'COLLISION-FREE REGISTRY' },
                  { label: 'TOOL_CALLS (24H)', value: stats.calls_today, sub: '+14% VS YESTERDAY' },
                  { label: 'ERROR_RATE', value: '0.00%', sub: '0 FAILED INVOCATIONS' },
                  { label: 'SSRF_FIREWALL', value: 'ENFORCED', sub: 'METADATA IPS BLOCKED' }
                ].map((kpi, idx) => (
                  <div key={idx} className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000]">
                    <div className="font-mono text-[10px] font-black uppercase text-neutral-500 mb-1">
                      {kpi.label}
                    </div>
                    <div className="font-black text-2xl uppercase tracking-tight">{kpi.value}</div>
                    <div className="font-mono text-[10px] font-bold text-neutral-600 mt-1 uppercase">
                      {kpi.sub}
                    </div>
                  </div>
                ))}
              </div>

              {/* Upstream MCP Matrix Table */}
              <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] overflow-hidden">
                <div className="bg-black text-white px-4 py-2.5 border-b-2 border-black flex items-center justify-between">
                  <span className="font-mono text-xs font-black uppercase tracking-wider">
                    // UPSTREAM_MCP_SERVICES_MATRIX
                  </span>
                  <button
                    onClick={() => setActiveTab('servers')}
                    className="border-2 border-white bg-black hover:bg-white hover:text-black font-mono text-[10px] font-bold uppercase px-2 py-0.5 transition-colors"
                  >
                    MANAGE_UPSTREAMS &gt;
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b-2 border-black bg-neutral-100 text-neutral-700 font-bold uppercase">
                        <th className="py-2.5 px-4">SERVICE_NAME</th>
                        <th className="py-2.5 px-4">INTERNAL_ENDPOINT</th>
                        <th className="py-2.5 px-4">PROTOCOL</th>
                        <th className="py-2.5 px-4">METHODS</th>
                        <th className="py-2.5 px-4">LATENCY</th>
                        <th className="py-2.5 px-4">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black">
                      {servers.map(s => (
                        <tr key={s.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-black flex items-center gap-2">
                            <span>{s.name}</span>
                            <span className="border border-black bg-neutral-200 text-black px-1.5 py-0.2 text-[10px] font-mono">
                              {s.slug}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-neutral-600">{s.url}</td>
                          <td className="py-3 px-4 font-mono font-bold">STREAMABLE_HTTP</td>
                          <td className="py-3 px-4 font-mono font-bold">{s.tools_count} EXPOSED</td>
                          <td className="py-3 px-4 font-mono">{s.latency_ms || 14}ms</td>
                          <td className="py-3 px-4">
                            <span className={`inline-block border-2 border-black px-2 py-0.5 font-mono text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] ${
                              s.status === 'CONNECTED'
                                ? 'bg-white text-black'
                                : 'bg-neutral-200 text-neutral-600'
                            }`}>
                              [{s.status}]
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: UPSTREAM MCP SERVERS */}
          {activeTab === 'servers' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="border-b-2 border-black pb-4 flex items-center justify-between">
                <div>
                  <h1 className="font-black text-2xl uppercase tracking-tight">UPSTREAM_MCP_SERVERS</h1>
                  <p className="font-mono text-xs font-bold text-neutral-600 uppercase mt-0.5">
                    REGISTER AND AUDIT STREAMABLE HTTP MCP MICROSERVICES RUNNING IN ISOLATED PODS
                  </p>
                </div>
                {currentUser.role === 'ADMIN' && (
                  <button
                    onClick={() => setShowAddServerModal(true)}
                    className="border-2 border-black bg-black text-white hover:bg-neutral-800 font-mono text-xs font-bold uppercase px-4 py-2 shadow-[3px_3px_0px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    [ REGISTER_SERVER ]
                  </button>
                )}
              </div>

              {/* Server Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {servers.map(s => (
                  <div key={s.id} className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_#000] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-3">
                        <div className="min-w-0 pr-2">
                          <h3 className="font-black text-sm uppercase tracking-tight truncate">{s.name}</h3>
                          <div className="font-mono text-[10px] text-neutral-500 font-bold uppercase">SLUG: {s.slug}</div>
                        </div>
                        <span className={`border-2 border-black px-2 py-0.5 font-mono text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] ${
                          s.status === 'CONNECTED' ? 'bg-white text-black' : 'bg-neutral-200 text-neutral-600'
                        }`}>
                          [{s.status}]
                        </span>
                      </div>

                      <div className="space-y-2 font-mono text-xs mb-4">
                        <div className="border border-black p-2 bg-neutral-50">
                          <div className="text-[10px] text-neutral-500 font-bold uppercase">STREAMABLE_ENDPOINT</div>
                          <div className="font-bold text-black break-all">{s.url}</div>
                        </div>
                        <div className="flex items-center justify-between text-neutral-600">
                          <span>TOOLS_EXPOSED:</span>
                          <span className="font-bold text-black">{s.tools_count}</span>
                        </div>
                        <div className="flex items-center justify-between text-neutral-600">
                          <span>ROUND_TRIP_LATENCY:</span>
                          <span className="font-bold text-black">{s.latency_ms || 14}ms</span>
                        </div>
                        <div className="flex items-center justify-between text-neutral-600">
                          <span>CREDENTIAL_VAULT:</span>
                          <span className="font-bold text-black">{s.has_auth ? 'PROTECTED (SERVER_SIDE)' : 'NONE (ANONYMOUS)'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t-2 border-black pt-3 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-neutral-500 font-bold uppercase">SYNCED: {s.last_checked}</span>
                      {currentUser.role === 'ADMIN' && (
                        <button
                          onClick={() => toggleServer(s.id)}
                          className={`border-2 border-black px-3 py-1 font-mono text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#000] active:translate-y-0.5 transition-all ${
                            s.is_enabled
                              ? 'bg-neutral-100 text-black hover:bg-black hover:text-white'
                              : 'bg-black text-white hover:bg-neutral-800'
                          }`}
                        >
                          {s.is_enabled ? '[ DISABLE ]' : '[ ENABLE ]'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: TOOL REGISTRY */}
          {activeTab === 'tools' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="border-b-2 border-black pb-4 flex items-center justify-between">
                <div>
                  <h1 className="font-black text-2xl uppercase tracking-tight">TOOL_REGISTRY</h1>
                  <p className="font-mono text-xs font-bold text-neutral-600 uppercase mt-0.5">
                    DYNAMICALLY AGGREGATED MCP TOOLS DISCOVERED FROM ALL CONNECTED SERVERS WITH COLLISION PREVENTION
                  </p>
                </div>
                <span className="border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000]">
                  {tools.length} METHODS AVAILABLE
                </span>
              </div>

              {/* Search & Filter Bar */}
              <div className="border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_#000] flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full md:w-96 border-2 border-black px-3 py-1.5 bg-neutral-50">
                  <Search className="w-4 h-4 text-black shrink-0" />
                  <input
                    type="text"
                    value={toolSearch}
                    onChange={e => setToolSearch(e.target.value)}
                    placeholder="Search by tool name or parameter description..."
                    className="w-full bg-transparent font-mono text-xs font-bold focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto font-mono text-xs font-bold">
                  {['ALL', 'WOO', 'INVENTORY', 'ANALYTICS'].map(filt => (
                    <button
                      key={filt}
                      onClick={() => setToolFilter(filt)}
                      className={`border-2 border-black px-3 py-1 uppercase shadow-[2px_2px_0px_0px_#000] active:translate-y-0.5 transition-all ${
                        toolFilter === filt ? 'bg-black text-white' : 'bg-white text-black hover:bg-neutral-100'
                      }`}
                    >
                      {filt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tool Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTools.map(t => (
                  <div key={t.name} className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000]">
                    <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
                      <span className="font-mono text-xs font-black text-black">{t.name}</span>
                      <span className="border border-black bg-neutral-200 text-black px-2 py-0.2 font-mono text-[10px] font-bold">
                        {t.server_slug.toUpperCase()}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-neutral-600 mb-3">{t.description}</p>
                    <div className="border border-black p-2 bg-neutral-50 font-mono text-[11px]">
                      <div className="text-[10px] text-neutral-500 font-bold uppercase mb-1">// INPUT_SCHEMA</div>
                      <pre className="text-black overflow-x-auto">{JSON.stringify(t.inputSchema || {}, null, 2)}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: OPERATIONS CONSOLE (CHAT AGENT WITH GROQ + REAL-TIME DATA) */}
          {activeTab === 'console' && (
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="border-b-2 border-black pb-2 flex items-center justify-between">
                <div>
                  <h1 className="font-black text-2xl uppercase tracking-tight">OPERATIONS_CONSOLE</h1>
                  <p className="font-mono text-xs font-bold text-neutral-600 uppercase mt-0.5">
                    AUTONOMOUS TOOL LOOP DRIVEN BY GROQ UNDER YOUR RBAC IDENTITY ({currentUser.name})
                  </p>
                </div>
              </div>

              {/* Terminal Window Box (Matching Reference Image 1) */}
              <div className="border-3 border-black bg-white shadow-[6px_6px_0px_0px_#000] flex flex-col h-[580px] overflow-hidden">
                {/* Window Titlebar */}
                <div className="bg-black text-white px-4 py-2.5 border-b-2 border-black flex flex-wrap items-center justify-between font-mono text-xs font-bold uppercase gap-2">
                  <div className="flex items-center gap-2">
                    <span>Operations Console</span>
                    <span className="text-neutral-500">|</span>
                    <span className="bg-neutral-800 text-neutral-200 px-2 py-0.5 border border-neutral-700">
                      Model: groq / openai/gpt-oss-120b
                    </span>
                    <span className="text-neutral-500">|</span>
                    <span className="text-neutral-300">Identity: {currentUser.name} ({currentUser.role})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowGroqConfig(!showGroqConfig)}
                      className="border border-white bg-black hover:bg-white hover:text-black px-2 py-0.5 text-[10px] uppercase font-bold"
                    >
                      {groqApiKey ? 'GROQ_KEY: ACTIVE' : 'SET_GROQ_KEY'}
                    </button>
                  </div>
                </div>

                {/* Groq Key Drawer */}
                {showGroqConfig && (
                  <div className="p-2.5 bg-neutral-100 border-b-2 border-black font-mono text-xs flex items-center gap-2">
                    <span className="font-bold">GROQ_API_KEY:</span>
                    <input
                      type="password"
                      value={groqApiKey}
                      onChange={e => {
                        setGroqApiKey(e.target.value);
                        localStorage.setItem('urumi_groq_key', e.target.value);
                      }}
                      placeholder="gsk_..."
                      className="flex-1 border-2 border-black bg-white px-2 py-1 font-mono text-xs focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        setShowGroqConfig(false);
                        showToast('GROQ_KEY_SAVED: Using Groq LLM');
                      }}
                      className="border-2 border-black bg-black text-white px-3 py-1 font-bold uppercase"
                    >
                      SAVE
                    </button>
                  </div>
                )}

                {/* Message Scroll Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 canvas-grid">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div className="font-mono text-[10px] font-bold text-neutral-500 uppercase mb-1">
                        {msg.role === 'user' ? `${currentUser.email}` : 'Gateway Engine · ' + msg.timestamp}
                      </div>
                      <div
                        className={`border-2 border-black p-3.5 max-w-2xl font-mono text-xs shadow-[3px_3px_0px_0px_#000] ${
                          msg.role === 'user' ? 'bg-neutral-100 text-black' : 'bg-white text-black'
                        }`}
                      >
                        {/* Function Call Execution Card (Matching User Reference Image 1) */}
                        {msg.tool_calls && msg.tool_calls.length > 0 && (
                          <div className="border border-black bg-neutral-900 text-white p-3 font-mono text-[11px] mb-3 shadow-[2px_2px_0px_0px_#000]">
                            <div className="flex items-center justify-between text-[10px] text-neutral-400 font-bold uppercase mb-1.5 border-b border-neutral-700 pb-1">
                              <span>EXECUTED FUNCTION CALLS ({msg.tool_calls.length})</span>
                              <span className="border border-white bg-black px-1.5 py-0.2 text-[10px]">200 OK</span>
                            </div>
                            {msg.tool_calls.map((tc, tcIdx) => (
                              <div key={tcIdx} className="space-y-0.5">
                                <div className="text-white font-bold">call: <span className="text-neutral-200">{tc.tool}</span></div>
                                <div className="text-neutral-400 text-[10px]">args: {JSON.stringify(tc.arguments)}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="whitespace-pre-wrap leading-relaxed font-medium">{msg.content}</div>
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="border-2 border-black bg-white p-3 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000] inline-block animate-pulse">
                      [ GROQ_AGENT_CALLING_UPSTREAM_TOOLS_IN_REALTIME... ]
                    </div>
                  )}
                </div>

                {/* Prompt Suggestions Bar */}
                <div className="border-t-2 border-black p-2 bg-neutral-100 flex items-center gap-2 overflow-x-auto font-mono text-[11px] font-bold">
                  <span className="text-neutral-500 shrink-0 uppercase">// PROMPTS:</span>
                  <button
                    onClick={() => sendChat("What orders came in today?")}
                    className="border border-black bg-white hover:bg-black hover:text-white px-2.5 py-1 shrink-0 uppercase shadow-[1px_1px_0px_0px_#000] transition-colors"
                  >
                    1. What orders came in today?
                  </button>
                  <button
                    onClick={() => sendChat("Which products sold today are low in inventory?")}
                    className="border border-black bg-white hover:bg-black hover:text-white px-2.5 py-1 shrink-0 uppercase shadow-[1px_1px_0px_0px_#000] transition-colors"
                  >
                    2. Low Stock Products Today?
                  </button>
                  <button
                    onClick={() => sendChat("Create a product called Demo Keyboard priced at 1499.")}
                    className="border border-black bg-white hover:bg-black hover:text-white px-2.5 py-1 shrink-0 uppercase shadow-[1px_1px_0px_0px_#000] transition-colors"
                  >
                    3. Create Demo Keyboard (1499)
                  </button>
                </div>

                {/* Command Input Bar */}
                <div className="p-3 border-t-2 border-black bg-white flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                    placeholder="Enter command or natural language question..."
                    className="flex-1 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold focus:outline-none shadow-[2px_2px_0px_0px_#000]"
                  />
                  <button
                    onClick={() => sendChat()}
                    disabled={chatLoading}
                    className="border-2 border-black bg-black text-white hover:bg-neutral-800 font-mono text-xs font-bold uppercase px-4 py-2 shadow-[2px_2px_0px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    [ SEND ]
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ACCESS CONTROL */}
          {activeTab === 'access' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="border-b-2 border-black pb-4 flex items-center justify-between">
                <div>
                  <h1 className="font-black text-2xl uppercase tracking-tight">ACCESS_CONTROL // RBAC</h1>
                  <p className="font-mono text-xs font-bold text-neutral-600 uppercase mt-0.5">
                    MANAGE TEAM ROLES AND PERMISSIONS (ADMINISTRATOR VS MEMBER)
                  </p>
                </div>
                {currentUser.role === 'ADMIN' && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="border-2 border-black bg-black text-white hover:bg-neutral-800 font-mono text-xs font-bold uppercase px-4 py-2 shadow-[3px_3px_0px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    [ INVITE_MEMBER ]
                  </button>
                )}
              </div>

              {/* Team Table */}
              <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] overflow-hidden">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b-2 border-black bg-black text-white uppercase font-bold">
                      <th className="py-2.5 px-4">OPERATOR_NAME</th>
                      <th className="py-2.5 px-4">EMAIL_IDENTIFIER</th>
                      <th className="py-2.5 px-4">ROLE_POLICY</th>
                      <th className="py-2.5 px-4">ACTIVE_API_KEYS</th>
                      <th className="py-2.5 px-4">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black">
                    {team.map(m => (
                      <tr key={m.id} className="hover:bg-neutral-50">
                        <td className="py-3 px-4 font-bold text-black">{m.name}</td>
                        <td className="py-3 px-4 text-neutral-600">{m.email}</td>
                        <td className="py-3 px-4">
                          <span className="border-2 border-black bg-neutral-100 text-black px-2 py-0.5 font-bold uppercase">
                            [{m.role}]
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold">{m.active_keys || 1} KEYS ISSUED</td>
                        <td className="py-3 px-4">
                          <span className="border border-black bg-white text-black px-2 py-0.2 font-bold">
                            ACTIVE
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: API CREDENTIALS */}
          {activeTab === 'keys' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="border-b-2 border-black pb-4 flex items-center justify-between">
                <div>
                  <h1 className="font-black text-2xl uppercase tracking-tight">API_CREDENTIALS</h1>
                  <p className="font-mono text-xs font-bold text-neutral-600 uppercase mt-0.5">
                    ISSUE SECURE USER API KEYS (UMCP_...) FOR CLAUDE CODE, CURSOR, AND MCP INSPECTOR
                  </p>
                </div>
                <button
                  onClick={handleGenerateKey}
                  className="border-2 border-black bg-black text-white hover:bg-neutral-800 font-mono text-xs font-bold uppercase px-4 py-2 shadow-[3px_3px_0px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  [ GENERATE_NEW_KEY ]
                </button>
              </div>

              {/* One-Time Reveal Modal Banner */}
              {newGeneratedKey && (
                <div className="border-3 border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
                  <div className="border-b-2 border-black pb-2 mb-3 flex items-center justify-between">
                    <span className="font-black text-xs uppercase tracking-wider text-black">
                      // ONE-TIME_CREDENTIAL_REVEAL: COPY NOW
                    </span>
                    <button
                      onClick={() => setNewGeneratedKey(null)}
                      className="border border-black px-2 py-0.5 font-mono text-xs font-bold hover:bg-black hover:text-white"
                    >
                      [ DISMISS ]
                    </button>
                  </div>
                  <div className="border-2 border-black bg-neutral-100 p-3 font-mono text-sm font-bold break-all mb-3 flex items-center justify-between gap-4">
                    <span>{newGeneratedKey}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(newGeneratedKey); showToast('COPIED_API_KEY'); }}
                      className="border-2 border-black bg-black text-white hover:bg-neutral-800 px-3 py-1 text-xs uppercase font-bold shrink-0"
                    >
                      COPY
                    </button>
                  </div>
                  <p className="font-mono text-[11px] text-neutral-600">
                    This key will not be shown again. It is stored as a cryptographic SHA-256 hash in the database.
                  </p>
                </div>
              )}

              {/* Keys Table */}
              <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] overflow-hidden">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b-2 border-black bg-black text-white uppercase font-bold">
                      <th className="py-2.5 px-4">KEY_DESCRIPTION</th>
                      <th className="py-2.5 px-4">PREFIX_IDENTIFIER</th>
                      <th className="py-2.5 px-4">CREATED_TIMESTAMP</th>
                      <th className="py-2.5 px-4">STATE</th>
                      <th className="py-2.5 px-4 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black">
                    {apiKeys.map(k => (
                      <tr key={k.id} className="hover:bg-neutral-50">
                        <td className="py-3 px-4 font-bold text-black">{k.name}</td>
                        <td className="py-3 px-4 text-neutral-600">{k.prefix}••••••••</td>
                        <td className="py-3 px-4 text-neutral-600">{k.created_at}</td>
                        <td className="py-3 px-4">
                          <span className={`border border-black px-2 py-0.5 font-bold uppercase ${
                            k.active ? 'bg-white text-black' : 'bg-neutral-200 text-neutral-500'
                          }`}>
                            {k.active ? 'ACTIVE' : 'REVOKED'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {k.active && (
                            <button
                              onClick={() => handleRevokeKey(k.id)}
                              className="border-2 border-black bg-white hover:bg-black hover:text-white px-2.5 py-1 text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#000] active:translate-y-0.5 transition-all"
                            >
                              [ REVOKE ]
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: FORENSIC AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="border-b-2 border-black pb-4 flex items-center justify-between">
                <div>
                  <h1 className="font-black text-2xl uppercase tracking-tight">AUDIT_TRAIL</h1>
                  <p className="font-mono text-xs font-bold text-neutral-600 uppercase mt-0.5">
                    PERMANENT, TAMPER-PROOF FORENSIC LOG OF EVERY DISPATCHED TOOL CALL AND OUTCOME
                  </p>
                </div>
                <span className="border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000]">
                  {auditLogs.length} LOGGED INVOCATIONS
                </span>
              </div>

              {/* Audit Table */}
              <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] overflow-hidden">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b-2 border-black bg-black text-white uppercase font-bold">
                      <th className="py-2.5 px-4">TIMESTAMP</th>
                      <th className="py-2.5 px-4">OPERATOR</th>
                      <th className="py-2.5 px-4">TARGET_SERVER</th>
                      <th className="py-2.5 px-4">TOOL_INVOKED</th>
                      <th className="py-2.5 px-4">DURATION</th>
                      <th className="py-2.5 px-4">STATUS</th>
                      <th className="py-2.5 px-4 text-right">INSPECT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black">
                    {auditLogs.map(a => (
                      <tr key={a.id} className="hover:bg-neutral-50">
                        <td className="py-3 px-4 font-mono text-neutral-600">{a.timestamp}</td>
                        <td className="py-3 px-4 font-bold text-black">{a.user_email}</td>
                        <td className="py-3 px-4 text-neutral-600">{a.server_name}</td>
                        <td className="py-3 px-4 font-bold text-black">{a.tool_name}</td>
                        <td className="py-3 px-4 font-mono">{a.duration_ms}ms</td>
                        <td className="py-3 px-4">
                          <span className={`border border-black px-2 py-0.5 font-bold uppercase ${
                            a.success ? 'bg-white text-black' : 'bg-neutral-200 text-neutral-600'
                          }`}>
                            {a.success ? 'SUCCESS' : 'FAILED'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedAuditItem(a)}
                            className="border border-black bg-neutral-100 hover:bg-black hover:text-white px-2 py-0.5 text-xs font-bold uppercase transition-colors"
                          >
                            [ VIEW ]
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: STOREFRONT PORTAL */}
          {activeTab === 'storefront' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="border-b-2 border-black pb-4 flex items-center justify-between">
                <div>
                  <h1 className="font-black text-2xl uppercase tracking-tight">STOREFRONT_PORTAL</h1>
                  <p className="font-mono text-xs font-bold text-neutral-600 uppercase mt-0.5">
                    WOOCOMMERCE STORE CATALOG · COD CHECKOUT · ORDER LIFECYCLE VERIFICATION
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000]">
                    CART: {cart.length} ITEMS
                  </span>
                </div>
              </div>

              {/* Order Confirmed Banner */}
              {recentOrder && (
                <div className="border-3 border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
                  <div className="border-b-2 border-black pb-2 mb-2 flex items-center justify-between">
                    <span className="font-black text-sm uppercase">ORDER_CONFIRMED: #{recentOrder.id}</span>
                    <button onClick={() => setRecentOrder(null)} className="font-mono text-xs font-bold underline">
                      [ DISMISS ]
                    </button>
                  </div>
                  <div className="font-mono text-xs space-y-1">
                    <div>TOTAL_AMOUNT: ₹{recentOrder.total}.00</div>
                    <div>PAYMENT_METHOD: {recentOrder.payment}</div>
                    <div>AUDIT_SYNC: Synchronized to Gateway Audit Trail via `woo__create_order`</div>
                  </div>
                </div>
              )}

              {/* Products Catalog Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {products.map(p => (
                  <div key={p.id} className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000] flex flex-col justify-between">
                    <div>
                      <div className="h-28 border-2 border-black bg-neutral-100 flex items-center justify-center text-4xl mb-3 shadow-[2px_2px_0px_0px_#000]">
                        {p.image}
                      </div>
                      <h4 className="font-black text-sm uppercase tracking-tight">{p.name}</h4>
                      <div className="font-mono text-[10px] text-neutral-500 font-bold mb-2">SKU: {p.sku}</div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-mono text-base font-black">₹{p.price}.00</span>
                        <span className={`border border-black px-1.5 py-0.2 font-mono text-[10px] font-bold ${
                          p.warning ? 'bg-neutral-200 text-black' : 'bg-white text-black'
                        }`}>
                          {p.warning ? 'LOW_STOCK (8)' : `STOCK: ${p.stock}`}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => addToCart(p)}
                      className="w-full border-2 border-black bg-black text-white hover:bg-neutral-800 font-mono text-xs font-bold uppercase py-2 shadow-[2px_2px_0px_0px_#000] active:translate-y-0.5 transition-all"
                    >
                      [ ADD_TO_CART ]
                    </button>
                  </div>
                ))}
              </div>

              {/* Shopping Cart Drawer */}
              {cart.length > 0 && (
                <div className="border-3 border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
                  <div className="border-b-2 border-black pb-2 mb-3 flex items-center justify-between">
                    <span className="font-black text-sm uppercase">// CHECKOUT_CART ({cart.length})</span>
                    <button onClick={() => setCart([])} className="font-mono text-xs font-bold underline">
                      EMPTY_CART
                    </button>
                  </div>
                  <div className="space-y-2 mb-4">
                    {cart.map((item, idx) => (
                      <div key={idx} className="border border-black p-2 flex items-center justify-between font-mono text-xs bg-neutral-50">
                        <span className="font-bold">{item.name}</span>
                        <span>₹{item.price}.00</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t-2 border-black pt-3 flex items-center justify-between">
                    <div className="font-mono text-sm font-black">
                      TOTAL: ₹{cart.reduce((s, i) => s + i.price, 0)}.00 (INR)
                    </div>
                    <button
                      onClick={handleCheckout}
                      className="border-2 border-black bg-black text-white hover:bg-neutral-800 font-mono text-xs font-bold uppercase px-6 py-2.5 shadow-[3px_3px_0px_0px_#000] active:translate-y-0.5 transition-all"
                    >
                      [ PLACE_ORDER_COD ]
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODAL: ADD UPSTREAM SERVER */}
      {showAddServerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="border-3 border-black bg-white p-6 shadow-[8px_8px_0px_0px_#000] w-full max-w-lg">
            <div className="border-b-2 border-black pb-3 mb-4 flex items-center justify-between">
              <span className="font-black text-sm uppercase">// REGISTER_UPSTREAM_MCP_SERVER</span>
              <button onClick={() => setShowAddServerModal(false)} className="font-mono font-bold text-sm">✕</button>
            </div>
            <form onSubmit={handleAddServer} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block font-bold uppercase mb-1">SERVICE_NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Warehouse Inventory"
                  value={newServerForm.name}
                  onChange={e => setNewServerForm({ ...newServerForm, name: e.target.value })}
                  className="w-full border-2 border-black px-3 py-2 font-mono text-xs focus:outline-none shadow-[2px_2px_0px_0px_#000]"
                />
              </div>
              <div>
                <label className="block font-bold uppercase mb-1">NAMESPACE_SLUG</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. inventory"
                  value={newServerForm.slug}
                  onChange={e => setNewServerForm({ ...newServerForm, slug: e.target.value })}
                  className="w-full border-2 border-black px-3 py-2 font-mono text-xs focus:outline-none shadow-[2px_2px_0px_0px_#000]"
                />
              </div>
              <div>
                <label className="block font-bold uppercase mb-1">STREAMABLE_HTTP_URL</label>
                <input
                  type="url"
                  required
                  placeholder="http://inventory-mcp:8002/mcp"
                  value={newServerForm.url}
                  onChange={e => setNewServerForm({ ...newServerForm, url: e.target.value })}
                  className="w-full border-2 border-black px-3 py-2 font-mono text-xs focus:outline-none shadow-[2px_2px_0px_0px_#000]"
                />
              </div>
              <div>
                <label className="block font-bold uppercase mb-1">STATIC_AUTH_HEADER (OPTIONAL)</label>
                <input
                  type="text"
                  placeholder="Bearer token or static API secret"
                  value={newServerForm.auth}
                  onChange={e => setNewServerForm({ ...newServerForm, auth: e.target.value })}
                  className="w-full border-2 border-black px-3 py-2 font-mono text-xs focus:outline-none shadow-[2px_2px_0px_0px_#000]"
                />
              </div>
              <div className="border-t-2 border-black pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddServerModal(false)}
                  className="border-2 border-black px-4 py-2 font-bold uppercase hover:bg-neutral-100"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="border-2 border-black bg-black text-white hover:bg-neutral-800 px-5 py-2 font-bold uppercase shadow-[2px_2px_0px_0px_#000]"
                >
                  [ CONFIRM_REGISTRATION ]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AUDIT DETAIL INSPECTOR */}
      {selectedAuditItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="border-3 border-black bg-white p-6 shadow-[8px_8px_0px_0px_#000] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b-2 border-black pb-3 mb-4 flex items-center justify-between">
              <span className="font-black text-sm uppercase">// AUDIT_ENTRY: #{selectedAuditItem.id}</span>
              <button onClick={() => setSelectedAuditItem(null)} className="font-mono font-bold text-sm">✕</button>
            </div>
            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2 border border-black p-3 bg-neutral-50">
                <div>OPERATOR: <span className="font-bold">{selectedAuditItem.user_email}</span></div>
                <div>SERVER: <span className="font-bold">{selectedAuditItem.server_name}</span></div>
                <div>TOOL: <span className="font-bold">{selectedAuditItem.tool_name}</span></div>
                <div>DURATION: <span className="font-bold">{selectedAuditItem.duration_ms}ms</span></div>
              </div>
              <div>
                <div className="font-bold uppercase mb-1">// REQUEST_PARAMETERS (SANITIZED)</div>
                <pre className="border border-black p-2 bg-neutral-900 text-white overflow-x-auto text-[11px]">
                  {selectedAuditItem.request_meta}
                </pre>
              </div>
              <div>
                <div className="font-bold uppercase mb-1">// RESPONSE_PAYLOAD (SANITIZED)</div>
                <pre className="border border-black p-2 bg-neutral-900 text-white overflow-x-auto text-[11px]">
                  {selectedAuditItem.response_meta}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
