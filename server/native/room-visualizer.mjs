import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const LOCAL_ARCHIFY_CLI = fileURLToPath(new URL("../../vendor/archify/bin/archify.mjs", import.meta.url));

function text(value, limit = 80) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function roomBot(agents, role, fallback) {
  return agents.find((agent) => String(agent.id).includes(role)) || agents.find((agent) => String(agent.role).includes(role)) || { name: fallback };
}

function visualBotName(agent, fallback = "Agent") {
  const id = String(agent?.id || "").toLowerCase();
  if (id.includes("planner")) return "NOVA";
  if (id.includes("builder")) return "BYTE";
  if (id.includes("reviewer")) return "GUARD";
  return text(agent?.name || fallback, 32);
}

function visualRole(agent) {
  const id = String(agent?.id || agent?.role || "").toLowerCase();
  if (id.includes("planner") || id.includes("decision")) return "决策";
  if (id.includes("builder") || id.includes("executor")) return "执行";
  if (id.includes("reviewer") || id.includes("guard")) return "复核";
  return text(agent?.title || agent?.description || "成员", 12);
}

function visualStatus(value) {
  const labels = {
    running: "进行中",
    queued: "排队中",
    waiting: "等待中",
    completed: "已完成",
    failed: "失败",
    idle: "空闲",
    "needs-input": "待输入",
  };
  return labels[String(value || "").toLowerCase()] || text(value || "待处理", 18);
}

function visualProject(value) {
  const name = text(value || "", 18);
  return !name || name.toLowerCase() === "inbox" ? "未分组" : name;
}

const ASUKA_ARCHIFY_STYLE = `<style id="asuka-archify-theme">
html[data-theme="light"],
html[data-preset][data-theme="light"] {
  color-scheme: light;
  --bg: #ffffff;
  --grid: #efefec;
  --canvas-dot: #deddd8;
  --text: #25231f;
  --text-muted: #6f6b65;
  --text-dim: #9a9690;
  --text-faint: #827d76;
  --panel: #ffffff;
  --panel-border: #dedcd7;
  --lane-fill: #f8f7f4;
  --lane-stroke: #dad8d2;
  --arrow: #8c8780;
  --arrow-emphasis: #55524d;
  --mask: #ffffff;
  --frontend-fill: #f1f2f2; --frontend-stroke: #7a7f82;
  --backend-fill: #f0f1f0; --backend-stroke: #737a74;
  --database-fill: #f2f1f3; --database-stroke: #7e7884;
  --cloud-fill: #f3f2ee; --cloud-stroke: #7d796c;
  --security-fill: #f3eff0; --security-stroke: #806e72;
  --messagebus-fill: #f3f0ec; --messagebus-stroke: #7d7062;
  --external-fill: #eff0f1; --external-stroke: #73787d;
  --toolbar-bg: rgba(255, 255, 255, .94);
  --toolbar-border: #dedcd7;
  --toolbar-text: #4f4b45;
  --toolbar-hover: #f5f4f1;
  --toolbar-menu-bg: #ffffff;
}
html[data-preset="signal-flow"][data-theme="light"] body { background-image: none; }
html[data-preset="signal-flow"][data-theme="light"] .diagram-container {
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(25, 25, 22, .04);
}
</style>`;

function injectEmbedTheme(html) {
  if (!html.includes("</head>") || html.includes('id="asuka-archify-theme"')) return html;
  return html.replace("</head>", `${ASUKA_ARCHIFY_STYLE}\n</head>`);
}

function architectureInput(snapshot, roomId) {
  const room = (snapshot.groups || []).find((group) => group.id === roomId);
  if (!room) throw new Error("Room not found for architecture visualization");
  const tasks = room.tasks || [];
  const agents = snapshot.bots || [];
  const planner = roomBot(agents, "planner", "Planner");
  const executor = roomBot(agents, "builder", "Executor");
  const reviewer = roomBot(agents, "reviewer", "Reviewer");
  const latest = tasks[0];
  const running = tasks.filter((task) => ["running", "queued", "waiting", "needs-input"].includes(task.activity || task.status)).length;
  const completed = tasks.filter((task) => (task.activity || task.status) === "completed").length;
  const failed = tasks.filter((task) => (task.activity || task.status) === "failed").length;
  const projects = [...new Set(tasks.map((task) => task.project || "inbox"))];
  const roles = latest?.decision?.plan?.roles || [];

  return {
    schema_version: 1,
    diagram_type: "architecture",
    meta: {
      title: `${text(room.name, 32)} · 团队架构`,
      subtitle: "团队、任务、工具与审批关系",
      locale: "zh-CN",
      visual_preset: "signal-flow",
      quality_profile: "standard",
      output: "room-architecture.html",
      views: [
        { id: "execution", label: "执行路径", focus: ["decision", "executor", "reviewer", "delivery"], note: "从指令到复核、交付" },
        { id: "knowledge", label: "知识与边界", focus: ["tasks", "storage", "skills", "tools", "approvals"], note: "任务、工具、技能和审批" },
      ],
    },
    layout: { mode: "grid", origin: [50, 72], cols: 5, gapX: 42, gapY: 44, cellW: 154, cellH: 76 },
    components: [
      { id: "room-entry", type: "external", label: "指挥室", sublabel: "任务与指令", icon: "person", row: 1, col: 0 },
      { id: "decision", type: "security", label: visualBotName(planner, "决策"), sublabel: `${roles.length || 3} 个角色`, icon: "decision", tag: "决策", row: 1, col: 1 },
      { id: "executor", type: "backend", label: visualBotName(executor, "执行"), sublabel: latest ? visualStatus(latest.activity || latest.status) : "待命", icon: "active", tag: "执行", row: 1, col: 2 },
      { id: "reviewer", type: "security", label: visualBotName(reviewer, "复核"), sublabel: latest ? "独立复核" : "待命", icon: "security", tag: "质检", row: 1, col: 3 },
      { id: "delivery", type: "frontend", label: "交付结果", sublabel: "报告与文件", icon: "frontend", row: 1, col: 4 },
      { id: "skills", type: "cloud", label: "技能库", sublabel: "16 个全局技能", icon: "cloud", row: 0, col: 2 },
      { id: "tasks", type: "messagebus", label: "任务", sublabel: `${tasks.length} 个 · ${running} 进行中`, icon: "messagebus", row: 2, col: 1 },
      { id: "tools", type: "cloud", label: "工具", sublabel: "读取 · 操作 · 审批", icon: "briefcase", row: 2, col: 2 },
      { id: "approvals", type: "security", label: "审批", sublabel: "敏感操作", icon: "security", row: 2, col: 3 },
      { id: "storage", type: "database", label: "本地数据", sublabel: "任务 · 消息 · 设置", icon: "database", row: 3, col: 1 },
    ],
    boundaries: [
      { kind: "security-group", label: "本地核心", wraps: ["decision", "executor", "reviewer", "delivery", "skills", "tasks", "tools", "approvals", "storage"], pad: 18 },
    ],
    connections: [
      { id: "brief-to-decision", from: "room-entry", to: "decision", label: "下发", variant: "emphasis" },
      { id: "decision-to-executor", from: "decision", to: "executor", label: "分工" },
      { id: "executor-to-reviewer", from: "executor", to: "reviewer", label: "提交" },
      { id: "reviewer-to-delivery", from: "reviewer", to: "delivery", label: "通过", variant: "emphasis" },
      { id: "decision-to-tasks", from: "decision", to: "tasks", label: "跟踪", labelDy: 24 },
      { id: "tasks-to-storage", from: "tasks", to: "storage", label: "保存", labelDy: 24 },
      { id: "executor-to-skills", from: "executor", to: "skills", label: "调用技能", labelDy: -24 },
      { id: "executor-to-tools", from: "executor", to: "tools", label: "调用工具", labelDy: 24 },
      { id: "executor-to-approvals", from: "executor", to: "approvals", label: "需要审批", labelDy: 24, variant: "security" },
    ],
    cards: [
      {
        dot: running ? "amber" : failed ? "rose" : "emerald",
        title: "房间状态",
        items: [`${tasks.length} 个任务 · ${running} 进行中`, `${completed} 已完成 · ${failed} 失败`, `${projects.length} 个项目 · ${agents.length} 个成员`],
      },
      {
        dot: "cyan",
        title: "团队",
        items: agents.slice(0, 5).map((agent) => `${visualBotName(agent)} · ${visualRole(agent)}`),
      },
      {
        dot: latest ? "violet" : "slate",
        title: "最近任务",
        items: latest ? [text(latest.title || "未命名任务", 42), `${visualProject(latest.project)} · ${visualStatus(latest.activity || latest.status)}`] : ["暂无任务", "在指挥室输入目标开始"],
      },
    ],
  };
}

function archifyCliCandidates() {
  return [
    process.env.ASUKA_ARCHIFY_CLI,
    process.resourcesPath && join(process.resourcesPath, "app.asar.unpacked", "vendor", "archify", "bin", "archify.mjs"),
    LOCAL_ARCHIFY_CLI,
  ].filter(Boolean).map((value) => resolve(value));
}

export class RoomVisualizer {
  constructor({ dataDir, cliPath } = {}) {
    this.dataDir = dataDir;
    this.cliPath = cliPath || archifyCliCandidates().find((candidate) => existsSync(candidate));
    this.pending = new Map();
  }

  input(snapshot, roomId) {
    return architectureInput(snapshot, roomId);
  }

  async render(snapshot, roomId, { force = false } = {}) {
    if (!this.cliPath) throw new Error("Bundled Archify runtime is missing");
    const input = this.input(snapshot, roomId);
    const json = `${JSON.stringify(input, null, 2)}\n`;
    const key = createHash("sha256").update(json).digest("hex").slice(0, 20);
    const cacheDir = join(this.dataDir, "archify-cache");
    const outputPath = join(cacheDir, `room-${key}.html`);
    if (!force && existsSync(outputPath)) return injectEmbedTheme(await readFile(outputPath, "utf8"));
    if (this.pending.has(key)) return this.pending.get(key);
    const job = (async () => {
      await mkdir(cacheDir, { recursive: true });
      const inputPath = join(cacheDir, `room-${key}.json`);
      await writeFile(inputPath, json, "utf8");
      const env = { ...process.env, ARCHIFY_UPDATE_CHECK_DISABLED: "1" };
      if (process.versions.electron) env.ELECTRON_RUN_AS_NODE = "1";
      try {
        await execFileAsync(process.execPath, [this.cliPath, "render", "architecture", inputPath, outputPath, "--quality", "standard"], {
          cwd: dirname(outputPath),
          env,
          windowsHide: true,
          timeout: 30_000,
          maxBuffer: 2 * 1024 * 1024,
        });
      } catch (error) {
        const detail = text(error?.stderr || error?.message || "Archify render failed", 800);
        throw new Error(`Archify render failed: ${detail}`);
      }
      return injectEmbedTheme(await readFile(outputPath, "utf8"));
    })().finally(() => this.pending.delete(key));
    this.pending.set(key, job);
    return job;
  }
}

export { architectureInput, injectEmbedTheme };
