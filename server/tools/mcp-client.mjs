import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const MCP_PROTOCOL_VERSION = "2024-11-05";

export class McpStdioClient {
  constructor({ name, command, args = [], env = {}, cwd }) {
    this.name = name;
    this.command = command;
    this.args = args;
    this.env = env;
    this.cwd = cwd;
    this.child = null;
    this.pending = new Map();
    this.nextId = 1;
    this.stderr = "";
    this.notifications = [];
    this.initialized = null;
    this.starting = null;
  }

  async start() {
    if (this.initialized) return this.initialized;
    if (this.starting) return this.starting;
    this.starting = this.open().finally(() => { this.starting = null; });
    return this.starting;
  }

  async open() {
    this.child = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: { ...process.env, ...this.env },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const lines = createInterface({ input: this.child.stdout });
    lines.on("line", (line) => this.onLine(line));
    this.child.stderr.on("data", (chunk) => {
      this.stderr = `${this.stderr}${chunk.toString("utf8")}`.slice(-30_000);
    });
    this.child.on("error", (error) => {
      this.initialized = null;
      this.rejectAll(error);
    });
    this.child.on("exit", (code, signal) => {
      this.initialized = null;
      this.rejectAll(new Error(`${this.name} MCP exited (${code ?? "null"}, ${signal || "no signal"})${this.stderr ? `: ${this.stderr.slice(-1_000)}` : ""}`));
      this.child = null;
    });
    this.initialized = await this.request("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "asuka-tool-fabric", title: "ASUKA", version: "0.8.3" },
    }, 120_000);
    this.notify("notifications/initialized", {});
    return this.initialized;
  }

  onLine(line) {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (message.id !== undefined && message.method) {
      this.answerServerRequest(message);
      return;
    }
    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
      else pending.resolve(message.result);
      return;
    }
    if (message.method) {
      this.notifications.push(message);
      if (this.notifications.length > 100) this.notifications.shift();
    }
  }

  answerServerRequest(message) {
    let result;
    let error;
    if (message.method === "ping") {
      result = {};
    } else if (message.method === "roots/list") {
      result = { roots: [] };
    } else {
      error = { code: -32601, message: `Unsupported MCP server request: ${message.method}` };
    }
    try {
      this.send(error ? { id: message.id, error } : { id: message.id, result });
    } catch {
      // The process may have exited while answering a best-effort server request.
    }
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  send(message) {
    if (!this.child?.stdin?.writable) throw new Error(`${this.name} MCP is not connected`);
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  }

  request(method, params = {}, timeoutMs = 30_000) {
    if (!this.child) return Promise.reject(new Error(`${this.name} MCP is not connected`));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        try { this.notify("notifications/cancelled", { requestId: id, reason: "ASUKA request timeout" }); } catch { /* Process already exited. */ }
        reject(new Error(`${this.name} MCP request timed out: ${method}`));
      }, timeoutMs);
      timer.unref?.();
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.send({ id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  notify(method, params = {}) {
    this.send({ method, params });
  }

  async paginate(method, key) {
    await this.start();
    const items = [];
    let cursor;
    do {
      const result = await this.request(method, cursor ? { cursor } : {}, 30_000);
      items.push(...(result?.[key] || []));
      cursor = result?.nextCursor || undefined;
    } while (cursor);
    return items;
  }

  async listTools() {
    return this.paginate("tools/list", "tools");
  }

  async listResources() {
    return this.paginate("resources/list", "resources");
  }

  async listPrompts() {
    return this.paginate("prompts/list", "prompts");
  }

  async readResource(uri) {
    await this.start();
    return this.request("resources/read", { uri }, 60_000);
  }

  async getPrompt(name, args = {}) {
    await this.start();
    return this.request("prompts/get", { name, arguments: args }, 60_000);
  }

  async callTool(name, args = {}, timeoutMs = 120_000) {
    await this.start();
    return this.request("tools/call", { name, arguments: args }, timeoutMs);
  }

  close() {
    this.rejectAll(new Error(`${this.name} MCP closed`));
    this.child?.kill();
    this.child = null;
    this.initialized = null;
  }
}
