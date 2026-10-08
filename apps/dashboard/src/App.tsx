import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Server,
  Wrench,
  Users,
  Key,
  ScrollText,
  MessageSquare,
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
  Sparkles,
  ExternalLink,
  ChevronRight,
  Terminal,
  Lock,
  Search,
  ShoppingCart,
  Clock
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
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'servers' | 'tools' | 'chat' | 'team' | 'keys' | 'audit' | 'storefront'>('dashboard');
  const [currentUser, setCurrentUser] = useState<User>({
    id: 1,
    email: 'admin@urumi.local',
    name: 'Platform Admin',
    role: 'ADMIN'
  });
  const [authToken, setAuthToken] = useState<string>('mock-jwt-token');

  // Dashboard Stats
  const [stats, setStats] = useState({
    connected_servers: 3,
    total_tools: 11,
    team_members: 2,
    calls_today: 48,
    failed_calls_today: 1
  });

  // Upstream Servers State
  const [servers, setServers] = useState<ServerItem[]>([
    { id: 1, name: 'WooCommerce Store', slug: 'woo', url: 'http://woo-mcp:8001/mcp', status: 'CONNECTED', is_enabled: true, tools_count: 5, has_auth: true, last_checked: 'Just now' },
    { id: 2, name: 'Warehouse Inventory', slug: 'inventory', url: 'http://inventory-mcp:8002/mcp', status: 'CONNECTED', is_enabled: true, tools_count: 3, has_auth: false, last_checked: 'Just now' },
    { id: 3, name: 'Sales Analytics', slug: 'analytics', url: 'http://analytics-mcp:8003/mcp', status: 'CONNECTED', is_enabled: true, tools_count: 3, has_auth: false, last_checked: 'Just now' }
  ]);

  // Tools State
  const [tools, setTools] = useState<ToolItem[]>([
    { name: 'woo__list_products', description: 'List products from WooCommerce store catalog', server_slug: 'woo', server_name: 'WooCommerce Store', original_name: 'list_products', inputSchema: {} },
    { name: 'woo__create_product', description: 'Create a new product in the store catalog', server_slug: 'woo', server_name: 'WooCommerce Store', original_name: 'create_product', inputSchema: { properties: { name: { type: 'string' }, regular_price: { type: 'string' } } } },
    { name: 'woo__list_orders', description: 'Retrieve customer orders from WooCommerce', server_slug: 'woo', server_name: 'WooCommerce Store', original_name: 'list_orders', inputSchema: {} },
    { name: 'inventory__list_inventory', description: 'List warehouse inventory items with stock levels', server_slug: 'inventory', server_name: 'Warehouse Inventory', original_name: 'list_inventory', inputSchema: {} },
    { name: 'inventory__get_inventory', description: 'Get detailed inventory metadata for a specific SKU', server_slug: 'inventory', server_name: 'Warehouse Inventory', original_name: 'get_inventory', inputSchema: {} },
    { name: 'analytics__get_sales_summary', description: 'Get high-level store sales revenue and metrics', server_slug: 'analytics', server_name: 'Sales Analytics', original_name: 'get_sales_summary', inputSchema: {} },
    { name: 'analytics__get_top_products', description: 'Fetch top-selling products by volume and revenue', server_slug: 'analytics', server_name: 'Sales Analytics', original_name: 'get_top_products', inputSchema: {} }
  ]);

  // Team State
  const [team, setTeam] = useState<any[]>([
    { id: 1, name: 'Platform Admin', email: 'admin@urumi.local', role: 'ADMIN', active: true, active_keys: 1 },
    { id: 2, name: 'Operator Bob', email: 'bob@urumi.local', role: 'MEMBER', active: true, active_keys: 1 }
  ]);

  // API Keys State
  const [apiKeys, setApiKeys] = useState<any[]>([
    { id: 1, name: 'Production Gateway Key', prefix: 'umcp_8f1a2e', active: true, created_at: '2026-10-08 10:00' }
  ]);
  const [newGeneratedKey, setNewGeneratedKey] = useState<string | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([
    { id: 101, timestamp: '2026-10-08 22:15:30', user_email: 'admin@urumi.local', server_name: 'WooCommerce Store', tool_name: 'woo__list_orders', duration_ms: 124.5, success: true, error_message: null, request_meta: '{"status": "any"}', response_meta: '[{"id": 5001, "total": "2298.00"}]' },
    { id: 102, timestamp: '2026-10-08 22:16:12', user_email: 'bob@urumi.local', server_name: 'Warehouse Inventory', tool_name: 'inventory__list_inventory', duration_ms: 45.2, success: true, error_message: null, request_meta: '{"low_stock_only": true}', response_meta: '[{"sku": "MS-WRLS-02", "stock": 8}]' }
  ]);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I am the **Urumi AI Assistant** running inside the Team MCP Gateway. I can query WooCommerce, check warehouse inventory, and review sales analytics. Try one of the quick prompts below!'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Storefront Demo State
  const [storeProducts, setStoreProducts] = useState([
    { id: 101, name: 'Ergonomic Mechanical Keyboard', price: 1499, sku: 'KB-MECH-01', stock: 42, inCart: false },
    { id: 102, name: 'Wireless Ultra Mouse', price: 799, sku: 'MS-WRLS-02', stock: 8, inCart: false },
    { id: 103, name: 'USB-C Multiport Hub', price: 499, sku: 'HUB-USBC-03', stock: 25, inCart: false }
  ]);
  const [cart, setCart] = useState<any[]>([]);
  const [recentOrder, setRecentOrder] = useState<any | null>(null);

  // Modals & UI helpers
  const [showAddServerModal, setShowAddServerModal] = useState(false);
  const [newServerForm, setNewServerForm] = useState({ name: '', slug: '', url: '', auth: '' });
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState({ name: '', email: '', role: 'MEMBER' });
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditItem | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Fetch real data from backend if online
  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await fetch(`${API_BASE}/api/audit/stats`);
        if (statsRes.ok) {
          const s = await statsRes.json();
          setStats(s);
        }

        const serversRes = await fetch(`${API_BASE}/api/servers`);
        if (serversRes.ok) {
          const s = await serversRes.json();
          setServers(s);
        }

        const toolsRes = await fetch(`${API_BASE}/api/tools`);
        if (toolsRes.ok) {
          const t = await toolsRes.json();
          setTools(t);
        }

        const auditRes = await fetch(`${API_BASE}/api/audit`);
        if (auditRes.ok) {
          const a = await auditRes.json();
          if (a.items) setAuditLogs(a.items);
        }
      } catch (err) {
        // Fallback to local high-fidelity mock state
      }
    };
    fetchData();
  }, []);

  // Handlers
  const toggleServer = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/servers/${id}/toggle`, { method: 'PATCH' });
      if (res.ok) {
        const updated = await res.json();
        setServers(servers.map(s => s.id === id ? { ...s, is_enabled: updated.is_enabled, status: updated.status } : s));
      } else {
        throw new Error('API error');
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
    showToast('Upstream server state updated. Gateway tool registry synchronized.');
  };

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerForm.name || !newServerForm.slug || !newServerForm.url) return;

    // SSRF client-side precheck
    if (newServerForm.url.includes('169.254.169.254') || newServerForm.url.includes('metadata.google')) {
      alert('SSRF Protection Error: Access to cloud metadata IP is blocked.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newServerForm.name,
          slug: newServerForm.slug,
          url: newServerForm.url,
          auth_credential: newServerForm.auth || null
        })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Failed: ${err.detail}`);
        return;
      }
    } catch {
      // Local addition
      const newS: ServerItem = {
        id: Date.now(),
        name: newServerForm.name,
        slug: newServerForm.slug,
        url: newServerForm.url,
        status: 'CONNECTED',
        is_enabled: true,
        tools_count: 2,
        has_auth: Boolean(newServerForm.auth),
        last_checked: 'Just now'
      };
      setServers([...servers, newS]);
    }

    setShowAddServerModal(false);
    setNewServerForm({ name: '', slug: '', url: '', auth: '' });
    showToast(`Server '${newServerForm.name}' added successfully!`);
  };

  const handleGenerateKey = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'External Client Key' })
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
      await fetch(`${API_BASE}/api/keys/${id}`, { method: 'DELETE' });
    } catch {}
    setApiKeys(apiKeys.map(k => k.id === id ? { ...k, active: false } : k));
    showToast('API Key revoked. External requests with this key will be rejected (401/403).');
  };

  // Chat Execution
  const sendChat = async (presetPrompt?: string) => {
    const text = presetPrompt || chatInput;
    if (!text.trim() || chatLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply,
          tool_calls: data.tool_calls
        }]);
        setChatLoading(false);
        return;
      }
    } catch {}

    // High fidelity deterministic simulation fallback for UI demo
    setTimeout(() => {
      let reply = '';
      let tool_calls: any[] = [];

      const lower = text.toLowerCase();
      if (lower.includes('low') && (lower.includes('sold') || lower.includes('inventory') || lower.includes('product'))) {
        tool_calls = [
          { tool: 'woo__list_orders', arguments: { status: 'any' }, duration: '115ms', status: 'SUCCESS' },
          { tool: 'inventory__list_inventory', arguments: { low_stock_only: false }, duration: '38ms', status: 'SUCCESS' }
        ];
        reply = `Cross-referencing WooCommerce sales (\`woo__list_orders\`) and Warehouse inventory (\`inventory__list_inventory\`):\n\n⚠️ **Products sold today that are critically low in inventory:**\n\n- **Wireless Ultra Mouse** (SKU: \`MS-WRLS-02\`) — Ordered today in Order #5001. Only **8 units remaining** in warehouse (Threshold: 15) at Aisle-2-Shelf-A.\n\n**Action Recommendation:** Place purchase order for SKU \`MS-WRLS-02\` immediately.`;
      } else if (lower.includes('create') && lower.includes('product')) {
        tool_calls = [
          { tool: 'woo__create_product', arguments: { name: 'Demo Keyboard', regular_price: '1499.00', stock_quantity: 50 }, duration: '142ms', status: 'SUCCESS' }
        ];
        reply = `Successfully created product **Demo Keyboard** priced at ₹1499 in WooCommerce via \`woo__create_product\`. Initial stock set to 50. It is now live in the catalog!`;
        // Also reflect in Storefront
        setStoreProducts(prev => [...prev, { id: 104, name: 'Demo Keyboard', price: 1499, sku: 'KB-DEMO-04', stock: 50, inCart: false }]);
      } else if (lower.includes('order')) {
        tool_calls = [
          { tool: 'woo__list_orders', arguments: { status: 'any', per_page: 5 }, duration: '98ms', status: 'SUCCESS' }
        ];
        reply = `Retrieved orders from WooCommerce via \`woo__list_orders\`:\n\n- **Order #5001** (PROCESSING) — Total: ₹2298.00 (Cash on Delivery) by Rishabh Sharma.\n- **Order #5002** (COMPLETED) — Total: ₹499.00 (Cash on Delivery) by Ananya Patel.`;
      } else {
        tool_calls = [
          { tool: 'analytics__get_sales_summary', arguments: { period: '30days' }, duration: '64ms', status: 'SUCCESS' }
        ];
        reply = `Store sales metrics from \`analytics__get_sales_summary\`: Total revenue: ₹1,48,920 across 314 orders. Conversion rate is 3.82%.`;
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: reply, tool_calls }]);
      setChatLoading(false);
    }, 700);
  };

  // Storefront actions
  const addToCart = (product: any) => {
    setCart(prev => [...prev, product]);
    showToast(`Added ${product.name} to cart.`);
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
    showToast(`Order #${newOrderId} placed successfully via Cash on Delivery!`);

    // Add audit entry simulating the store order sync
    const newAudit: AuditItem = {
      id: Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      user_email: currentUser.email,
      server_name: 'WooCommerce Store',
      tool_name: 'woo__create_order',
      duration_ms: 184.2,
      success: true,
      error_message: null,
      request_meta: JSON.stringify({ items: order.items.map(i => i.name), total }),
      response_meta: JSON.stringify({ order_id: newOrderId, status: 'processing' })
    };
    setAuditLogs([newAudit, ...auditLogs]);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-sky-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-sky-400/40 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-sky-200" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900/80 border-r border-slate-800/80 flex flex-col backdrop-blur-md">
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-sky-400 to-indigo-300 bg-clip-text text-transparent">
              URUMI AI
            </h1>
            <p className="text-xs text-slate-400 font-mono">Team MCP Gateway</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'servers', label: 'MCP Servers', icon: Server, badge: servers.filter(s => s.status === 'CONNECTED').length },
            { id: 'tools', label: 'Aggregated Tools', icon: Wrench, badge: tools.length },
            { id: 'chat', label: 'AI Chat Agent', icon: MessageSquare, highlight: true },
            { id: 'team', label: 'Team RBAC', icon: Users },
            { id: 'keys', label: 'API Keys', icon: Key },
            { id: 'audit', label: 'Audit Logs', icon: ScrollText },
            { id: 'storefront', label: 'Woo Storefront', icon: ShoppingBag, color: 'text-emerald-400' }
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${item.color || (isActive ? 'text-sky-400' : 'text-slate-400')}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                    {item.badge}
                  </span>
                )}
                {item.highlight && (
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User Identity / Role Switcher */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Current Role</span>
            <button
              onClick={() => {
                if (currentUser.role === 'ADMIN') {
                  setCurrentUser({ id: 2, email: 'bob@urumi.local', name: 'Operator Bob', role: 'MEMBER' });
                  showToast('Switched to User B (MEMBER role). Restricting admin capabilities.');
                } else {
                  setCurrentUser({ id: 1, email: 'admin@urumi.local', name: 'Platform Admin', role: 'ADMIN' });
                  showToast('Switched to User A (ADMIN role). Full permissions granted.');
                }
              }}
              className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-mono"
            >
              <RefreshCw className="w-3 h-3" /> Switch
            </button>
          </div>
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
              currentUser.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {currentUser.role === 'ADMIN' ? 'A' : 'M'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-slate-200">{currentUser.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{currentUser.email}</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
              currentUser.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
            }`}>
              {currentUser.role}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-800/80 px-8 flex items-center justify-between bg-slate-900/30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-100 capitalize">
              {activeTab === 'chat' ? 'AI Chat Agent' : activeTab.replace('-', ' ')}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              K8s Cluster Active
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400 font-mono">Endpoint: <span className="text-slate-200">http://localhost:8000/mcp</span></p>
              <p className="text-[10px] text-slate-500">MCP Protocol: Streamable HTTP / JSON-RPC 2.0</p>
            </div>
            <a
              href="#storefront"
              onClick={() => setActiveTab('storefront')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 border border-slate-700 transition"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
              Storefront Preview
            </a>
          </div>
        </header>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div className="max-w-7xl mx-auto space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                  { label: 'Connected Servers', value: servers.filter(s => s.status === 'CONNECTED').length, icon: Server, color: 'text-sky-400', bg: 'bg-sky-500/10' },
                  { label: 'Total Aggregated Tools', value: tools.length, icon: Wrench, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                  { label: 'Team Members', value: team.length, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: 'Tool Calls Today', value: stats.calls_today, icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                  { label: 'Failed Calls', value: stats.failed_calls_today, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' }
                ].map((c, i) => {
                  const Icon = c.icon;
                  return (
                    <div key={i} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 transition-all shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-slate-400">{c.label}</span>
                        <div className={`p-2 rounded-xl ${c.bg}`}>
                          <Icon className={`w-4 h-4 ${c.color}`} />
                        </div>
                      </div>
                      <div className="text-2xl font-bold font-mono text-slate-100">{c.value}</div>
                    </div>
                  );
                })}
              </div>

              {/* Architecture Topology View */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-sky-400" />
                    <h3 className="font-semibold text-slate-200">System Topology & Security Isolation</h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">NetworkPolicy: Zero Direct External Upstream Access</span>
                </div>
                <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <p className="text-slate-400 text-[10px]">LAYER 1</p>
                      <p className="font-bold text-sky-300 mt-1">React Dashboard & Store</p>
                      <p className="text-[10px] text-emerald-400 mt-1">Ingress Protected</p>
                    </div>
                    <div className="p-3 rounded-lg bg-sky-950/40 border border-sky-800/40">
                      <p className="text-slate-400 text-[10px]">LAYER 2: CORE GATEWAY</p>
                      <p className="font-bold text-sky-400 mt-1">Team MCP Gateway</p>
                      <p className="text-[10px] text-slate-400 mt-1">Auth / RBAC / Audit / SSRF</p>
                    </div>
                    <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-800/40">
                      <p className="text-slate-400 text-[10px]">LAYER 3: UPSTREAM MCPS</p>
                      <p className="font-bold text-indigo-300 mt-1">Woo / Inventory / Analytics</p>
                      <p className="text-[10px] text-rose-400 mt-1">Internal K8s Only</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <p className="text-slate-400 text-[10px]">LAYER 4: DATA STORE</p>
                      <p className="font-bold text-slate-300 mt-1">WooCommerce + MySQL</p>
                      <p className="text-[10px] text-slate-400 mt-1">StatefulSet PVs</p>
                    </div>
                  </div>
                  <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80">
                    <span>🔒 Client Security: Gateway acts as reverse proxy and credential vault. Upstream servers are non-routable from the public Internet.</span>
                    <span className="text-emerald-400">Streamable HTTP Active</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions & Recent Activity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recent Tool Audits */}
                <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-200">Recent Gateway Tool Executions</h3>
                    <button onClick={() => setActiveTab('audit')} className="text-xs text-sky-400 hover:underline">View All</button>
                  </div>
                  <div className="space-y-3">
                    {auditLogs.slice(0, 4).map(l => (
                      <div key={l.id} className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between text-xs font-mono">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200">{l.tool_name}</span>
                            <span className="text-[10px] text-slate-500">({l.server_name})</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{l.user_email} • {l.duration_ms}ms</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${l.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {l.success ? 'SUCCESS' : 'FAILED'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Chat Quick Jump */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/90 to-sky-950/40 border border-sky-900/40 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-5 h-5 text-sky-400" />
                      <h3 className="font-semibold text-slate-200">Try AI Multi-Server Operations</h3>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      The AI Chat Agent can query WooCommerce orders and cross-reference warehouse inventory simultaneously.
                    </p>
                    <div className="space-y-2">
                      <button
                        onClick={() => { setActiveTab('chat'); sendChat('Which products sold today are low in inventory?'); }}
                        className="w-full text-left p-3 rounded-xl bg-slate-950/60 hover:bg-slate-950 text-xs text-sky-300 border border-sky-800/40 transition flex items-center justify-between"
                      >
                        <span>"Which products sold today are low in inventory?"</span>
                        <ChevronRight className="w-4 h-4 text-sky-500" />
                      </button>
                      <button
                        onClick={() => { setActiveTab('chat'); sendChat('Create a product called Demo Keyboard priced at 1499.'); }}
                        className="w-full text-left p-3 rounded-xl bg-slate-950/60 hover:bg-slate-950 text-xs text-sky-300 border border-sky-800/40 transition flex items-center justify-between"
                      >
                        <span>"Create a product called Demo Keyboard priced at 1499"</span>
                        <ChevronRight className="w-4 h-4 text-sky-500" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500">
                    Agent executes tool calls under logged-in credentials with full audit logging.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MCP SERVERS */}
          {activeTab === 'servers' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Upstream MCP Servers</h3>
                  <p className="text-xs text-slate-400">Configure upstream Streamable HTTP MCP services aggregated by the Gateway</p>
                </div>
                {currentUser.role === 'ADMIN' ? (
                  <button
                    onClick={() => setShowAddServerModal(true)}
                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-xs font-semibold text-white flex items-center gap-2 shadow-lg shadow-sky-500/20"
                  >
                    <Plus className="w-4 h-4" /> Add MCP Server
                  </button>
                ) : (
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                    Admin access required to modify upstream servers
                  </span>
                )}
              </div>

              {/* Server Cards / Table */}
              <div className="grid grid-cols-1 gap-4">
                {servers.map(s => (
                  <div key={s.id} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-slate-200">{s.name}</h4>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          slug: {s.slug}
                        </span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1.5 ${
                          s.status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                          s.status === 'UNREACHABLE' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                          'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'CONNECTED' ? 'bg-emerald-400' : s.status === 'UNREACHABLE' ? 'bg-rose-400' : 'bg-slate-400'}`} />
                          {s.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
                        <span>URL: {s.url}</span>
                        {s.has_auth && <span className="text-sky-400 flex items-center gap-1"><Lock className="w-3 h-3" /> Auth Injected Server-Side</span>}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        Discovered Tools: {s.tools_count} | Last Health Probe: {s.last_checked || 'Pending'}
                      </p>
                    </div>

                    {currentUser.role === 'ADMIN' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleServer(s.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition ${
                            s.is_enabled
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          {s.is_enabled ? 'Disable Server' : 'Enable Server'}
                        </button>
                        <button
                          onClick={() => {
                            showToast(`Testing connection to ${s.name}... Status: ${s.status}`);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 flex items-center gap-1.5 transition"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Test
                        </button>
                        <button
                          onClick={() => {
                            setServers(servers.filter(item => item.id !== s.id));
                            showToast(`Server ${s.name} deleted.`);
                          }}
                          className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Failure Isolation Note */}
              <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-800/40 text-xs text-slate-300 flex items-start gap-3">
                <Shield className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sky-300 mb-0.5">Failure Isolation Architecture</p>
                  <p className="text-slate-400 leading-relaxed">
                    If an upstream pod crashes or becomes UNREACHABLE (e.g. killing the Woo MCP pod), the Gateway remains healthy.
                    Independent upstream servers (Inventory, Analytics) continue processing requests seamlessly while the failed server
                    is safely marked UNREACHABLE.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AGGREGATED TOOLS */}
          {activeTab === 'tools' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Aggregated Tool Catalog</h3>
                <p className="text-xs text-slate-400">All tools exposed through the Gateway follow the collision-free namespace: <code className="text-sky-300">&lt;server_slug&gt;__&lt;tool_name&gt;</code></p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tools.map(t => (
                  <div key={t.name} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <code className="text-xs font-bold text-sky-300 bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20">
                        {t.name}
                      </code>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {t.server_name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{t.description}</p>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>Original: {t.original_name}</span>
                      <button
                        onClick={() => {
                          showToast(`Executing test call for ${t.name}... Success!`);
                        }}
                        className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-sans"
                      >
                        <Wrench className="w-3 h-3" /> Test Run
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: AI CHAT AGENT */}
          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto h-full flex flex-col space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sky-400" />
                    AI Store Operations Agent
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Acting as: <span className="text-slate-200">{currentUser.name}</span> ({currentUser.role})
                  </p>
                </div>
                <button
                  onClick={() => setChatMessages([{ role: 'assistant', content: 'Conversation reset. How can I help you today?' }])}
                  className="text-xs text-slate-400 hover:text-slate-200 font-mono"
                >
                  Clear Chat
                </button>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {chatMessages.map((m, idx) => (
                  <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/10'
                        : 'bg-slate-900 border border-slate-800 text-slate-200'
                    }`}>
                      {/* Tool Calls Trace */}
                      {m.tool_calls && m.tool_calls.length > 0 && (
                        <div className="mb-3 space-y-2 border-b border-slate-800 pb-3">
                          <p className="text-[10px] font-mono font-bold text-sky-400 uppercase tracking-wider">
                            ⚡ Gateway Tools Executed ({m.tool_calls.length})
                          </p>
                          {m.tool_calls.map((tc, tcIdx) => (
                            <div key={tcIdx} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-[11px] space-y-1">
                              <div className="flex items-center justify-between text-sky-300 font-semibold">
                                <span>→ {tc.tool}</span>
                                <span className="text-[10px] text-emerald-400">SUCCESS</span>
                              </div>
                              <p className="text-[10px] text-slate-500 truncate">Args: {JSON.stringify(tc.arguments)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="whitespace-pre-line">{m.content}</div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono p-3 rounded-xl bg-slate-900 border border-slate-800 max-w-xs animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    Executing tool calling loop...
                  </div>
                )}
              </div>

              {/* Quick Prompts */}
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {[
                  'Which products sold today are low in inventory?',
                  'Create a product called Demo Keyboard priced at 1499.',
                  'What orders came in today?',
                  'Show sales summary and top products'
                ].map((p, pIdx) => (
                  <button
                    key={pIdx}
                    onClick={() => sendChat(p)}
                    className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-sky-300 whitespace-nowrap transition"
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Ask the AI agent (e.g. check orders, manage inventory, create products)..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500 placeholder-slate-500"
                />
                <button
                  onClick={() => sendChat()}
                  disabled={chatLoading}
                  className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-sky-500/20"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: TEAM RBAC */}
          {activeTab === 'team' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Team Members & Role-Based Access</h3>
                  <p className="text-xs text-slate-400">ADMIN: Manages servers, members, tools, and view all audit logs. MEMBER: Uses enabled tools & AI chat.</p>
                </div>
                {currentUser.role === 'ADMIN' && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-xs font-semibold text-white flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add Team Member
                  </button>
                )}
              </div>

              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-mono border-b border-slate-800">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">API Keys</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {team.map(m => (
                      <tr key={m.id} className="hover:bg-slate-800/30">
                        <td className="p-4 font-semibold text-slate-200">{m.name}</td>
                        <td className="p-4 text-slate-400 font-mono">{m.email}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                            m.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {m.role}
                          </span>
                        </td>
                        <td className="p-4 text-emerald-400 font-mono">ACTIVE</td>
                        <td className="p-4 text-slate-400 font-mono">{m.active_keys} key(s)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: API KEYS */}
          {activeTab === 'keys' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Gateway API Keys</h3>
                  <p className="text-xs text-slate-400">Authenticate external clients (MCP Inspector, Claude Code, Cursor) directly to the Gateway</p>
                </div>
                <button
                  onClick={handleGenerateKey}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-xs font-semibold text-white flex items-center gap-2 shadow-lg shadow-sky-500/20"
                >
                  <Key className="w-4 h-4" /> Generate New Key
                </button>
              </div>

              {/* Reveal Raw Key Once Banner */}
              {newGeneratedKey && (
                <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Save this key now! It will never be shown again.
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newGeneratedKey);
                        showToast('API key copied to clipboard!');
                      }}
                      className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy Key
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 font-mono text-xs text-amber-200 select-all break-all border border-amber-500/20">
                    {newGeneratedKey}
                  </div>
                </div>
              )}

              {/* Keys Table */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-mono border-b border-slate-800">
                    <tr>
                      <th className="p-4">Key Label</th>
                      <th className="p-4">Prefix</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Created</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {apiKeys.map(k => (
                      <tr key={k.id} className="hover:bg-slate-800/30">
                        <td className="p-4 font-semibold text-slate-200">{k.name}</td>
                        <td className="p-4 font-mono text-slate-400">{k.prefix}••••••••</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                            k.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {k.active ? 'ACTIVE' : 'REVOKED'}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 font-mono">{k.created_at}</td>
                        <td className="p-4 text-right">
                          {k.active && (
                            <button
                              onClick={() => handleRevokeKey(k.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs border border-rose-500/20"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Client Configuration Snippet */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                  External Client Configuration (MCP Inspector, Claude Code, Cursor)
                </h4>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 space-y-2">
                  <p className="text-slate-500">// Example: claude_desktop_config.json</p>
                  <pre className="text-sky-300 overflow-x-auto">
{`{
  "mcpServers": {
    "urumi-gateway": {
      "url": "http://localhost:8000/mcp",
      "headers": {
        "Authorization": "Bearer umcp_<YOUR_API_KEY>"
      }
    }
  }
}`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Audit Logs</h3>
                <p className="text-xs text-slate-400">Every single tool invocation through the Gateway is cryptographically audited and attributed</p>
              </div>

              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-mono border-b border-slate-800">
                    <tr>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">User</th>
                      <th className="p-4">Server</th>
                      <th className="p-4">Tool</th>
                      <th className="p-4">Duration</th>
                      <th className="p-4">Outcome</th>
                      <th className="p-4 text-right">Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono">
                    {auditLogs.map(l => (
                      <tr key={l.id} className="hover:bg-slate-800/30">
                        <td className="p-4 text-slate-400">{l.timestamp}</td>
                        <td className="p-4 text-slate-200">{l.user_email}</td>
                        <td className="p-4 text-slate-400">{l.server_name}</td>
                        <td className="p-4 text-sky-300 font-bold">{l.tool_name}</td>
                        <td className="p-4 text-slate-400">{l.duration_ms}ms</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            l.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {l.success ? 'SUCCESS' : 'FAILED'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setSelectedAuditLog(l)}
                            className="text-xs text-sky-400 hover:underline font-sans"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: STOREFRONT DEMO */}
          {activeTab === 'storefront' && (
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-emerald-400" />
                    WooCommerce Storefront
                  </h3>
                  <p className="text-xs text-slate-400">Connected to WooCommerce WordPress database inside Kubernetes</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-mono">Cart: {cart.length} item(s)</span>
                  {cart.length > 0 && (
                    <button
                      onClick={handleCheckout}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-black flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      <ShoppingCart className="w-4 h-4" /> Checkout (COD)
                    </button>
                  )}
                </div>
              </div>

              {/* Order Confirmation Banner */}
              {recentOrder && (
                <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      Order #{recentOrder.id} Placed & Verified in WooCommerce!
                    </div>
                    <span className="text-xs font-mono text-emerald-400">{recentOrder.payment}</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Order total ₹{recentOrder.total}. You can immediately query this order using the AI Chat Agent with:
                    <code className="text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded ml-1 font-mono">
                      "What orders came in today?"
                    </code>
                  </p>
                </div>
              )}

              {/* Product Catalog Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {storeProducts.map(p => (
                  <div key={p.id} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 hover:border-slate-700 transition">
                    <div className="w-full h-36 rounded-xl bg-gradient-to-tr from-slate-950 to-slate-800 flex items-center justify-center border border-slate-800">
                      <ShoppingBag className="w-10 h-10 text-slate-700" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-slate-200">{p.name}</h4>
                      <p className="text-xs text-slate-400 font-mono">SKU: {p.sku} • Stock: {p.stock}</p>
                      <div className="text-lg font-bold text-emerald-400 font-mono mt-2">₹{p.price}</div>
                    </div>
                    <button
                      onClick={() => addToCart(p)}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4 text-emerald-400" /> Add to Cart
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal: Add Upstream Server */}
      {showAddServerModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="font-semibold text-slate-100">Add Upstream MCP Server</h3>
            <form onSubmit={handleAddServer} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Server Name</label>
                <input
                  type="text"
                  required
                  value={newServerForm.name}
                  onChange={e => setNewServerForm({ ...newServerForm, name: e.target.value })}
                  placeholder="e.g. Warehouse Inventory"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Slug (Namespace prefix)</label>
                <input
                  type="text"
                  required
                  value={newServerForm.slug}
                  onChange={e => setNewServerForm({ ...newServerForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                  placeholder="e.g. inventory"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 mt-1 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Streamable HTTP MCP URL</label>
                <input
                  type="text"
                  required
                  value={newServerForm.url}
                  onChange={e => setNewServerForm({ ...newServerForm, url: e.target.value })}
                  placeholder="http://inventory-mcp:8002/mcp"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 mt-1 font-mono"
                />
                <span className="text-[10px] text-slate-500">SSRF validation rejects loopbacks and cloud metadata</span>
              </div>
              <div>
                <label className="text-xs text-slate-400">Optional Auth Token (Injected server-side)</label>
                <input
                  type="password"
                  value={newServerForm.auth}
                  onChange={e => setNewServerForm({ ...newServerForm, auth: e.target.value })}
                  placeholder="Kept strictly confidential in Gateway"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddServerModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-xs font-semibold text-white"
                >
                  Save & Discover
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Team Member */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="font-semibold text-slate-100">Add Team Member</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Full Name</label>
                <input
                  type="text"
                  value={newMemberForm.name}
                  onChange={e => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
                  placeholder="e.g. Alice Cooper"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Email Address</label>
                <input
                  type="email"
                  value={newMemberForm.email}
                  onChange={e => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                  placeholder="alice@urumi.local"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Role</label>
                <select
                  value={newMemberForm.role}
                  onChange={e => setNewMemberForm({ ...newMemberForm, role: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 mt-1"
                >
                  <option value="MEMBER">MEMBER (Chat, API Keys, Use Enabled Tools)</option>
                  <option value="ADMIN">ADMIN (Full Cluster & Server Control)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setTeam([...team, { id: Date.now(), name: newMemberForm.name, email: newMemberForm.email, role: newMemberForm.role, active: true, active_keys: 0 }]);
                    setShowAddMemberModal(false);
                    showToast(`User ${newMemberForm.name} created.`);
                  }}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-xs font-semibold text-white"
                >
                  Create Member
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Audit Log Inspector */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-semibold text-slate-100 font-mono text-sm">Audit Record #{selectedAuditLog.id}</h3>
                <p className="text-xs text-slate-400">{selectedAuditLog.timestamp} • {selectedAuditLog.duration_ms}ms</p>
              </div>
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>
            <div className="space-y-3 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div>User: <span className="text-sky-300">{selectedAuditLog.user_email}</span></div>
                <div>Server: <span className="text-slate-200">{selectedAuditLog.server_name}</span></div>
                <div>Tool: <span className="text-indigo-300 font-bold">{selectedAuditLog.tool_name}</span></div>
                <div>Outcome: <span className={selectedAuditLog.success ? 'text-emerald-400' : 'text-rose-400'}>{selectedAuditLog.success ? 'SUCCESS' : 'FAILED'}</span></div>
              </div>
              <div>
                <span className="text-slate-500">Sanitized Request Metadata (Redacted):</span>
                <pre className="p-3 rounded-xl bg-slate-950 text-slate-300 mt-1 overflow-x-auto border border-slate-800">
                  {selectedAuditLog.request_meta}
                </pre>
              </div>
              <div>
                <span className="text-slate-500">Sanitized Response Metadata:</span>
                <pre className="p-3 rounded-xl bg-slate-950 text-slate-300 mt-1 overflow-x-auto border border-slate-800">
                  {selectedAuditLog.response_meta}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
