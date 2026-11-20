import {
  Activity,
  Archive,
  ArrowUpRight,
  Ban,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Command,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileCode2,
  GitBranch,
  Globe2,
  Github,
  HardDrive,
  Keyboard,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  Monitor,
  Network,
  Inbox,
  Layers3,
  Pencil,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  PinOff,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Terminal,
  Trash2,
  Upload,
  User,
  UserRound,
  Users,
  Wrench,
  Workflow,
  X,
  Zap,
  Palette,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CORE = "/__asuka/core";
const DEFAULT_OMB_URL = "http://127.0.0.1:8799";
const ASUKA_SECTION = "ASUKA";
const ADAPTER_KEY = "asuka.adapter";
const ADAPTER_DEFAULT_MIGRATION_KEY = "asuka.adapterDefaultMigration.v2";
const ENGINE_API_KEY = "asuka.engineApi";
const UI_SETTINGS_KEY = "asuka.ui-settings";
const ADAPTER_IDS = ["native", "codex", "claude", "dsh", "openmausbot"];
const ADAPTER_LABELS = {
  native: "Bot API",
  codex: "Codex",
  claude: "Claude",
  dsh: "DSH",
  openmausbot: "OpenMausBot",
};
const TASK_CATEGORIES = [
  { value: "research", label: "研究" },
  { value: "market_analysis", label: "市场分析" },
  { value: "software", label: "软件" },
  { value: "ai_product", label: "AI 产品" },
  { value: "data_pipeline", label: "数据管道" },
  { value: "automation", label: "自动化" },
  { value: "content", label: "内容" },
  { value: "operations", label: "运营" },
  { value: "unknown", label: "未分类" },
];
const TASK_CATEGORY_LABELS = Object.fromEntries(TASK_CATEGORIES.map((item) => [item.value, item.label]));
const TASK_INBOX_PROJECT = "inbox";
const PROVIDER_SETUP = [
  { id: "openai", label: "OpenAI", defaultUrl: "https://api.openai.com/v1", detail: "GPT API", native: true, configKey: "openai", instanceId: "openai" },
  { id: "anthropic", label: "Anthropic", defaultUrl: "https://api.anthropic.com", detail: "Claude API", native: true, configKey: "anthropic", instanceId: "claudeApi" },
  { id: "openrouter", label: "OpenRouter", defaultUrl: "https://openrouter.ai/api/v1", detail: "多模型路由", native: true, configKey: "openrouter", instanceId: "openrouter" },
  { id: "xai", label: "xAI / Grok", defaultUrl: "https://api.x.ai/v1", detail: "Grok API", native: true, configKey: "xai", instanceId: "xaiApi" },
  { id: "mistral", label: "Mistral", defaultUrl: "https://api.mistral.ai/v1", detail: "Mistral API", native: true, configKey: "mistral", instanceId: "mistral" },
  { id: "groq", label: "Groq", defaultUrl: "https://api.groq.com/openai/v1", detail: "高速推理", native: true, configKey: "groq", instanceId: "groq" },
  { id: "cerebras", label: "Cerebras", defaultUrl: "https://api.cerebras.ai/v1", detail: "高速推理", native: true, configKey: "cerebras", instanceId: "cerebras" },
  { id: "greenference", label: "Greenference", defaultUrl: "https://llm.eu.greenference.com/v1", detail: "欧洲推理服务", native: true, configKey: "greenference", instanceId: "greenference" },
  { id: "modelgo", label: "ModelGo", defaultUrl: "https://api.modelgo.ai/v1", detail: "聚合模型服务", native: true, configKey: "modelgo", instanceId: "modelgo" },
  { id: "meta", label: "Meta", defaultUrl: "https://api.meta.ai/v1", detail: "Meta Muse API", native: true, configKey: "meta", instanceId: "meta" },
  { id: "deepseek", label: "DeepSeek", defaultUrl: "https://api.deepseek.com/v1", modelPlaceholder: "deepseek-chat", detail: "DeepSeek 官方 API", native: false },
  { id: "qwen", label: "Qwen / DashScope", defaultUrl: "", modelPlaceholder: "qwen-plus", detail: "阿里云百炼兼容端点", native: false },
  { id: "zai", label: "Z.ai / GLM", defaultUrl: "https://api.z.ai/api/paas/v4", modelPlaceholder: "glm-5.3", detail: "智谱 GLM 兼容端点", native: false },
  { id: "moonshot", label: "Moonshot / Kimi", defaultUrl: "https://api.moonshot.cn/v1", modelPlaceholder: "moonshot-v1-8k", detail: "Moonshot 兼容端点", native: false },
  { id: "custom", label: "自定义兼容接口", defaultUrl: "", modelPlaceholder: "model-id", detail: "EchoBird、Ollama、vLLM、LM Studio 等", native: false },
];
const VIEW_ITEMS = [
  { id: "command", label: "指挥台", icon: Command },
  { id: "fabric", label: "Fabric", icon: Layers3 },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "tasks", label: "任务", icon: Activity },
  { id: "agents", label: "Bots", icon: Bot },
  { id: "skills", label: "Skills", icon: BookOpen },
  { id: "approvals", label: "审批", icon: ShieldCheck },
  { id: "rooms", label: "Rooms", icon: MessageCircle },
  { id: "runtimes", label: "Runtimes", icon: Cpu },
  { id: "settings", label: "设置", icon: Settings2 },
];

const AGENT_COLORS = {
  yellow: "#a87a16",
  red: "#b94d42",
  orange: "#bb6a31",
  teal: "#197a78",
  green: "#4f7555",
  blue: "#356f96",
  purple: "#755e86",
  chrome: "#697176",
};

const BOT_CREW = [
  { key: "nova", name: "NOVA", role: "CORE", action: "PLAN", accent: "#ff4f87", aliases: ["asuka planner", "asuka concierge", "planner", "concierge", "chief", "orchestrator", "core", "product owner", "delivery lead"], roles: ["product_owner", "delivery_lead"] },
  { key: "byte", name: "BYTE", role: "CODE", action: "BUILD", accent: "#3978f6", aliases: ["asuka builder", "builder", "software engineer", "ai engineer", "coding", "implementation", "code"], roles: ["software_engineer", "ai_engineer"] },
  { key: "lens", name: "LENS", role: "RESEARCH", action: "SCAN", accent: "#8a5cff", aliases: ["research", "researcher", "domain expert", "investigate", "evidence"], roles: ["domain_expert"] },
  { key: "grid", name: "GRID", role: "DATA", action: "CHECK", accent: "#0d8e9f", aliases: ["data", "analyst", "analysis", "database", "dataset"], roles: ["data_engineer"] },
  { key: "bloom", name: "BLOOM", role: "DESIGN", action: "STYLE", accent: "#f13bc2", aliases: ["design", "designer", "product design", "interface", "visual"], roles: ["product_designer"] },
  { key: "relay", name: "RELAY", role: "OPS", action: "RUN", accent: "#11b981", aliases: ["operations", "ops", "runtime", "release", "deploy", "delivery"], roles: [] },
  { key: "guard", name: "GUARD", role: "SECURITY", action: "AUDIT", accent: "#e33f57", aliases: ["asuka reviewer", "reviewer", "review", "evaluator", "quality", "security", "platform security", "audit"], roles: ["evaluator", "platform_security"] },
  { key: "sprout", name: "SPROUT", role: "GROWTH", action: "TEST", accent: "#8bcf25", aliases: ["growth", "experiment", "marketing", "sales", "test"], roles: [] },
  { key: "luna", name: "LUNA", role: "NIGHT", action: "WATCH", accent: "#4b4acf", aliases: ["night", "watch", "monitor", "background"], roles: [] },
];

const CREW_BY_KEY = Object.fromEntries(BOT_CREW.map((crew) => [crew.key, crew]));
const CREW_BY_ROLE = Object.fromEntries(BOT_CREW.flatMap((crew) => crew.roles.map((role) => [role, crew])));
const LEGACY_ACCENTS = { ember: "nova", teal: "grid", graphite: "luna" };
const BOOT_STAGES = [
  [0, "INITIALIZING NOVA CORE"],
  [26, "SYNCING NINE AGENT CREW"],
  [52, "MOUNTING WORKSPACE"],
  [78, "CALIBRATING INTERFACE"],
  [100, "NOVA CORE ONLINE"],
];

function normalizeOmbUrl(value) {
  const raw = String(value || DEFAULT_OMB_URL).trim();
  const parsed = new URL(raw.includes("://") ? raw : `http://${raw}`);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("OpenMausBot 地址必须使用 http 或 https");
  if (parsed.username || parsed.password) throw new Error("OpenMausBot 地址不能包含账号密码");
  return parsed.origin;
}

function readOmbUrl() {
  try {
    return normalizeOmbUrl(localStorage.getItem("asuka.ombUrl") || DEFAULT_OMB_URL);
  } catch {
    return DEFAULT_OMB_URL;
  }
}

function writeOmbUrl(value) {
  const next = normalizeOmbUrl(value);
  localStorage.setItem("asuka.ombUrl", next);
  window.dispatchEvent(new CustomEvent("asuka:omb-url", { detail: next }));
  return next;
}

function readAdapter() {
  const saved = localStorage.getItem(ADAPTER_KEY);
  return ADAPTER_IDS.includes(saved) ? saved : "native";
}

function readEngineApi() {
  return localStorage.getItem(ENGINE_API_KEY) || "";
}

function apiInstancesFrom(snapshot) {
  const seen = new Set();
  return (snapshot?.instances || []).filter((item) => {
    if (item.snapshot?.state !== "available" || item.snapshot?.authenticated === false) return false;
    if (!item.url || !item.models?.default) return false;
    const key = `${item.displayName}|${item.models.default}|${item.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function writeAdapter(value) {
  const next = ADAPTER_IDS.includes(value) ? value : "native";
  localStorage.setItem(ADAPTER_KEY, next);
  window.dispatchEvent(new CustomEvent("asuka:adapter", { detail: next }));
  return next;
}

function readUiSettings() {
  try {
    return JSON.parse(localStorage.getItem(UI_SETTINGS_KEY) || "null") || {};
  } catch {
    return {};
  }
}

function applyUiSettings(settings = {}) {
  const root = document.documentElement;
  const requestedAccent = LEGACY_ACCENTS[settings.appearance?.accent] || settings.appearance?.accent;
  root.dataset.accent = BOT_CREW.some((crew) => crew.key === requestedAccent) ? requestedAccent : "nova";
  root.dataset.density = settings.appearance?.density || "comfortable";
}

function saveUiSettings(settings) {
  const value = {
    appearance: settings.appearance,
    general: { closeConfirm: settings.general?.closeConfirm !== false },
  };
  localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(value));
  applyUiSettings(value);
  window.dispatchEvent(new CustomEvent("asuka:ui-settings", { detail: value }));
}

async function core(path, options = {}) {
  const { ombUrl, adapter, ...requestOptions } = options;
  const effectiveAdapter = adapter || readAdapter();
  const headers = {
    "x-asuka-adapter": effectiveAdapter,
    ...(effectiveAdapter === "openmausbot" || ombUrl ? { "x-asuka-omb-url": normalizeOmbUrl(ombUrl || readOmbUrl()) } : {}),
    ...(requestOptions.body ? { "content-type": "application/json" } : {}),
    ...requestOptions.headers,
  };
  const response = await fetch(`${CORE}${path}`, { ...requestOptions, headers });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) throw new Error(typeof data === "object" && data?.error ? data.error : text || `ASUKA Core HTTP ${response.status}`);
  return data;
}

async function probeOmb(value) {
  const health = await core("/health", { ombUrl: value, adapter: "openmausbot" });
  if (health?.app !== "openmausbot") throw new Error("目标地址不是 OpenMausBot");
  return health;
}

function mergeMessage(current, message) {
  if (!message?.id) return current;
  const index = current.findIndex((item) => item.id === message.id);
  if (index < 0) return [...current, message];
  const next = [...current];
  next[index] = message;
  return next;
}

async function launchOmbRuntime() {
  const response = await fetch("/__asuka/omb-launch", { method: "POST" });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || "OpenMausBot 启动失败");
  return result;
}

function initials(name = "") {
  const clean = name.trim();
  if (!clean) return "AI";
  const parts = clean.split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase() : clean.slice(0, 2).toUpperCase();
}

function friendlyTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function shortText(text = "", length = 180) {
  const value = String(text).replace(/\s+/g, " ").trim();
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function statusTone(state) {
  if (state === "available" || state === "running" || state === "completed") return "ok";
  if (state === "needs-input" || state === "waiting" || state === "queued") return "warn";
  if (state === "failed" || state === "unavailable") return "bad";
  return "idle";
}

function taskProjectKey(task) {
  return String(task?.project || "").trim() || TASK_INBOX_PROJECT;
}

function taskProjectLabel(project) {
  return project === TASK_INBOX_PROJECT ? "未分组" : project;
}

function taskSortOrder(a, b) {
  return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
    || Number(b.updatedAt || b.lastThreadOrderAt || 0) - Number(a.updatedAt || a.lastThreadOrderAt || 0);
}

function crewForKey(key) {
  return CREW_BY_KEY[String(key || "").toLowerCase()] || null;
}

function crewForRole(role = "") {
  return CREW_BY_ROLE[String(role || "").toLowerCase()] || null;
}

function crewForBot(value = "") {
  const text = typeof value === "string" ? value : `${value?.name || ""} ${value?.title || ""} ${value?.description || ""}`;
  const normalized = text.toLowerCase();
  const direct = BOT_CREW.find((crew) => normalized.includes(crew.name.toLowerCase()));
  if (direct) return direct;
  return BOT_CREW.find((crew) => crew.aliases.some((alias) => normalized.includes(alias))) || null;
}

function crewImage(key, size = "128") {
  return `/brand/bots/${crewForKey(key)?.key || "nova"}-${size}.png`;
}

function displayBotName(name) {
  return crewForBot(name)?.name || name;
}

function Avatar({ name, color = "chrome", size = "md", busy = false, role = "" }) {
  const crew = role ? crewForRole(role) : crewForBot(name);
  return (
    <span className={`avatar avatar--${size} ${busy ? "is-busy" : ""} ${crew ? "avatar--crew" : ""}`} style={{ "--avatar-color": crew?.accent || AGENT_COLORS[color] || AGENT_COLORS.chrome }} title={crew ? `${name} · ${crew.name} ${crew.role}` : name}>
      {crew ? <img src={crewImage(crew.key, size === "lg" ? "512" : "128")} alt="" draggable="false" /> : initials(name)}
    </span>
  );
}

function BrandMark({ large = false, className = "" }) {
  return (
    <span className={`brand-mark ${large ? "brand-mark--large" : ""} ${className}`} aria-hidden="true">
      <img src="/brand/asuka-logo.svg" alt="" draggable="false" />
    </span>
  );
}

function StatusDot({ tone = "idle", pulse = false }) {
  return <span className={`status-dot status-dot--${tone} ${pulse ? "is-pulsing" : ""}`} aria-hidden="true" />;
}

function SidebarDisclosure({ label, count, open, onToggle, action, children }) {
  return (
    <section className="sidebar-disclosure">
      <div className="sidebar-disclosure__head">
        <button className="sidebar-disclosure__toggle" onClick={onToggle} aria-expanded={open}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span>{label}</span>
          {count !== undefined && <small>{count}</small>}
        </button>
        {action}
      </div>
      {open && <div className="sidebar-disclosure__body">{children}</div>}
    </section>
  );
}

function Toast({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={`toast toast--${notice.tone || "neutral"}`} role="status">
      <span>{notice.message}</span>
      <button className="icon-button icon-button--small" onClick={onClose} aria-label="关闭提示"><X size={14} /></button>
    </div>
  );
}

function LoadingScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 500 : 1900;
    let frame = 0;
    let start = 0;
    const tick = (now) => {
      if (!start) start = now;
      const linear = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - linear, 2.4);
      setProgress(Math.round(eased * 100));
      if (linear < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const stage = [...BOOT_STAGES].reverse().find(([threshold]) => progress >= threshold)?.[1] || BOOT_STAGES[0][1];

  return (
    <main className={`loading-screen startup-screen ${progress === 100 ? "is-ready" : ""}`} aria-live="polite" aria-busy={progress < 100}>
      <div className="startup-grid" aria-hidden="true" />
      <section className="startup-shell">
        <header className="startup-topline">
          <span><i /> ASUKA / PERSONAL AGENT DESK</span>
          <strong>NOVA CORE {String(progress).padStart(3, "0")}%</strong>
        </header>
        <div className="startup-main">
          <div className="startup-copy">
            <span className="eyebrow">LOCAL-FIRST AGENT SYSTEM</span>
            <h1>ASUKA</h1>
            <p>BUILD THE NEXT MOVE.</p>
            <div className="startup-crew" aria-label="Nine agent crew ready">
              {BOT_CREW.map((crew) => <span key={crew.key} style={{ "--crew-accent": crew.accent }} title={`${crew.name} / ${crew.role}`} />)}
            </div>
          </div>
          <div className="startup-mascot" aria-hidden="true">
            <span className="startup-orbit startup-orbit--one" />
            <span className="startup-orbit startup-orbit--two" />
            <img src={crewImage("nova", "512")} alt="" draggable="false" />
            <span className="startup-agent-tag">NOVA / CORE</span>
          </div>
        </div>
        <footer className="startup-boot">
          <div className="startup-boot__meta"><span>&gt; {stage}<i className="startup-cursor" /></span><strong>{progress}%</strong></div>
          <div className="startup-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
          <div className="startup-boot__foot"><span>9 AGENTS / 1 COMMAND DECK</span><span>LOCAL / ENCRYPTED / AUDITED</span></div>
        </footer>
      </section>
    </main>
  );
}

function NewAgentDialog({ instances, onClose, onCreate, busy }) {
  const available = instances.filter((item) => item.snapshot?.state === "available" && item.snapshot?.authenticated !== false && item.models?.default);
  const [instanceId, setInstanceId] = useState(available[0]?.instanceId || "");
  const runtime = instances.find((item) => item.instanceId === instanceId);
  const [model, setModel] = useState(runtime?.models?.default || "");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const next = instances.find((item) => item.instanceId === instanceId);
    setModel(next?.models?.default || "");
  }, [instanceId, instances]);

  async function submit(event) {
    event.preventDefault();
    if (!name.trim() || !instanceId || !model) return;
    await onCreate({ name: name.trim(), title: title.trim(), description: description.trim(), instanceId, model });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-agent-title">
        <header className="modal__header">
          <div>
            <span className="eyebrow">Agent registry</span>
            <h2 id="new-agent-title">新建 Agent</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        <form onSubmit={submit} className="form-stack">
          <label className="field"><span>名称</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：研究 Agent" /></label>
          <label className="field"><span>职责</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="一句话描述它负责什么" /></label>
          <label className="field"><span>Runtime</span>
            <select value={instanceId} onChange={(event) => setInstanceId(event.target.value)}>
              {available.map((item) => <option key={item.instanceId} value={item.instanceId}>{item.displayName} · {item.driverKind}</option>)}
            </select>
          </label>
          <label className="field"><span>模型</span>
            <select value={model} onChange={(event) => setModel(event.target.value)}>
              {(runtime?.models?.options || []).map((item) => <option key={item.id} value={item.id}>{item.label || item.id}</option>)}
            </select>
          </label>
          <label className="field"><span>长期职责</span><textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="它应该如何工作、交付什么、什么时候停下来询问。" /></label>
          <footer className="modal__footer">
            <button type="button" className="button button--ghost" onClick={onClose}>取消</button>
            <button type="submit" className="button button--primary" disabled={busy || !name.trim() || !instanceId || !model}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} 创建 Agent
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function NewRoomDialog({ bots, onClose, onCreate, busy }) {
  const [name, setName] = useState("");
  const [bulletin, setBulletin] = useState("");
  const [memberIds, setMemberIds] = useState(() => bots.map((bot) => bot.id));

  function toggleMember(botId) {
    setMemberIds((current) => current.includes(botId) ? current.filter((id) => id !== botId) : [...current, botId]);
  }

  async function submit(event) {
    event.preventDefault();
    if (!name.trim()) return;
    await onCreate({ name: name.trim(), bulletin: bulletin.trim(), memberIds });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="new-room-title">
        <header className="modal__header">
          <div><span className="eyebrow">Room registry</span><h2 id="new-room-title">新建 Room</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        <form onSubmit={submit} className="form-stack">
          <label className="field"><span>名称</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：市场研究" /></label>
          <label className="field"><span>说明</span><textarea rows={3} value={bulletin} onChange={(event) => setBulletin(event.target.value)} placeholder="这个 Room 负责什么、有哪些边界。" /></label>
          <div className="field">
            <span>成员</span>
            <div className="room-choice-grid">
              {bots.map((bot) => (
                <label key={bot.id} className="room-choice">
                  <input type="checkbox" checked={memberIds.includes(bot.id)} onChange={() => toggleMember(bot.id)} />
                  <span>{displayBotName(bot.name)}</span>
                  <small>{bot.title || "Agent"}</small>
                </label>
              ))}
            </div>
          </div>
          <footer className="modal__footer">
            <button type="button" className="button button--ghost" onClick={onClose}>取消</button>
            <button type="submit" className="button button--primary" disabled={busy || !name.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} 创建 Room</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function AddRoomMembersDialog({ bots, memberIds, onClose, onAdd, busy }) {
  const [selected, setSelected] = useState([]);
  const available = bots.filter((bot) => !memberIds.includes(bot.id));
  function toggle(botId) {
    setSelected((current) => current.includes(botId) ? current.filter((id) => id !== botId) : [...current, botId]);
  }
  async function submit(event) {
    event.preventDefault();
    if (!selected.length) return;
    await onAdd(selected);
  }
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="modal modal--wide" onSubmit={submit}>
        <div className="modal__header">
          <div><span className="eyebrow">ROOM MEMBERS</span><h2>增加成员</h2><p>手工加入的成员会保留，NOVA 后续自动组队时会继续带上他们。</p></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={17} /></button>
        </div>
        {available.length > 0 ? (
          <div className="room-choice-grid room-choice-grid--modal">
            {available.map((bot) => {
              const crew = crewForBot(bot);
              return (
                <label key={bot.id} className="room-choice">
                  <input type="checkbox" checked={selected.includes(bot.id)} onChange={() => toggle(bot.id)} />
                  <Avatar name={bot.name} color={bot.color} size="xs" />
                  <span>{crew?.name || bot.name}</span>
                  <small>{crew?.role || bot.title || "Agent"}</small>
                </label>
              );
            })}
          </div>
        ) : <EmptyState icon={Users} title="所有 Bot 已在房间中" body="当前房间已经包含全部可用成员。" />}
        <footer className="modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose}>取消</button>
          <button type="submit" className="button button--primary" disabled={busy || !selected.length}>{busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} 加入 {selected.length || ""} 位成员</button>
        </footer>
      </form>
    </div>
  );
}

function EditAgentDialog({ bot, instances, groups, onClose, onSave, busy }) {
  const ready = instances.filter((item) => item.snapshot?.state === "available" && item.snapshot?.authenticated !== false && item.models?.default);
  const currentRuntime = instances.find((item) => item.instanceId === bot.modelSelection?.instanceId);
  const available = currentRuntime && !ready.some((item) => item.instanceId === currentRuntime.instanceId) ? [currentRuntime, ...ready] : ready;
  const [name, setName] = useState(bot.name || "");
  const [title, setTitle] = useState(bot.title || "");
  const [description, setDescription] = useState(bot.description || "");
  const [soul, setSoul] = useState(bot.soul || "");
  const [instanceId, setInstanceId] = useState(bot.modelSelection?.instanceId || available[0]?.instanceId || "");
  const [model, setModel] = useState(bot.modelSelection?.model || "");
  const [approvalMode, setApprovalMode] = useState(bot.approvalMode || "ask");
  const [roomIds, setRoomIds] = useState(() => groups.filter((room) => room.section === ASUKA_SECTION && room.memberIds?.includes(bot.id)).map((room) => room.id));
  const runtime = instances.find((item) => item.instanceId === instanceId);
  const roomBusy = groups.some((room) => room.working && room.memberIds?.includes(bot.id));
  const locked = bot.busy || roomBusy;

  useEffect(() => {
    const options = runtime?.models?.options || [];
    if (!options.some((item) => item.id === model)) setModel(runtime?.models?.default || options[0]?.id || "");
  }, [runtime, model]);

  function toggleRoom(roomId) {
    setRoomIds((current) => current.includes(roomId) ? current.filter((id) => id !== roomId) : [...current, roomId]);
  }

  async function submit(event) {
    event.preventDefault();
    if (!name.trim() || !instanceId || !model || locked) return;
    await onSave({
      name: name.trim(),
      title: title.trim(),
      description: description.trim(),
      soul,
      instanceId,
      model,
      approvalMode,
      roomIds,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="edit-agent-title">
        <header className="modal__header">
          <div><span className="eyebrow">AGENT PROFILE</span><h2 id="edit-agent-title">编辑 {bot.name}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        <form className="form-stack" onSubmit={submit}>
          {locked && <div className="settings-result settings-result--warn"><CircleAlert size={15} /><span>该 Agent 正在执行任务，停止任务后才能修改 Runtime、模型和审批级别。</span></div>}
          <div className="form-grid">
            <label className="field"><span>名称</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="field"><span>职责</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          </div>
          <label className="field"><span>简介</span><textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label className="field"><span>长期职责与工作方式</span><textarea rows={6} value={soul} onChange={(event) => setSoul(event.target.value)} /></label>
          <div className="form-grid">
            <label className="field"><span>Runtime</span><select value={instanceId} onChange={(event) => setInstanceId(event.target.value)} disabled={locked}>{available.map((item) => <option key={item.instanceId} value={item.instanceId}>{item.displayName} · {item.driverKind}</option>)}</select></label>
            <label className="field"><span>模型</span><select value={model} onChange={(event) => setModel(event.target.value)} disabled={locked}>{(runtime?.models?.options || []).map((item) => <option key={item.id} value={item.id}>{item.label || item.id}</option>)}</select></label>
          </div>
          <label className="field"><span>审批级别</span><select value={approvalMode} onChange={(event) => setApprovalMode(event.target.value)} disabled={locked || approvalMode === "custom"}><option value="ask">每次询问</option><option value="auto">自动处理常规动作</option><option value="full">完全访问（高风险）</option>{approvalMode === "custom" && <option value="custom">Custom（在 OpenMausBot 修改）</option>}</select></label>
          <div className="field"><span>ASUKA 房间</span><div className="room-choice-grid">{groups.filter((room) => room.section === ASUKA_SECTION).map((room) => <label key={room.id} className="room-choice"><input type="checkbox" checked={roomIds.includes(room.id)} onChange={() => toggleRoom(room.id)} /><span>{room.name}</span><small>{room.memberIds?.length || 0} agents</small></label>)}</div></div>
          <footer className="modal__footer"><button type="button" className="button button--ghost" onClick={onClose}>取消</button><button type="submit" className="button button--primary" disabled={busy || locked || !name.trim() || !instanceId || !model}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} 保存更改</button></footer>
        </form>
      </section>
    </div>
  );
}

function EmptyState({ icon: Icon = Sparkles, title, body, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon"><Icon size={22} /></span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

function ConnectionScreen({ error, ombUrl, onConnect, onUseNative }) {
  const [draft, setDraft] = useState(ombUrl);
  const [busy, setBusy] = useState(false);
  const [discovery, setDiscovery] = useState(null);
  const [localError, setLocalError] = useState("");

  async function discover() {
    setBusy(true);
    try {
      const response = await fetch("/__asuka/discover");
      const result = await response.json();
      setDiscovery(result);
      if (result.found?.url) setDraft(result.found.url);
    } finally {
      setBusy(false);
    }
  }

  async function connect(event) {
    event.preventDefault();
    setBusy(true);
    setLocalError("");
    try {
      await onConnect(draft);
    } catch (connectError) {
      setLocalError(connectError instanceof Error ? connectError.message : String(connectError));
    } finally {
      setBusy(false);
    }
  }

  async function launch() {
    setBusy(true);
    setLocalError("");
    try {
      const result = await launchOmbRuntime();
      setDraft(result.url);
      setDiscovery({ found: { url: result.url } });
      await onConnect(result.url);
    } catch (launchError) {
      setLocalError(launchError instanceof Error ? launchError.message : String(launchError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="connection-screen">
      <BrandMark large />
      <span className="eyebrow">ASUKA / LOCAL BACKEND</span>
      <h1>ASUKA Core 未连接</h1>
      <p>{localError || error}</p>
      <div className="connection-actions">
        <button type="button" className="button button--primary" onClick={async () => {
          setBusy(true);
          setLocalError("");
          try {
            await onUseNative();
          } catch (nativeError) {
            setLocalError(nativeError instanceof Error ? nativeError.message : String(nativeError));
          } finally {
            setBusy(false);
          }
        }} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Server size={15} />} 使用 Native 重试</button>
      </div>
      <details className="connection-optional">
        <summary>OpenMausBot 兼容连接（可选）</summary>
        <form className="connection-form" onSubmit={connect}>
          <label><span>OpenMausBot 地址</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={DEFAULT_OMB_URL} /></label>
          <div className="connection-actions">
            <button type="submit" className="button button--ghost" disabled={busy}><RefreshCw size={16} /> 连接并重试</button>
            <button type="button" className="button button--ghost" onClick={discover} disabled={busy}><Search size={15} /> 自动发现</button>
            <button type="button" className="button button--ghost" onClick={launch} disabled={busy}><Zap size={15} /> 启动 OpenMausBot</button>
          </div>
        </form>
        {discovery && <p className="connection-discovery">{discovery.found ? `发现 OpenMausBot ${discovery.found.version || ""} · ${discovery.found.url}` : "8799、18799、28799 均未发现 OpenMausBot。"}</p>}
      </details>
    </main>
  );
}

export default function App() {
  const [view, setView] = useState(() => localStorage.getItem("asuka.view") || "command");
  const [ombUrl, setOmbUrlState] = useState(readOmbUrl);
  const [adapter, setAdapterState] = useState(readAdapter);
  const [engineApiId, setEngineApiId] = useState(readEngineApi);
  const [data, setData] = useState({ backend: null, health: null, bots: [], groups: [], instances: [], config: null, adapters: [], apiInstances: [] });
  const [loading, setLoading] = useState(true);
  const [bootReady, setBootReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState(() => localStorage.getItem("asuka.room") || "");
  const [targetId, setTargetId] = useState("auto");
  const [messages, setMessages] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [job, setJob] = useState(null);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState("goal");
  const [sending, setSending] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [savingAgent, setSavingAgent] = useState(false);
  const [savingAgentModel, setSavingAgentModel] = useState("");
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);
  const [editingBotId, setEditingBotId] = useState("");
  const [agentFilter, setAgentFilter] = useState("asuka");
  const [agentSearch, setAgentSearch] = useState("");
  const [skillAgentId, setSkillAgentId] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [sidebarSearchOpen, setSidebarSearchOpen] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [sidebarSections, setSidebarSections] = useState(() => {
    try {
      return { crew: true, rooms: true, recent: true, ...JSON.parse(localStorage.getItem("asuka.sidebarSections") || "{}") };
    } catch {
      return { crew: true, rooms: true, recent: true };
    }
  });
  const [notice, setNotice] = useState(null);
  const [sidebarTaskMenu, setSidebarTaskMenu] = useState(null);
  const messageEndRef = useRef(null);
  const conversationEventsRef = useRef(null);

  useEffect(() => {
    const initial = readUiSettings();
    applyUiSettings(initial);
    const sync = (event) => {
      applyUiSettings(event.detail || {});
    };
    window.addEventListener("asuka:ui-settings", sync);
    core("/settings").then((snapshot) => {
      if (!snapshot?.settings) return;
      const value = { appearance: snapshot.settings.appearance, general: { closeConfirm: snapshot.settings.general?.closeConfirm !== false } };
      localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(value));
      applyUiSettings(value);
    }).catch(() => {});
    return () => {
      window.removeEventListener("asuka:ui-settings", sync);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setBootReady(true), 2050);
    return () => window.clearTimeout(timer);
  }, []);

  const showNotice = useCallback((message, tone = "neutral") => setNotice({ message, tone }), []);
  const openOmbApp = useCallback(() => window.open(ombUrl, "_blank", "noopener,noreferrer"), [ombUrl]);
  const openRoom = useCallback((roomId) => {
    setSelectedRoomId(roomId);
    setView("command");
  }, []);

  const refreshCore = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const includeOmb = adapter === "openmausbot";
      const [snapshot, adapterData, ombSnapshot] = await Promise.all([
        core("/snapshot"),
        core("/adapters"),
        includeOmb ? core("/snapshot", { adapter: "openmausbot" }).catch(() => null) : null,
      ]);
      const next = {
        backend: snapshot.backend,
        health: snapshot.health,
        bots: snapshot.bots || [],
        groups: snapshot.groups || [],
        instances: snapshot.instances || [],
        config: snapshot.config,
        adapters: adapterData.adapters || [],
        apiInstances: includeOmb ? apiInstancesFrom(ombSnapshot) : [],
      };
      setData(next);
      setConnectionError("");
      setSelectedRoomId((current) => {
        if (current) return current;
        const preferred = next.groups.find((room) => room.section === ASUKA_SECTION) || next.groups[0];
        return preferred?.id || "";
      });
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [adapter]);

  async function switchAdapter(value) {
    localStorage.removeItem(ENGINE_API_KEY);
    setEngineApiId("");
    setAdapterState(writeAdapter(value));
    await refreshCore(true);
  }

  async function chooseEngine(value) {
    if (String(value).startsWith("api:")) {
      const instanceId = String(value).slice(4);
      const instance = data.apiInstances.find((item) => item.instanceId === instanceId);
      if (!instance) {
        showNotice("所选 API 当前不可用，请刷新后重试", "bad");
        return;
      }
      if (adapter !== "openmausbot") {
        setAdapterState(writeAdapter("openmausbot"));
        await refreshCore(true);
      }
      setEngineApiId(instanceId);
      localStorage.setItem(ENGINE_API_KEY, instanceId);
      setTargetId("auto");
      return;
    }
    await switchAdapter(value);
  }

  const activeRoom = useMemo(() => data.groups.find((room) => room.id === selectedRoomId) || null, [data.groups, selectedRoomId]);
  const activeThreadId = activeRoom?.threadId || "";
  const roomBots = useMemo(() => (activeRoom?.memberIds || []).map((id) => data.bots.find((bot) => bot.id === id)).filter(Boolean), [activeRoom, data.bots]);
  const asukaBots = useMemo(() => data.bots.filter((bot) => bot.section === ASUKA_SECTION), [data.bots]);
  const availableRuntimes = useMemo(() => data.instances.filter((item) => item.snapshot?.state === "available" && item.snapshot?.authenticated !== false && item.models?.default), [data.instances]);
  const editingBot = data.bots.find((bot) => bot.id === editingBotId) || null;
  const targetBot = targetId === "auto" ? null : roomBots.find((bot) => bot.id === targetId) || null;
  const activeJobState = job?.state || (activeRoom?.working || activeRoom?.busyBotId ? "running" : "idle");
  const allTaskItems = useMemo(() => {
    const seen = new Set();
    const tasks = [];
    for (const room of data.groups) {
      for (const task of room.tasks || []) {
        if (!task.threadId || seen.has(task.threadId)) continue;
        seen.add(task.threadId);
        tasks.push({ ...task, owner: room.name, roomId: room.id });
      }
    }
    for (const bot of asukaBots) {
      for (const task of bot.tasks || []) {
        if (!task.threadId || seen.has(task.threadId)) continue;
        seen.add(task.threadId);
        tasks.push({ ...task, owner: bot.name });
      }
    }
    return tasks.sort((a, b) => Number(b.updatedAt || b.lastThreadOrderAt || 0) - Number(a.updatedAt || a.lastThreadOrderAt || 0));
  }, [asukaBots, data.groups]);
  const sidebarTasks = useMemo(() => allTaskItems.slice(0, 8), [allTaskItems]);
  const sidebarProjectNames = useMemo(() => [...new Set(allTaskItems.map(taskProjectKey).filter((project) => project !== TASK_INBOX_PROJECT))].sort((a, b) => a.localeCompare(b, "zh-CN")), [allTaskItems]);
  const sidebarSearch = sidebarQuery.trim().toLowerCase();
  const sidebarBots = asukaBots.filter((bot) => `${bot.name} ${bot.title || ""} ${bot.modelSelection?.instanceId || ""}`.toLowerCase().includes(sidebarSearch));
  const sidebarRooms = data.groups.filter((room) => !room.archived && `${room.name} ${room.section || ""}`.toLowerCase().includes(sidebarSearch));
  const primaryNavigation = VIEW_ITEMS.filter((item) => ["fabric", "tools", "tasks", "agents", "skills", "approvals"].includes(item.id));
  const utilityNavigation = VIEW_ITEMS.filter((item) => ["rooms", "runtimes", "settings"].includes(item.id));

  const toggleSidebarSection = useCallback((section) => {
    setSidebarSections((current) => ({ ...current, [section]: !current[section] }));
  }, []);

  useEffect(() => {
    localStorage.setItem("asuka.view", view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem("asuka.sidebarSections", JSON.stringify(sidebarSections));
  }, [sidebarSections]);

  useEffect(() => {
    const update = (event) => setOmbUrlState(event.detail || readOmbUrl());
    window.addEventListener("asuka:omb-url", update);
    return () => window.removeEventListener("asuka:omb-url", update);
  }, []);

  useEffect(() => {
    const update = (event) => setAdapterState(event.detail || readAdapter());
    window.addEventListener("asuka:adapter", update);
    return () => window.removeEventListener("asuka:adapter", update);
  }, []);

  useEffect(() => {
    if (selectedRoomId) localStorage.setItem("asuka.room", selectedRoomId);
  }, [selectedRoomId]);

  useEffect(() => {
    refreshCore();
    const timer = window.setInterval(() => refreshCore(), 12000);
    return () => window.clearInterval(timer);
  }, [refreshCore]);

  useEffect(() => {
    if (!data.adapters.length || localStorage.getItem(ADAPTER_DEFAULT_MIGRATION_KEY)) return;
    const native = data.adapters.find((item) => item.id === "native");
    if (!native?.available) return;
    localStorage.setItem(ADAPTER_DEFAULT_MIGRATION_KEY, "1");
    if (adapter !== "native") {
      setAdapterState(writeAdapter("native"));
      void refreshCore(true);
    }
  }, [adapter, data.adapters, refreshCore]);

  useEffect(() => {
    if (!engineApiId || !data.backend) return;
    if (data.apiInstances.some((item) => item.instanceId === engineApiId)) return;
    localStorage.removeItem(ENGINE_API_KEY);
    setEngineApiId("");
  }, [engineApiId, data.apiInstances, data.backend]);

  const loadConversation = useCallback(async () => {
    if (!activeThreadId) {
      setMessages([]);
      setArtifacts([]);
      setJob(null);
      return;
    }
    try {
      const task = await core(`/tasks/${encodeURIComponent(activeThreadId)}?limit=100`);
      setMessages(task.messages || []);
      setArtifacts(task.artifacts || []);
      setJob(task.job || null);
    } catch (error) {
      if (/native task not found/i.test(error instanceof Error ? error.message : String(error))) {
        setMessages([]);
        setArtifacts([]);
        setJob(null);
        return;
      }
      showNotice(error.message, "bad");
    }
  }, [activeThreadId, showNotice]);

  useEffect(() => {
    loadConversation();
    const timer = window.setInterval(loadConversation, 3500);
    return () => window.clearInterval(timer);
  }, [loadConversation]);

  useEffect(() => {
    conversationEventsRef.current?.close();
    conversationEventsRef.current = null;
    if (!activeThreadId || adapter !== "native") return undefined;
    const source = new EventSource(`${CORE}/tasks/${encodeURIComponent(activeThreadId)}/events?adapter=native`);
    conversationEventsRef.current = source;
    source.addEventListener("update", (event) => {
      try {
        const update = JSON.parse(event.data);
        if (update.type === "message" && update.message) setMessages((current) => mergeMessage(current, update.message));
        if (update.type === "state") void loadConversation();
      } catch {
        // Polling remains the fallback when an event is malformed.
      }
    });
    return () => source.close();
  }, [activeThreadId, adapter, loadConversation]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (!targetId || !["auto", ...roomBots.map((bot) => bot.id)].includes(targetId)) setTargetId("auto");
  }, [roomBots, targetId]);

  async function createAgent(payload) {
    setCreatingAgent(true);
    try {
      const asukaRoom = data.groups.find((room) => room.section === ASUKA_SECTION);
      await core("/agents", {
        method: "POST",
        body: JSON.stringify({
          useDefaults: false,
          name: payload.name,
          title: payload.title || "Personal agent",
          description: payload.description,
          soul: payload.description || `You are ${payload.name}, a focused personal agent inside ASUKA. Work clearly, report concrete progress, and ask before irreversible actions.`,
          section: ASUKA_SECTION,
          modelSelection: { instanceId: payload.instanceId, model: payload.model },
          approvalMode: "ask",
          computer: "off",
          roomId: asukaRoom?.id,
        }),
      });
      setAgentDialogOpen(false);
      showNotice(`${payload.name} 已加入 ASUKA`, "ok");
      await refreshCore();
    } catch (error) {
      showNotice(error.message, "bad");
    } finally {
      setCreatingAgent(false);
    }
  }

  async function saveAgent(payload) {
    if (!editingBot) return;
    setSavingAgent(true);
    try {
      await core(`/agents/${encodeURIComponent(editingBot.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          patch: {
            name: payload.name,
            title: payload.title,
            description: payload.description,
            soul: payload.soul,
            modelSelection: { instanceId: payload.instanceId, model: payload.model },
            approvalMode: payload.approvalMode,
          },
          roomIds: payload.roomIds,
        }),
      });
      setEditingBotId("");
      showNotice(`${payload.name} 已更新`, "ok");
      await refreshCore();
    } catch (error) {
      showNotice(error.message, "bad");
    } finally {
      setSavingAgent(false);
    }
  }

  async function assignAgentModel(bot, instance) {
    if (!bot || !instance) return;
    setSavingAgentModel(bot.id);
    try {
      await core(`/agents/${encodeURIComponent(bot.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          patch: {
            modelSelection: {
              instanceId: instance.instanceId,
              model: instance.models?.default || instance.models?.options?.[0]?.id || "",
            },
          },
        }),
      });
      showNotice(`${bot.name} 已接入 ${instance.displayName || instance.instanceId}`, "ok");
      await refreshCore();
    } catch (error) {
      showNotice(error.message, "bad");
    } finally {
      setSavingAgentModel("");
    }
  }

  async function createRoom(payload) {
    setCreatingRoom(true);
    try {
      const response = await core("/rooms", {
        method: "POST",
        body: JSON.stringify({
          name: payload.name,
          section: ASUKA_SECTION,
          memberIds: payload.memberIds,
          setup: { bulletin: payload.bulletin || "Personal project room." },
        }),
      });
      setRoomDialogOpen(false);
      setSelectedRoomId(response.group.id);
      setView("command");
      showNotice(`${response.group.name} 已创建`, "ok");
      await refreshCore();
    } catch (error) {
      showNotice(error.message, "bad");
    } finally {
      setCreatingRoom(false);
    }
  }

  async function addRoomMembers(botIds) {
    if (!activeRoom || !botIds?.length) return;
    setAddingMembers(true);
    try {
      const memberIds = [...new Set([...(activeRoom.memberIds || []), ...botIds])];
      const manualMemberIds = [...new Set([...(activeRoom.manualMemberIds || []), ...botIds])];
      await core(`/rooms/${encodeURIComponent(activeRoom.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ memberIds, manualMemberIds }),
      });
      setAddMemberDialogOpen(false);
      showNotice(`已增加 ${botIds.length} 位 Room 成员`, "ok");
      await refreshCore();
    } catch (error) {
      showNotice(error.message, "bad");
    } finally {
      setAddingMembers(false);
    }
  }

  function openSidebarTaskMenu(event, task) {
    event.preventDefault();
    event.stopPropagation();
    const width = 288;
    const height = 420;
    setSidebarTaskMenu({
      task,
      mode: "list",
      draft: "",
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
    });
  }

  async function moveTaskToProject(task, project) {
    setSidebarTaskMenu(null);
    try {
      await core(`/tasks/${encodeURIComponent(task.threadId)}`, {
        method: "PATCH",
        body: JSON.stringify({ project: project || TASK_INBOX_PROJECT }),
      });
      showNotice(`已移动到 ${taskProjectLabel(project || TASK_INBOX_PROJECT)}`, "ok");
      await refreshCore();
    } catch (error) {
      showNotice(error.message, "bad");
    }
  }

  async function renameSidebarProject(from, to) {
    const next = to.trim();
    if (!next || next === taskProjectLabel(from)) return;
    setSidebarTaskMenu(null);
    try {
      const affected = allTaskItems.filter((task) => taskProjectKey(task) === from);
      for (const task of affected) {
        await core(`/tasks/${encodeURIComponent(task.threadId)}`, {
          method: "PATCH",
          body: JSON.stringify({ project: next }),
        });
      }
      showNotice(`项目已重命名为 ${next}`, "ok");
      await refreshCore();
    } catch (error) {
      showNotice(error.message, "bad");
    }
  }

  useEffect(() => {
    if (!sidebarTaskMenu) return undefined;
    const close = () => setSidebarTaskMenu(null);
    const onKeyDown = (event) => { if (event.key === "Escape") close(); };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [sidebarTaskMenu]);

  async function createAsukaTeam() {
    setSeeding(true);
    try {
      if (["native", "codex", "claude", "dsh"].includes(data.backend?.kind)) {
        const room = data.groups.find((item) => item.section === ASUKA_SECTION);
        if (room) openRoom(room.id);
        setView("command");
        showNotice(`${ADAPTER_LABELS[data.backend?.kind] || "Local"} Adapter 已使用内置 Agent 编队`, "ok");
        return;
      }
      if (!availableRuntimes.length) throw new Error("当前没有可用 Runtime。请先配置 Native Provider，或在 OpenMausBot 中配置模型。");
      const runtimeAt = (index) => availableRuntimes[index % availableRuntimes.length];
      const roleSpecs = [
        {
          name: "ASUKA Concierge",
          title: "Task router and final reviewer",
          runtime: availableRuntimes.find((item) => item.instanceId === "codex") || availableRuntimes.find((item) => item.instanceId.startsWith("claude-")) || runtimeAt(0),
          soul: "You are ASUKA's concierge. Turn personal goals into concrete briefs, route work to the smallest capable agent, verify the result, and ask the person before irreversible actions. Be concise and evidence-driven.",
          chief: true,
        },
        {
          name: "ASUKA Builder",
          title: "Implementation specialist",
          runtime: runtimeAt(1),
          soul: "You are ASUKA's builder. Execute well-scoped implementation work, report exact files and commands, and stop when a decision or permission is needed.",
        },
        {
          name: "ASUKA Reviewer",
          title: "Independent verifier",
          runtime: availableRuntimes.find((item) => item.instanceId === "deepseek") || availableRuntimes.find((item) => item.instanceId === "hermes") || runtimeAt(2),
          soul: "You are ASUKA's reviewer. Check claims against artifacts, list defects and risks, and reject work that does not meet the stated completion criteria.",
        },
      ];

      let botList = [...data.bots];
      const resolved = [];
      for (const spec of roleSpecs) {
        let bot = botList.find((item) => item.section === ASUKA_SECTION && item.name === spec.name);
        if (!bot) {
          const response = await core("/agents", {
            method: "POST",
            body: JSON.stringify({
              useDefaults: false,
              name: spec.name,
              title: spec.title,
              description: spec.soul,
              soul: spec.soul,
              section: ASUKA_SECTION,
              modelSelection: { instanceId: spec.runtime.instanceId, model: spec.runtime.models.default },
              approvalMode: "ask",
              computer: "off",
              ...(spec.chief ? { chiefOfStaff: true } : {}),
            }),
          });
          bot = response.bot;
          botList = [...botList, bot];
          if (bot.approvalMode !== "ask") {
            const patched = await core(`/agents/${encodeURIComponent(bot.id)}`, {
              method: "PATCH",
              body: JSON.stringify({ patch: { approvalMode: "ask" } }),
            });
            bot = patched.bot || { ...bot, approvalMode: "ask" };
            botList = botList.map((item) => item.id === bot.id ? bot : item);
          }
        } else {
          const currentRuntime = data.instances.find((item) => item.instanceId === bot.modelSelection?.instanceId);
          const currentModel = bot.modelSelection?.model;
          const needsRepair = currentRuntime?.snapshot?.state !== "available" || currentRuntime?.snapshot?.authenticated === false || currentModel !== spec.runtime.models.default || bot.approvalMode !== "ask";
          if (needsRepair) {
            const response = await core(`/agents/${encodeURIComponent(bot.id)}`, {
              method: "PATCH",
              body: JSON.stringify({ patch: {
                modelSelection: { instanceId: spec.runtime.instanceId, model: spec.runtime.models.default },
                ...(bot.approvalMode !== "ask" ? { approvalMode: "ask" } : {}),
              } }),
            });
            bot = response.bot || { ...bot, modelSelection: { instanceId: spec.runtime.instanceId, model: spec.runtime.models.default } };
            botList = botList.map((item) => item.id === bot.id ? bot : item);
          }
        }
        resolved.push(bot);
      }

      const memberIds = [...new Set(resolved.map((bot) => bot.id))];
      let room = data.groups.find((item) => item.section === ASUKA_SECTION && item.name === "ASUKA Command");
      if (!room) {
        const response = await core("/rooms", {
          method: "POST",
          body: JSON.stringify({
            name: "ASUKA Command",
            section: ASUKA_SECTION,
            memberIds,
            setup: {
              bulletin: "Personal command room. Keep work scoped, verify outputs, and ask before sending, publishing, deleting, paying, or changing credentials.",
              defaultResponder: { kind: "member", botId: resolved[0].id },
            },
          }),
        });
        room = response.group;
      } else {
        const missing = memberIds.filter((id) => !(room.memberIds || []).includes(id));
        if (missing.length) {
          await core(`/rooms/${encodeURIComponent(room.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ memberIds: [...new Set([...(room.memberIds || []), ...missing])] }),
          });
        }
      }
      setSelectedRoomId(room.id);
      setView("command");
      showNotice("ASUKA Command 已就绪", "ok");
      await refreshCore();
      await loadConversation();
    } catch (error) {
      showNotice(error.message, "bad");
    } finally {
      setSeeding(false);
    }
  }

  async function sendTask(event) {
    event?.preventDefault();
    if (!activeRoom || !draft.trim() || sending) return;
    setSending(true);
    try {
      if (adapter === "native" && activeThreadId && activeJobState === "running") {
        await core(`/tasks/${encodeURIComponent(activeThreadId)}/guidance`, {
          method: "POST",
          body: JSON.stringify({ text: draft.trim() }),
        });
        setDraft("");
        showNotice("指导意见已进入决策队列，将在下一个执行阶段纳入", "ok");
        await loadConversation();
        return;
      }
      const selectedApi = engineApiId ? data.apiInstances.find((item) => item.instanceId === engineApiId) : null;
      const currentTaskStatus = activeRoom?.tasks?.find((task) => task.threadId === activeThreadId)?.status || activeJobState;
      if (adapter !== "openmausbot" && !selectedApi && activeThreadId) {
        if (currentTaskStatus === "needs-input") {
          showNotice("请先处理当前任务的审批或问题，再继续发送修正", "warn");
          return;
        }
        await core(`/tasks/${encodeURIComponent(activeThreadId)}/messages`, {
          method: "POST",
          body: JSON.stringify({ text: draft.trim(), mode }),
        });
        setSelectedRoomId(activeRoom.id);
        setDraft("");
        showNotice("已继续当前任务并带入修正要求", "ok");
        await loadConversation();
        await refreshCore();
        return;
      }
      const apiTarget = selectedApi ? (targetBot || roomBots.find((bot) => crewForBot(bot)?.key === "nova") || roomBots[0]) : null;
      if (selectedApi) {
        if (!apiTarget) throw new Error("当前房间没有可用于 Bot API 的 Agent");
        const modelSelection = apiTarget.modelSelection || {};
        if (modelSelection.instanceId !== selectedApi.instanceId || modelSelection.model !== selectedApi.models.default) {
          await core(`/agents/${encodeURIComponent(apiTarget.id)}`, {
            adapter: "openmausbot",
            method: "PATCH",
            body: JSON.stringify({
              patch: { modelSelection: { instanceId: selectedApi.instanceId, model: selectedApi.models.default } },
              roomIds: [activeRoom.id],
            }),
          });
        }
      }
      const dispatchTarget = selectedApi ? apiTarget : targetBot;
      const text = dispatchTarget && !draft.includes(`@${dispatchTarget.name}`) ? `@${dispatchTarget.name} ${draft.trim()}` : draft.trim();
      const body = {
        text,
        mode,
        sendId: crypto.randomUUID(),
        ...(dispatchTarget ? { mentions: [dispatchTarget.id] } : {}),
      };
      await core(`/rooms/${encodeURIComponent(activeRoom.id)}/messages`, {
        ...(selectedApi ? { adapter: "openmausbot" } : {}),
        method: "POST",
        body: JSON.stringify(body),
      });
      setSelectedRoomId(activeRoom.id);
      setDraft("");
      showNotice(dispatchTarget ? `任务已派给 ${dispatchTarget.name}${selectedApi ? ` · ${selectedApi.models.default}` : ""}` : "任务已进入房间", "ok");
      await loadConversation();
      await refreshCore();
    } catch (error) {
      showNotice(error.message, "bad");
    } finally {
      setSending(false);
    }
  }

  function openAgentInCommand(bot) {
    if (activeRoom && !(activeRoom.memberIds || []).includes(bot.id)) {
      showNotice(`${bot.name} 不在当前房间，请先在 Rooms 中加入。`, "warn");
      return;
    }
    setTargetId(bot.id);
    setView("command");
  }

  if (loading || !bootReady) return <LoadingScreen />;

  if (connectionError) {
    return <ConnectionScreen error={connectionError} ombUrl={ombUrl} onUseNative={async () => {
      setAdapterState(writeAdapter("native"));
      await refreshCore(true);
    }} onConnect={async (value) => {
      const normalized = normalizeOmbUrl(value);
      await probeOmb(normalized);
      writeOmbUrl(normalized);
      setAdapterState(writeAdapter("openmausbot"));
      setOmbUrlState(normalized);
      await refreshCore(true);
    }} />;
  }

  return (
    <div className={`app-shell ${view === "command" && inspectorOpen ? "has-inspector" : ""}`}>
      <aside className="sidebar">
        <header className="sidebar-header">
          <div className="sidebar-brand-row">
            <span className="sidebar-brand-mark"><img src="/brand/asuka-logo.svg" alt="" draggable="false" /></span>
            <button className="sidebar-brand-name" onClick={() => setView("command")}>ASUKA <ChevronDown size={13} /></button>
            <button className="icon-button icon-button--small sidebar-search-toggle" onClick={() => setSidebarSearchOpen((current) => !current)} aria-label="搜索 Bots 和 Rooms" title="搜索"><Search size={15} /></button>
          </div>
          {sidebarSearchOpen && (
            <div className="sidebar-search-box">
              <Search size={14} />
              <input autoFocus value={sidebarQuery} onChange={(event) => setSidebarQuery(event.target.value)} placeholder="搜索 Bots、Rooms、任务" />
              <button className="icon-button icon-button--small" onClick={() => { setSidebarQuery(""); setSidebarSearchOpen(false); }} aria-label="关闭搜索"><X size={13} /></button>
            </div>
          )}
        </header>

        <button className="sidebar-new-task" onClick={() => setRoomDialogOpen(true)}><Plus size={16} /><span>新建任务</span></button>

        <nav className="main-nav sidebar-primary-nav" aria-label="主导航">
          {primaryNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={`nav-item ${view === item.id ? "is-active" : ""}`} onClick={() => setView(item.id)}>
                <Icon size={17} /><span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-scroll">
          <SidebarDisclosure label="BOT CREW" count={sidebarBots.length} open={sidebarSections.crew || Boolean(sidebarSearch)} onToggle={() => toggleSidebarSection("crew")}>
            {sidebarBots.map((bot) => {
              const runtime = data.instances.find((item) => item.instanceId === bot.modelSelection?.instanceId);
              const inRoom = activeRoom?.memberIds?.includes(bot.id);
              const crew = crewForBot(bot);
              return (
                <button key={bot.id} className="sidebar-bot" onClick={() => { if (inRoom) { setTargetId(bot.id); setView("command"); } else { setView("agents"); } }}>
                  <Avatar name={bot.name} color={bot.color} size="xs" busy={bot.busy} />
                  <span><strong>{crew?.name || bot.name}</strong><small>{crew ? `${crew.role} / ${runtime?.displayName || bot.modelSelection?.instanceId || "Runtime"}` : runtime?.displayName || bot.modelSelection?.instanceId || "Runtime"}</small></span>
                  <StatusDot tone={bot.busy ? "warn" : statusTone(runtime?.snapshot?.state)} pulse={bot.busy} />
                </button>
              );
            })}
            {!sidebarBots.length && <p className="sidebar-empty">没有匹配的 Bot</p>}
          </SidebarDisclosure>

          <SidebarDisclosure label="ROOMS" count={sidebarRooms.length} open={sidebarSections.rooms || Boolean(sidebarSearch)} onToggle={() => toggleSidebarSection("rooms")} action={<button className="icon-button icon-button--small" onClick={() => setRoomDialogOpen(true)} aria-label="新建 Room" title="新建 Room"><Plus size={14} /></button>}>
            {sidebarRooms.map((room) => (
              <button key={room.id} className={`sidebar-room ${activeRoom?.id === room.id ? "is-active" : ""}`} onClick={() => { setSelectedRoomId(room.id); setView("command"); }}>
                <span>{room.section === ASUKA_SECTION ? "◆" : "#"}</span><strong>{room.name}</strong><small>{room.memberIds?.length || 0}</small>
              </button>
            ))}
            {!sidebarRooms.length && <p className="sidebar-empty">没有匹配的 Room</p>}
          </SidebarDisclosure>

          <SidebarDisclosure label="RECENT" count={sidebarTasks.length} open={sidebarSections.recent || Boolean(sidebarSearch)} onToggle={() => toggleSidebarSection("recent")}>
            {sidebarTasks.filter((task) => `${task.title || ""} ${task.owner || ""}`.toLowerCase().includes(sidebarSearch)).map((task) => (
              <button key={task.threadId} className="sidebar-recent" onClick={() => setView("tasks")} onContextMenu={(event) => openSidebarTaskMenu(event, task)}>
                <StatusDot tone={statusTone(task.activity || (task.busy ? "running" : "idle"))} pulse={task.busy} />
                <span><strong>{task.title || "Untitled task"}</strong><small>{task.owner} · {friendlyTime(task.updatedAt || task.lastThreadOrderAt)}</small></span>
              </button>
            ))}
            {!sidebarTasks.length && <p className="sidebar-empty">还没有任务</p>}
          </SidebarDisclosure>
        </div>

        <nav className="sidebar-utility-nav" aria-label="系统导航">
          {utilityNavigation.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-item ${view === item.id ? "is-active" : ""}`} onClick={() => setView(item.id)}><Icon size={15} /><span>{item.label}</span></button>;
          })}
        </nav>

        <div className="sidebar-status">
          <StatusDot tone="ok" pulse />
          <div><strong>{ADAPTER_LABELS[data.backend?.kind] || "Native"} Adapter {data.backend?.version || data.health?.version}</strong><span>{availableRuntimes.length} runtimes · {data.bots.length} bots</span></div>
        </div>
      </aside>

      <main className={`main-area ${view === "command" ? "main-area--command" : ""}`}>
        <header className="topbar">
          <div>
            <span className="eyebrow">LOCAL COMMAND / {new Date().toLocaleDateString("zh-CN")}</span>
            <h1>{view === "command" ? activeRoom?.name || "ASUKA Command" : VIEW_ITEMS.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <span className="connection-pill"><StatusDot tone="ok" /> {ADAPTER_LABELS[data.backend?.kind] || "Native"} / local</span>
            {data.backend?.kind === "openmausbot" && <a className="icon-button" href={ombUrl} target="_blank" rel="noreferrer" aria-label="打开 OpenMausBot"><ArrowUpRight size={17} /></a>}
            <button className="icon-button" onClick={() => refreshCore(true)} aria-label="刷新" disabled={refreshing}><RefreshCw size={17} className={refreshing ? "spin" : ""} /></button>
            {view === "command" && <button className={`icon-button inspector-toggle ${inspectorOpen ? "is-active" : ""}`} onClick={() => setInspectorOpen((value) => !value)} aria-label={inspectorOpen ? "收起右侧状态栏" : "展开右侧状态栏"} title={inspectorOpen ? "收起状态栏" : "展开状态栏"} aria-pressed={inspectorOpen}>{inspectorOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}</button>}
          </div>
        </header>

        {view === "command" && (
          <CommandView
            room={activeRoom}
            roomBots={roomBots}
            bots={data.bots}
            messages={messages}
            artifacts={artifacts}
            job={job}
            activeJobState={activeJobState}
            targetId={targetId}
            setTargetId={setTargetId}
            draft={draft}
            setDraft={setDraft}
            mode={mode}
            setMode={setMode}
            sendTask={sendTask}
            sending={sending}
            messageEndRef={messageEndRef}
            onCreateTeam={createAsukaTeam}
            seeding={seeding}
            instances={data.instances}
            targetBot={targetBot}
            openOmb={openOmbApp}
            onOpenSettings={() => setView("settings")}
            backend={data.backend}
            adapter={adapter}
            adapters={data.adapters}
            apiInstances={data.apiInstances}
            engineApiId={engineApiId}
            onSwitchAdapter={switchAdapter}
            onChooseEngine={chooseEngine}
            showActivity={showActivity}
            setShowActivity={setShowActivity}
            onAddMembers={() => setAddMemberDialogOpen(true)}
          />
        )}

        {view === "fabric" && (
          <FabricView adapter={adapter} backend={data.backend} onNotice={showNotice} onRefresh={refreshCore} />
        )}

        {view === "tools" && <ToolCenterView onNotice={showNotice} />}

        {view === "tasks" && (
          <TasksView bots={data.bots} groups={data.groups} onOpenRoom={(roomId) => { setSelectedRoomId(roomId); setView("command"); }} onNotice={showNotice} onRefresh={refreshCore} />
        )}

        {view === "agents" && (
          <AgentsView
            bots={data.bots}
            instances={data.instances}
            agentFilter={agentFilter}
            setAgentFilter={setAgentFilter}
            search={agentSearch}
            setSearch={setAgentSearch}
            onNew={() => setAgentDialogOpen(true)}
            onEdit={(bot) => setEditingBotId(bot.id)}
            onSeed={createAsukaTeam}
            seeding={seeding}
            onOpenSkills={(bot) => { setSkillAgentId(bot.id); setView("skills"); }}
            onUse={openAgentInCommand}
            activeRoom={activeRoom}
            onAssignModel={assignAgentModel}
            savingAgentModel={savingAgentModel}
          />
        )}

        {view === "skills" && (
          <SkillsView bots={data.bots} instances={data.instances} onNotice={showNotice} initialBotId={skillAgentId} />
        )}

        {view === "approvals" && (
          <ApprovalsView
            bots={data.bots}
            groups={data.groups}
            onNotice={showNotice}
            onOpenRoom={(roomId) => { setSelectedRoomId(roomId); setView("command"); }}
            onRefreshCore={() => refreshCore()}
          />
        )}

        {view === "rooms" && (
          <RoomsView
            groups={data.groups}
            bots={data.bots}
            activeRoomId={activeRoom?.id}
            onOpen={(room) => { setSelectedRoomId(room.id); setView("command"); }}
            onCreate={() => setRoomDialogOpen(true)}
            creating={creatingRoom}
          />
        )}

        {view === "runtimes" && <RuntimesView instances={data.instances} config={data.config} backend={data.backend} adapters={data.adapters} openOmb={openOmbApp} />}

        {view === "settings" && <SettingsView adapter={adapter} onSwitchAdapter={switchAdapter} ombUrl={ombUrl} onApply={async (value) => {
          const next = writeOmbUrl(value);
          setAdapterState(writeAdapter("openmausbot"));
          setOmbUrlState(next);
          await refreshCore(true);
          showNotice("OpenMausBot 连接已更新", "ok");
        }} openOmb={openOmbApp} onOpenTools={() => setView("tools")} config={data.config} instances={data.instances} backend={data.backend} adapters={data.adapters} onRefresh={refreshCore} onNotice={showNotice} />}
      </main>

      {view === "command" && inspectorOpen && (
        <aside className="inspector">
          <header className="inspector__header"><span>ROOM STATUS</span><button className="icon-button icon-button--small" onClick={() => setInspectorOpen(false)} aria-label="收起右侧状态栏" title="收起状态栏"><PanelRightClose size={15} /></button></header>
          <Inspector room={activeRoom} roomBots={roomBots} job={job} activeJobState={activeJobState} instances={data.instances} targetBot={targetBot} backendKind={data.backend?.kind} />
        </aside>
      )}

      <Toast notice={notice} onClose={() => setNotice(null)} />
      {sidebarTaskMenu && (
        <div className="task-context-menu sidebar-project-menu" style={{ left: sidebarTaskMenu.x, top: sidebarTaskMenu.y }} role="menu" aria-label="项目管理" onContextMenu={(event) => event.preventDefault()} onClick={(event) => event.stopPropagation()}>
          <header className="sidebar-project-menu__header"><span>项目管理</span><small>{taskProjectLabel(taskProjectKey(sidebarTaskMenu.task))}</small></header>
          <p className="sidebar-project-menu__task">{sidebarTaskMenu.task.title || "Untitled task"}</p>
          {sidebarTaskMenu.mode === "list" ? (
            <>
              {[TASK_INBOX_PROJECT, ...sidebarProjectNames].map((project) => (
                <button type="button" role="menuitemradio" aria-checked={taskProjectKey(sidebarTaskMenu.task) === project} key={project} onClick={() => void moveTaskToProject(sidebarTaskMenu.task, project)}>
                  <Folder size={16} /><span>{taskProjectLabel(project)}</span>{taskProjectKey(sidebarTaskMenu.task) === project && <Check size={15} />}
                </button>
              ))}
              <div className="task-context-menu__separator" />
              {taskProjectKey(sidebarTaskMenu.task) !== TASK_INBOX_PROJECT && <button type="button" role="menuitem" onClick={() => setSidebarTaskMenu((current) => ({ ...current, mode: "rename", draft: taskProjectLabel(taskProjectKey(current.task)) }))}><Pencil size={16} /><span>重命名当前项目</span></button>}
              <button type="button" role="menuitem" onClick={() => setSidebarTaskMenu((current) => ({ ...current, mode: "new", draft: "" }))}><Plus size={16} /><span>新建项目并移入</span></button>
            </>
          ) : (
            <form className="sidebar-project-menu__form" onSubmit={(event) => {
              event.preventDefault();
              if (sidebarTaskMenu.mode === "rename") void renameSidebarProject(taskProjectKey(sidebarTaskMenu.task), sidebarTaskMenu.draft);
              else void moveTaskToProject(sidebarTaskMenu.task, sidebarTaskMenu.draft.trim());
            }}>
              <label><span>{sidebarTaskMenu.mode === "rename" ? "新项目名称" : "项目名称"}</span><input autoFocus value={sidebarTaskMenu.draft} onChange={(event) => setSidebarTaskMenu((current) => ({ ...current, draft: event.target.value }))} placeholder="输入项目名称" /></label>
              <div><button type="button" className="button button--ghost button--compact" onClick={() => setSidebarTaskMenu((current) => ({ ...current, mode: "list", draft: "" }))}>返回</button><button type="submit" className="button button--primary button--compact" disabled={!sidebarTaskMenu.draft.trim()}>{sidebarTaskMenu.mode === "rename" ? "保存" : "创建并移入"}</button></div>
            </form>
          )}
        </div>
      )}
      {agentDialogOpen && <NewAgentDialog instances={data.instances} onClose={() => setAgentDialogOpen(false)} onCreate={createAgent} busy={creatingAgent} />}
      {roomDialogOpen && <NewRoomDialog bots={data.bots} onClose={() => setRoomDialogOpen(false)} onCreate={createRoom} busy={creatingRoom} />}
      {addMemberDialogOpen && activeRoom && <AddRoomMembersDialog bots={asukaBots} memberIds={activeRoom.memberIds || []} onClose={() => setAddMemberDialogOpen(false)} onAdd={addRoomMembers} busy={addingMembers} />}
      {editingBot && <EditAgentDialog bot={editingBot} instances={data.instances} groups={data.groups} onClose={() => setEditingBotId("")} onSave={saveAgent} busy={savingAgent} />}
    </div>
  );
}

const ROLE_LABELS = {
  product_owner: "产品负责人",
  domain_expert: "领域专家",
  product_designer: "产品设计",
  ai_engineer: "AI 工程",
  data_engineer: "数据工程",
  software_engineer: "软件工程",
  evaluator: "质量评测",
  platform_security: "平台安全",
  delivery_lead: "交付负责人",
};

const WORKFLOW_GROUP_DEFS = [
  { id: "decision", title: "决策与架构", phases: ["scope", "discover", "design"], icon: Workflow },
  { id: "execution", title: "分组执行", phases: ["build"], icon: Cpu },
  { id: "review", title: "验收与安全", phases: ["evaluate", "secure"], icon: ShieldCheck },
  { id: "delivery", title: "交付与简报", phases: ["deliver"], icon: Send },
];

function workflowStateFor(job, messages, index, group) {
  const state = job?.state || "idle";
  const reviewerStarted = messages.some((message) => message.tool?.name === "reviewer" || message.from?.name === "ASUKA Reviewer");
  const digest = messages.some((message) => message.kind === "digest");
  if (state === "completed") return "done";
  if (["failed", "cancelled"].includes(state)) {
    if (reviewerStarted) return group.id === "review" ? state : group.id === "decision" || group.id === "execution" ? "done" : "queued";
    return group.id === "execution" ? state : group.id === "decision" ? "done" : "queued";
  }
  if (state === "needs-input") return group.id === "decision" ? "waiting" : group.id === "execution" ? "waiting" : "queued";
  if (state === "running") {
    if (digest) return group.id === "delivery" ? "active" : "done";
    if (reviewerStarted) return group.id === "review" ? "active" : group.id === "delivery" ? "queued" : "done";
    return group.id === "execution" ? "active" : group.id === "decision" ? "done" : "queued";
  }
  if (state === "queued" || state === "waiting") return group.id === "decision" ? "active" : "queued";
  return index === 0 ? "active" : "queued";
}

function buildWorkflow(job, messages, roomBots) {
  const plan = job?.decision?.plan;
  if (!plan) return null;
  const workflow = plan.workflow || [];
  const groups = WORKFLOW_GROUP_DEFS.map((definition, index) => {
    const steps = workflow.filter((step) => definition.phases.includes(step.phase));
    const roleIds = [...new Set(steps.map((step) => step.ownerRole))];
    const roles = roleIds.map((role) => ({ id: role, label: ROLE_LABELS[role] || role }));
    const gates = (plan.evaluationGates || []).filter((gate) => definition.phases.includes(gate.phase));
    const logs = messages.filter((message) => {
      if (definition.id === "decision") return message.role === "user" || message.from?.name === "NOVA";
      if (definition.id === "execution") return message.from?.name === "ASUKA Builder" || message.kind === "guidance" || message.tool?.name !== "reviewer";
      if (definition.id === "review") return message.from?.name === "ASUKA Reviewer" || message.tool?.name === "reviewer";
      return message.kind === "digest" || (message.from?.name === "ASUKA Builder" && message.role === "assistant");
    }).slice(-24);
    return { ...definition, index, steps, roles, gates, logs, state: workflowStateFor(job, messages, index, definition) };
  });
  const activeGroup = groups.find((group) => ["active", "waiting", "failed", "cancelled"].includes(group.state)) || groups.at(-1);
  return {
    groups,
    activeGroup,
    scale: plan.scale,
    taskType: plan.taskType,
    risks: plan.risks || [],
    rationale: job.decision?.rationale || [],
    budget: plan.budget,
    roles: plan.roles || [],
  };
}

function workStateForBot(bot, workflow, job) {
  const crew = crewForBot(bot);
  if (!workflow) {
    if (job?.state === "completed") return "done";
    if (job?.state === "running") return crew?.key === "nova" ? "thinking" : bot.busy ? "working" : "queued";
    if (["queued", "waiting", "needs-input"].includes(job?.state)) return crew?.key === "nova" ? "waiting" : "queued";
    if (["failed", "cancelled"].includes(job?.state)) return "failed";
    return "ready";
  }
  const groupByCrew = { nova: "decision", byte: "execution", guard: "review", relay: "delivery" };
  const group = workflow.groups.find((item) => item.id === groupByCrew[crew?.key]);
  if (!group) return job?.state === "completed" ? "done" : bot.busy ? "working" : "ready";
  if (group.state === "active") return crew?.key === "nova" ? "thinking" : "working";
  if (group.state === "waiting") return "waiting";
  if (group.state === "done") return "done";
  if (["failed", "cancelled"].includes(group.state)) return "failed";
  return group.state === "queued" ? "queued" : "ready";
}

const WORK_STATE_META = {
  ready: { label: "READY", progress: 0 },
  queued: { label: "QUEUE", progress: 18 },
  waiting: { label: "WAITING", progress: 42 },
  thinking: { label: "THINKING", progress: 48 },
  working: { label: "WORKING", progress: 72 },
  done: { label: "DONE", progress: 100 },
  failed: { label: "FAILED", progress: 100 },
};

function CrewWorkRail({ roomBots, workflow, job }) {
  if (!roomBots.length) return null;
  return (
    <section className="crew-work-rail" aria-label="Agent work states">
      <div className="crew-work-rail__label"><span>AGENT EXECUTION</span><small>{roomBots.filter((bot) => bot.busy).length || 0} active</small></div>
      <div className="crew-work-rail__items">
        {roomBots.map((bot) => {
          const crew = crewForBot(bot);
          const state = workStateForBot(bot, workflow, job);
          const meta = WORK_STATE_META[state] || WORK_STATE_META.ready;
          return (
            <article key={bot.id} className={`crew-work-card crew-work-card--${state}`} style={{ "--crew-accent": crew?.accent || "var(--accent)" }} title={bot.name}>
              <Avatar name={bot.name} color={bot.color} size="sm" busy={["thinking", "working"].includes(state)} />
              <div className="crew-work-card__copy"><span>{crew ? `${crew.name} / ${crew.role}` : bot.name}</span><strong>{state === "working" && crew ? `${crew.action} · WORKING` : meta.label}</strong></div>
              <span className="crew-work-card__percent">{meta.progress}%</span>
              <i className="crew-work-card__meter" aria-hidden="true"><span style={{ width: `${meta.progress}%` }} /></i>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ThinkingStatus({ workflow, job }) {
  if (!job || !["running", "queued", "waiting"].includes(job.state)) return null;
  const groupId = workflow?.activeGroup?.id || "decision";
  const crew = groupId === "review" ? crewForKey("guard") : groupId === "delivery" ? crewForKey("relay") : groupId === "execution" ? crewForKey("byte") : crewForKey("nova");
  const copy = {
    decision: [`${crew.name} 正在思考`, "解析目标、约束与风险，生成可执行的分组计划。"],
    execution: [`${crew.name} 正在执行`, "按已冻结的决策计划推进实现，并把阶段结果回传给 NOVA。"],
    review: [`${crew.name} 正在验收`, "独立检查交付物、阻断项和完成标准，不替代执行 Bot 自检。"],
    delivery: [`${crew.name} 正在整理交付`, "汇总实际变更、验证结果、剩余风险与下一步。"],
  }[groupId] || [`${crew.name} 正在处理`, "任务仍在推进中。"];
  return (
    <div className={`thinking-stage thinking-stage--${groupId}`} role="status">
      <div className="thinking-stage__orb" style={{ "--crew-accent": crew.accent }}>
        <span className="thinking-stage__ring thinking-stage__ring--outer" />
        <span className="thinking-stage__ring thinking-stage__ring--two" />
        <img src={crewImage(crew.key, "512")} alt="" draggable="false" />
      </div>
      <div className="thinking-stage__copy">
        <span className="eyebrow">{crew.name} / {crew.role} · LIVE</span>
        <strong>{copy[0]}<span className="thinking-dots"><i /><i /><i /></span></strong>
        <p>{copy[1]}</p>
      </div>
      <div className="thinking-stage__steps" aria-hidden="true">
        {(workflow?.groups || WORKFLOW_GROUP_DEFS).map((group) => <span key={group.id} className={`is-${group.state || "queued"}`} />)}
      </div>
    </div>
  );
}

function WorkflowMap({ workflow, open, onToggle, onSelect }) {
  if (!workflow) return null;
  return (
    <section className={`mission-map ${open ? "is-open" : ""}`}>
      <header>
        <div className="mission-map__title"><span className="mission-decision-mark"><img src={crewImage("nova", "128")} alt="" draggable="false" /></span><div><span className="eyebrow">NOVA / DECISION BOT · LIVE PLAN</span><strong>{workflow.activeGroup?.title || "准备任务"}</strong></div></div>
        <div className="mission-map__summary"><span>Scale {workflow.scale}</span><span>{workflow.taskType}</span><span>{workflow.roles.length} roles</span><span>{workflow.risks.length} risks</span><button className="text-button" onClick={onToggle}>{open ? "收起" : "展开作战图"}</button></div>
      </header>
      {open && <>
        <div className="mission-brief"><span>决策简报</span><p>{workflow.rationale.slice(0, 2).join(" ")}</p></div>
        <div className="mission-track">
          {workflow.groups.map((group, index) => {
            const Icon = group.icon;
            return <button key={group.id} className={`mission-node mission-node--${group.state}`} onClick={() => onSelect(group.id)}>
              <span className="mission-node__status">{group.state === "done" ? <CheckCircle2 size={15} /> : group.state === "active" || group.state === "waiting" ? <LoaderCircle className={group.state === "active" ? "spin" : ""} size={15} /> : <Icon size={15} />}</span>
              <span className="mission-node__copy"><small>0{index + 1}</small><strong>{group.title}</strong><em>{group.state}</em></span>
              <span className="mission-node__roles">{group.roles.slice(0, 3).map((role) => <Avatar key={role.id} role={role.id} name={role.label} color={index === 0 ? "yellow" : index === 1 ? "teal" : index === 2 ? "red" : "chrome"} size="xs" />)}{group.roles.length > 3 && <b>+{group.roles.length - 3}</b>}</span>
              {index < workflow.groups.length - 1 && <span className="mission-node__link" aria-hidden="true" />}
            </button>;
          })}
        </div>
      </>}
    </section>
  );
}

function WorkflowGroupDialog({ group, workflow, onClose }) {
  if (!group) return null;
  const Icon = group.icon;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal modal--wide workflow-detail" role="dialog" aria-modal="true" aria-labelledby="workflow-detail-title">
        <header className="modal__header"><div><span className="eyebrow">BOT GROUP · {group.state.toUpperCase()}</span><h2 id="workflow-detail-title"><Icon size={20} /> {group.title}</h2><p>Decision Bot 分配给该组的角色、交付物和执行画面。</p></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button></header>
        <div className="workflow-detail__grid">
          <aside>
            <div className="section-heading"><span>ASSIGNED BOTS</span><span>{group.roles.length}</span></div>
            <div className="workflow-agent-grid">{group.roles.map((role, index) => <article key={role.id}><Avatar role={role.id} name={role.label} color={["yellow", "teal", "red", "blue", "chrome"][index % 5]} size="sm" /><div><strong>{crewForRole(role.id)?.name || role.label}</strong><span>{role.label} · {workflow.roles.find((item) => item.role === role.id)?.mode || "shared_agent"}</span></div><StatusDot tone={group.state === "done" ? "ok" : group.state === "active" ? "warn" : "idle"} pulse={group.state === "active"} /></article>)}</div>
            <div className="section-heading workflow-detail__steps-title"><span>DELIVERABLES</span><span>{group.steps.length}</span></div>
            <div className="workflow-step-list">{group.steps.map((step) => <div key={step.id}><strong>{step.deliverable}</strong><span>{step.phase} · {ROLE_LABELS[step.ownerRole] || step.ownerRole}</span>{step.gateAfter && <em>Gate: {step.gateAfter}</em>}</div>)}</div>
            {group.gates.length > 0 && <div className="workflow-gates">{group.gates.map((gate) => <div key={gate.id}><ShieldCheck size={14} /><span><strong>{gate.id}</strong><small>{gate.criteria.join(" · ")}</small></span></div>)}</div>}
          </aside>
          <main>
            <div className="section-heading"><span>EXECUTION STREAM</span><span>{group.logs.length} events</span></div>
            <div className="workflow-execution-log">{group.logs.map((message) => <article key={message.id} className={message.kind === "activity" ? "is-tool" : ""}><Avatar name={message.from?.name || "You"} color={message.from?.color || "chrome"} size="xs" /><div><header><strong>{message.from?.name || "You"}</strong><span>{friendlyTime(message.at)}</span></header><p>{message.text || message.tool?.summary || "Activity"}</p></div></article>)}{!group.logs.length && <EmptyState title="等待该组启动" body="Decision Bot 会在前置阶段完成后把执行简报写入这里。" />}</div>
          </main>
        </div>
      </section>
    </div>
  );
}

function CommandView({ room, roomBots, bots, messages, artifacts, job, activeJobState, targetId, setTargetId, draft, setDraft, mode, setMode, sendTask, sending, messageEndRef, onCreateTeam, seeding, instances, targetBot, openOmb, onOpenSettings, backend, adapter, adapters, apiInstances, engineApiId, onSwitchAdapter, onChooseEngine, showActivity, setShowActivity, onAddMembers }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [showArchify, setShowArchify] = useState(false);
  const [selectedWorkflowGroupId, setSelectedWorkflowGroupId] = useState("");
  const composerInputRef = useRef(null);
  const workflow = useMemo(() => buildWorkflow(job, messages, roomBots), [job, messages, roomBots]);
  const selectedWorkflowGroup = workflow?.groups.find((group) => group.id === selectedWorkflowGroupId) || null;
  const guidanceMode = adapter === "native" && room?.threadId && activeJobState === "running";

  useEffect(() => {
    setSelectedWorkflowGroupId("");
  }, [room?.threadId]);

  useEffect(() => {
    const input = composerInputRef.current;
    if (!input) return;
    const resize = () => {
      const composer = input.closest(".composer");
      const chromeHeight = composer ? Math.max(74, composer.offsetHeight - input.offsetHeight) : 92;
      input.style.height = "0px";
      const contentHeight = Math.max(44, input.scrollHeight);
      const maxHeight = Math.max(44, Math.floor(window.innerHeight * 0.25 - chromeHeight));
      input.style.height = `${Math.min(contentHeight, maxHeight)}px`;
      input.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draft, guidanceMode]);

  if (!room) {
    return (
      <section className="content-pane content-pane--centered">
        <EmptyState
          icon={Workflow}
          title="建立 ASUKA 指挥室"
          body="创建一个由协调、执行和审查 Agent 组成的个人团队，然后直接在房间中派发任务。"
          action={<button className="button button--primary" onClick={onCreateTeam} disabled={seeding}>{seeding ? <LoaderCircle className="spin" size={16} /> : <Zap size={16} />} 创建 ASUKA 团队</button>}
        />
      </section>
    );
  }

  const visibleMessages = messages.filter((message) => {
    if (message.kind === "runtime" || message.kind === "screen") return false;
    if (message.kind === "activity" && !showActivity) return false;
    return true;
  }).slice(-80);
  const workingBot = roomBots.find((bot) => bot.busy);
  const architectureSignature = [
    room.threadId,
    room.tasks?.length || 0,
    room.tasks?.map((task) => `${task.threadId}:${task.activity || task.status}:${task.updatedAt}`).join(",") || "",
    roomBots.map((bot) => `${bot.id}:${bot.busy ? "busy" : "idle"}`).join(","),
  ].join("|").slice(0, 1200);
  const architectureSrc = `${CORE}/rooms/${encodeURIComponent(room.id)}/architecture?adapter=${encodeURIComponent(adapter)}&theme=light&v=${encodeURIComponent(architectureSignature)}`;

  return (
    <section className="command-pane">
      <div className="room-header">
        <div className="room-title-group">
          <div><span className="eyebrow">LIVE ROOM</span><p>{room.bulletin ? shortText(room.bulletin, 120) : room.section || "Personal command room"}</p></div>
        </div>
        <div className="room-header__right">
          {workflow && <button className={`trace-toggle status-drawer-toggle ${!showArchify && statusOpen ? "is-active" : ""}`} onClick={() => { setShowArchify(false); setStatusOpen((value) => !value); }} title="显示或隐藏运行状态" aria-expanded={statusOpen}><Activity size={14} /> {statusOpen ? "收起状态" : "状态"} <ChevronDown className={statusOpen ? "is-open" : ""} size={13} /></button>}
          <button className={`trace-toggle ${!showArchify && showActivity ? "is-active" : ""}`} onClick={() => { setShowArchify(false); setShowActivity((value) => !value); }} title="显示或隐藏工具活动"><Terminal size={14} /> 工具活动</button>
          <div className="avatar-stack">
          {roomBots.slice(0, 5).map((bot) => <Avatar key={bot.id} name={bot.name} color={bot.color} size="sm" busy={bot.busy} />)}
          <span className="avatar-stack__count">{roomBots.length} agents</span>
          <button className="avatar-stack__add" onClick={onAddMembers} aria-label="增加成员" title="增加成员"><Plus size={14} /></button>
          </div>
        </div>
      </div>

      {!showArchify && statusOpen && (
        <div className="command-status-drawer">
          <CrewWorkRail roomBots={roomBots} workflow={workflow} job={job} />
          <WorkflowMap workflow={workflow} open={workflowOpen} onToggle={() => setWorkflowOpen((value) => !value)} onSelect={setSelectedWorkflowGroupId} />
        </div>
      )}

      {showArchify ? (
        <div className="room-visualizer">
          <iframe key={architectureSignature} src={architectureSrc} title={`${room.name} Archify 架构视图`} sandbox="allow-scripts allow-downloads" />
        </div>
      ) : (
        <div className="message-stream">
            {visibleMessages.length === 0 ? (
              <div className="conversation-empty">
                <div className="conversation-empty__mark"><img src="/brand/asuka-logo.svg" alt="" draggable="false" /></div>
                <span className="eyebrow">READY FOR A BRIEF</span>
                <h3>把目标交给团队</h3>
                <p>ASUKA 会保留房间上下文、Agent 回复、执行状态和任务树。</p>
                <div className="prompt-seeds">
                  <button onClick={() => setDraft("检查当前项目，列出最值得先做的三件事，并说明验收标准。")}>检查当前项目</button>
                  <button onClick={() => setDraft("让 Builder 做一个小改动，再让 Reviewer 独立检查结果。")}>执行并复核</button>
                  <button onClick={() => setDraft("调研这个问题的三个独立来源，整理证据、反证和下一步。")}>调研与取证</button>
                </div>
              </div>
            ) : visibleMessages.map((message) => <MessageRow key={message.id} message={message} bots={bots} />)}
            {artifacts.length > 0 && <ArtifactShelf artifacts={artifacts} />}
            {(room.working || workingBot) && <ThinkingStatus workflow={workflow} job={job} />}
            <div ref={messageEndRef} />
        </div>
      )}

      <form className="composer" onSubmit={sendTask}>
        <div className="composer__toolbar">
          <label className="target-select"><span>ENGINE</span><select value={engineApiId ? `api:${engineApiId}` : adapter} onChange={(event) => void onChooseEngine(event.target.value)} disabled={sending}><optgroup label="Execution Adapter">{adapters.map((item) => <option key={item.id} value={item.id} disabled={!item.available && item.id !== adapter}>{item.label}{item.model ? ` · ${item.model}` : ""}{item.available ? "" : " · unavailable"}</option>)}</optgroup>{apiInstances.length > 0 && <optgroup label="Fallback API">{apiInstances.map((item) => <option key={item.instanceId} value={`api:${item.instanceId}`}>{item.displayName} · {item.models.default}</option>)}</optgroup>}</select></label>
          <label className="target-select"><span>TO</span><select value={guidanceMode ? "decision" : targetId} onChange={(event) => setTargetId(event.target.value)} disabled={guidanceMode}><option value="auto">Auto / NOVA</option>{guidanceMode && <option value="decision">NOVA / Decision Bot</option>}{roomBots.map((bot) => <option key={bot.id} value={bot.id}>{displayBotName(bot.name)}</option>)}</select></label>
          <div className="mode-switch" role="group" aria-label="消息模式">
            <button type="button" className={mode === "goal" ? "is-active" : ""} onClick={() => setMode("goal")}><Workflow size={14} /> 任务</button>
            <button type="button" className={mode === "chat" ? "is-active" : ""} onClick={() => setMode("chat")}><MessageCircle size={14} /> 对话</button>
          </div>
          <button type="button" className={`composer-view-toggle ${showArchify ? "is-active" : ""}`} onClick={() => setShowArchify((value) => !value)} title={showArchify ? "关闭架构视图" : "打开架构视图"} aria-pressed={showArchify}><Network size={14} /> {showArchify ? "收起视图" : "架构视图"}</button>
          {targetBot && <span className="target-hint"><Avatar name={targetBot.name} color={targetBot.color} size="xs" />{displayBotName(targetBot.name)}</span>}
        </div>
        <textarea
          ref={composerInputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) sendTask(event); }}
          placeholder={guidanceMode ? `向 Decision Bot 补充指导意见；将纳入下一个执行阶段。当前：${workflow?.activeGroup?.title || "执行中"}` : "描述目标、约束和验收标准。Ctrl+Enter 发送。"}
          rows={1}
        />
        <div className="composer__footer">
          <span className="composer-note">{guidanceMode ? <><Workflow size={14} /> Decision Bot 正在执行 · 可随时补充指导</> : <><ShieldCheck size={14} /> 不可逆动作保留审批</>}</span>
          <div className="composer-actions">
            <button type="button" className="button button--ghost button--compact" onClick={backend?.kind === "openmausbot" ? openOmb : onOpenSettings}><Settings2 size={15} /> 设置</button>
            <button type="submit" className="button button--primary" disabled={sending || !draft.trim()}>{sending ? <LoaderCircle className="spin" size={16} /> : guidanceMode ? <MessageCircle size={16} /> : <Send size={16} />} {guidanceMode ? "发送指导" : "派发"}</button>
          </div>
        </div>
      </form>
      {selectedWorkflowGroup && <WorkflowGroupDialog group={selectedWorkflowGroup} workflow={workflow} onClose={() => setSelectedWorkflowGroupId("")} />}
    </section>
  );
}

function ArtifactShelf({ artifacts }) {
  const [notice, setNotice] = useState("");
  const iconFor = (kind) => kind === "spreadsheet" ? FileSpreadsheet : kind === "image" ? FileImage : kind === "code" ? FileCode2 : FileText;
  async function copyPath(path) {
    try {
      await navigator.clipboard.writeText(path);
      setNotice("产物路径已复制");
    } catch {
      setNotice(path);
    }
  }
  async function openArtifact(path) {
    const openPath = window.asukaDesktop?.openPath;
    if (openPath) await openPath(path);
    else await copyPath(path);
  }
  async function revealArtifact(path) {
    const revealPath = window.asukaDesktop?.revealPath;
    if (revealPath) await revealPath(path);
    else await copyPath(path);
  }
  return (
    <section className="artifact-shelf" aria-label="任务产物">
      <header><span className="eyebrow">DELIVERABLES</span><span>{artifacts.length} artifacts</span></header>
      <div className="artifact-shelf__grid">
        {artifacts.map((artifact) => {
          const Icon = iconFor(artifact.kind);
          return <article key={artifact.id || artifact.path} className="artifact-card">
            <span className={`artifact-card__icon artifact-card__icon--${artifact.kind || "file"}`}><Icon size={19} /></span>
            <div className="artifact-card__copy">
              <strong title={artifact.name}>{artifact.name}</strong>
              <span>{(artifact.extension || "FILE").replace(".", "").toUpperCase()} · {formatBytes(artifact.size)} · {friendlyTime(artifact.modifiedAt)}</span>
              <small title={artifact.path}>{artifact.path}</small>
            </div>
            <div className="artifact-card__actions">
              <button type="button" className="icon-button icon-button--small" onClick={() => void openArtifact(artifact.path)} title="打开产物" aria-label={`打开 ${artifact.name}`}><ExternalLink size={14} /></button>
              <button type="button" className="icon-button icon-button--small" onClick={() => void revealArtifact(artifact.path)} title="在文件夹中显示" aria-label={`显示 ${artifact.name} 所在文件夹`}><FolderOpen size={14} /></button>
              <button type="button" className="icon-button icon-button--small" onClick={() => void copyPath(artifact.path)} title="复制路径" aria-label={`复制 ${artifact.name} 路径`}><Copy size={14} /></button>
            </div>
          </article>;
        })}
      </div>
      {notice && <div className="artifact-shelf__notice" role="status">{notice}</div>}
    </section>
  );
}

function MessageRow({ message, bots }) {
  const isUser = message.role === "user";
  const bot = message.from?.botId ? bots.find((item) => item.id === message.from.botId) : null;
  const rawName = isUser ? "YOU" : message.from?.name || bot?.name || "Agent";
  const name = isUser ? rawName : displayBotName(rawName);
  const color = isUser ? "chrome" : message.from?.color || bot?.color || "teal";
  const tone = message.kind === "activity" ? "activity" : message.kind === "digest" ? "digest" : "text";
  const text = message.text || (message.kind === "activity" ? message.tool?.summary || message.tool?.step?.target || "Tool activity" : "");
  if (!text && !message.tool) return null;
  return (
    <article className={`message message--${tone} ${isUser ? "message--user" : ""}`}>
      <Avatar name={name} color={color} size="sm" />
      <div className="message__body">
        <header><strong title={isUser ? name : rawName}>{name}</strong>{!isUser && <span>{crewForBot(rawName) ? `${crewForBot(rawName).role} · ` : ""}{friendlyTime(message.at)}</span>}{isUser && <span>{friendlyTime(message.at)}</span>}</header>
        {tone === "activity" ? (
          <div className="activity-line"><Terminal size={14} /><span>{shortText(text, 240)}</span>{message.tool?.ok === false && <CircleAlert size={14} />}</div>
        ) : (
          <p>{message.kind === "digest" ? shortText(text, 900) : text}</p>
        )}
        {message.from?.name && !isUser && <footer><span>{message.kind === "digest" ? "turn summary" : message.kind}</span></footer>}
      </div>
    </article>
  );
}

function Inspector({ room, roomBots, job, activeJobState, instances, targetBot, backendKind }) {
  const counts = job?.counts || {};
  const runtimeFor = (bot) => instances.find((item) => item.instanceId === bot.modelSelection?.instanceId);
  return (
    <div className="inspector__inner">
      <section className="inspector-section">
        <div className="section-heading"><span>ROOM PULSE</span><StatusDot tone={statusTone(activeJobState)} pulse={activeJobState === "running"} /></div>
        <div className="pulse-grid">
          <div><strong>{roomBots.length}</strong><span>Agents</span></div>
          <div><strong>{counts.running || 0}</strong><span>Running</span></div>
          <div><strong>{(counts.queued || 0) + (counts.waiting || 0)}</strong><span>Queued</span></div>
          <div><strong>{counts.needsInput || 0}</strong><span>Needs you</span></div>
        </div>
        {job?.state === "needs-input" && <div className="attention-box"><ShieldCheck size={17} /><div><strong>需要你的决定</strong><span>{backendKind === "openmausbot" ? "在 OpenMausBot 中处理审批卡，然后回到 ASUKA 继续。" : "在审批页处理原生审批卡，Allow 后任务自动继续。"}</span></div></div>}
      </section>

      <section className="inspector-section">
        <div className="section-heading"><span>AGENT LINEUP</span><Users size={15} /></div>
        <div className="agent-mini-list">
          {roomBots.map((bot) => {
            const runtime = runtimeFor(bot);
            const crew = crewForBot(bot);
            return (
              <div className={`agent-mini ${bot.id === targetBot?.id ? "is-target" : ""}`} key={bot.id}>
                <Avatar name={bot.name} color={bot.color} size="sm" busy={bot.busy} />
                <div><strong>{crew?.name || bot.name}</strong><span>{crew ? `${crew.role} / ${runtime?.displayName || bot.modelSelection?.instanceId || "Runtime"}` : runtime?.displayName || bot.modelSelection?.instanceId || "Runtime"}</span></div>
                <StatusDot tone={bot.busy ? "warn" : statusTone(runtime?.snapshot?.state)} pulse={bot.busy} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="inspector-section inspector-section--trace">
        <div className="section-heading"><span>LATEST JOB</span><Activity size={15} /></div>
        <div className="job-summary">
          <div className="job-state"><StatusDot tone={statusTone(job?.state)} /><span>{job?.state || "idle"}</span></div>
          <p>{job?.reason || "No task is running in this room."}</p>
          {job?.roots?.length > 0 && <div className="trace-stat"><Workflow size={14} /><span>{job.roots.length} root handoff · {job.nodes?.length || 0} nodes</span></div>}
          {job?.scope && <div className="trace-stat"><Clock3 size={14} /><span>scope: {job.scope}</span></div>}
        </div>
      </section>

      <section className="inspector-section inspector-connection">
        <Server size={16} />
        <div><strong>Local harness</strong><span>{room?.section || "ASUKA"} · OpenMausBot</span></div>
        <CheckCircle2 size={15} />
      </section>
    </div>
  );
}

function AgentsView({ bots, instances, agentFilter, setAgentFilter, search, setSearch, onNew, onEdit, onSeed, seeding, onUse, onOpenSkills, activeRoom, onAssignModel, savingAgentModel }) {
  const runtimeFor = (bot) => instances.find((item) => item.instanceId === bot.modelSelection?.instanceId);
  const filtered = bots.filter((bot) => {
    if (agentFilter === "asuka" && bot.section !== ASUKA_SECTION) return false;
    if (agentFilter === "ready") return runtimeFor(bot)?.snapshot?.state === "available";
    return true;
  }).filter((bot) => `${bot.name} ${bot.title} ${bot.description}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="content-pane">
      <div className="page-toolbar">
        <div><span className="eyebrow">AGENT REGISTRY</span><h2>把不同 Runtime 组织成个人团队</h2></div>
        <div className="page-toolbar__actions">
          <button className="button button--ghost" onClick={onSeed} disabled={seeding}>{seeding ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} 初始化 ASUKA 团队</button>
          <button className="button button--primary" onClick={onNew}><Plus size={16} /> 新建 Agent</button>
        </div>
      </div>
      <div className="filter-row">
        <div className="mode-switch"><button className={agentFilter === "asuka" ? "is-active" : ""} onClick={() => setAgentFilter("asuka")}>ASUKA</button><button className={agentFilter === "ready" ? "is-active" : ""} onClick={() => setAgentFilter("ready")}>Ready</button><button className={agentFilter === "all" ? "is-active" : ""} onClick={() => setAgentFilter("all")}>All</button></div>
        <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索 Agent" /></label>
      </div>
      <div className="agent-grid">
        {filtered.map((bot) => {
          const runtime = runtimeFor(bot);
          const crew = crewForBot(bot);
          const available = runtime?.snapshot?.state === "available";
          const inRoom = activeRoom?.memberIds?.includes(bot.id);
          const apiOptions = instances.filter((item) => item.snapshot?.state === "available" || item.instanceId === bot.modelSelection?.instanceId);
          return (
            <article className={`agent-card${bot.isOrchestrator ? " agent-card--orchestrator" : ""}`} key={bot.id}>
              <div className="agent-card__top"><Avatar name={bot.name} color={bot.color} size="lg" busy={bot.busy} /><div className="agent-card__status"><StatusDot tone={bot.isOrchestrator ? "ok" : bot.busy ? "warn" : statusTone(runtime?.snapshot?.state)} pulse={bot.busy} />{bot.isOrchestrator ? "orchestrator" : bot.busy ? "working" : available ? "ready" : "offline"}</div></div>
              <div className="agent-card__identity"><span>{bot.isOrchestrator ? "ASUKA CORE / ROUTER" : crew ? `${crew.name} / ${crew.role}` : bot.section || "PERSONAL"}</span><h3>{crew?.name || bot.name}</h3><p>{bot.isOrchestrator ? "NOVA · 中台不参与 Worker 产出" : `${bot.name} · ${bot.roleLabel || bot.title || "Personal agent"}`}</p></div>
              <p className="agent-card__description">{shortText(bot.description || bot.soul || "No standing brief.", 240)}</p>
              {bot.isOrchestrator ? <div className="agent-card__runtime"><Workflow size={14} /><span>Event Bus · Router · Approval · Review</span><code>deterministic / no worker output</code></div> : <>
                <div className="agent-card__runtime"><Cpu size={14} /><span>{runtime?.displayName || bot.modelSelection?.instanceId || "Unknown runtime"}</span><code>{bot.modelSelection?.model}</code></div>
                <label className="agent-card__api"><span><Server size={13} /> 接入 API</span><select value={bot.modelSelection?.instanceId || ""} onChange={(event) => onAssignModel(bot, instances.find((item) => item.instanceId === event.target.value))} disabled={savingAgentModel === bot.id || bot.busy}>{apiOptions.map((item) => <option key={item.instanceId} value={item.instanceId}>{item.displayName || item.instanceId}{item.models?.default ? ` · ${item.models.default}` : ""}</option>)}{!apiOptions.length && <option value="">未配置 API</option>}</select>{savingAgentModel === bot.id && <LoaderCircle className="spin" size={13} />}</label>
                <div className="agent-card__skills"><div><BookOpen size={14} /><strong>{bot.skillSummary?.enabled || 0}/{bot.skillSummary?.total || 0} Skills</strong>{bot.skillSummary?.private > 0 && <span>{bot.skillSummary.private} private</span>}</div>{bot.skillSummary?.labels?.length > 0 && <p>{bot.skillSummary.labels.join(" · ")}</p>}</div>
              </>}
              <div className="agent-card__footer"><span>{inRoom ? "IN CURRENT ROOM" : bot.approvalMode === "ask" ? "APPROVAL ON" : "AUTONOMY ON"}</span><div className="agent-card__actions"><button className="text-button" onClick={() => onOpenSkills(bot)}>Skills</button><button className="icon-button icon-button--small" onClick={() => onEdit(bot)} aria-label={`编辑 ${bot.name}`}><Pencil size={13} /></button><button className="text-button" disabled={!inRoom} onClick={() => onUse(bot)}>派发任务 <ChevronRight size={14} /></button></div></div>
            </article>
          );
        })}
      </div>
      {filtered.length === 0 && <EmptyState title="没有匹配的 Agent" body="新建 Agent，或切换筛选条件。" action={<button className="button button--primary" onClick={onNew}><Plus size={16} /> 新建 Agent</button>} />}
    </section>
  );
}

function stageDisplay(stage = "idle") {
  return String(stage).replace("person/", "needs ").replace("working/", "");
}

function toolResultParts(result) {
  const content = Array.isArray(result?.content) ? result.content : [];
  return {
    text: content.filter((item) => item?.type === "text").map((item) => item.text).join("\n"),
    images: content.filter((item) => item?.type === "image" && item.data && item.mimeType).map((item) => `data:${item.mimeType};base64,${item.data}`),
  };
}

function ToolCenterView({ onNotice }) {
  const [catalog, setCatalog] = useState({ servers: [], approvals: [], audit: [] });
  const [selectedServerId, setSelectedServerId] = useState("");
  const [tools, setTools] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);
  const [argsText, setArgsText] = useState("{}");
  const [result, setResult] = useState(null);
  const [approval, setApproval] = useState(null);
  const [busy, setBusy] = useState("");
  const [showServerForm, setShowServerForm] = useState(false);
  const [serverForm, setServerForm] = useState({ name: "", transport: "stdio", command: "", url: "", args: "[]", env: "{}", headers: "{}" });

  const selectedServer = catalog.servers.find((server) => server.id === selectedServerId) || null;
  const resultParts = toolResultParts(result);

  const loadCatalog = useCallback(async () => {
    try {
      const next = await core("/tools");
      setCatalog(next);
      if (!selectedServerId && next.servers?.[0]) setSelectedServerId(next.servers[0].id);
    } catch (error) {
      onNotice(error.message, "bad");
    }
  }, [onNotice, selectedServerId]);

  useEffect(() => {
    loadCatalog();
    const timer = window.setInterval(loadCatalog, 8000);
    return () => window.clearInterval(timer);
  }, [loadCatalog]);

  async function connect(serverId = selectedServerId) {
    if (!serverId) return;
    setBusy("connect");
    setSelectedServerId(serverId);
    try {
      const response = await core(`/tools/servers/${encodeURIComponent(serverId)}/connect`, { method: "POST", body: "{}" });
      setTools(response.tools || []);
      setSelectedTool(null);
      setResult(null);
      await loadCatalog();
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  function chooseTool(tool) {
    setSelectedTool(tool);
    setApproval(null);
    setResult(null);
    const defaults = {};
    for (const [key, schema] of Object.entries(tool.inputSchema?.properties || {})) {
      if (schema.default !== undefined) defaults[key] = schema.default;
    }
    setArgsText(JSON.stringify(defaults, null, 2));
  }

  async function callTool(approvalId) {
    let args;
    try { args = JSON.parse(argsText || "{}"); } catch { throw new Error("工具参数必须是 JSON 对象"); }
    const response = await core("/tools/call", {
      method: "POST",
      body: JSON.stringify({ serverId: selectedServerId, toolName: selectedTool.name, args, approvalId }),
    });
    setResult(response.result);
    setApproval(null);
    await loadCatalog();
  }

  async function invokeTool() {
    if (!selectedTool || !selectedServerId) return;
    setBusy("invoke");
    try {
      if (selectedTool.risk === "safe") {
        await callTool();
      } else {
        let args;
        try { args = JSON.parse(argsText || "{}"); } catch { throw new Error("工具参数必须是 JSON 对象"); }
        const response = await core("/tools/approvals", {
          method: "POST",
          body: JSON.stringify({ serverId: selectedServerId, toolName: selectedTool.name, args }),
        });
        setApproval(response.approval);
      }
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  async function decideApproval(approved) {
    if (!approval) return;
    setBusy("approval");
    try {
      await core(`/tools/approvals/${encodeURIComponent(approval.id)}/decide`, { method: "POST", body: JSON.stringify({ approved }) });
      if (approved) await callTool(approval.id);
      else setApproval(null);
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  async function quickInvoke(toolName, args = {}) {
    setBusy(`quick:${toolName}`);
    try {
      const response = await core("/tools/call", {
        method: "POST",
        body: JSON.stringify({ serverId: selectedServerId, toolName, args }),
      });
      setSelectedTool(tools.find((tool) => tool.name === toolName) || null);
      setArgsText(JSON.stringify(args, null, 2));
      setResult(response.result);
      await loadCatalog();
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  async function saveServer(event) {
    event.preventDefault();
    setBusy("server");
    try {
      const args = serverForm.transport === "stdio" ? JSON.parse(serverForm.args || "[]") : [];
      const env = serverForm.transport === "stdio" ? JSON.parse(serverForm.env || "{}") : {};
      const headers = serverForm.transport === "http" ? JSON.parse(serverForm.headers || "{}") : {};
      if (!Array.isArray(args)) throw new Error("args 必须是 JSON 数组");
      if (!env || typeof env !== "object" || Array.isArray(env)) throw new Error("env 必须是 JSON 对象");
      if (!headers || typeof headers !== "object" || Array.isArray(headers)) throw new Error("headers 必须是 JSON 对象");
      const response = await core("/tools/servers", {
        method: "POST",
        body: JSON.stringify({ name: serverForm.name, transport: serverForm.transport, command: serverForm.command, url: serverForm.url, args, env, headers }),
      });
      setShowServerForm(false);
      setServerForm({ name: "", transport: "stdio", command: "", url: "", args: "[]", env: "{}", headers: "{}" });
      await loadCatalog();
      await connect(response.server.id);
      onNotice("MCP Server 已保存", "ok");
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  function configureGithub() {
    setShowServerForm(true);
    setServerForm({
      name: "GitHub",
      transport: "http",
      command: "",
      url: "https://api.githubcopilot.com/mcp/",
      args: "[]",
      env: "{}",
      headers: "{\n  \"Authorization\": \"Bearer YOUR_GITHUB_PAT\"\n}",
    });
  }

  async function removeServer(server) {
    if (!window.confirm(`移除 MCP Server ${server.name}？`)) return;
    setBusy(`remove:${server.id}`);
    try {
      await core(`/tools/servers/${encodeURIComponent(server.id)}`, { method: "DELETE" });
      if (selectedServerId === server.id) {
        setSelectedServerId("");
        setTools([]);
        setSelectedTool(null);
        setResult(null);
      }
      await loadCatalog();
      onNotice(`${server.name} 已移除`, "ok");
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="content-pane tools-view">
      <div className="page-toolbar"><div><span className="eyebrow">MCP TOOL FABRIC</span><h2>工具、Computer Use 与审计</h2></div><div className="settings-actions"><button className="button button--ghost" onClick={loadCatalog}><RefreshCw size={15} /> 刷新</button><button className="button button--ghost" onClick={configureGithub}><Github size={15} /> GitHub PAT</button><button className="button button--primary" onClick={() => setShowServerForm((current) => !current)}><Plus size={15} /> 添加 MCP Server</button></div></div>
      <div className="fabric-boundary"><ShieldCheck size={18} /><div><strong>Native Agent 自动调用 MCP，GUI 动作先观察再审批</strong><span>支持本地 stdio 与远程 HTTPS MCP。Read-only 工具可自动运行；状态变更动作必须生成一次性审批。GUI 动作后自动刷新 Snapshot，所有调用写入本地审计。</span></div><span className="provider-state is-ready">STDIO + HTTPS</span></div>
      {showServerForm && (
        <form className="settings-panel tool-server-form" onSubmit={saveServer}>
          <div className="settings-panel__head"><span className="runtime-icon"><Server size={17} /></span><div><span className="eyebrow">CUSTOM SERVER</span><h3>{serverForm.transport === "http" ? "远程 HTTPS MCP" : "本地 stdio MCP"}</h3></div></div>
          <div className="provider-form">
            <label className="field"><span>名称</span><input required value={serverForm.name} onChange={(event) => setServerForm({ ...serverForm, name: event.target.value })} placeholder="my-mcp" /></label>
            <label className="field"><span>Transport</span><select value={serverForm.transport} onChange={(event) => setServerForm({ ...serverForm, transport: event.target.value })}><option value="stdio">Local stdio</option><option value="http">Remote HTTP</option></select></label>
            {serverForm.transport === "stdio" ? <>
              <label className="field"><span>命令</span><input required value={serverForm.command} onChange={(event) => setServerForm({ ...serverForm, command: event.target.value })} placeholder="C:\path\to\server.exe" /></label>
              <label className="field"><span>Args JSON</span><input value={serverForm.args} onChange={(event) => setServerForm({ ...serverForm, args: event.target.value })} placeholder='["serve"]' /></label>
              <label className="field"><span>Env JSON</span><input value={serverForm.env} onChange={(event) => setServerForm({ ...serverForm, env: event.target.value })} placeholder='{"TOKEN":"..."}' /></label>
            </> : <>
              <label className="field"><span>MCP URL</span><input required type="url" value={serverForm.url} onChange={(event) => setServerForm({ ...serverForm, url: event.target.value })} placeholder="https://api.githubcopilot.com/mcp/" /></label>
              <label className="field"><span>Headers JSON</span><textarea rows={4} value={serverForm.headers} onChange={(event) => setServerForm({ ...serverForm, headers: event.target.value })} spellCheck={false} placeholder='{"Authorization":"Bearer ..."}' /></label>
            </>}
            <div className="settings-actions"><button className="button button--primary" disabled={busy === "server"}>{busy === "server" ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} 保存并连接</button></div>
          </div>
        </form>
      )}
      <div className="tools-layout">
        <aside className="tool-server-list">
          <div className="section-heading"><span>MCP SERVERS</span><span>{catalog.servers.length}</span></div>
          {catalog.servers.map((server) => (
            <article className={`tool-server-card ${server.id === selectedServerId ? "is-active" : ""}`} key={server.id}>
              <div><StatusDot tone={server.error ? "bad" : server.connected ? "ok" : "idle"} /><strong>{server.name}</strong></div>
              <code>{server.transport === "http" ? server.url : server.command}</code>
              {server.error && <p>{shortText(server.error, 160)}</p>}
              <footer><button className="text-button" onClick={() => connect(server.id)} disabled={busy === "connect"}>{server.connected ? "重新连接" : "连接"}</button><button className="icon-button icon-button--small" onClick={() => removeServer(server)} aria-label={`移除 ${server.name}`}><Trash2 size={13} /></button></footer>
            </article>
          ))}
        </aside>

        <div className="tool-catalog">
          <div className="section-heading"><span>TOOLS</span><span>{selectedServer?.name || "No server"}</span></div>
          {selectedServerId === "windows-mcp" && (
            <div className="tool-quick-actions">
              <button onClick={() => quickInvoke("ControlStatus", {})} disabled={Boolean(busy)}><Activity size={14} /> ControlStatus</button>
              <button onClick={() => quickInvoke("Snapshot", { use_vision: true, use_ui_tree: false })} disabled={Boolean(busy)}><Bot size={14} /> Snapshot</button>
              <button onClick={() => quickInvoke("Screenshot", {})} disabled={Boolean(busy)}><Sparkles size={14} /> Screenshot</button>
              <button onClick={() => quickInvoke("DisplayInventory", {})} disabled={Boolean(busy)}><Monitor size={14} /> Displays</button>
            </div>
          )}
          <div className="tool-list">
            {tools.map((tool) => (
              <button key={tool.name} className={`tool-row ${selectedTool?.name === tool.name ? "is-active" : ""}`} onClick={() => chooseTool(tool)}>
                <span><strong>{tool.name}</strong><small>{shortText(tool.description || "", 130)}</small></span>
                <span className={`tool-risk tool-risk--${tool.risk}`}>{tool.risk}</span>
              </button>
            ))}
            {!tools.length && <EmptyState title="连接一个 MCP Server" body="连接后可查看工具 schema、运行只读工具或申请危险操作审批。" />}
          </div>
        </div>

        <div className="tool-console">
          <div className="section-heading"><span>TOOL CONSOLE</span><span>{selectedTool?.risk || "idle"}</span></div>
          {selectedTool ? (
            <>
              <div className="tool-console__head"><div><span className="eyebrow">SELECTED TOOL</span><h3>{selectedTool.name}</h3><p>{selectedTool.description}</p></div><span className={`tool-risk tool-risk--${selectedTool.risk}`}>{selectedTool.risk}</span></div>
              <label className="field"><span>Arguments JSON</span><textarea rows={8} value={argsText} onChange={(event) => setArgsText(event.target.value)} spellCheck={false} /></label>
              <div className="settings-actions">
                <button className="button button--primary" onClick={invokeTool} disabled={Boolean(busy) || Boolean(approval)}>{busy === "invoke" ? <LoaderCircle className="spin" size={15} /> : selectedTool.risk === "safe" ? <Play size={15} /> : <ShieldCheck size={15} />} {selectedTool.risk === "safe" ? "运行只读工具" : "申请一次性审批"}</button>
              </div>
              {approval && (
                <div className="tool-approval-box">
                  <ShieldCheck size={18} />
                  <div><strong>需要确认：{approval.toolName}</strong><span>风险级别 {approval.risk}。批准只对当前参数生效，调用一次后失效。</span><pre>{JSON.stringify(approval.args, null, 2)}</pre></div>
                  <div className="settings-actions"><button className="button button--ghost" onClick={() => decideApproval(false)} disabled={busy === "approval"}><X size={14} /> 拒绝</button><button className="button button--primary" onClick={() => decideApproval(true)} disabled={busy === "approval"}><Check size={14} /> 批准并运行</button></div>
                </div>
              )}
            </>
          ) : <EmptyState icon={Wrench} title="选择一个工具" body="工具参数使用服务器提供的 JSON Schema。危险动作不会直接执行。" />}
          {(resultParts.text || resultParts.images.length > 0) && (
            <div className="tool-result">
              <div className="section-heading"><span>RESULT</span><span>{resultParts.images.length} images</span></div>
              {resultParts.text && <pre>{resultParts.text}</pre>}
              {resultParts.images.map((src, index) => <img key={index} src={src} alt={`tool result ${index + 1}`} />)}
            </div>
          )}
        </div>
      </div>

      <div className="tool-audit">
        <div className="section-heading"><span>RECENT CALLS</span><span>{catalog.audit.length}</span></div>
        <div className="tool-audit-list">
          {catalog.audit.slice(0, 12).map((item) => (
            <div key={item.id} className="tool-audit-row"><StatusDot tone={item.status === "ok" ? "ok" : "bad"} /><span><strong>{item.serverId} / {item.toolName}</strong><small>{item.taskId ? `task ${item.taskId.slice(0, 8)} · ` : ""}{item.resultSummary || item.error || item.status}</small></span><span className={`tool-risk tool-risk--${item.risk}`}>{item.risk}</span><time>{friendlyTime(item.createdAt)}</time></div>
          ))}
          {!catalog.audit.length && <div className="fabric-empty">No MCP calls yet</div>}
        </div>
      </div>
    </section>
  );
}

function FabricView({ adapter, backend, onNotice, onRefresh }) {
  const [fabric, setFabric] = useState({ tasks: [], lanes: {}, partial: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFabric(await core("/fabric"));
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setLoading(false);
    }
  }, [onNotice]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [load, adapter]);

  async function act(task, action) {
    setBusy(`${action}:${task.threadId || task.id}`);
    try {
      await core(`/tasks/${encodeURIComponent(task.threadId || task.id)}/${action}`, {
        method: "POST",
        body: JSON.stringify({ kind: task.kind || "room", ownerId: task.ownerId || "" }),
      });
      onNotice(action === "retry" ? "任务已重新入队" : "任务已停止", "ok");
      await load();
      await onRefresh();
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  const lanes = [
    { id: "attention", title: "HUMAN ATTENTION", tone: "warn" },
    { id: "working", title: "WORKING", tone: "ok" },
    { id: "queued", title: "QUEUED", tone: "warn" },
    { id: "idle", title: "IDLE", tone: "idle" },
    { id: "ended", title: "ENDED", tone: "idle" },
  ];
  const byLane = (lane) => (fabric.tasks || []).filter((task) => (showArchived || !task.archived) && task.stageMeta?.lane === lane);

  return (
    <section className="content-pane fabric-view">
      <div className="page-toolbar"><div><span className="eyebrow">TASK FABRIC</span><h2>Stage、授权与执行报告</h2></div><div className="page-toolbar__actions"><button className="button button--ghost" onClick={() => setShowArchived((value) => !value)}><Archive size={16} /> {showArchived ? "隐藏归档" : "显示归档"}</button><button className="button button--ghost" onClick={load} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} 刷新</button></div></div>
      <div className="fabric-boundary"><Layers3 size={18} /><div><strong>{ADAPTER_LABELS[backend?.kind] || "Native"} · ASUKA owned</strong><span>任务阶段由确定性规则计算；Mandate 记录授权范围，Report 记录执行器最后回报。</span></div><span className="provider-state is-ready">{fabric.partial ? "mapped" : "native"}</span></div>
      <div className="fabric-lanes">
        {lanes.map((lane) => {
          const tasks = byLane(lane.id);
          return (
            <section className="fabric-lane" key={lane.id}>
              <header><span><StatusDot tone={lane.tone} />{lane.title}</span><strong>{tasks.length}</strong></header>
              <div className="fabric-lane__body">
                {tasks.map((task) => {
                  const canRetry = ["person/failed", "person/recovery", "person/blocked", "person/delivery"].includes(task.stage);
                  const canStop = ["working", "working/queued"].includes(task.stage);
                  const id = task.threadId || task.id;
                  return (
                    <article className="fabric-ticket" key={id}>
                      <div className="fabric-ticket__top"><span className="fabric-stage">{stageDisplay(task.stage)}</span><span>{friendlyTime(task.updatedAt)}</span></div>
                      <h3>{task.title || "Untitled task"}</h3>
                      <p>{task.report?.summary || task.error || task.mandate?.scope || "No report yet"}</p>
                      <div className="fabric-ticket__meta"><span>{TASK_CATEGORY_LABELS[task.category] || task.category || "未分类"}</span><span>{(task.mandate?.autonomy || "execute").toUpperCase()}</span><code>{String(id).slice(0, 8)}</code></div>
                      <footer>
                        {canRetry && <button className="button button--ghost button--compact" disabled={busy === `retry:${id}`} onClick={() => act(task, "retry")}><RefreshCw size={13} /> 重试</button>}
                        {canStop && <button className="button button--ghost button--compact" disabled={busy === `stop:${id}`} onClick={() => act(task, "stop")}><Ban size={13} /> 停止</button>}
                        <span>{task.stageAction || "stable"}</span>
                      </footer>
                    </article>
                  );
                })}
                {!tasks.length && <div className="fabric-empty">Empty</div>}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function TasksView({ bots, groups, onOpenRoom, onNotice, onRefresh }) {
  const tasks = useMemo(() => {
    const rows = [];
    const seen = new Set();
    for (const room of groups.filter((item) => item.section === ASUKA_SECTION)) {
      for (const task of room.tasks || []) {
        if (!task.threadId || seen.has(task.threadId)) continue;
        seen.add(task.threadId);
        rows.push({ ...task, kind: "room", roomId: room.id, owner: room.name, busy: Boolean(task.working || task.busy) });
      }
    }
    for (const bot of bots.filter((item) => item.section === ASUKA_SECTION)) {
      for (const task of bot.tasks || []) {
        if (!task.threadId || seen.has(task.threadId)) continue;
        seen.add(task.threadId);
        rows.push({ ...task, kind: "bot", botId: bot.id, owner: bot.name, busy: Boolean(task.busy) });
      }
    }
    return rows.sort(taskSortOrder);
  }, [bots, groups]);

  const [selectedId, setSelectedId] = useState("");
  const [job, setJob] = useState(null);
  const [messages, setMessages] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [followup, setFollowup] = useState("");
  const [archiveFilter, setArchiveFilter] = useState("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [categoryDraft, setCategoryDraft] = useState("unknown");
  const [projectDraft, setProjectDraft] = useState(TASK_INBOX_PROJECT);
  const [taskMenu, setTaskMenu] = useState(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [collapsedProjects, setCollapsedProjects] = useState({});
  const taskEventsRef = useRef(null);
  const deletedTaskIdsRef = useRef(new Set());
  const categories = useMemo(() => [...new Set(tasks.map((task) => task.category || "unknown"))].sort(), [tasks]);
  const projects = useMemo(() => [...new Set(tasks.map(taskProjectKey))].sort((a, b) => taskProjectLabel(a).localeCompare(taskProjectLabel(b), "zh-CN")), [tasks]);
  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const archiveMatch = archiveFilter === "all" || (archiveFilter === "archived" ? task.archived : !task.archived);
    const categoryMatch = categoryFilter === "all" || (task.category || "unknown") === categoryFilter;
    const projectMatch = projectFilter === "all" || taskProjectKey(task) === projectFilter;
    return archiveMatch && categoryMatch && projectMatch;
  }), [tasks, archiveFilter, categoryFilter, projectFilter]);
  const taskGroups = useMemo(() => {
    const grouped = new Map();
    for (const task of visibleTasks) {
      const project = taskProjectKey(task);
      if (!grouped.has(project)) grouped.set(project, []);
      grouped.get(project).push(task);
    }
    return [...grouped.entries()]
      .map(([project, rows]) => ({ project, label: taskProjectLabel(project), rows: rows.sort(taskSortOrder), pinned: rows.some((task) => task.pinned) }))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.label.localeCompare(b.label, "zh-CN"));
  }, [visibleTasks]);
  const selected = visibleTasks.find((task) => `${task.kind}:${task.threadId}` === selectedId) || visibleTasks[0] || null;

  useEffect(() => {
    if (!selected || `${selected.kind}:${selected.threadId}` !== selectedId) setSelectedId(selected ? `${selected.kind}:${selected.threadId}` : "");
  }, [selected, selectedId]);

  useEffect(() => {
    setCategoryDraft(selected?.category || "unknown");
    setProjectDraft(taskProjectKey(selected));
    setRenameOpen(false);
    setTaskMenu(null);
  }, [selected?.threadId]);

  useEffect(() => {
    if (!taskMenu) return undefined;
    function closeMenu(event) {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "pointerdown" && event.target instanceof Element && event.target.closest(".task-context-menu, .task-row-menu-trigger")) return;
      setTaskMenu(null);
    }
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeMenu);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeMenu);
    };
  }, [taskMenu]);

  const loadDetail = useCallback(async () => {
    if (!selected) {
      setJob(null);
      setMessages([]);
      setArtifacts([]);
      return;
    }
    if (deletedTaskIdsRef.current.has(selected.threadId)) {
      setJob(null);
      setMessages([]);
      setArtifacts([]);
      return;
    }
    setLoading(true);
    try {
      const task = await core(`/tasks/${encodeURIComponent(selected.threadId)}?limit=80`);
      setJob(task.job || null);
      setMessages(task.messages || []);
      setArtifacts(task.artifacts || []);
    } catch (error) {
      if (deletedTaskIdsRef.current.has(selected.threadId)) return;
      onNotice(error.message, "bad");
    } finally {
      setLoading(false);
    }
  }, [selected, onNotice]);

  useEffect(() => {
    loadDetail();
    const timer = window.setInterval(loadDetail, 5000);
    return () => window.clearInterval(timer);
  }, [loadDetail]);

  useEffect(() => {
    taskEventsRef.current?.close();
    taskEventsRef.current = null;
    if (!selected || deletedTaskIdsRef.current.has(selected.threadId) || readAdapter() !== "native") return undefined;
    const source = new EventSource(`${CORE}/tasks/${encodeURIComponent(selected.threadId)}/events?adapter=native`);
    taskEventsRef.current = source;
    source.addEventListener("update", (event) => {
      try {
        const update = JSON.parse(event.data);
        if (update.type === "message" && update.message) setMessages((current) => mergeMessage(current, update.message));
        if (update.type === "state") void loadDetail();
      } catch {
        // Polling remains the fallback when an event is malformed.
      }
    });
    return () => source.close();
  }, [selected, loadDetail]);

  async function stopTask() {
    if (!selected) return;
    setBusyAction("stop");
    try {
      await core(`/tasks/${encodeURIComponent(selected.threadId)}/stop`, {
        method: "POST",
        body: JSON.stringify({ kind: selected.kind, ownerId: selected.kind === "room" ? selected.roomId : selected.botId }),
      });
      onNotice("任务已停止", "ok");
      await loadDetail();
      await onRefresh();
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusyAction("");
    }
  }

  async function sendFollowup(text) {
    const value = String(text || "").trim();
    if (!selected || !value) return;
    setBusyAction("send");
    try {
      await core(`/tasks/${encodeURIComponent(selected.threadId)}/messages`, {
        method: "POST",
        body: JSON.stringify({ kind: selected.kind, ownerId: selected.kind === "room" ? selected.roomId : selected.botId, text: value, mode: "goal" }),
      });
      setFollowup("");
      onNotice("已重新提交任务", "ok");
      await loadDetail();
      await onRefresh();
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusyAction("");
    }
  }

  async function retryTask() {
    if (!selected) return;
    setBusyAction("retry");
    try {
      await core(`/tasks/${encodeURIComponent(selected.threadId)}/retry`, {
        method: "POST",
        body: JSON.stringify({ kind: selected.kind, ownerId: selected.kind === "room" ? selected.roomId : selected.botId }),
      });
      onNotice("已重新提交任务", "ok");
      await loadDetail();
      await onRefresh();
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusyAction("");
    }
  }

  async function patchTask(task, patch, notice = "任务已更新") {
    if (!task) return null;
    setBusyAction(`patch:${task.threadId}`);
    try {
      const result = await core(`/tasks/${encodeURIComponent(task.threadId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setTaskMenu(null);
      onNotice(notice, "ok");
      await loadDetail();
      await onRefresh();
      return result.task;
    } catch (error) {
      onNotice(error.message, "bad");
      return null;
    } finally {
      setBusyAction("");
    }
  }

  async function saveTaskMeta(event) {
    event.preventDefault();
    if (!selected) return;
    await patchTask(selected, {
      category: categoryDraft.trim() || "unknown",
      project: projectDraft.trim() || TASK_INBOX_PROJECT,
    }, "任务信息已更新");
  }

  function beginRename(task = selected) {
    if (!task) return;
    setSelectedId(`${task.kind}:${task.threadId}`);
    setRenameDraft(task.title || "");
    setRenameOpen(true);
    setTaskMenu(null);
  }

  async function saveRename(event) {
    event?.preventDefault();
    if (!selected) return;
    const title = renameDraft.trim();
    if (!title) return;
    await patchTask(selected, { title }, "任务已重命名");
    setRenameOpen(false);
  }

  function selectTask(task) {
    setSelectedId(`${task.kind}:${task.threadId}`);
    setTaskMenu(null);
    if (task.unread) {
      void core(`/tasks/${encodeURIComponent(task.threadId)}`, {
        method: "PATCH",
        body: JSON.stringify({ unread: false }),
      }).then(() => onRefresh()).catch(() => {});
    }
  }

  function toggleTaskPin(task = selected) {
    void patchTask(task, { pinned: !task?.pinned }, task?.pinned ? "任务已取消置顶" : "任务已置顶");
  }

  function toggleTaskUnread(task = selected) {
    void patchTask(task, { unread: !task?.unread }, task?.unread ? "任务已标记为已读" : "任务已标记为未读");
  }

  async function setTaskArchived(archived, task = selected) {
    if (!task) return;
    await patchTask(task, { archived }, archived ? "任务已归档" : "任务已恢复");
  }

  async function forkTask(task = selected) {
    if (!task) return;
    setBusyAction(`fork:${task.threadId}`);
    try {
      const result = await core(`/tasks/${encodeURIComponent(task.threadId)}/fork`, { method: "POST" });
      setTaskMenu(null);
      onNotice("已创建任务分支", "ok");
      await onRefresh();
      setSelectedId(`room:${result.threadId}`);
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusyAction("");
    }
  }

  async function deleteTask(task = selected) {
    if (!task) return;
    if (!window.confirm(`永久删除“${task.title || "Untitled task"}”？此操作无法撤销。`)) return;
    setBusyAction(`delete:${task.threadId}`);
    try {
      deletedTaskIdsRef.current.add(task.threadId);
      await core(`/tasks/${encodeURIComponent(task.threadId)}`, { method: "DELETE" });
      setTaskMenu(null);
      setSelectedId("");
      setJob(null);
      setMessages([]);
      onNotice("任务已永久删除", "ok");
      await onRefresh();
    } catch (error) {
      deletedTaskIdsRef.current.delete(task.threadId);
      onNotice(error.message, "bad");
    } finally {
      setBusyAction("");
    }
  }

  async function copyTaskValue(value, label) {
    const text = String(value || "");
    if (!text) {
      onNotice(`没有可复制的${label}`, "warn");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      onNotice(`已复制${label}`, "ok");
      setTaskMenu(null);
    } catch {
      onNotice("剪贴板不可用", "bad");
    }
  }

  function openTaskMenu(event, task, source = "button") {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 304;
    const height = 452;
    const rawX = source === "context" ? event.clientX : rect.right - width;
    const rawY = source === "context" ? event.clientY : rect.bottom + 4;
    setTaskMenu({
      key: `${task.kind}:${task.threadId}`,
      task,
      submenu: "",
      x: Math.max(8, Math.min(rawX, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(rawY, window.innerHeight - height - 8)),
    });
  }

  const taskState = job?.state && job.state !== "idle" ? job.state : selected?.activity || (selected?.busy ? "running" : "idle");
  const working = Boolean(job?.conversation?.busy || selected?.busy || ["running", "queued", "waiting", "needs-input"].includes(taskState));
  const failedTool = [...messages].reverse().find((message) => message.kind === "activity" && message.tool?.ok === false);
  const failure = job?.state === "failed" ? job.reason || failedTool?.tool?.summary || failedTool?.tool?.name : "";
  const visibleMessages = messages.filter((message) => !["runtime", "screen"].includes(message.kind)).slice(-12);
  const menuTask = taskMenu?.task || null;
  const menuTaskWorking = Boolean(menuTask?.busy || ["running", "queued", "waiting", "needs-input"].includes(menuTask?.activity || menuTask?.status));

  useEffect(() => {
    function handleShortcut(event) {
      if (!selected || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.altKey && event.ctrlKey && event.code === "KeyR") {
        event.preventDefault();
        beginRename(selected);
      } else if (event.altKey && event.ctrlKey && event.code === "KeyP") {
        event.preventDefault();
        toggleTaskPin(selected);
      } else if (event.ctrlKey && event.shiftKey && event.code === "KeyU") {
        event.preventDefault();
        toggleTaskUnread(selected);
      } else if (event.ctrlKey && event.shiftKey && event.code === "KeyA" && !working) {
        event.preventDefault();
        void setTaskArchived(!selected.archived, selected);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [selected, working]);

  return (
    <section className="content-pane">
      <div className="page-toolbar"><div><span className="eyebrow">TASK CONTROL</span><h2>任务、失败原因与重试</h2></div><button className="button button--ghost" onClick={loadDetail} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} 刷新</button></div>
      <div className="filter-row task-filter-row">
        <div className="task-filter-tabs">
          {[{ id: "active", label: "活跃" }, { id: "archived", label: "归档" }, { id: "all", label: "全部" }].map((item) => <button key={item.id} className={`task-filter-tab ${archiveFilter === item.id ? "is-active" : ""}`} onClick={() => setArchiveFilter(item.id)}>{item.label}</button>)}
        </div>
        <div className="task-filter-selects">
          <label className="task-category-filter"><Folder size={15} /><select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">全部项目</option>{projects.map((project) => <option key={project} value={project}>{taskProjectLabel(project)}</option>)}</select></label>
          <label className="task-category-filter"><Tag size={15} /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">全部分类</option>{categories.map((category) => <option key={category} value={category}>{TASK_CATEGORY_LABELS[category] || category}</option>)}</select></label>
        </div>
      </div>
      <div className="task-layout">
        <aside className="task-list">
          <div className="section-heading"><span>ASUKA TASKS</span><span>{visibleTasks.length}</span></div>
          {taskGroups.map((group) => {
            const collapsed = Boolean(collapsedProjects[group.project]);
            return (
              <section className="task-project-group" key={group.project}>
                <button type="button" className="task-project-heading" onClick={() => setCollapsedProjects((current) => ({ ...current, [group.project]: !collapsed }))}>
                  <ChevronDown size={13} className={collapsed ? "is-collapsed" : ""} />
                  <Folder size={13} />
                  <strong>{group.label}</strong>
                  <span>{group.rows.length}</span>
                </button>
                {!collapsed && group.rows.map((task) => {
                  const active = selected?.kind === task.kind && selected?.threadId === task.threadId;
                  const state = task.activity || (task.busy ? "running" : "idle");
                  const menuOpen = taskMenu?.key === `${task.kind}:${task.threadId}`;
                  return (
                    <div className={`task-row-shell ${active ? "is-active" : ""}`} key={`${task.kind}:${task.threadId}`}>
                      <button className={`task-row ${active ? "is-active" : ""} ${task.unread ? "is-unread" : ""}`} onClick={() => selectTask(task)} onContextMenu={(event) => openTaskMenu(event, task, "context")}>
                        <StatusDot tone={statusTone(state)} pulse={task.busy} />
                        <span className="task-row__body">
                          <span className="task-row__title-line">
                            {task.pinned && <Pin size={11} />}
                            {task.unread && <span className="task-unread-dot" />}
                            <strong>{task.title || "Untitled task"}</strong>
                          </span>
                          <small>{task.owner} · {TASK_CATEGORY_LABELS[task.category] || task.category || "未分类"} · {friendlyTime(task.updatedAt || task.lastThreadOrderAt)}</small>
                        </span>
                        <span className="task-row__state">{state}</span>
                      </button>
                      <button type="button" className={`task-row-menu-trigger ${menuOpen ? "is-open" : ""}`} aria-label={`${task.title || "任务"} 选项`} aria-haspopup="menu" aria-expanded={menuOpen} onClick={(event) => openTaskMenu(event, task)}><MoreHorizontal size={15} /></button>
                    </div>
                  );
                })}
              </section>
            );
          })}
          {!visibleTasks.length && <EmptyState title={archiveFilter === "archived" ? "没有归档任务" : "没有任务"} body={archiveFilter === "archived" ? "归档后的任务会出现在这里。" : "在 ASUKA Command 中派发第一个任务。"} />}
        </aside>

        <div className="task-detail">
          {selected ? (
            <>
              <header className="task-detail__header">
                <div className="task-detail__title">
                  <span className="eyebrow">{selected.kind === "room" ? "ROOM TASK" : "AGENT TASK"} · {selected.owner} · {taskProjectLabel(taskProjectKey(selected))}</span>
                  {renameOpen ? (
                    <form className="task-rename-form" onSubmit={saveRename}>
                      <input autoFocus value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} aria-label="任务名称" />
                      <button className="button button--ghost button--compact" disabled={!renameDraft.trim() || Boolean(busyAction)}>{busyAction.startsWith("patch:") ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} 保存</button>
                      <button type="button" className="button button--ghost button--compact" onClick={() => setRenameOpen(false)}><X size={14} /> 取消</button>
                    </form>
                  ) : <h3>{selected.title || "Untitled task"}</h3>}
                  <p>{selected.threadId}</p>
                </div>
                <div className="task-detail__actions">
                  {selected.kind === "room" && <button className="button button--ghost button--compact" onClick={() => onOpenRoom(selected.roomId)}><MessageCircle size={14} /> 在房间打开</button>}
                  <button className="button button--ghost button--compact" onClick={retryTask} disabled={Boolean(busyAction) || working}><RefreshCw size={14} /> 重试</button>
                  <button className="button button--ghost button--compact" onClick={stopTask} disabled={Boolean(busyAction) || !working}><Ban size={14} /> 停止</button>
                </div>
              </header>
              <div className="job-strip">
                <span><StatusDot tone={statusTone(taskState)} pulse={working} /> {taskState}</span>
                <span>queued {job?.counts?.queued || 0}</span>
                <span>running {job?.counts?.running || 0}</span>
                <span>failed {job?.counts?.failed || 0}</span>
                <span>needs you {job?.counts?.needsInput || 0}</span>
              </div>
              <form className="task-settings-row" onSubmit={saveTaskMeta}>
                <label><Folder size={15} /><span>Project</span><input className="task-project-input" list="asuka-task-projects" value={projectDraft} onChange={(event) => setProjectDraft(event.target.value)} placeholder="输入或选择项目" /></label>
                <datalist id="asuka-task-projects">{projects.map((project) => <option key={project} value={project}>{taskProjectLabel(project)}</option>)}</datalist>
                <label><Tag size={15} /><span>分类</span><input list="asuka-task-categories" value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} placeholder="选择或输入分类" /></label>
                <datalist id="asuka-task-categories">{TASK_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</datalist>
                <button className="button button--ghost button--compact" disabled={Boolean(busyAction) || (categoryDraft.trim() === (job?.category || selected.category || "unknown") && projectDraft.trim() === taskProjectKey(selected))}>{busyAction.startsWith("patch:") ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} 保存任务信息</button>
                <button type="button" className="button button--ghost button--compact" onClick={() => void setTaskArchived(!(job?.archived || selected.archived), selected)} disabled={Boolean(busyAction) || (!selected.archived && !job?.archived && working)}><Archive size={14} /> {(job?.archived || selected.archived) ? "恢复任务" : "归档任务"}</button>
              </form>
              {failure && <div className="task-failure"><CircleAlert size={16} /><div><strong>失败原因</strong><span>{failure}</span></div></div>}
              <div className="task-messages">
                {visibleMessages.map((message) => <MessageRow key={message.id} message={message} bots={bots} />)}
                {artifacts.length > 0 && <ArtifactShelf artifacts={artifacts} />}
                {!visibleMessages.length && !artifacts.length && !loading && <EmptyState title="没有消息" body="这个任务还没有可显示的对话。" />}
              </div>
              <form className="task-composer" onSubmit={(event) => { event.preventDefault(); void sendFollowup(followup); }}>
                <textarea rows={2} value={followup} onChange={(event) => setFollowup(event.target.value)} placeholder="向这个任务继续补充要求，或重试失败步骤。" />
                <button className="button button--primary" disabled={!followup.trim() || Boolean(busyAction)}>{busyAction === "send" ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />} 继续任务</button>
              </form>
            </>
          ) : <EmptyState icon={Activity} title="选择任务" body="从左侧选择任务查看状态、失败原因和对话。" />}
        </div>
      </div>
      {taskMenu && menuTask && (
        <div className="task-context-menu" style={{ left: taskMenu.x, top: taskMenu.y }} role="menu" aria-label="任务设置" onContextMenu={(event) => event.preventDefault()}>
          <button type="button" role="menuitem" onClick={() => beginRename(menuTask)}>
            <Pencil size={16} /><span>重命名</span><kbd>Alt+Ctrl+R</kbd>
          </button>
          <button type="button" role="menuitem" onClick={() => toggleTaskPin(menuTask)}>
            {menuTask.pinned ? <PinOff size={16} /> : <Pin size={16} />}<span>{menuTask.pinned ? "取消置顶" : "置顶"}</span><kbd>Alt+Ctrl+P</kbd>
          </button>
          <button type="button" role="menuitem" onClick={() => toggleTaskUnread(menuTask)}>
            {menuTask.unread ? <EyeOff size={16} /> : <Eye size={16} />}<span>{menuTask.unread ? "标记为已读" : "标记为未读"}</span><kbd>Ctrl+Shift+U</kbd>
          </button>
          <div className="task-context-menu__separator" />
          <button type="button" role="menuitem" className="has-submenu" onClick={() => setTaskMenu((current) => current ? { ...current, submenu: current.submenu === "fork" ? "" : "fork" } : current)} disabled={menuTaskWorking || Boolean(busyAction)}>
            <GitBranch size={16} /><span>Fork</span><ChevronRight size={15} className={taskMenu.submenu === "fork" ? "is-open" : ""} />
          </button>
          {taskMenu.submenu === "fork" && <div className="task-context-menu__children"><button type="button" role="menuitem" onClick={() => void forkTask(menuTask)} disabled={menuTaskWorking || Boolean(busyAction)}><GitBranch size={14} /><span>创建分支任务</span></button></div>}
          <button type="button" role="menuitem" className="has-submenu" onClick={() => setTaskMenu((current) => current ? { ...current, submenu: current.submenu === "copy" ? "" : "copy" } : current)}>
            <Copy size={16} /><span>复制</span><ChevronRight size={15} className={taskMenu.submenu === "copy" ? "is-open" : ""} />
          </button>
          {taskMenu.submenu === "copy" && (
            <div className="task-context-menu__children">
              <button type="button" role="menuitem" onClick={() => void copyTaskValue(menuTask.title, "任务标题")}><Copy size={14} /><span>复制标题</span></button>
              <button type="button" role="menuitem" onClick={() => void copyTaskValue(menuTask.requestText, "任务要求")}><Copy size={14} /><span>复制任务要求</span></button>
              <button type="button" role="menuitem" onClick={() => void copyTaskValue(menuTask.threadId, "任务 ID")}><Copy size={14} /><span>复制任务 ID</span></button>
            </div>
          )}
          <button type="button" role="menuitem" className="has-submenu" onClick={() => setTaskMenu((current) => current ? { ...current, submenu: current.submenu === "open" ? "" : "open" } : current)}>
            <ExternalLink size={16} /><span>打开于</span><ChevronRight size={15} className={taskMenu.submenu === "open" ? "is-open" : ""} />
          </button>
          {taskMenu.submenu === "open" && (
            <div className="task-context-menu__children">
              <button type="button" role="menuitem" onClick={() => { onOpenRoom(menuTask.roomId || groups.find((group) => group.section === ASUKA_SECTION)?.id); setTaskMenu(null); }}><MessageCircle size={14} /><span>ASUKA Command 房间</span></button>
            </div>
          )}
          <div className="task-context-menu__separator" />
          <button type="button" role="menuitem" onClick={() => void setTaskArchived(!(menuTask.archived), menuTask)} disabled={menuTaskWorking || Boolean(busyAction)}>
            <Archive size={16} /><span>{menuTask.archived ? "恢复任务" : "归档"}</span><kbd>Ctrl+Shift+A</kbd>
          </button>
          <button type="button" role="menuitem" className="is-danger" onClick={() => void deleteTask(menuTask)} disabled={menuTaskWorking || Boolean(busyAction)}>
            <Trash2 size={16} /><span>永久删除</span>
          </button>
        </div>
      )}
    </section>
  );
}

function SkillsView({ bots, instances, onNotice, initialBotId = "" }) {
  const scopedBots = bots.filter((bot) => bot.section === ASUKA_SECTION);
  const candidates = scopedBots.length ? scopedBots : bots;
  const [selectedBotId, setSelectedBotId] = useState(initialBotId || candidates[0]?.id || "");
  const [data, setData] = useState({ skills: [], library: [], staged: [], assignedSkills: [], privateSkills: [], capabilities: {} });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [source, setSource] = useState("");
  const [paste, setPaste] = useState("");
  const [query, setQuery] = useState("");
  const [skillText, setSkillText] = useState(null);
  const selectedBot = candidates.find((bot) => bot.id === selectedBotId) || candidates[0];
  const runtime = instances.find((item) => item.instanceId === selectedBot?.modelSelection?.instanceId);

  useEffect(() => {
    if (!selectedBot || candidates.some((bot) => bot.id === selectedBotId)) return;
    setSelectedBotId(selectedBot.id);
  }, [candidates, selectedBot, selectedBotId]);

  const loadSkills = useCallback(async () => {
    if (!selectedBot?.id) return;
    setLoading(true);
    try {
      const result = await core(`/agents/${encodeURIComponent(selectedBot.id)}/skills`);
      setData({ skills: result.skills || [], library: result.library || [], staged: result.staged || [], assignedSkills: result.assignedSkills || [], privateSkills: result.privateSkills || [], capabilities: result.capabilities || {} });
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setLoading(false);
    }
  }, [selectedBot?.id, onNotice]);

  useEffect(() => {
    setSkillText(null);
    loadSkills();
  }, [loadSkills]);

  const skills = useMemo(() => data.skills.filter((skill) => `${skill.name} ${skill.description || ""} ${(skill.tags || []).join(" ")}`.toLowerCase().includes(query.toLowerCase())), [data.skills, query]);
  const enabledCount = data.skills.filter((skill) => skill.enabled).length;

  async function toggleSkill(skill) {
    if (!skill.editable && !["imported", "native", "own"].includes(skill.origin)) {
      onNotice("这是全局 Skill，请在 OpenMausBot 的 Skills Library 中统一管理。", "warn");
      return;
    }
    setBusy(`toggle:${skill.name}`);
    try {
      await core(`/agents/${encodeURIComponent(selectedBot.id)}/skills/${encodeURIComponent(skill.name)}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !skill.enabled }),
      });
      onNotice(`${skill.name} 已${skill.enabled ? "停用" : "启用"}`, "ok");
      await loadSkills();
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  async function viewSkill(skill) {
    setBusy(`view:${skill.name}`);
    try {
      const result = await core(`/agents/${encodeURIComponent(selectedBot.id)}/skills/${encodeURIComponent(skill.name)}`);
      setSkillText({ name: skill.name, text: result.text || "" });
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  async function importSource(event) {
    event.preventDefault();
    if (!source.trim() || !selectedBot) return;
    setBusy("source");
    try {
      const result = await core(`/agents/${encodeURIComponent(selectedBot.id)}/skills`, {
        method: "POST",
        body: JSON.stringify({ source: source.trim() }),
      });
      setSource("");
      onNotice(`已导入 ${result.installed?.length || 0} 个 Skill，默认停用，检查后再启用。`, "ok");
      await loadSkills();
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  async function importPasted(event) {
    event.preventDefault();
    const name = /^---[\s\S]*?^name:\s*["']?([a-z0-9-]+)["']?\s*$/im.exec(paste)?.[1];
    if (!name) {
      onNotice("SKILL.md 的 frontmatter 缺少合法 name。", "bad");
      return;
    }
    setBusy("paste");
    try {
      await core(`/agents/${encodeURIComponent(selectedBot.id)}/skill-template`, {
        method: "POST",
        body: JSON.stringify({ name, text: paste, source: "asuka-paste", enabled: false }),
      });
      setPaste("");
      onNotice(`${name} 已导入并保持停用`, "ok");
      await loadSkills();
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  async function removeSkill(skill) {
    if (!window.confirm(`删除 ${skill.name}？这会从当前 Agent 移除该 Skill。`)) return;
    setBusy(`delete:${skill.name}`);
    try {
      await core(`/agents/${encodeURIComponent(selectedBot.id)}/skills/${encodeURIComponent(skill.name)}`, { method: "DELETE" });
      if (skillText?.name === skill.name) setSkillText(null);
      onNotice(`${skill.name} 已移除`, "ok");
      await loadSkills();
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  async function quickInvoke(toolName, args = {}) {
    setBusy(`quick:${toolName}`);
    try {
      const response = await core("/tools/call", {
        method: "POST",
        body: JSON.stringify({ serverId: selectedServerId, toolName, args }),
      });
      setSelectedTool(tools.find((tool) => tool.name === toolName) || null);
      setArgsText(JSON.stringify(args, null, 2));
      setResult(response.result);
      await loadCatalog();
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  async function saveServer(event) {
    event.preventDefault();
    setBusy("server");
    try {
      const args = JSON.parse(serverForm.args || "[]");
      const env = JSON.parse(serverForm.env || "{}");
      if (!Array.isArray(args)) throw new Error("args 必须是 JSON 数组");
      if (!env || typeof env !== "object" || Array.isArray(env)) throw new Error("env 必须是 JSON 对象");
      const response = await core("/tools/servers", {
        method: "POST",
        body: JSON.stringify({ name: serverForm.name, command: serverForm.command, args, env }),
      });
      setShowServerForm(false);
      setServerForm({ name: "", command: "", args: "[]", env: "{}" });
      await loadCatalog();
      await connect(response.server.id);
      onNotice("MCP Server 已保存", "ok");
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  async function removeServer(server) {
    if (!window.confirm(`移除 MCP Server ${server.name}？`)) return;
    setBusy(`remove:${server.id}`);
    try {
      await core(`/tools/servers/${encodeURIComponent(server.id)}`, { method: "DELETE" });
      if (selectedServerId === server.id) {
        setSelectedServerId("");
        setTools([]);
        setSelectedTool(null);
        setResult(null);
      }
      await loadCatalog();
      onNotice(`${server.name} 已移除`, "ok");
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="content-pane">
      <div className="page-toolbar">
        <div><span className="eyebrow">SKILL REGISTRY</span><h2>让同一能力跨 Agent 复用</h2></div>
        <button className="button button--ghost" onClick={loadSkills} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} 刷新</button>
      </div>

      <div className="skill-layout">
        <aside className="skill-agent-list">
          <div className="section-heading"><span>AGENT</span><span>{candidates.length}</span></div>
          {candidates.map((bot) => (
            <button key={bot.id} className={`skill-agent ${bot.id === selectedBot?.id ? "is-active" : ""}`} onClick={() => setSelectedBotId(bot.id)}>
              <Avatar name={bot.name} color={bot.color} size="sm" busy={bot.busy} />
              <span><strong>{bot.name}</strong><small>{bot.modelSelection?.instanceId}</small></span>
              <ChevronRight size={14} />
            </button>
          ))}
        </aside>

        <div className="skill-main">
          <div className="skill-summary">
            <div><span className="eyebrow">SELECTED AGENT</span><h3>{selectedBot?.name || "No agent"}</h3><p>{runtime?.displayName || selectedBot?.modelSelection?.instanceId} · {selectedBot?.modelSelection?.model}</p></div>
            <div className="skill-stats"><span><strong>{data.skills.length}</strong> skills</span><span><strong>{enabledCount}</strong> enabled</span><span><strong>{data.staged.length}</strong> staged</span></div>
          </div>

          <div className={`skill-import-grid ${data.capabilities?.sourceImport === false ? "is-single" : ""}`}>
            {data.capabilities?.sourceImport !== false && (
              <form className="skill-import" onSubmit={importSource}>
                <label>从 GitHub / skills.sh 导入</label>
                <div><input value={source} onChange={(event) => setSource(event.target.value)} placeholder="owner/repo 或 Skill URL" /><button className="button button--ghost button--compact" disabled={busy === "source" || !source.trim()}>{busy === "source" ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />} 导入</button></div>
              </form>
            )}
            <form className="skill-import" onSubmit={importPasted}>
              <label>为当前 Agent 新建私有 SKILL.md</label>
              <textarea rows={3} value={paste} onChange={(event) => setPaste(event.target.value)} placeholder="---\nname: my-private-skill\ndescription: ...\n---\n\n完整 Skill 指令" />
              <button className="button button--ghost button--compact" disabled={busy === "paste" || !paste.trim()}>{busy === "paste" ? <LoaderCircle className="spin" size={14} /> : <Plus size={14} />} 创建私有 Skill</button>
            </form>
          </div>

          <div className="filter-row skill-filter-row">
            <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Skill" /></label>
            <span className="skill-policy"><ShieldCheck size={14} /> 导入默认停用，审阅后再启用</span>
          </div>

          <div className="skill-list">
            {skills.map((skill) => (
              <article className={`skill-row ${skillText?.name === skill.name ? "is-active" : ""}`} key={skill.name}>
                <span className={`skill-state ${skill.enabled ? "is-on" : ""}`}>{skill.enabled ? <Check size={14} /> : <Ban size={14} />}</span>
                <button type="button" className="skill-row__body" onClick={() => viewSkill(skill)}>
                  <div><strong>{skill.name}</strong><span>{skill.origin || "skill"}{skill.everyBot ? " · every bot" : ""}</span></div>
                  <p>{shortText(skill.description || "No description", 180)}</p>
                  <div className="skill-tags">{(skill.tags || []).slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}{skill.warnings?.length > 0 && <span className="skill-warning">{skill.warnings.length} warnings</span>}</div>
                </button>
                <div className="skill-row__actions" onClick={(event) => event.stopPropagation()}>
                  <button className="button button--ghost button--compact" onClick={() => viewSkill(skill)} disabled={busy === `view:${skill.name}`}>查看</button>
                  <button className="button button--ghost button--compact" onClick={() => toggleSkill(skill)} disabled={!skill.editable && !["imported", "native", "own"].includes(skill.origin)}>{skill.enabled ? "停用" : "启用"}</button>
                  {skill.editable && <button className="icon-button icon-button--small" onClick={() => removeSkill(skill)} aria-label={`删除 ${skill.name}`} disabled={busy === `delete:${skill.name}`}><Trash2 size={14} /></button>}
                </div>
              </article>
            ))}
            {!skills.length && <EmptyState title="没有 Skill" body="从 GitHub 或 SKILL.md 导入能力，或切换 Agent。" />}
          </div>
        </div>

        {skillText && (
          <aside className="skill-preview">
            <div className="section-heading"><span>SKILL.MD</span><button className="icon-button icon-button--small" onClick={() => setSkillText(null)}><X size={14} /></button></div>
            <h3>{skillText.name}</h3>
            <pre>{skillText.text}</pre>
          </aside>
        )}
      </div>
    </section>
  );
}

function pendingCard(message) {
  const card = message.card;
  return card?.requestId && !card.answered && !card.dismissed && !card.expired && !card.stopped && !card.autoApplied;
}

function behaviorForLabel(label = "") {
  const value = label.toLowerCase();
  if (/(deny|reject|cancel|don't|do not|stop)/.test(value)) return "deny";
  if (/(allow|approve|run|turn on|enable|continue)/.test(value)) return "allow";
  return null;
}

function formattedQuestionAnswer(card, label) {
  const question = card.questionRequest?.questions?.[0];
  if (!question) return label;
  return `The user answered your questions.\n\nQ: ${question.question}\nA: ${label}`;
}

function ApprovalsView({ bots, groups, onNotice, onOpenRoom, onRefreshCore }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [answers, setAnswers] = useState({});

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const asukaBots = bots.filter((bot) => bot.section === ASUKA_SECTION);
      const asukaGroups = groups.filter((room) => room.section === ASUKA_SECTION);
      const threadMap = new Map();
      for (const room of asukaGroups) {
        threadMap.set(room.threadId, { roomId: room.id, roomName: room.name });
        for (const task of room.tasks || []) threadMap.set(task.threadId, { roomId: room.id, roomName: room.name });
      }
      for (const bot of asukaBots) {
        if (bot.threadId) threadMap.set(bot.threadId, { roomId: undefined, roomName: bot.name });
        for (const task of bot.tasks || []) threadMap.set(task.threadId, { roomId: undefined, roomName: bot.name });
      }
      const pages = await Promise.all([...threadMap.entries()].map(async ([threadId, meta]) => {
        try {
          const page = await core(`/tasks/${encodeURIComponent(threadId)}?limit=80`);
          return (page.messages || []).filter(pendingCard).map((message) => ({ message, threadId, ...meta }));
        } catch {
          return [];
        }
      }));
      const seen = new Set();
      setCards(pages.flat().filter((entry) => {
        const id = entry.message.card.requestId;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      }));
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setLoading(false);
    }
  }, [bots, groups, onNotice]);

  useEffect(() => {
    loadApprovals();
    const timer = window.setInterval(loadApprovals, 4500);
    return () => window.clearInterval(timer);
  }, [loadApprovals]);

  async function respond(entry, behavior, message = "", always = false) {
    if (!behavior) {
      onNotice("这个选项需要打开 OpenMausBot 处理。", "warn");
      return;
    }
    const requestId = entry.message.card.requestId;
    setBusy(requestId);
    try {
      await core(`/approvals/${encodeURIComponent(entry.threadId)}/respond`, {
        method: "POST",
        body: JSON.stringify({ requestId, behavior, ...(message ? { message } : {}), ...(always ? { always: true } : {}) }),
      });
      onNotice(behavior === "answer" ? "已提交回答" : behavior === "deny" ? "已拒绝" : "已批准", "ok");
      await loadApprovals();
      await onRefreshCore();
    } catch (error) {
      onNotice(error.message, "bad");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="content-pane">
      <div className="page-toolbar"><div><span className="eyebrow">APPROVAL INBOX</span><h2>原生审批与问题</h2></div><button className="button button--ghost" onClick={loadApprovals} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} 刷新</button></div>
      <div className="approval-banner"><ShieldCheck size={17} /><div><strong>{cards.length} 个请求等待处理</strong><span>Allow、Deny 和文字回答直接写回当前对话。</span></div></div>
      <div className="approval-list">
        {cards.map((entry) => {
          const { message, threadId, roomName } = entry;
          const card = message.card;
          const question = Boolean(card.questionRequest) || card.requestType === "question";
          const questionSet = card.questionRequest?.questions || [];
          const optionLabels = questionSet.length === 1 ? (questionSet[0].options || []).map((option) => option.label) : (card.options || []);
          const oneTap = questionSet.length === 1 && !questionSet[0].multiSelect && optionLabels.length > 0;
          const showManualAnswer = !optionLabels.length || (question && !oneTap);
          return (
            <article className="approval-card" key={card.requestId}>
              <div className="approval-card__top"><span className={`approval-kind ${question ? "is-question" : ""}`}>{question ? "QUESTION" : "APPROVAL"}</span><span>{roomName}</span></div>
              <h3>{card.title || (question ? "Agent needs an answer" : "Agent needs approval")}</h3>
              <p>{card.subtitle || message.text || "Review the request before continuing."}</p>
              <div className="approval-meta"><Avatar name={message.from?.name || "Agent"} color={message.from?.color || "chrome"} size="xs" /><span>{message.from?.name || "Agent"}</span>{card.tool && <><span>·</span><code>{card.tool}</code></>}<span>·</span><span>{friendlyTime(message.at)}</span></div>
              {oneTap && <div className="approval-actions">{optionLabels.map((label) => <button key={label} className="button button--ghost" disabled={busy === card.requestId} onClick={() => respond(entry, "answer", formattedQuestionAnswer(card, label))}>{label}</button>)}</div>}
              {!question && optionLabels.length > 0 && <div className="approval-actions">{optionLabels.map((label) => { const behavior = behaviorForLabel(label); return <button key={label} className={`button ${behavior === "deny" ? "button--ghost" : "button--primary"}`} disabled={!behavior || busy === card.requestId} onClick={() => respond(entry, behavior, "", /always/i.test(label))}>{label}</button>; })}</div>}
              {showManualAnswer && (
                <div className="approval-answer">
                  <textarea rows={2} value={answers[card.requestId] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [card.requestId]: event.target.value }))} placeholder={question ? "输入问题答案" : "补充审批说明"} />
                  <button className="button button--primary" disabled={busy === card.requestId || (question && !(answers[card.requestId] || "").trim())} onClick={() => respond(entry, question ? "answer" : "allow", answers[card.requestId] || "")}>提交</button>
                </div>
              )}
              <footer><button className="text-button" onClick={() => entry.roomId ? onOpenRoom(entry.roomId) : window.open(readOmbUrl(), "_blank", "noopener,noreferrer")}>在房间中查看 <ChevronRight size={13} /></button><span>request {String(card.requestId).slice(0, 8)}</span></footer>
            </article>
          );
        })}
        {!cards.length && !loading && <EmptyState icon={Inbox} title="没有待处理请求" body="Agent 需要授权或提问时会在这里出现。" />}
      </div>
    </section>
  );
}

function RoomsView({ groups, bots, activeRoomId, onOpen, onCreate, creating }) {
  const [archiveFilter, setArchiveFilter] = useState("active");
  const visibleGroups = groups.filter((room) => archiveFilter === "all" || (archiveFilter === "archived" ? room.archived : !room.archived));
  return (
    <section className="content-pane">
      <div className="page-toolbar"><div><span className="eyebrow">ROOMS</span><h2>不同项目，不同 Agent 编队</h2></div><button className="button button--primary" onClick={onCreate} disabled={creating}>{creating ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} 新建 Room</button></div>
      <div className="filter-row">
        <div className="task-filter-tabs">
          {[{ id: "active", label: "活跃" }, { id: "archived", label: "归档" }, { id: "all", label: "全部" }].map((item) => <button key={item.id} className={`task-filter-tab ${archiveFilter === item.id ? "is-active" : ""}`} onClick={() => setArchiveFilter(item.id)}>{item.label}</button>)}
        </div>
        <span className="skill-policy"><Archive size={14} /> 所有任务归档后，Room 自动归档</span>
      </div>
      <div className="room-table">
        <div className="room-table__head"><span>ROOM</span><span>MEMBERS</span><span>STATE</span><span /></div>
        {visibleGroups.map((room) => {
          const members = (room.memberIds || []).map((id) => bots.find((bot) => bot.id === id)).filter(Boolean);
          const working = room.working || room.busyBotId;
          return (
            <button key={room.id} className={`room-table__row ${room.id === activeRoomId ? "is-active" : ""} ${room.archived ? "is-archived" : ""}`} onClick={() => onOpen(room)}>
              <span className="room-table__name"><span className="room-glyph">#</span><span><strong>{room.name}</strong><small>{room.section || "Personal"}</small></span></span>
              <span className="room-table__members"><span className="avatar-stack">{members.slice(0, 4).map((bot) => <Avatar key={bot.id} name={bot.name} color={bot.color} size="xs" />)}</span><small>{members.length} agents</small></span>
              <span className="room-state"><StatusDot tone={room.archived ? "idle" : working ? "warn" : "ok"} pulse={working && !room.archived} />{room.archived ? "archived" : working ? "working" : "idle"}</span>
              <ChevronRight size={16} />
            </button>
          );
        })}
        {!visibleGroups.length && <div className="task-list-empty"><EmptyState icon={Archive} title={archiveFilter === "archived" ? "没有归档 Room" : "没有活跃 Room"} body={archiveFilter === "archived" ? "Room 内所有任务归档后会自动出现在这里。" : "新建一个 Room 或恢复已归档任务。"} /></div>}
      </div>
    </section>
  );
}

function RuntimesView({ instances, config, backend, adapters = [], openOmb }) {
  const featured = ["codex", "claude", "deepseek", "hermes", "openaiCompat", "openrouter"];
  const visibleInstances = instances.filter((item) => featured.includes(item.instanceId) || item.instanceId.startsWith("claude-") || item.instanceId.startsWith("codex-endpoint") || item.snapshot?.state === "available");
  const ordered = [...visibleInstances].sort((a, b) => {
    const ai = featured.indexOf(a.instanceId) === -1 ? 99 : featured.indexOf(a.instanceId);
    const bi = featured.indexOf(b.instanceId) === -1 ? 99 : featured.indexOf(b.instanceId);
    return ai - bi;
  });
  const detected = ordered.filter((item) => item.snapshot?.state === "available").length;
  const authenticated = ordered.filter((item) => item.snapshot?.state === "available" && item.snapshot?.authenticated !== false).length;
  const runtimeAuthenticated = (driverKind) => ordered.some((item) => item.driverKind === driverKind && item.snapshot?.state === "available" && item.snapshot?.authenticated !== false);
  const isNative = backend?.kind === "native";
  const isOmb = backend?.kind === "openmausbot";
  const cliRuntime = config?.executionAdapter || null;
  const nativeProvider = config?.nativeProvider || {};
  const providerState = isNative ? [
    { label: nativeProvider.kind === "anthropic" ? "Anthropic" : "OpenAI-compatible", ready: Boolean(nativeProvider.configured), hostAuth: false, detail: nativeProvider.model || nativeProvider.baseUrl || "Native provider" },
  ] : cliRuntime ? [
    { label: cliRuntime.label, ready: Boolean(cliRuntime.available), hostAuth: true, detail: `${cliRuntime.version || "CLI"} · ${cliRuntime.workspace}` },
  ] : [
    { label: "OpenAI", ready: Boolean(config?.openai?.configured || runtimeAuthenticated("codex")), hostAuth: !config?.openai?.configured && runtimeAuthenticated("codex"), detail: "Responses / Codex provider" },
    { label: "Anthropic", ready: Boolean(config?.anthropic?.configured || runtimeAuthenticated("claudeAgent")), hostAuth: !config?.anthropic?.configured && runtimeAuthenticated("claudeAgent"), detail: "Claude Code / API" },
    { label: "DeepSeek", ready: Boolean(config?.deepseek?.configured || runtimeAuthenticated("deepseekAgent")), hostAuth: !config?.deepseek?.configured && runtimeAuthenticated("deepseekAgent"), detail: "DeepSeek Harness" },
    { label: "OpenAI-compatible", ready: Boolean(config?.openaiCompat?.configured), hostAuth: false, detail: config?.openaiCompat?.url || "Custom endpoint" },
  ];
  return (
    <section className="content-pane">
      <div className="page-toolbar"><div><span className="eyebrow">RUNTIME FABRIC</span><h2>Agent 引擎与 Adapter 状态</h2></div>{isOmb && <button className="button button--ghost" onClick={openOmb}><Settings2 size={16} /> 打开 OpenMausBot 设置</button>}</div>
      <div className="adapter-fabric-strip">
        {adapters.map((item) => <div key={item.id} className={`adapter-chip ${item.id === backend?.kind ? "is-active" : ""}`}><StatusDot tone={item.available ? "ok" : "bad"} /><span><strong>{item.label}</strong><small>{item.available ? item.model || item.version || "ready" : item.reason || "unavailable"}</small></span></div>)}
      </div>
      <div className="runtime-boundary">
        <ShieldCheck size={18} />
        <div><strong>ASUKA 独立持有认证与执行状态</strong><span>{isOmb ? "OpenMausBot 只是当前选择的 Adapter；ASUKA 持有 Adapter 路由与认证状态，其下游 Runtime 凭据由该 Adapter 管理。" : isNative ? "Provider Key 由 ASUKA 加密保存并直接用于模型请求，任务与审批保存在本地 SQLite。" : "ASUKA 持有 Adapter 认证状态并复用本机 CLI 登录；任务与审批保存在独立 SQLite，不会自动回退到 OpenMausBot。"}</span></div>
        <div className="runtime-boundary__chips"><span>ASUKA CORE</span><span>{isOmb ? "ADAPTER CREDENTIALS" : isNative ? "ENCRYPTED KEY" : "HOST CLI"}</span></div>
      </div>
      <div className="runtime-section">
        <div className="section-heading"><span>ACTIVE SURFACES</span><span>{authenticated} authenticated · {detected} detected</span></div>
        <div className="runtime-grid">
          {ordered.map((item) => {
            const detectedHere = item.snapshot?.state === "available";
            const ready = detectedHere && item.snapshot?.authenticated !== false;
            const stateLabel = ready ? "ready" : detectedHere ? "sign in" : "unavailable";
            const authLabel = ready
              ? item.snapshot?.account?.method === "api-key" ? "API key" : item.snapshot?.account?.method ? shortText(item.snapshot.account.method, 20) : "Host credential"
              : "Not connected";
            return (
            <article className={`runtime-card ${ready ? "is-ready" : ""}`} key={item.instanceId}>
              <div className="runtime-card__top"><span className="runtime-icon"><Terminal size={17} /></span><StatusDot tone={ready ? "ok" : detectedHere ? "warn" : "bad"} pulse={ready} /></div>
              <h3>{item.displayName}</h3><p>{item.driverKind}</p>
              <div className="runtime-model">{item.models?.default || "No model selected"}</div>
              <footer><span>{stateLabel}</span><small>{authLabel} · {item.models?.options?.length || 0} models</small></footer>
              {item.snapshot?.reason && <div className="runtime-reason">{shortText(item.snapshot.reason, 170)}</div>}
            </article>
          )})}
        </div>
      </div>
      <div className="runtime-section">
        <div className="section-heading"><span>PROVIDER KEYS</span><ShieldCheck size={15} /></div>
        <div className="provider-list">
          {providerState.map((provider) => <div className="provider-row" key={provider.label}><span className="provider-mark">{initials(provider.label)}</span><div><strong>{provider.label}</strong><span>{provider.detail}</span></div><span className={`provider-state ${provider.ready ? "is-ready" : ""}`}>{provider.ready ? provider.hostAuth ? "host auth" : "configured" : "needs setup"}</span></div>)}
        </div>
      </div>
    </section>
  );
}

function ProviderSetupPanel({ config, instances, onRefresh, onNotice }) {
  const [providerId, setProviderId] = useState("deepseek");
  const spec = PROVIDER_SETUP.find((item) => item.id === providerId) || PROVIDER_SETUP[0];
  const saved = Boolean(spec.native && config?.[spec.configKey]?.configured);
  const addedEndpoints = instances.filter((item) => item.instanceId.startsWith("openai-compat-"));
  const [displayName, setDisplayName] = useState(spec.label);
  const [key, setKey] = useState("");
  const [url, setUrl] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState([]);
  const [refreshTarget, setRefreshTarget] = useState(spec.native ? spec.instanceId : "");
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    setKey("");
    setDisplayName(spec.label);
    setModel("");
    setUrl(spec.native ? config?.[spec.configKey]?.url || "" : spec.defaultUrl || "");
    setModels([]);
    setRefreshTarget(spec.native ? spec.instanceId : "");
    setResult(null);
  }, [providerId, spec.label, spec.defaultUrl, spec.native, spec.configKey, spec.instanceId, config?.[spec.configKey]?.url]);

  async function testKey(payload = {}) {
    const verdict = await core("/providers/test", {
      adapter: "openmausbot",
      method: "POST",
      body: JSON.stringify({
        provider: spec.native ? spec.id : "openaiCompat",
        ...(key.trim() ? { key: key.trim() } : {}),
        ...(url.trim() ? { url: url.trim() } : {}),
        ...payload,
      }),
    });
    setModels(verdict.models || []);
    setResult(verdict.ok
      ? { tone: "ok", text: verdict.check === "authentication" ? "API Key 验证通过" : `API Key 验证通过 · ${verdict.models?.length || 0} 个模型` }
      : { tone: "bad", text: verdict.reason === "rejected" ? "API Key 被服务商拒绝" : verdict.reason === "unreachable" ? "无法连接 API 地址" : "服务商返回了非预期响应" });
    if (verdict.ok && verdict.models?.[0] && !model) setModel(verdict.models[0]);
    return verdict;
  }

  async function testConnection() {
    setBusy("test");
    setResult(null);
    try {
      if (!key.trim() && !saved) throw new Error("请先填写 API Key");
      if (!spec.native && !url.trim()) throw new Error("请填写兼容接口 Base URL");
      await testKey();
    } catch (error) {
      setResult({ tone: "bad", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy("");
    }
  }

  async function saveProvider() {
    setBusy("save");
    setResult(null);
    try {
      if (!key.trim() && !saved) throw new Error("请先填写 API Key");
      if (!spec.native && !url.trim()) throw new Error(`${spec.label} 需要 Base URL`);
      if (key.trim()) {
        const verdict = await testKey();
        if (!verdict.ok) throw new Error("API Key 验证未通过，未保存");
      }
      if (spec.native) {
        const packet = {};
        if (key.trim()) packet.key = key.trim();
        if (url.trim()) packet.url = url.trim().replace(/\/+$/, "");
        if (!Object.keys(packet).length) throw new Error("没有需要保存的变更");
        await core("/providers/config", { adapter: "openmausbot", method: "PUT", body: JSON.stringify({ [spec.configKey]: packet }) });
      } else {
        const selectedModel = model.trim() || models[0] || "";
        if (!selectedModel) throw new Error("请填写或从检测结果选择一个模型 ID");
        const endpointModels = [...new Set([selectedModel, ...models])];
        const normalizedUrl = url.trim().replace(/\/+$/, "");
        const response = await core("/endpoints", {
          adapter: "openmausbot",
          method: "POST",
          body: JSON.stringify({ displayName: displayName.trim() || spec.label, url: normalizedUrl, key: key.trim(), models: endpointModels }),
        });
        const added = (response.instances || []).find((item) => item.instanceId.startsWith("openai-compat-") && item.displayName === (displayName.trim() || spec.label) && (!item.url || item.url === normalizedUrl));
        if (added?.instanceId) setRefreshTarget(added.instanceId);
        setModel(selectedModel);
      }
      setKey("");
      setResult({ tone: "ok", text: spec.native ? "Provider 配置已保存，Runtime 正在刷新" : "兼容 API 实例已添加，可以立即用于 Agent" });
      onNotice(`${spec.label} 配置已保存`, "ok");
      await onRefresh();
    } catch (error) {
      setResult({ tone: "bad", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy("");
    }
  }

  async function refreshModels() {
    setBusy("models");
    try {
      const instanceId = refreshTarget || spec.instanceId;
      if (!instanceId) throw new Error("请先保存兼容 API 实例");
      const response = await core(`/instances/${encodeURIComponent(instanceId)}/refresh-models`, { adapter: "openmausbot", method: "POST", body: "{}" });
      const instance = (response.instances || []).find((item) => item.instanceId === instanceId);
      const next = instance?.models?.options?.map((item) => item.id) || [];
      setModels(next.slice(0, 12));
      if (next[0] && !model) setModel(next[0]);
      setResult({ tone: "ok", text: `模型目录已刷新 · ${next.length} 个模型` });
      await onRefresh();
    } catch (error) {
      setResult({ tone: "bad", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy("");
    }
  }

  async function removeEndpoint(instanceId, name) {
    if (!window.confirm(`移除 ${name}？正在被 Agent 使用的实例不能移除。`)) return;
    setBusy(`remove:${instanceId}`);
    try {
      await core(`/instances/${encodeURIComponent(instanceId)}`, { adapter: "openmausbot", method: "DELETE" });
      if (refreshTarget === instanceId) setRefreshTarget("");
      onNotice(`${name} 已移除`, "ok");
      await onRefresh();
    } catch (error) {
      setResult({ tone: "bad", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy("");
    }
  }

  return (
    <article className="settings-panel settings-panel--wide provider-setup">
      <div className="provider-setup__head">
        <div className="settings-panel__head"><span className="runtime-icon"><Server size={17} /></span><div><span className="eyebrow">MODEL PROVIDERS</span><h3>接入模型 API</h3></div></div>
        <span className={`provider-state ${saved || addedEndpoints.length ? "is-ready" : ""}`}>{spec.native ? saved ? "configured" : "not configured" : `${addedEndpoints.length} endpoints`}</span>
      </div>
      <div className="provider-tabs">
        {PROVIDER_SETUP.map((provider) => <button key={provider.id} type="button" className={provider.id === providerId ? "is-active" : ""} onClick={() => setProviderId(provider.id)}><strong>{provider.label}</strong><span>{provider.detail}</span></button>)}
      </div>
      <div className="provider-form">
        {!spec.native && <label className="field"><span>连接名称</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={spec.label} /></label>}
        <label className="field"><span>API Key</span><input type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} placeholder={saved ? "已保存，留空表示不修改" : "粘贴 API Key"} /></label>
        <label className="field"><span>Base URL</span><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={spec.defaultUrl} /></label>
        {!spec.native && <label className="field"><span>默认模型</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder={spec.modelPlaceholder || "model-id"} /></label>}
        <div className="settings-actions">
          <button type="button" className="button button--ghost" onClick={testConnection} disabled={Boolean(busy)}>{busy === "test" ? <LoaderCircle className="spin" size={15} /> : <Activity size={15} />} 测试 Key</button>
          <button type="button" className="button button--ghost" onClick={refreshModels} disabled={Boolean(busy) || (!spec.native && !refreshTarget)}>{busy === "models" ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} 刷新模型</button>
          <button type="button" className="button button--primary" onClick={saveProvider} disabled={Boolean(busy)}>{busy === "save" ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} 保存 Provider</button>
        </div>
      </div>
      {models.length > 0 && <div className="provider-models">{models.map((item) => <button key={item} type="button" className={item === model ? "is-active" : ""} onClick={() => setModel(item)}>{item}</button>)}</div>}
      {result && <div className={`settings-result settings-result--${result.tone}`}>{result.tone === "ok" ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}<span>{result.text}</span></div>}
      {addedEndpoints.length > 0 && <div className="provider-endpoints"><div className="section-heading"><span>ADDED API ENDPOINTS</span><span>{addedEndpoints.length}</span></div>{addedEndpoints.map((endpoint) => <div className="provider-endpoint" key={endpoint.instanceId}><StatusDot tone={statusTone(endpoint.snapshot?.state)} /><div><strong>{endpoint.displayName}</strong><span>{endpoint.url || endpoint.models?.default || endpoint.instanceId}</span></div><span>{endpoint.snapshot?.state || "unknown"}</span><button className="icon-button icon-button--small" onClick={() => removeEndpoint(endpoint.instanceId, endpoint.displayName)} disabled={busy === `remove:${endpoint.instanceId}`} aria-label={`移除 ${endpoint.displayName}`}><Trash2 size={13} /></button></div>)}</div>}
      <p className="provider-note">密钥只发送给 OpenMausBot。OpenAI、Anthropic、OpenRouter 等使用原生 Provider；DeepSeek、Qwen、GLM、Kimi 和自定义服务会创建独立的 OpenAI-compatible 实例。</p>
    </article>
  );
}

function AdapterSelectionPanel({ adapter, adapters, onSwitchAdapter }) {
  return (
    <article className="settings-panel settings-panel--wide adapter-fabric">
      <div className="settings-panel__head"><span className="runtime-icon"><Cpu size={17} /></span><div><span className="eyebrow">EXECUTION FABRIC</span><h3>Adapter Registry</h3></div></div>
      <div className="adapter-grid">
        {adapters.map((item) => (
          <article className={`adapter-card ${item.id === adapter ? "is-active" : ""} ${item.available ? "is-ready" : ""}`} key={item.id}>
            <div className="adapter-card__top"><span>{item.category === "pure-api" ? "PURE API" : item.category === "coding-agent" ? "LOCAL CODING" : "COMPATIBILITY"} · ASUKA AUTH</span><StatusDot tone={item.id === adapter ? "ok" : item.available ? "ok" : "bad"} /></div>
            <h3>{item.label}</h3>
            <p>{item.recommendedFor}</p>
            <div className="adapter-card__meta"><span>{item.available ? item.model || "ready" : item.reason || "unavailable"}</span>{item.version && <code>{shortText(item.version, 34)}</code>}</div>
            <footer>
              <button className={`button ${item.id === adapter ? "button--ghost" : "button--primary"} button--compact`} disabled={!item.available || item.id === adapter} onClick={() => onSwitchAdapter(item.id)}>{item.id === adapter ? "ACTIVE" : item.available ? "USE ADAPTER" : "UNAVAILABLE"}</button>
              {item.explicitOnly && <small>explicit only</small>}
            </footer>
          </article>
        ))}
      </div>
      <p className="provider-note">认证所有权归 ASUKA Core。任务默认走 Native；只有真实探测可用的 Coding Agent 才能被选中，OpenMausBot 保留为显式兼容 Adapter。</p>
    </article>
  );
}

function NativeProviderPanel({ adapter, onSwitchAdapter, config, onRefresh, onNotice }) {
  const providers = Array.isArray(config?.nativeProviders) && config.nativeProviders.length
    ? config.nativeProviders
    : config?.nativeProvider?.configured ? [config.nativeProvider] : [];
  const [providerId, setProviderId] = useState(providers[0]?.id || "");
  const [creatingProvider, setCreatingProvider] = useState(!providers.length);
  const selectedProvider = creatingProvider ? null : providers.find((item) => item.id === providerId) || providers[0] || null;
  const [label, setLabel] = useState(selectedProvider?.label || "OpenAI-compatible API");
  const [kind, setKind] = useState(selectedProvider?.kind === "anthropic" ? "anthropic" : "openai-compatible");
  const [baseUrl, setBaseUrl] = useState(selectedProvider?.baseUrl || "https://api.openai.com/v1");
  const [model, setModel] = useState(selectedProvider?.model || "");
  const [key, setKey] = useState("");
  const [models, setModels] = useState(selectedProvider?.models || (selectedProvider?.model ? [selectedProvider.model] : []));
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState(null);
  const [configured, setConfigured] = useState(Boolean(selectedProvider?.configured));

  useEffect(() => {
    const next = creatingProvider ? {} : selectedProvider || {};
    setLabel(next.label || "OpenAI-compatible API");
    setKind(next.kind === "anthropic" ? "anthropic" : "openai-compatible");
    setBaseUrl(next.baseUrl || "https://api.openai.com/v1");
    setModel(next.model || "");
    setModels(next.models || (next.model ? [next.model] : []));
    setKey("");
    setConfigured(Boolean(next.configured));
  }, [creatingProvider, selectedProvider?.id, selectedProvider?.kind, selectedProvider?.baseUrl, selectedProvider?.model, selectedProvider?.updatedAt, selectedProvider?.configured]);

  function payload() {
    return {
      ...(selectedProvider?.id ? { id: selectedProvider.id } : {}),
      kind,
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      ...(key.trim() ? { apiKey: key.trim() } : {}),
    };
  }

  async function testConnection() {
    setBusy("test");
    setResult(null);
    try {
      const verdict = await core("/native/provider/test", { method: "POST", body: JSON.stringify(payload()) });
      setModels(verdict.models || models);
      setResult({ tone: "ok", text: `Provider 验证通过 · ${verdict.models?.length || 0} 个模型` });
    } catch (error) {
      setResult({ tone: "bad", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy("");
    }
  }

  async function refreshModels() {
    setBusy("models");
    setResult(null);
    try {
      const response = await core("/native/provider/models", { method: "POST", body: JSON.stringify(payload()) });
      setModels(response.models || []);
      if (!model && response.models?.[0]) setModel(response.models[0]);
      setResult({ tone: "ok", text: `模型目录已刷新 · ${response.models?.length || 0} 个模型` });
    } catch (error) {
      setResult({ tone: "bad", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy("");
    }
  }

  async function saveProvider() {
    setBusy("save");
    setResult(null);
    try {
      if (!model.trim()) throw new Error("请填写模型 ID");
      if (!key.trim() && !configured) throw new Error("首次配置需要填写 API Key");
      const id = selectedProvider?.id || `native-provider-${crypto.randomUUID()}`;
      const response = await core("/native/provider", {
        method: "PUT",
        body: JSON.stringify({
          id,
          label: label.trim() || (kind === "anthropic" ? "Anthropic API" : "OpenAI-compatible API"),
          kind,
          baseUrl: baseUrl.trim(),
          model: model.trim(),
          models,
          ...(key.trim() ? { apiKey: key.trim() } : {}),
        }),
      });
      setProviderId(id);
      setCreatingProvider(false);
      setKey("");
      setConfigured(true);
      setResult({ tone: "ok", text: "Native API 已保存，密钥不会返回前端" });
      onNotice("Native API 已保存", "ok");
      await onRefresh();
      return response;
    } catch (error) {
      setResult({ tone: "bad", text: error instanceof Error ? error.message : String(error) });
      return null;
    } finally {
      setBusy("");
    }
  }

  async function enableNative() {
    const saved = configured ? { provider: selectedProvider } : await saveProvider();
    if (!saved && !configured) return;
    await onSwitchAdapter("native");
    onNotice("已切换到 Native 运行时", "ok");
  }

  return (
    <article className="settings-panel settings-panel--wide native-provider-panel">
      <div className="provider-setup__head">
        <div className="settings-panel__head"><span className="runtime-icon"><Sparkles size={17} /></span><div><span className="eyebrow">NATIVE ADAPTER</span><h3>本地模型执行</h3></div></div>
        <span className={`provider-state ${configured ? "is-ready" : ""}`}>{adapter === "native" ? "active" : configured ? "configured" : "not configured"}</span>
      </div>
      {(providers.length > 0 || creatingProvider) && <div className="provider-models native-provider-list">{providers.map((provider) => <button key={provider.id} type="button" className={!creatingProvider && provider.id === selectedProvider?.id ? "is-active" : ""} onClick={() => { setCreatingProvider(false); setProviderId(provider.id); }}>{provider.label || provider.id}</button>)}<button type="button" className={creatingProvider ? "is-active" : ""} onClick={() => { setCreatingProvider(true); setProviderId(""); }}>+ 新增 API</button></div>}
      <div className="provider-form native-provider-form">
        <label className="field"><span>名称</span><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="例如：DeepSeek API" /></label>
        <label className="field"><span>协议</span><select value={kind} onChange={(event) => {
          const next = event.target.value;
          setKind(next);
          setBaseUrl(next === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com/v1");
        }}><option value="openai-compatible">OpenAI-compatible</option><option value="anthropic">Anthropic</option></select></label>
        <label className="field"><span>Base URL</span><input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label>
        <label className="field"><span>模型 ID</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder={kind === "anthropic" ? "claude-model-id" : "gpt-or-compatible-model"} /></label>
        <label className="field"><span>API Key</span><input type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} placeholder={configured && !creatingProvider ? "已保存，留空表示不修改" : "粘贴 API Key"} /></label>
        <div className="settings-actions">
          <button type="button" className="button button--ghost" onClick={testConnection} disabled={Boolean(busy)}>{busy === "test" ? <LoaderCircle className="spin" size={15} /> : <Activity size={15} />} 测试连接</button>
          <button type="button" className="button button--ghost" onClick={refreshModels} disabled={Boolean(busy)}>{busy === "models" ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} 刷新模型</button>
          <button type="button" className="button button--ghost" onClick={saveProvider} disabled={Boolean(busy)}>{busy === "save" ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} 保存</button>
          <button type="button" className="button button--primary" onClick={enableNative} disabled={Boolean(busy) || adapter === "native"}><Zap size={15} /> {adapter === "native" ? "Native 使用中" : "启用 Native"}</button>
        </div>
      </div>
      {models.length > 0 && <div className="provider-models">{models.slice(0, 20).map((item) => <button key={item} type="button" className={item === model ? "is-active" : ""} onClick={() => setModel(item)}>{item}</button>)}</div>}
      {result && <div className={`settings-result settings-result--${result.tone}`}>{result.tone === "ok" ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}<span>{result.text}</span></div>}
      <p className="provider-note">每个 Bot 可以在卡片上独立选择这里保存的 API。桌面端使用 Windows 凭据加密保存 Key；任务、消息、审批和执行记录不经过 OpenMausBot。</p>
    </article>
  );
}

const SETTINGS_GROUPS = [
  { label: "PERSONAL", items: [
    { id: "general", label: "通用", icon: SlidersHorizontal, keywords: "permission workspace language close" },
    { id: "appearance", label: "外观", icon: Palette, keywords: "appearance theme accent density" },
    { id: "permissions", label: "权限", icon: ShieldCheck, keywords: "permission approval shell network write" },
    { id: "storage", label: "存储", icon: HardDrive, keywords: "storage database cache retention" },
  ] },
  { label: "INTEGRATIONS", items: [
    { id: "models", label: "模型与执行器", icon: Cpu, keywords: "model provider adapter native" },
    { id: "plugins", label: "连接与插件", icon: Plug, keywords: "plugin mcp github omb connector" },
    { id: "computer", label: "Computer Use", icon: Monitor, keywords: "computer desktop windows approval screenshot" },
    { id: "browser", label: "浏览器", icon: Globe2, keywords: "browser web site" },
  ] },
  { label: "CODING", items: [
    { id: "personalization", label: "个性化", icon: UserRound, keywords: "instructions personalization agent" },
    { id: "git", label: "Git", icon: GitBranch, keywords: "git branch worktree workspace" },
    { id: "shortcuts", label: "快捷键", icon: Keyboard, keywords: "keyboard shortcut" },
    { id: "advanced", label: "高级", icon: Database, keywords: "advanced hooks environment worktree diagnostics" },
  ] },
];

function SettingsToggle({ checked, onChange, disabled = false, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      className={`settings-switch ${checked ? "is-on" : ""}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

function SettingsRow({ title, detail, children, action }) {
  return (
    <div className="settings-row">
      <div><strong>{title}</strong>{detail && <p>{detail}</p>}</div>
      <div className="settings-row__control">{action}{children}</div>
    </div>
  );
}

function SettingsPageHeader({ title, description, dirty, saving, onSave }) {
  return (
    <header className="settings-page-header">
      <div><span className="eyebrow">ASUKA PREFERENCES</span><h2>{title}</h2><p>{description}</p></div>
      <button className="button button--primary" onClick={onSave} disabled={saving || !dirty}>
        {saving ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} {dirty ? "保存更改" : "已保存"}
      </button>
    </header>
  );
}

function SettingsCard({ icon: Icon = Settings2, title, description, children, wide = false }) {
  return (
    <section className={`settings-card ${wide ? "settings-card--wide" : ""}`}>
      <header><span><Icon size={17} /></span><div><strong>{title}</strong>{description && <p>{description}</p>}</div></header>
      <div className="settings-card__body">{children}</div>
    </section>
  );
}

function SettingsChoice({ value, options, onChange, disabled = false }) {
  return (
    <div className="settings-choice" role="group">
      {options.map((option) => (
        <button key={option.id} type="button" disabled={disabled} className={value === option.id ? "is-active" : ""} onClick={() => onChange(option.id)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function BotThemePicker({ value, onChange }) {
  return (
    <div className="bot-theme-picker" role="group" aria-label="Bot 主题色">
      {BOT_CREW.map((crew) => (
        <button key={crew.key} type="button" aria-pressed={value === crew.key} className={value === crew.key ? "is-active" : ""} style={{ "--theme-accent": crew.accent }} onClick={() => onChange(crew.key)}>
          <span className="bot-theme-swatch" aria-hidden="true" />
          <span className="bot-theme-copy"><strong>{crew.name}</strong><small>{crew.role}</small></span>
          {value === crew.key && <Check size={14} aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}

function formatBytes(bytes = 0) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function SettingsView({ adapter, onSwitchAdapter, ombUrl, onApply, openOmb, onOpenTools, config, instances, backend, adapters = [], onRefresh, onNotice }) {
  const [draft, setDraft] = useState(ombUrl);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState(null);
  const [discovery, setDiscovery] = useState(null);
  const [settingsPage, setSettingsPage] = useState("general");
  const [settingsQuery, setSettingsQuery] = useState("");
  const [settingsSnapshot, setSettingsSnapshot] = useState(null);
  const [draftSettings, setDraftSettings] = useState(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [toolSnapshot, setToolSnapshot] = useState({ servers: [], approvals: [], audit: [] });
  const selectedAdapter = adapters.find((item) => item.id === backend?.kind) || null;
  const localCoding = ["codex", "claude", "dsh"].includes(backend?.kind);
  const settingsDirty = Boolean(draftSettings && settingsSnapshot?.settings && JSON.stringify(draftSettings) !== JSON.stringify(settingsSnapshot.settings));
  const windowsServer = toolSnapshot.servers.find((server) => server.id === "windows-mcp");
  const filteredSettings = SETTINGS_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(settingsQuery.trim().toLowerCase())),
  })).filter((group) => group.items.length);
  const settingsPageMeta = SETTINGS_GROUPS.flatMap((group) => group.items).find((item) => item.id === settingsPage) || SETTINGS_GROUPS[0].items[0];

  useEffect(() => setDraft(ombUrl), [ombUrl]);

  const loadSettings = useCallback(async () => {
    try {
      const [snapshot, tools] = await Promise.all([core("/settings"), core("/tools").catch(() => ({ servers: [], approvals: [], audit: [] }))]);
      setSettingsSnapshot(snapshot);
      setDraftSettings(snapshot.settings);
      setToolSnapshot(tools);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : String(error), "bad");
    }
  }, [onNotice]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  function updateSetting(path, value) {
    const next = JSON.parse(JSON.stringify(draftSettings || {}));
    const parts = path.split(".");
    let target = next;
    for (const part of parts.slice(0, -1)) target = target[part] ||= {};
    target[parts.at(-1)] = value;
    setDraftSettings(next);
    if (path.startsWith("appearance.")) applyUiSettings(next);
  }

  async function chooseWorkspace() {
    try {
      const pickDirectory = window.asukaDesktop?.pickDirectory;
      const selected = pickDirectory ? await pickDirectory() : "";
      if (selected) updateSetting("general.workspace", selected);
      else if (!pickDirectory) document.getElementById("asuka-default-workspace")?.focus();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : String(error), "bad");
    }
  }

  async function saveSettings() {
    if (!draftSettings) return;
    setSettingsBusy(true);
    try {
      const snapshot = await core("/settings", { method: "PATCH", body: JSON.stringify(draftSettings) });
      setSettingsSnapshot(snapshot);
      setDraftSettings(snapshot.settings);
      saveUiSettings(snapshot.settings);
      onNotice("ASUKA 设置已保存", "ok");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : String(error), "bad");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function discover() {
    setBusy("discover");
    setResult(null);
    try {
      const response = await fetch("/__asuka/discover");
      const found = await response.json();
      setDiscovery(found);
      if (found.found?.url) setDraft(found.found.url);
      setResult({ tone: found.found ? "ok" : "warn", text: found.found ? `发现 OpenMausBot ${found.found.version || ""}` : "自动发现未找到 OpenMausBot" });
    } catch (error) {
      setResult({ tone: "bad", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy("");
    }
  }

  async function testConnection() {
    setBusy("test");
    setResult(null);
    try {
      const health = await probeOmb(draft);
      setResult({ tone: "ok", text: `连接正常 · OpenMausBot ${health.version}` });
    } catch (error) {
      setResult({ tone: "bad", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy("");
    }
  }

  async function launchBackend() {
    setBusy("launch");
    setResult(null);
    try {
      const launched = await launchOmbRuntime();
      setDraft(launched.url);
      await onApply(launched.url);
      setResult({ tone: "ok", text: launched.alreadyRunning ? `OpenMausBot 已在运行 · ${launched.url}` : `OpenMausBot 已启动 · ${launched.url}` });
    } catch (error) {
      setResult({ tone: "bad", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy("");
    }
  }

  async function apply(event) {
    event.preventDefault();
    setBusy("apply");
    setResult(null);
    try {
      const normalized = normalizeOmbUrl(draft);
      const health = await probeOmb(normalized);
      await onApply(normalized);
      setResult({ tone: "ok", text: `已切换到 ${normalized} · OpenMausBot ${health.version}` });
    } catch (error) {
      setResult({ tone: "bad", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy("");
    }
  }

  let settingsBody = null;
  if (draftSettings) {
    const s = draftSettings;
    if (settingsPage === "general") {
      settingsBody = <>
        <SettingsCard icon={ShieldCheck} title="默认权限" description="控制 ASUKA 与本地执行器可使用的工作区权限。">
          <SettingsRow title="工作区文件读写" detail="允许 Coding Adapter 修改当前工作目录中的文件。关闭时 Codex 强制使用 read-only。">
            <SettingsToggle checked={s.permissions.fullAccess || s.permissions.workspaceWrite} disabled={s.permissions.fullAccess} onChange={(value) => updateSetting("permissions.workspaceWrite", value)} label="工作区文件读写" />
          </SettingsRow>
          <SettingsRow title="完全访问" detail="启用后 Native、BrowserSkill 与 Coding Adapter 可使用无逐次审批的文件、网络和命令访问；所有动作仍写入本地审计日志。">
            <SettingsToggle checked={s.permissions.fullAccess} onChange={(value) => updateSetting("permissions.fullAccess", value)} label="完全访问" />
          </SettingsRow>
        </SettingsCard>
        <SettingsCard icon={SlidersHorizontal} title="通用" description="工作目录、语言和关闭行为。">
          <div className="settings-field"><span>默认工作目录</span><div className="settings-path"><input id="asuka-default-workspace" value={s.general.workspace} onChange={(event) => updateSetting("general.workspace", event.target.value)} spellCheck={false} /><button type="button" className="settings-path__button" onClick={chooseWorkspace} aria-label="选择默认工作目录" title="选择目录"><FolderOpen size={15} /></button></div><small>{settingsSnapshot?.runtime?.workspaceExists ? "目录可用，可直接编辑或点击文件夹选择" : "目录不存在，执行器将拒绝运行"}</small></div>
          <SettingsRow title="Bot 回复语言" detail="仅影响 Bot 的输出语言，不改变设置与操作界面语言。"><select value={s.general.language} onChange={(event) => updateSetting("general.language", event.target.value)}><option value="zh-CN">简体中文</option><option value="en-US">English</option></select></SettingsRow>
          <SettingsRow title="关闭窗口前确认" detail="仅在关闭快捷键会结束窗口时提示。">
            <SettingsToggle checked={s.general.closeConfirm} onChange={(value) => updateSetting("general.closeConfirm", value)} label="关闭窗口前确认" />
          </SettingsRow>
        </SettingsCard>
      </>;
    } else if (settingsPage === "appearance") {
      settingsBody = <>
        <SettingsCard icon={Palette} title="Bot 主题色" description="强调色来自九位 Bot 的角色配色，默认使用 NOVA。灰度底色保持中性，只让交互层携带主题色。">
          <BotThemePicker value={s.appearance.accent} onChange={(value) => updateSetting("appearance.accent", value)} />
        </SettingsCard>
        <SettingsCard icon={SlidersHorizontal} title="界面密度" description="影响设置页、列表和工具栏的垂直间距。">
          <SettingsChoice value={s.appearance.density} onChange={(value) => updateSetting("appearance.density", value)} options={[{ id: "comfortable", label: "舒适" }, { id: "compact", label: "紧凑" }]} />
        </SettingsCard>
      </>;
    } else if (settingsPage === "permissions") {
      settingsBody = <>
        <SettingsCard icon={ShieldCheck} title="执行边界" description="这些状态由 ASUKA Core 持有并应用到每次任务。">
          <SettingsRow title="完全访问" detail="关闭逐次审批，并向 Native 暴露受审计的本地命令工具。">
            <SettingsToggle checked={s.permissions.fullAccess} onChange={(value) => updateSetting("permissions.fullAccess", value)} label="完全访问" />
          </SettingsRow>
          <SettingsRow title="工作区写入" detail="Codex Adapter 还要求下方 Git 页面关闭 read-only。">
            <SettingsToggle checked={s.permissions.fullAccess || s.permissions.workspaceWrite} disabled={s.permissions.fullAccess} onChange={(value) => updateSetting("permissions.workspaceWrite", value)} label="工作区写入" />
          </SettingsRow>
          <SettingsRow title="Shell 命令" detail="完全访问开启后，Native 可使用带审计的本地命令工具执行 Skill 脚本。"><span className="settings-badge">{s.permissions.fullAccess ? "完全访问" : "逐次审批"}</span></SettingsRow>
          <SettingsRow title="网络访问" detail="远程 MCP 与模型请求使用 HTTPS；Computer Use 不绕过沙箱。"><span className="settings-badge">{s.permissions.fullAccess ? "完全访问" : "受控"}</span></SettingsRow>
          <SettingsRow title="Computer Use" detail="桌面操作始终需要观察与状态变更审批。">
            <SettingsToggle checked={s.computerUse.enabled} onChange={(value) => updateSetting("computerUse.enabled", value)} label="Computer Use" />
          </SettingsRow>
        </SettingsCard>
      </>;
    } else if (settingsPage === "models") {
      settingsBody = (
        <div className="settings-page-grid settings-page-grid--single">
          <AdapterSelectionPanel adapter={adapter} adapters={adapters} onSwitchAdapter={onSwitchAdapter} />
          <NativeProviderPanel adapter={adapter} onSwitchAdapter={onSwitchAdapter} config={config} onRefresh={onRefresh} onNotice={onNotice} />
          <ProviderSetupPanel config={config} instances={instances} onRefresh={onRefresh} onNotice={onNotice} />
        </div>
      );
    } else if (settingsPage === "plugins") {
      settingsBody = <>
        <SettingsCard icon={Plug} title="MCP 与插件" description="Native Agent 自动使用已启用的本地 stdio 或远程 HTTPS MCP。">
          <SettingsRow title="已配置连接器" detail={`${toolSnapshot.servers.length} 个 Server · ${toolSnapshot.servers.filter((server) => server.connected).length} 个已连接`}>
            <button className="button button--ghost" onClick={onOpenTools}><Wrench size={14} /> 打开 Tools</button>
          </SettingsRow>
          <div className="settings-connector-list">
            {toolSnapshot.servers.map((server) => <div key={server.id}><StatusDot tone={server.error ? "bad" : server.connected ? "ok" : "idle"} /><span><strong>{server.name}</strong><small>{server.transport === "http" ? server.url : server.command}</small></span><span className="settings-badge">{server.transport}</span></div>)}
            {!toolSnapshot.servers.length && <p className="settings-empty-line">还没有 MCP Server。GitHub 可从 Tools 页使用 PAT 预设。</p>}
          </div>
        </SettingsCard>
        <SettingsCard icon={Server} title="OpenMausBot 兼容后端" description="仅在显式选择 OpenMausBot Adapter 时使用。">
          <form className="settings-inline-form" onSubmit={apply}>
            <label className="field"><span>地址</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={DEFAULT_OMB_URL} /></label>
            <div className="settings-actions">
              <button type="button" className="button button--ghost" onClick={testConnection} disabled={Boolean(busy)}><Activity size={14} /> 测试</button>
              <button type="button" className="button button--ghost" onClick={discover} disabled={Boolean(busy)}><Search size={14} /> 自动发现</button>
              <button type="button" className="button button--ghost" onClick={launchBackend} disabled={Boolean(busy)}><Zap size={14} /> 启动</button>
              <button type="submit" className="button button--primary" disabled={Boolean(busy)}>应用</button>
            </div>
          </form>
          {result && <div className={`settings-result settings-result--${result.tone}`}><span>{result.text}</span></div>}
        </SettingsCard>
      </>;
    } else if (settingsPage === "computer") {
      settingsBody = <>
        <SettingsCard icon={Monitor} title="Computer Use" description="Windows 前台桌面控制通过本地 Windows-MCP 执行。">
          <SettingsRow title="启用 Computer Use" detail="关闭后 Native Agent 不再收到 Windows-MCP 工具，手动调用也会被拒绝。">
            <SettingsToggle checked={s.computerUse.enabled} onChange={(value) => updateSetting("computerUse.enabled", value)} label="启用 Computer Use" />
          </SettingsRow>
          <SettingsRow title="动作前必须观察" detail="状态变更动作前必须存在 Snapshot 或 Screenshot 结果。">
            <SettingsToggle checked={s.computerUse.requireObservation} onChange={(value) => updateSetting("computerUse.requireObservation", value)} label="动作前必须观察" />
          </SettingsRow>
          <SettingsRow title="动作后自动刷新" detail="执行 GUI 动作后自动截取新的桌面状态，再允许模型继续。">
            <SettingsToggle checked={s.computerUse.autoRefresh} onChange={(value) => updateSetting("computerUse.autoRefresh", value)} label="动作后自动刷新" />
          </SettingsRow>
          <SettingsRow title="高危动作审批" detail="点击、输入、启动、快捷操作始终按精确参数逐次审批。"><span className="settings-badge">强制</span></SettingsRow>
        </SettingsCard>
        <SettingsCard icon={Activity} title="Windows-MCP 状态" description="本机不需要写入 Codex 的全局 MCP 配置。">
          <div className="settings-status-card"><StatusDot tone={windowsServer?.connected ? "ok" : windowsServer?.error ? "bad" : "idle"} /><div><strong>{windowsServer?.name || "Windows-MCP 未安装"}</strong><span>{windowsServer?.error || windowsServer?.command || "可在 Tools 页添加本地 stdio Server"}</span></div><button className="button button--ghost" onClick={onOpenTools}>管理</button></div>
          <div className="settings-note"><ShieldCheck size={15} /><span>终端、密码管理器、安全设置、ASUKA 自身和 Windows/Meta 键自动化被阻止。</span></div>
        </SettingsCard>
      </>;
    } else if (settingsPage === "browser") {
      settingsBody = <>
        <SettingsCard icon={Globe2} title="浏览器模式" description="ASUKA 当前不打包独立浏览器，网站访问通过 MCP、Playwright 或 Computer Use。">
          <SettingsRow title="连接方式" detail="结构化 MCP 优先；只有缺少结构化接口时才回退到 GUI 自动化。"><span className="settings-badge">Computer Use</span></SettingsRow>
          <SettingsRow title="远程 MCP" detail="非 loopback 地址必须使用 HTTPS，Header 密钥加密保存。"><span className="settings-badge">HTTPS</span></SettingsRow>
          <SettingsRow title="网站内容" detail="页面文本和截图始终按不可信输入处理。"><span className="settings-badge">Untrusted</span></SettingsRow>
        </SettingsCard>
      </>;
    } else if (settingsPage === "personalization") {
      settingsBody = <>
        <SettingsCard icon={UserRound} title="全局个性化" description="这段指令会追加到 Native 与 Local Coding Adapter 的系统约束中。">
          <label className="settings-textarea"><span>长期工作偏好</span><textarea rows={10} value={s.personalization.instructions} onChange={(event) => updateSetting("personalization.instructions", event.target.value)} placeholder="例如：优先用中文回答；不自动提交代码；所有结论必须注明证据来源。" /></label>
        </SettingsCard>
      </>;
    } else if (settingsPage === "storage") {
      settingsBody = <>
        <SettingsCard icon={HardDrive} title="本地存储" description="ASUKA 使用 SQLite 与本地 JSON 配置，不把任务数据上传到第三方。">
          <div className="settings-facts">
            <div><span>数据目录</span><strong>{settingsSnapshot?.runtime?.dataDir || "-"}</strong></div>
            <div><span>设置文件</span><strong>{settingsSnapshot?.runtime?.settingsFile || "-"}</strong></div>
            <div><span>数据库大小</span><strong>{formatBytes(settingsSnapshot?.runtime?.databaseBytes || 0)}</strong></div>
            <div><span>环境</span><strong>{settingsSnapshot?.runtime?.environment || "local"}</strong></div>
          </div>
          <SettingsRow title="历史保留天数" detail="用于后续清理策略；当前不会自动删除活动任务或审计记录。"><input className="settings-number" type="number" min="1" max="3650" value={s.storage.retentionDays} onChange={(event) => updateSetting("storage.retentionDays", Number(event.target.value))} /></SettingsRow>
        </SettingsCard>
      </>;
    } else if (settingsPage === "git") {
      settingsBody = <>
        <SettingsCard icon={GitBranch} title="Git 与工作区" description="Local Coding Adapter 的工作目录和安全边界。">
          <div className="settings-field"><span>工作区目录</span><div className="settings-path"><input value={s.general.workspace} onChange={(event) => updateSetting("general.workspace", event.target.value)} /><FolderOpen size={15} /></div></div>
          <SettingsRow title="Git read-only" detail="启用时 Codex Adapter 使用 read-only sandbox；关闭后还必须允许工作区写入才会生效。">
            <SettingsToggle checked={s.git.readOnly} onChange={(value) => updateSetting("git.readOnly", value)} label="Git read-only" />
          </SettingsRow>
          <SettingsRow title="分支前缀" detail="供支持分支创建的 Adapter 使用。"><input value={s.git.branchPrefix} onChange={(event) => updateSetting("git.branchPrefix", event.target.value)} /></SettingsRow>
          <div className="settings-note"><CircleAlert size={15} /><span>Claude Code 与 DSH 的写权限仍由各自 CLI 配置决定；ASUKA 当前只对 Codex CLI 强制执行 sandbox 选择。</span></div>
        </SettingsCard>
      </>;
    } else if (settingsPage === "shortcuts") {
      settingsBody = <SettingsCard icon={Keyboard} title="快捷键" description="当前版本的固定快捷键。">
        <div className="settings-shortcut-list"><div><span>打开设置</span><kbd>Ctrl</kbd><kbd>,</kbd></div><div><span>查找</span><kbd>Ctrl</kbd><kbd>K</kbd></div><div><span>新建任务</span><kbd>Ctrl</kbd><kbd>N</kbd></div><div><span>关闭弹窗</span><kbd>Esc</kbd></div></div>
      </SettingsCard>;
    } else if (settingsPage === "advanced") {
      settingsBody = <>
        <SettingsCard icon={Database} title="能力状态" description="只展示 ASUKA 当前真实支持的能力。">
          <SettingsRow title="Hooks" detail="尚未实现生命周期命令或 MCP Hook。"><span className="settings-badge settings-badge--muted">未启用</span></SettingsRow>
          <SettingsRow title="Environments" detail="当前为本地 Windows 执行环境；远程 Environment 尚未实现。"><span className="settings-badge">Local</span></SettingsRow>
          <SettingsRow title="Worktrees" detail="Native 任务使用 SQLite；Git worktree 并行任务尚未暴露。"><span className="settings-badge settings-badge--muted">未启用</span></SettingsRow>
          <SettingsRow title="Diagnostics" detail={`Core v${settingsSnapshot?.settings?.version || 1} · ${backend?.kind || "native"} · ${localCoding ? "host CLI" : "local runtime"}`}><span className="settings-badge">Ready</span></SettingsRow>
        </SettingsCard>
      </>;
    }
  }

  if (draftSettings) {
    return (
      <section className="content-pane native-settings-view">
        <div className="settings-console">
          <aside className="settings-console__nav">
            <header><span className="eyebrow">ASUKA SETTINGS</span><h2>设置</h2><p>本地执行、连接与安全边界</p></header>
            <label className="settings-search"><Search size={14} /><input value={settingsQuery} onChange={(event) => setSettingsQuery(event.target.value)} placeholder="搜索设置" /></label>
            <div className="settings-console__nav-scroll">
              {filteredSettings.map((group) => <div className="settings-nav-group" key={group.label}><span>{group.label}</span>{group.items.map((item) => { const Icon = item.icon; return <button key={item.id} className={settingsPage === item.id ? "is-active" : ""} onClick={() => setSettingsPage(item.id)}><Icon size={15} /><span>{item.label}</span></button>; })}</div>)}
            </div>
            <footer><StatusDot tone="ok" /><span>Core {settingsSnapshot?.settings?.version || 1} · local</span></footer>
          </aside>
          <div className="settings-console__main">
            <SettingsPageHeader title={settingsPageMeta.label} description={settingsPage === "models" ? "模型、Provider 与执行适配器。" : settingsPage === "plugins" ? "MCP、远程连接与 OpenMausBot 兼容层。" : "ASUKA 原生设置会加密保存密钥，并只把可执行配置应用到 Core。"} dirty={settingsDirty} saving={settingsBusy} onSave={saveSettings} />
            <div className="settings-console__body">{settingsBody || <SettingsCard icon={settingsPageMeta.icon} title={settingsPageMeta.label} description="该页面正在迁移中。" />}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="content-pane">
      <div className="page-toolbar">
        <div><span className="eyebrow">CLIENT SETTINGS</span><h2>连接与认证边界</h2></div>
        {backend?.kind === "openmausbot" && <button className="button button--ghost" onClick={openOmb}><ArrowUpRight size={16} /> 打开 OpenMausBot</button>}
      </div>
      <div className="settings-grid">
        <form className="settings-panel" onSubmit={apply}>
          <div className="settings-panel__head"><span className="runtime-icon"><Server size={17} /></span><div><span className="eyebrow">BACKEND</span><h3>OpenMausBot 连接</h3></div></div>
          <label className="field"><span>地址</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={DEFAULT_OMB_URL} /></label>
          <p>ASUKA 只连接本机或已授权网络中的 OpenMausBot。默认端口为 8799，也支持 18799 和 28799。</p>
          <div className="settings-actions">
            <button type="button" className="button button--ghost" onClick={testConnection} disabled={Boolean(busy)}>{busy === "test" ? <LoaderCircle className="spin" size={15} /> : <Activity size={15} />} 测试</button>
            <button type="button" className="button button--ghost" onClick={discover} disabled={Boolean(busy)}>{busy === "discover" ? <LoaderCircle className="spin" size={15} /> : <Search size={15} />} 自动发现</button>
            <button type="button" className="button button--ghost" onClick={launchBackend} disabled={Boolean(busy)}>{busy === "launch" ? <LoaderCircle className="spin" size={15} /> : <Zap size={15} />} 启动 OpenMausBot</button>
            <button type="submit" className="button button--primary" disabled={Boolean(busy)}>{busy === "apply" ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} 应用</button>
          </div>
          {result && <div className={`settings-result settings-result--${result.tone}`}>{result.tone === "ok" ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}<span>{result.text}</span></div>}
        </form>

        <article className="settings-panel">
          <div className="settings-panel__head"><span className="runtime-icon"><ShieldCheck size={17} /></span><div><span className="eyebrow">AUTH OWNERSHIP</span><h3>认证与执行</h3></div></div>
          <div className="settings-facts">
            <div><span>Core Adapter</span><strong>{backend?.kind || "native"} {backend?.version || ""}</strong></div>
            <div><span>认证所有者</span><strong>ASUKA Core</strong></div>
            <div><span>凭据来源</span><strong>{backend?.kind === "native" ? "ASUKA encrypted provider store" : localCoding ? "ASUKA registry + host CLI" : "ASUKA adapter config"}</strong></div>
            <div><span>执行边界</span><strong>{localCoding ? `${selectedAdapter?.label || backend?.kind} + SQLite` : backend?.kind === "native" ? "ASUKA Native + SQLite" : "OpenMausBot Runtime"}</strong></div>
            <div><span>工作目录</span><strong>{selectedAdapter?.workspace || "/"}</strong></div>
            <div><span>审批写回</span><strong>{backend?.kind === "openmausbot" ? "OpenMausBot REST" : "ASUKA 原生审批"}</strong></div>
            <div><span>外部 MCP</span><strong>{backend?.kind === "openmausbot" ? "通过 OpenMausBot MCP" : "按所选 CLI 自身配置"}</strong></div>
          </div>
        </article>

        <AdapterSelectionPanel adapter={adapter} adapters={adapters} onSwitchAdapter={onSwitchAdapter} />

        <NativeProviderPanel adapter={adapter} onSwitchAdapter={onSwitchAdapter} config={config} onRefresh={onRefresh} onNotice={onNotice} />

        <ProviderSetupPanel config={config} instances={instances} onRefresh={onRefresh} onNotice={onNotice} />

        <article className="settings-panel settings-panel--wide">
          <div className="settings-panel__head"><span className="runtime-icon"><Terminal size={17} /></span><div><span className="eyebrow">DISCOVERY</span><h3>端口探测</h3></div></div>
          <div className="discovery-list">
            {(discovery?.candidates || [
              { url: DEFAULT_OMB_URL, reachable: null, version: null },
              { url: "http://127.0.0.1:18799", reachable: null, version: null },
              { url: "http://127.0.0.1:28799", reachable: null, version: null },
            ]).map((candidate) => (
              <div key={candidate.url}><StatusDot tone={candidate.reachable === true ? "ok" : candidate.reachable === false ? "idle" : "idle"} /><code>{candidate.url}</code><span>{candidate.reachable === true ? `ready · ${candidate.version || ""}` : candidate.reachable === false ? "not found" : "not checked"}</span></div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
