import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, extname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SESSION_ID = /^[A-Za-z0-9_-]{1,160}$/;

function findExecutable(command) {
  const requested = String(command || "").trim();
  if (!requested) return "";
  if (existsSync(requested)) return requested;
  const names = process.platform === "win32" && !extname(requested)
    ? [requested, `${requested}.exe`, `${requested}.cmd`, `${requested}.bat`]
    : [requested];
  for (const directory of String(process.env.PATH || "").split(delimiter).filter(Boolean)) {
    for (const name of names) {
      const candidate = join(directory, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return requested;
}

function result(text) {
  return { content: [{ type: "text", text: String(text || "").trim().slice(0, 200_000) }] };
}

function validateSession(value) {
  const session = String(value || "").trim();
  if (!SESSION_ID.test(session)) throw new Error("BrowserSkill session id is invalid");
  return session;
}

export class BrowserSkillTools {
  constructor(options = {}) {
    this.command = findExecutable(options.command || process.env.BSK_COMMAND || join(homedir(), "AppData", "Local", "Programs", "bsk", "bin", "bsk.exe"));
    this.prefixArgs = Array.isArray(options.prefixArgs) ? options.prefixArgs.map(String) : [];
    this.timeoutMs = Math.max(5_000, Math.min(Number(options.timeoutMs) || 90_000, 180_000));
    this.contexts = new Map();
    this.observations = new Map();
    this.scopes = new Map();
  }

  tools() {
    return [
      {
        name: "browser_skill_status",
        modelName: "browser_skill_status",
        description: "BrowserSkill / bsk: inspect daemon status and connected browser instances. Safe read-only discovery.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        risk: "safe",
        builtin: true,
        serverId: "browser-skill",
        serverName: "BrowserSkill CLI",
      },
      {
        name: "browser_skill_session",
        modelName: "browser_skill_session",
        description: "BrowserSkill / bsk: start or stop a browser task session. Use start first, retain session_id, and stop the same session on success or failure.",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["start", "stop"] },
            session_id: { type: "string", description: "Required when action=stop." },
            browser: { type: "string", description: "Optional bsk browser id or label when action=start." },
          },
          required: ["action"],
          additionalProperties: false,
        },
        risk: "confirm",
        builtin: true,
        serverId: "browser-skill",
        serverName: "BrowserSkill CLI",
      },
      {
        name: "browser_skill_open",
        modelName: "browser_skill_open",
        description: "BrowserSkill / bsk: start or reuse one task-scoped background Agent Window, navigate to an http(s) URL, and return a settled page observation. Prefer this for read-only research. Reuse the scope instead of starting another session.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
            browser: { type: "string", description: "Optional bsk browser id or label." },
            max_tokens: { type: "number", minimum: 1000, maximum: 20000 },
          },
          required: ["url"],
          additionalProperties: false,
        },
        risk: "safe",
        builtin: true,
        serverId: "browser-skill",
        serverName: "BrowserSkill CLI",
      },
      {
        name: "browser_skill_navigate",
        modelName: "browser_skill_navigate",
        description: "BrowserSkill / bsk: navigate a task session to one http(s) URL before syncing page evidence.",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string" },
            url: { type: "string" },
          },
          required: ["session_id", "url"],
          additionalProperties: false,
        },
        risk: "confirm",
        builtin: true,
        serverId: "browser-skill",
        serverName: "BrowserSkill CLI",
      },
      {
        name: "browser_skill_sync",
        modelName: "browser_skill_sync",
        description: "BrowserSkill / bsk: synchronize the current page and return actionable text, refs and context_id. Read-only page evidence.",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string" },
            tab_id: { type: "string" },
          },
          required: ["session_id"],
          additionalProperties: false,
        },
        risk: "safe",
        builtin: true,
        serverId: "browser-skill",
        serverName: "BrowserSkill CLI",
      },
    ];
  }

  riskFor(name, args = {}) {
    if (name === "browser_skill_session" && args.action === "start") return "confirm";
    return "safe";
  }

  async run(args) {
    if (!this.command) throw new Error("BrowserSkill CLI is not configured. Set BSK_COMMAND.");
    try {
      const { stdout, stderr } = await execFileAsync(this.command, [...this.prefixArgs, ...args], {
        windowsHide: true,
        timeout: this.timeoutMs,
        maxBuffer: 8 * 1024 * 1024,
        env: process.env,
      });
      return [stdout, stderr].filter((value) => String(value || "").trim()).join("\n").trim();
    } catch (error) {
      const stdout = String(error?.stdout || "").trim();
      const stderr = String(error?.stderr || "").trim();
      const detail = [stderr, stdout, error?.message].filter(Boolean).join("\n").slice(0, 20_000);
      throw new Error(`BrowserSkill command failed: ${detail}`);
    }
  }

  async syncSession(session, tabId = "") {
    const command = ["cooperate", "sync", "--session", session];
    const selectedTab = String(tabId || "").trim();
    if (selectedTab) command.push("--tab-id", selectedTab);
    const output = await this.run(command);
    const context = /"context_id"\s*:\s*"([^"]+)"/.exec(output)?.[1] || "";
    const observation = /"observation_id"\s*:\s*"([^"]+)"/.exec(output)?.[1] || "";
    if (context) this.contexts.set(session, context);
    if (observation) this.observations.set(session, observation);
    return { output, context, observation };
  }

  async call(name, args = {}, context = {}) {
    if (name === "browser_skill_status") {
      const status = await this.run(["status", "--json"]);
      const browsers = await this.run(["browsers", "--json"]);
      return result(`STATUS\n${status}\n\nBROWSERS\n${browsers}`);
    }
    if (name === "browser_skill_session") {
      if (args.action === "start") {
        const browser = String(args.browser || "").trim();
        const command = ["session", "start", "--json"];
        if (browser) command.push("--browser", browser);
        return result(await this.run(command));
      }
      if (args.action === "stop") {
        const session = validateSession(args.session_id);
        const output = await this.run(["session", "stop", session]);
        this.contexts.delete(session);
        this.observations.delete(session);
        for (const [scope, meta] of this.scopes.entries()) if (meta.session === session) this.scopes.delete(scope);
        return result(output);
      }
      throw new Error("BrowserSkill session action must be start or stop");
    }
    if (name === "browser_skill_open") {
      const parsed = new URL(String(args.url || "").trim());
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("BrowserSkill URL must use http or https");
      const scope = String(context.taskId || "").trim().replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 120);
      if (!scope) throw new Error("BrowserSkill task scope is required");
      const scopeName = `asuka-${scope}`;
      const previous = this.scopes.get(scopeName) || null;
      const commandFor = (meta = null) => {
        const command = ["open", parsed.toString(), "--scope", scopeName, "--no-focus", "--json", "--max-tokens", String(Math.max(1_000, Math.min(Number(args.max_tokens) || 8_000, 20_000)))];
        if (meta?.session) command.push("--session", meta.session);
        if (meta?.context) command.push("--context", meta.context);
        if (meta?.observation) command.push("--observation", meta.observation);
        return command;
      };
      const browser = String(args.browser || "").trim();
      const execute = async (meta = null) => {
        const command = commandFor(meta);
        if (browser) command.push("--browser", browser);
        const output = await this.run(command);
        const session = /"session_id"\s*:\s*"([A-Za-z0-9_-]+)"/.exec(output)?.[1] || meta?.session || "";
        const context = /"context_id"\s*:\s*"([^"]+)"/.exec(output)?.[1] || "";
        const observation = /"observation_id"\s*:\s*"([^"]+)"/.exec(output)?.[1] || "";
        if (session && context) this.contexts.set(session, context);
        if (session && observation) this.observations.set(session, observation);
        if (session) this.scopes.set(scopeName, { session, context, observation });
        return output;
      };
      try {
        return result(await execute(previous));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!previous?.session || !/(observation|context|shared page control|cooperation_sync_required)/i.test(message)) throw error;
        await this.run(["cooperate", "wait", "--session", previous.session]).catch(() => "");
        const refreshed = await this.syncSession(previous.session);
        const output = await execute({ session: previous.session, context: refreshed.context, observation: refreshed.observation });
        return result(output);
      }
    }
    if (name === "browser_skill_navigate") {
      const session = validateSession(args.session_id);
      const parsed = new URL(String(args.url || "").trim());
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("BrowserSkill URL must use http or https");
      const navigate = (context = "") => {
        const command = ["navigate", parsed.toString(), "--session", session];
        if (context) command.push("--context", context);
        const observation = this.observations.get(session) || "";
        if (observation) command.push("--observation", observation);
        return this.run(command);
      };
      try {
        const output = await navigate(this.contexts.get(session) || "");
        this.contexts.delete(session);
        this.observations.delete(session);
        return result(output);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/(context|shared page control|observation changed|cooperation_sync_required)/i.test(message)) throw error;
        await this.run(["cooperate", "wait", "--session", session]).catch(() => "");
        const refreshed = await this.syncSession(session);
        if (!refreshed.context) throw error;
        const output = await navigate(refreshed.context);
        this.contexts.delete(session);
        this.observations.delete(session);
        return result(output);
      }
    }
    if (name === "browser_skill_sync") {
      const session = validateSession(args.session_id);
      const refreshed = await this.syncSession(session, args.tab_id);
      return result(refreshed.output);
    }
    throw new Error("Unknown BrowserSkill tool");
  }
}
