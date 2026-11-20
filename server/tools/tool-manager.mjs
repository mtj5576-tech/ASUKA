import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { McpStdioClient } from "./mcp-client.mjs";
import { McpHttpClient } from "./mcp-http-client.mjs";
import { ToolStore } from "./tool-store.mjs";
import { createFileSecretStore } from "../native/secret-store.mjs";
import { BrowserSkillTools } from "./browser-skill-tools.mjs";
import { LocalCommandTools } from "./local-command-tools.mjs";
import { SkillRuntimeTools } from "./skill-runtime-tools.mjs";

const SAFE_TOOL_PATTERNS = /(status|screenshot|snapshot|display|inventory|list|read|search|info|wait|query|get_window|list_apps)/i;
const ALWAYS_CONFIRM = /(powershell|shell|command|file.?system|registry|process|app|launch|click|type|scroll|move|shortcut|multiselect|multiedit|clipboard|notification|scrape|download|upload|delete|write|copy)/i;
const TERMINAL_TARGETS = /(cmd\.exe|powershell\.exe|pwsh\.exe|windows terminal|wt\.exe|terminal|command prompt)/i;
const SECURITY_TARGETS = /(windows security|defender|password manager|1password|bitwarden|keepass|credential manager|lockapp)/i;
const SELF_TARGETS = /(asuka(?:\.exe)?|chatgpt(?:\.exe)?)/i;

function normalize(value) {
  return String(value || "").replace(/[^a-z0-9]+/gi, " ").trim();
}

function summarizeResult(result) {
  const content = Array.isArray(result?.content) ? result.content : [];
  return content.map((item) => item?.type === "text" ? item.text : item?.type === "image" ? `[image ${item.mimeType || "image"}]` : `[${item?.type || "content"}]`).join("\n").slice(0, 4_000);
}

function toolSlug(value, limit) {
  return String(value || "tool").toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, limit) || "tool";
}

function modelToolName(serverId, toolName) {
  const suffix = createHash("sha256").update(`${serverId}\0${toolName}`).digest("hex").slice(0, 8);
  return `mcp_${toolSlug(serverId, 16)}_${toolSlug(toolName, 28)}_${suffix}`;
}

export class ToolManager {
  constructor(options = {}) {
    this.dataDir = options.dataDir || join(homedir(), ".asuka");
    this.settingsStore = options.settingsStore || null;
    this.windowsMcpCommand = options.windowsMcpCommand || process.env.WINDOWS_MCP_COMMAND || join(homedir(), ".local", "bin", "windows-mcp.exe");
    const secretStore = options.secretStore || createFileSecretStore(this.dataDir);
    this.store = new ToolStore(options.databasePath || join(this.dataDir, "asuka-tools.sqlite"), secretStore, {
      windowsMcpCommand: existsSync(this.windowsMcpCommand) ? this.windowsMcpCommand : "",
    });
    this.clientFactory = options.clientFactory || ((server) => server.transport === "http"
      ? new McpHttpClient({ name: server.name, url: server.url, headers: server.headers })
      : new McpStdioClient({ name: server.name, command: server.command, args: server.args, env: server.env, cwd: this.dataDir }));
    this.browserSkill = options.browserSkill || new BrowserSkillTools(options.browserSkillOptions);
    this.localCommands = options.localCommands || new LocalCommandTools({
      defaultCwd: this.settingsStore?.get().general.workspace || this.dataDir,
    });
    this.skillRuntime = options.skillRuntime || new SkillRuntimeTools({
      workspace: this.settingsStore?.get().general.workspace || this.dataDir,
    });
    this.clients = new Map();
    this.errors = new Map();
    this.modelTools = new Map();
  }

  close() {
    for (const client of this.clients.values()) client.close();
    this.clients.clear();
    this.store.close();
  }

  serverView(server) {
    if (!server) return null;
    return {
      id: server.id,
      name: server.name,
      transport: server.transport,
      command: server.command,
      url: server.url,
      args: server.args,
      envKeys: Object.keys(server.env || {}),
      headerKeys: Object.keys(server.headers || {}),
      enabled: server.enabled,
      connected: this.clients.has(server.id),
      error: this.errors.get(server.id) || "",
    };
  }

  listServers() {
    const servers = [
      ...this.store.listServers().map((server) => this.serverView(server)),
      {
        id: "browser-skill",
        name: "BrowserSkill CLI",
        transport: "builtin",
        command: this.browserSkill.command,
        url: "",
        args: [],
        envKeys: [],
        headerKeys: [],
        enabled: true,
        connected: Boolean(this.browserSkill.command),
        error: this.browserSkill.command ? "" : "bsk CLI not found",
      },
    ];
    if (this.hasFullAccess()) {
      servers.push({
        id: "local-command",
        name: "ASUKA Local Command",
        transport: "builtin",
        command: process.platform === "win32" ? "powershell.exe" : (process.env.SHELL || "/bin/sh"),
        url: "",
        args: [],
        envKeys: [],
        headerKeys: [],
        enabled: true,
        connected: true,
        error: "",
      });
    }
    if (this.skillRuntime.library) {
      servers.push({
        id: "skill-runtime",
        name: "ASUKA Skill Runtime",
        transport: "builtin",
        command: "",
        url: "",
        args: [],
        envKeys: [],
        headerKeys: [],
        enabled: true,
        connected: true,
        error: "",
      });
    }
    return servers;
  }

  setSkillLibrary(library) {
    this.skillRuntime.attach(library);
    this.modelTools.clear();
  }

  hasFullAccess() {
    return this.settingsStore?.get().permissions.fullAccess === true;
  }

  approvalRequired(tool, args = {}) {
    if (this.hasFullAccess()) return false;
    return this.riskForTool(tool, args) !== "safe";
  }

  saveServer(input) {
    const transport = input.transport === "http" ? "http" : "stdio";
    let url = "";
    if (transport === "http") {
      const parsed = new URL(String(input.url || ""));
      if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Remote MCP URL must use http or https");
      if (parsed.protocol === "http:" && !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) throw new Error("Remote MCP HTTP must use HTTPS outside loopback");
      if (parsed.username || parsed.password) throw new Error("Remote MCP URL cannot contain credentials");
      url = parsed.toString();
    }
    if (input.headers && (typeof input.headers !== "object" || Array.isArray(input.headers))) throw new Error("MCP headers must be an object");
    const saved = this.store.saveServer({ ...input, transport, url });
    this.dropClient(saved.id);
    return this.serverView(saved);
  }

  removeServer(id) {
    this.dropClient(id);
    this.store.removeServer(id);
    return { ok: true };
  }

  dropClient(id) {
    const client = this.clients.get(id);
    if (client) client.close();
    this.clients.delete(id);
    this.errors.delete(id);
  }

  clientFor(id) {
    const server = this.store.getServer(id);
    if (!server) throw new Error("MCP server not found");
    if (!server.enabled) throw new Error("MCP server is disabled");
    let client = this.clients.get(id);
    if (!client) {
      client = this.clientFactory(server);
      this.clients.set(id, client);
    }
    return client;
  }

  async listTools(id) {
    const client = this.clientFor(id);
    try {
      const tools = await client.listTools();
      this.errors.delete(id);
      return tools.map((tool) => ({
        ...tool,
        serverId: id,
        modelName: modelToolName(id, tool.name),
        risk: this.classify(tool.name, tool.annotations, {}),
      }));
    } catch (error) {
      this.errors.set(id, error instanceof Error ? error.message : String(error));
      this.clients.get(id)?.close();
      this.clients.delete(id);
      throw error;
    }
  }

  classify(name, annotations = {}, args = {}) {
    const label = normalize(name);
    if (annotations?.destructiveHint === true) return "high";
    if (ALWAYS_CONFIRM.test(label)) return "confirm";
    if (annotations?.readOnlyHint === true && SAFE_TOOL_PATTERNS.test(label)) return "safe";
    return SAFE_TOOL_PATTERNS.test(label) ? "safe" : "confirm";
  }

  riskForTool(tool, args = {}) {
    if (tool?.serverId === "browser-skill") return this.browserSkill.riskFor(tool.name, args);
    if (tool?.serverId === "local-command") return this.localCommands.riskFor(tool.name, args);
    if (tool?.serverId === "skill-runtime") return this.skillRuntime.riskFor(tool.name, args);
    return this.classify(tool?.name, tool?.annotations, args);
  }

  assertAllowed(toolName, args) {
    const serialized = JSON.stringify(args || {});
    if (/shortcut/i.test(toolName) && /(^|[^a-z])(win|windows|meta|super|cmd|command)([^a-z]|$)/i.test(serialized)) {
      throw new Error("Windows/Meta key shortcuts are blocked by ASUKA Computer Use policy");
    }
    const explicitTarget = /^app$/i.test(toolName)
      ? JSON.stringify({ name: args?.name || "", executable: args?.executable || "", cwd: args?.cwd || "", args: args?.args || null })
      : /^(click|type)$/i.test(toolName) && args?.label
        ? String(args.label)
        : "";
    if (TERMINAL_TARGETS.test(explicitTarget)) {
      throw new Error("Terminal applications cannot be automated through GUI tools");
    }
    if (SECURITY_TARGETS.test(explicitTarget)) {
      throw new Error("Security and password-manager applications are blocked through GUI automation");
    }
    if (SELF_TARGETS.test(explicitTarget)) {
      throw new Error("ASUKA and ChatGPT desktop windows cannot be automated through Computer Use");
    }
  }

  async createApproval({ id, taskId = null, serverId, toolName, args = {}, metadata = null, ttlMs }) {
    if (this.hasFullAccess()) return null;
    if (serverId === "browser-skill") {
      const tool = this.browserSkill.tools().find((item) => item.name === toolName);
      if (!tool) throw new Error("BrowserSkill tool not found");
      const risk = this.riskForTool(tool, args);
      if (risk === "safe") return null;
      return this.store.createApproval({ id, taskId, serverId, toolName, args, risk, metadata, ttlMs });
    }
    if (serverId === "windows-mcp" && this.settingsStore?.get().computerUse.enabled === false) throw new Error("Computer Use is disabled in ASUKA settings");
    if (serverId === "skill-runtime") {
      const tool = this.skillRuntime.tools().find((item) => item.name === toolName);
      if (!tool) throw new Error("Skill Runtime tool not found");
      const risk = this.skillRuntime.riskFor(tool.name, args);
      if (risk === "safe") return null;
      return this.store.createApproval({ id, taskId, serverId, toolName, args, risk, metadata, ttlMs });
    }
    const tools = await this.listTools(serverId);
    const tool = tools.find((item) => item.name === toolName);
    if (!tool) throw new Error("MCP tool not found");
    const risk = this.classify(tool.name, tool.annotations, args);
    this.assertAllowed(tool.name, args);
    if (risk === "safe") return null;
    return this.store.createApproval({ id, taskId, serverId, toolName, args, risk, metadata, ttlMs });
  }

  getApproval(id) { return this.store.getApproval(id); }

  decideApproval(id, approved) {
    const approval = this.store.decideApproval(id, approved);
    if (!approved) {
      this.store.audit({
        taskId: approval.taskId,
        serverId: approval.serverId,
        toolName: approval.toolName,
        risk: approval.risk,
        args: approval.args,
        status: "denied",
        error: "Denied by user",
      });
    }
    return approval;
  }

  listApprovals(limit = 30) { return this.store.listApprovals(limit); }
  listAudit(limit = 100) { return this.store.listAudit(limit); }

  async listModelTools() {
    const tools = [];
    const errors = [];
    this.modelTools.clear();
    if (this.hasFullAccess()) {
      for (const tool of this.localCommands.tools()) {
        tools.push({
          type: "function",
          name: tool.modelName,
          description: tool.description,
          parameters: tool.inputSchema,
        });
        this.modelTools.set(tool.modelName, tool);
      }
    }
    if (this.skillRuntime.library) {
      for (const tool of this.skillRuntime.tools()) {
        tools.push({
          type: "function",
          name: tool.modelName,
          description: tool.description,
          parameters: tool.inputSchema,
        });
        this.modelTools.set(tool.modelName, tool);
      }
    }
    for (const tool of this.browserSkill.tools()) {
      tools.push({
        type: "function",
        name: tool.modelName,
        description: tool.description,
        parameters: tool.inputSchema,
      });
      this.modelTools.set(tool.modelName, tool);
    }
    for (const server of this.store.listServers().filter((item) => item.enabled)) {
      if (server.id === "windows-mcp" && this.settingsStore?.get().computerUse.enabled === false) continue;
      try {
        const discovered = await this.listTools(server.id);
        for (const tool of discovered) {
          const descriptor = {
            type: "function",
            name: tool.modelName,
            description: `${server.name} / ${tool.name}: ${tool.description || "MCP tool"}`.slice(0, 4_000),
            parameters: tool.inputSchema?.type === "object" ? tool.inputSchema : { type: "object", properties: {} },
          };
          tools.push(descriptor);
          this.modelTools.set(tool.modelName, { ...tool, serverName: server.name });
        }
      } catch (error) {
        errors.push({ serverId: server.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { tools, errors };
  }

  async resolveModelTool(name) {
    if (!this.modelTools.has(name)) await this.listModelTools();
    return this.modelTools.get(name) || null;
  }

  async callModel({ taskId = null, modelName, args = {}, approvalId }) {
    const tool = await this.resolveModelTool(modelName);
    if (!tool) throw new Error("MCP model tool not found");
    return this.call({ taskId, serverId: tool.serverId, toolName: tool.name, args, approvalId });
  }

  async listResources(serverId) {
    return this.clientFor(serverId).listResources();
  }

  async readResource(serverId, uri) {
    return this.clientFor(serverId).readResource(uri);
  }

  async listPrompts(serverId) {
    return this.clientFor(serverId).listPrompts();
  }

  async getPrompt(serverId, name, args = {}) {
    return this.clientFor(serverId).getPrompt(name, args);
  }

  isComputerUseServer(serverId) {
    return serverId === "windows-mcp";
  }

  async call({ taskId = null, serverId, toolName, args = {}, approvalId }) {
    const started = Date.now();
    let risk = "confirm";
    try {
      if (serverId === "browser-skill") {
        const tool = this.browserSkill.tools().find((item) => item.name === toolName);
        if (!tool) throw new Error("BrowserSkill tool not found");
        risk = this.riskForTool(tool, args);
        if (this.approvalRequired(tool, args)) {
          if (!approvalId) throw new Error("This BrowserSkill tool requires one-time user approval");
          this.store.consumeApproval(approvalId, serverId, toolName, args);
        }
        const output = await this.browserSkill.call(toolName, args);
        const durationMs = Date.now() - started;
        this.store.audit({ taskId, serverId, toolName, risk, args, status: "ok", resultSummary: summarizeResult(output), durationMs });
        return { result: output, risk, durationMs };
      }
      if (serverId === "local-command") {
        if (!this.hasFullAccess()) throw new Error("Local command execution requires Full Access");
        const tool = this.localCommands.tools().find((item) => item.name === toolName);
        if (!tool) throw new Error("Local command tool not found");
        risk = this.localCommands.riskFor(toolName, args);
        const output = await this.localCommands.call(toolName, {
          ...args,
          cwd: args.cwd || this.settingsStore?.get().general.workspace || this.dataDir,
        });
        const durationMs = Date.now() - started;
        this.store.audit({ taskId, serverId, toolName, risk, args, status: "ok", resultSummary: summarizeResult(output), durationMs });
        return { result: output, risk, durationMs };
      }
      if (serverId === "skill-runtime") {
        const tool = this.skillRuntime.tools().find((item) => item.name === toolName);
        if (!tool) throw new Error("Skill Runtime tool not found");
        risk = this.skillRuntime.riskFor(toolName, args);
        if (this.approvalRequired(tool, args)) {
          if (!approvalId) throw new Error("This Skill Runtime tool requires one-time user approval");
          this.store.consumeApproval(approvalId, serverId, toolName, args);
        }
        const output = await this.skillRuntime.call(toolName, args);
        const durationMs = Date.now() - started;
        this.store.audit({ taskId, serverId, toolName, risk, args, status: "ok", resultSummary: summarizeResult(output), durationMs });
        return { result: output, risk, durationMs };
      }
      if (serverId === "windows-mcp" && this.settingsStore?.get().computerUse.enabled === false) throw new Error("Computer Use is disabled in ASUKA settings");
      const tools = await this.listTools(serverId);
      const tool = tools.find((item) => item.name === toolName);
      if (!tool) throw new Error("MCP tool not found");
      risk = this.classify(tool.name, tool.annotations, args);
      this.assertAllowed(tool.name, args);
      if (this.approvalRequired(tool, args)) {
        if (!approvalId) throw new Error("This MCP tool requires one-time user approval");
        this.store.consumeApproval(approvalId, serverId, toolName, args);
      }
      const result = await this.clientFor(serverId).callTool(toolName, args);
      const durationMs = Date.now() - started;
      this.store.audit({ taskId, serverId, toolName, risk, args, status: "ok", resultSummary: summarizeResult(result), durationMs });
      return { result, risk, durationMs };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.store.audit({ taskId, serverId, toolName, risk, args, status: "error", error: message, durationMs: Date.now() - started });
      throw error;
    }
  }
}
