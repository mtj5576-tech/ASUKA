import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { normalizeBotLanguage } from "./language.mjs";

const DEFAULT_SETTINGS = Object.freeze({
  version: 1,
  general: {
    workspace: "",
    language: "zh-CN",
    closeConfirm: true,
  },
  appearance: {
    accent: "nova",
    density: "comfortable",
  },
  permissions: {
    fullAccess: false,
    workspaceWrite: false,
    shellCommands: "approval",
    networkAccess: "approval",
  },
  personalization: {
    instructions: "",
  },
  computerUse: {
    enabled: true,
    requireObservation: true,
    autoRefresh: true,
  },
  git: {
    readOnly: true,
    branchPrefix: "codex/",
  },
  storage: {
    retentionDays: 30,
  },
  browser: {
    mode: "computer-use",
  },
});

const BOT_ACCENTS = ["nova", "byte", "lens", "grid", "bloom", "relay", "guard", "sprout", "luna"];
const LEGACY_ACCENTS = { ember: "nova", teal: "grid", graphite: "luna" };

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return base;
  const next = clone(base);
  for (const [key, value] of Object.entries(patch)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) continue;
    if (value && typeof value === "object" && !Array.isArray(value) && next[key] && typeof next[key] === "object" && !Array.isArray(next[key])) {
      next[key] = merge(next[key], value);
    } else {
      next[key] = value;
    }
  }
  return next;
}

function boolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function cleanText(value, limit = 20_000) {
  return String(value ?? "").trim().slice(0, limit);
}

function databaseStats(paths) {
  let bytes = 0;
  const files = [];
  for (const path of paths) {
    try {
      const item = statSync(path);
      if (item.isFile()) {
        bytes += item.size;
        files.push({ name: path.split(/[\\/]/).pop(), bytes: item.size });
      }
    } catch {
      // Missing databases are reported as zero.
    }
  }
  return { bytes, files };
}

export class AsukaSettingsStore {
  constructor({ dataDir, defaultWorkspace = process.cwd(), databasePaths = [] }) {
    this.dataDir = resolve(dataDir);
    this.filePath = join(this.dataDir, "asuka-settings.json");
    this.defaultWorkspace = resolve(defaultWorkspace);
    this.databasePaths = databasePaths.filter(Boolean).map((path) => resolve(path));
    mkdirSync(this.dataDir, { recursive: true });
    this.settings = this.load();
  }

  defaults() {
    const value = clone(DEFAULT_SETTINGS);
    value.general.workspace = this.defaultWorkspace;
    return value;
  }

  load() {
    const defaults = this.defaults();
    if (!existsSync(this.filePath)) return defaults;
    try {
      return this.sanitize(merge(defaults, JSON.parse(readFileSync(this.filePath, "utf8"))));
    } catch {
      return defaults;
    }
  }

  sanitize(input) {
    const next = merge(this.defaults(), input);
    const workspace = cleanText(next.general.workspace, 2_000);
    next.general.workspace = workspace && isAbsolute(workspace) ? resolve(workspace) : this.defaultWorkspace;
    next.general.language = normalizeBotLanguage(next.general.language);
    next.general.closeConfirm = boolean(next.general.closeConfirm, true);
    const requestedAccent = LEGACY_ACCENTS[next.appearance.accent] || next.appearance.accent;
    next.appearance.accent = BOT_ACCENTS.includes(requestedAccent) ? requestedAccent : "nova";
    next.appearance.density = next.appearance.density === "compact" ? "compact" : "comfortable";
    next.permissions.fullAccess = boolean(next.permissions.fullAccess, false);
    next.permissions.workspaceWrite = next.permissions.fullAccess || boolean(next.permissions.workspaceWrite, false);
    next.permissions.shellCommands = next.permissions.fullAccess ? "full" : "approval";
    next.permissions.networkAccess = next.permissions.fullAccess ? "full" : "approval";
    next.personalization.instructions = cleanText(next.personalization.instructions);
    next.computerUse.enabled = boolean(next.computerUse.enabled, true);
    next.computerUse.requireObservation = boolean(next.computerUse.requireObservation, true);
    next.computerUse.autoRefresh = boolean(next.computerUse.autoRefresh, true);
    next.git.readOnly = next.permissions.fullAccess ? false : boolean(next.git.readOnly, true);
    next.git.branchPrefix = cleanText(next.git.branchPrefix, 80) || "codex/";
    next.storage.retentionDays = Math.max(1, Math.min(Number(next.storage.retentionDays) || 30, 3_650));
    next.browser.mode = "computer-use";
    return next;
  }

  get() {
    return clone(this.settings);
  }

  update(patch) {
    this.settings = this.sanitize(merge(this.settings, patch));
    writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), "utf8");
    return this.get();
  }

  snapshot() {
    const databases = databaseStats(this.databasePaths);
    return {
      settings: this.get(),
      runtime: {
        dataDir: this.dataDir,
        databaseBytes: databases.bytes,
        databases: databases.files,
        settingsFile: this.filePath,
        workspaceExists: existsSync(this.settings.general.workspace),
        environment: process.platform === "win32" ? "Windows local" : `${process.platform} local`,
      },
    };
  }
}
