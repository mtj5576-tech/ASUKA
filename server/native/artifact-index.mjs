import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { basename, extname } from "node:path";

const QUOTED_PATH = /["']([A-Za-z]:\\[^"'\r\n]+)["']/g;
const WINDOWS_PATH = /([A-Za-z]:\\[^\r\n<>|?*"']+?\.[A-Za-z0-9]{1,12})(?=$|[\s)\]},.;，。；])/g;
const POSIX_PATH = /(\/(?:[^\s"'`<>]+\/)*[^\s"'`<>]+\.[A-Za-z0-9]{1,12})(?=$|[\s"'`)\]},.;，。；])/g;
const EXCLUDED = /(?:^|[\\/])(?:node_modules|\.git|\.cache|\.runtime-temp|app\.asar)(?:[\\/]|$)/i;

function kindFor(extension) {
  if ([".doc", ".docx", ".rtf", ".odt"].includes(extension)) return "document";
  if ([".xls", ".xlsx", ".csv", ".tsv", ".ods"].includes(extension)) return "spreadsheet";
  if ([".ppt", ".pptx", ".odp"].includes(extension)) return "presentation";
  if (extension === ".pdf") return "pdf";
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp", ".tif", ".tiff"].includes(extension)) return "image";
  if ([".zip", ".7z", ".rar", ".tar", ".gz"].includes(extension)) return "archive";
  if ([".md", ".txt", ".json", ".xml", ".yaml", ".yml", ".html"].includes(extension)) return "text";
  if ([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".ps1", ".sh", ".sql"].includes(extension)) return "code";
  return "file";
}

function requestedExtensions(text) {
  const value = String(text || "").toLowerCase();
  const extensions = new Set();
  if (/(?:word|docx|word\s*文档|文档)/i.test(value)) [".docx", ".doc", ".rtf", ".odt", ".pdf"].forEach((item) => extensions.add(item));
  if (/(?:pdf)/i.test(value)) [".pdf"].forEach((item) => extensions.add(item));
  if (/(?:excel|xlsx|csv|spreadsheet|表格|工作表)/i.test(value)) [".xlsx", ".xls", ".csv", ".tsv", ".pdf"].forEach((item) => extensions.add(item));
  if (/(?:powerpoint|pptx|slide|slides|演示文稿|幻灯片)/i.test(value)) [".pptx", ".ppt", ".pdf"].forEach((item) => extensions.add(item));
  if (/(?:image|png|jpg|jpeg|图片|图像)/i.test(value)) [".png", ".jpg", ".jpeg", ".webp", ".svg"].forEach((item) => extensions.add(item));
  if (/(?:zip|7z|archive|压缩包)/i.test(value)) [".zip", ".7z", ".rar", ".tar", ".gz"].forEach((item) => extensions.add(item));
  return extensions;
}

function extractPaths(text) {
  const paths = [];
  const value = String(text || "").slice(0, 120_000);
  const collect = (pattern) => {
    for (const match of value.matchAll(pattern)) {
      const candidate = String(match[1] || "").replace(/[.,;，。；]+$/, "");
      if (candidate && !candidate.includes("://")) paths.push(candidate);
    }
  };
  collect(QUOTED_PATH);
  collect(WINDOWS_PATH);
  if (process.platform !== "win32") collect(POSIX_PATH);
  return paths;
}

function addCandidate(found, path, priority) {
  if (!path || EXCLUDED.test(path) || !existsSync(path)) return;
  try {
    const stat = statSync(path);
    if (!stat.isFile()) return;
    const extension = extname(path).toLowerCase() || "";
    const id = createHash("sha256").update(path.toLowerCase()).digest("hex").slice(0, 20);
    const current = found.get(path.toLowerCase());
    if (current) {
      current.priority = Math.max(current.priority, priority);
      return;
    }
    found.set(path.toLowerCase(), {
      id,
      name: basename(path),
      path,
      extension,
      kind: kindFor(extension),
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      priority,
    });
  } catch {
    // A mentioned path is not an available artifact when it cannot be inspected.
  }
}

export function collectTaskArtifacts({ task, messages = [], modelMessages = [], limit = 24 } = {}) {
  if (!task?.id) return [];
  const found = new Map();
  const taskStarted = Date.parse(task.createdAt || "") - 5_000;
  const finalPaths = new Set();
  const finalAssistantMessages = modelMessages.filter((message) => message.role === "assistant" && typeof message.content === "string" && message.content.trim()).slice(-3);
  for (const message of finalAssistantMessages) {
    for (const path of extractPaths(message.content)) finalPaths.add(path.toLowerCase());
  }
  const finalPublicMessages = messages.filter((message) => message.role === "assistant" && String(message.text || "").trim()).slice(-3);
  for (const message of finalPublicMessages) {
    for (const path of extractPaths(message.text)) finalPaths.add(path.toLowerCase());
  }
  modelMessages.forEach((message, index) => {
    if (message.role === "assistant" && typeof message.content === "string") {
      const priority = index >= Math.max(0, modelMessages.length - 12) ? 5 : 2;
      for (const path of extractPaths(message.content)) addCandidate(found, path, finalPaths.has(path.toLowerCase()) ? 5 : priority);
    }
    if (Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) {
        for (const path of extractPaths(call.arguments)) addCandidate(found, path, 1);
      }
    }
    if (message.role === "tool") {
      for (const path of extractPaths(message.content)) addCandidate(found, path, finalPaths.has(path.toLowerCase()) ? 5 : 1);
    }
  });
  for (const message of messages) {
    if (message.role === "assistant") {
      for (const path of extractPaths(message.text)) addCandidate(found, path, finalPaths.has(path.toLowerCase()) ? 5 : 2);
    }
  }
  const all = [...found.values()]
    .filter((artifact) => !Number.isFinite(taskStarted) || Date.parse(artifact.modifiedAt) >= taskStarted)
    .sort((a, b) => b.priority - a.priority || Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt));
  const deliverables = all.filter((artifact) => artifact.priority >= 5);
  const requested = requestedExtensions(task.requestText);
  const preferred = deliverables.filter((artifact) => requested.has(artifact.extension));
  return (preferred.length ? preferred : deliverables.length ? deliverables : all)
    .slice(0, Math.max(1, Math.min(Number(limit) || 24, 100)))
    .map(({ priority, ...artifact }) => artifact);
}
