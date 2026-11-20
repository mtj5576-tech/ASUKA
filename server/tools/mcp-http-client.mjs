const MCP_HTTP_PROTOCOL_VERSION = "2025-03-26";

function parseSseBlock(block) {
  const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart()).join("\n");
  if (!data) return null;
  try { return JSON.parse(data); } catch { return null; }
}

export class McpHttpClient {
  constructor({ name, url, headers = {} }) {
    this.name = name;
    this.url = url;
    this.headers = headers;
    this.sessionId = "";
    this.protocolVersion = MCP_HTTP_PROTOCOL_VERSION;
    this.nextId = 1;
    this.initialized = null;
    this.starting = null;
    this.active = new Set();
  }

  requestHeaders(extra = {}) {
    const headers = {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...this.headers,
      ...extra,
    };
    if (this.sessionId) headers["mcp-session-id"] = this.sessionId;
    if (this.initialized) headers["mcp-protocol-version"] = this.protocolVersion;
    return headers;
  }

  async start() {
    if (this.initialized) return this.initialized;
    if (this.starting) return this.starting;
    this.starting = this.initialize().finally(() => { this.starting = null; });
    return this.starting;
  }

  async initialize() {
    const result = await this.request("initialize", {
      protocolVersion: MCP_HTTP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "asuka-tool-fabric", title: "ASUKA", version: "0.8.3" },
    }, 120_000, false);
    this.protocolVersion = result?.protocolVersion || MCP_HTTP_PROTOCOL_VERSION;
    this.initialized = result;
    await this.notify("notifications/initialized", {});
    return result;
  }

  async post(message, timeoutMs = 30_000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`${this.name} MCP HTTP request timed out`)), timeoutMs);
    timer.unref?.();
    this.active.add(controller);
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: this.requestHeaders(),
        body: JSON.stringify({ jsonrpc: "2.0", ...message }),
        signal: controller.signal,
      });
      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) this.sessionId = sessionId;
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`${this.name} MCP HTTP ${response.status}${detail ? `: ${detail.slice(0, 500)}` : ""}`);
      }
      return response;
    } finally {
      clearTimeout(timer);
      this.active.delete(controller);
    }
  }

  async responseResult(response, requestId) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const message = await response.json();
      if (message?.error) throw new Error(message.error.message || JSON.stringify(message.error));
      if (message?.id !== undefined && message.id !== requestId) throw new Error("MCP HTTP response id mismatch");
      return message?.result;
    }
    if (!contentType.includes("text/event-stream") || !response.body) throw new Error(`${this.name} MCP HTTP returned unsupported content type: ${contentType || "none"}`);
    const decoder = new TextDecoder();
    let buffer = "";
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let boundary = buffer.search(/\r?\n\r?\n/);
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + (buffer[boundary] === "\r" ? 4 : 2));
        const message = parseSseBlock(block);
        if (message?.id === requestId) {
          if (message.error) throw new Error(message.error.message || JSON.stringify(message.error));
          return message.result;
        }
        if (message?.error) throw new Error(message.error.message || JSON.stringify(message.error));
        boundary = buffer.search(/\r?\n\r?\n/);
      }
    }
    throw new Error(`${this.name} MCP HTTP stream ended without a response`);
  }

  async request(method, params = {}, timeoutMs = 30_000, waitForStart = true) {
    if (waitForStart) await this.start();
    const id = this.nextId++;
    const response = await this.post({ id, method, params }, timeoutMs);
    return this.responseResult(response, id);
  }

  async notify(method, params = {}) {
    const response = await this.post({ method, params }, 30_000);
    await response.body?.cancel().catch(() => {});
  }

  async paginate(method, key) {
    await this.start();
    const items = [];
    let cursor;
    do {
      const result = await this.request(method, cursor ? { cursor } : {}, 30_000, false);
      items.push(...(result?.[key] || []));
      cursor = result?.nextCursor || undefined;
    } while (cursor);
    return items;
  }

  async listTools() { return this.paginate("tools/list", "tools"); }
  async listResources() { return this.paginate("resources/list", "resources"); }
  async listPrompts() { return this.paginate("prompts/list", "prompts"); }

  async readResource(uri) {
    await this.start();
    return this.request("resources/read", { uri }, 60_000, false);
  }

  async getPrompt(name, args = {}) {
    await this.start();
    return this.request("prompts/get", { name, arguments: args }, 60_000, false);
  }

  async callTool(name, args = {}, timeoutMs = 120_000) {
    await this.start();
    return this.request("tools/call", { name, arguments: args }, timeoutMs, false);
  }

  close() {
    for (const controller of this.active) controller.abort(new Error(`${this.name} MCP HTTP closed`));
    this.active.clear();
    this.initialized = null;
    this.sessionId = "";
  }
}
