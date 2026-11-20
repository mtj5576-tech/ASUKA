import { randomUUID, createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const now = () => new Date().toISOString();
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");
const parseJson = (value, fallback = null) => {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

export class ToolStore {
  constructor(databasePath, secretStore, defaults = {}) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.secretStore = secretStore;
    this.db = new DatabaseSync(databasePath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS tool_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        transport TEXT NOT NULL DEFAULT 'stdio',
        command TEXT NOT NULL DEFAULT '',
        url TEXT,
        args_json TEXT NOT NULL,
        env_cipher TEXT,
        headers_cipher TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tool_approvals (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        server_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        args_json TEXT NOT NULL,
        args_hash TEXT NOT NULL,
        risk TEXT NOT NULL,
        status TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        decided_at TEXT,
        consumed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS tool_audit (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        server_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        risk TEXT NOT NULL,
        args_json TEXT NOT NULL,
        status TEXT NOT NULL,
        result_summary TEXT,
        error TEXT,
        duration_ms INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS tool_audit_created ON tool_audit(created_at DESC);
    `);
    const serverColumns = new Set(this.db.prepare("PRAGMA table_info(tool_servers)").all().map((column) => column.name));
    if (!serverColumns.has("transport")) this.db.exec("ALTER TABLE tool_servers ADD COLUMN transport TEXT NOT NULL DEFAULT 'stdio'");
    if (!serverColumns.has("url")) this.db.exec("ALTER TABLE tool_servers ADD COLUMN url TEXT");
    if (!serverColumns.has("headers_cipher")) this.db.exec("ALTER TABLE tool_servers ADD COLUMN headers_cipher TEXT");
    const approvalColumns = new Set(this.db.prepare("PRAGMA table_info(tool_approvals)").all().map((column) => column.name));
    if (!approvalColumns.has("task_id")) this.db.exec("ALTER TABLE tool_approvals ADD COLUMN task_id TEXT");
    if (!approvalColumns.has("metadata_json")) this.db.exec("ALTER TABLE tool_approvals ADD COLUMN metadata_json TEXT");
    const auditColumns = new Set(this.db.prepare("PRAGMA table_info(tool_audit)").all().map((column) => column.name));
    if (!auditColumns.has("task_id")) this.db.exec("ALTER TABLE tool_audit ADD COLUMN task_id TEXT");
    if (defaults.windowsMcpCommand && existsSync(defaults.windowsMcpCommand) && !this.getServer("windows-mcp")) {
      this.saveServer({
        id: "windows-mcp",
        name: "Windows MCP",
        command: defaults.windowsMcpCommand,
        args: ["serve"],
        env: { ANONYMIZED_TELEMETRY: "false" },
      });
    }
  }

  close() { this.db.close(); }

  saveServer(input) {
    const id = String(input.id || input.name || "mcp-server").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 80);
    const transport = input.transport === "http" ? "http" : "stdio";
    if (!id || transport === "stdio" && !input.command || transport === "http" && !input.url) throw new Error("MCP server id and transport endpoint are required");
    const args = Array.isArray(input.args) ? input.args.map(String) : [];
    const envCipher = input.env && Object.keys(input.env).length ? this.secretStore.encrypt(JSON.stringify(input.env)) : null;
    const headersCipher = input.headers && Object.keys(input.headers).length ? this.secretStore.encrypt(JSON.stringify(input.headers)) : null;
    const at = now();
    this.db.prepare(`
      INSERT INTO tool_servers (id, name, transport, command, url, args_json, env_cipher, headers_cipher, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, command = excluded.command, args_json = excluded.args_json,
        transport = excluded.transport, url = excluded.url, env_cipher = excluded.env_cipher, headers_cipher = excluded.headers_cipher,
        enabled = excluded.enabled, updated_at = excluded.updated_at
    `).run(id, String(input.name || id), transport, String(input.command || ""), input.url ? String(input.url) : null, JSON.stringify(args), envCipher, headersCipher, input.enabled === false ? 0 : 1, at, at);
    return this.getServer(id);
  }

  getServer(id) {
    const row = this.db.prepare("SELECT * FROM tool_servers WHERE id = ?").get(id);
    if (!row) return null;
    let env = {};
    let headers = {};
    let credentialError = "";
    try {
      if (row.env_cipher) env = JSON.parse(this.secretStore.decrypt(row.env_cipher));
      if (row.headers_cipher) headers = JSON.parse(this.secretStore.decrypt(row.headers_cipher));
    } catch (error) {
      credentialError = error instanceof Error ? error.message : String(error);
    }
    return {
      id: row.id,
      name: row.name,
      transport: row.transport || "stdio",
      command: row.command,
      url: row.url || "",
      args: JSON.parse(row.args_json || "[]"),
      env,
      headers,
      enabled: Boolean(row.enabled) && !credentialError,
      credentialError,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listServers() {
    return this.db.prepare("SELECT id FROM tool_servers ORDER BY name").all().map((row) => this.getServer(row.id));
  }

  removeServer(id) { this.db.prepare("DELETE FROM tool_servers WHERE id = ?").run(id); }

  createApproval({ id = randomUUID(), taskId = null, serverId, toolName, args, risk, metadata = null, ttlMs = 120_000 }) {
    const serialized = JSON.stringify(args || {});
    const createdAt = now();
    this.db.prepare(`
      INSERT OR IGNORE INTO tool_approvals (id, task_id, server_id, tool_name, args_json, args_hash, risk, status, metadata_json, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `).run(id, taskId, serverId, toolName, serialized, hash(serialized), risk, metadata ? JSON.stringify(metadata) : null, createdAt, new Date(Date.now() + ttlMs).toISOString());
    return this.getApproval(id);
  }

  getApproval(id) {
    const row = this.db.prepare("SELECT * FROM tool_approvals WHERE id = ?").get(id);
    if (!row) return null;
    return {
      id: row.id,
      taskId: row.task_id || "",
      serverId: row.server_id,
      toolName: row.tool_name,
      args: JSON.parse(row.args_json),
      argsHash: row.args_hash,
      risk: row.risk,
      status: row.status,
      metadata: parseJson(row.metadata_json),
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      decidedAt: row.decided_at,
      consumedAt: row.consumed_at,
    };
  }

  listApprovals(limit = 30) {
    return this.db.prepare("SELECT id FROM tool_approvals ORDER BY created_at DESC LIMIT ?").all(limit).map((row) => this.getApproval(row.id));
  }

  decideApproval(id, approved) {
    const approval = this.getApproval(id);
    if (!approval) throw new Error("MCP approval not found");
    if (approval.status !== "pending") throw new Error("MCP approval is already resolved");
    if (Date.parse(approval.expiresAt) <= Date.now()) throw new Error("MCP approval expired");
    const status = approved ? "approved" : "denied";
    this.db.prepare("UPDATE tool_approvals SET status = ?, decided_at = ? WHERE id = ?").run(status, now(), id);
    return this.getApproval(id);
  }

  consumeApproval(id, serverId, toolName, args) {
    const approval = this.getApproval(id);
    if (!approval || approval.serverId !== serverId || approval.toolName !== toolName) throw new Error("MCP approval does not match this call");
    if (approval.status !== "approved" || approval.consumedAt) throw new Error("MCP approval is not usable");
    if (Date.parse(approval.expiresAt) <= Date.now()) throw new Error("MCP approval expired");
    if (approval.argsHash !== hash(JSON.stringify(args || {}))) throw new Error("MCP approval arguments changed");
    this.db.prepare("UPDATE tool_approvals SET consumed_at = ? WHERE id = ?").run(now(), id);
  }

  audit({ taskId = null, serverId, toolName, risk, args, status, resultSummary = "", error = "", durationMs = 0 }) {
    this.db.prepare(`
      INSERT INTO tool_audit (id, task_id, server_id, tool_name, risk, args_json, status, result_summary, error, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), taskId, serverId, toolName, risk, JSON.stringify(args || {}), status, resultSummary.slice(0, 4_000), error.slice(0, 4_000), durationMs, now());
  }

  listAudit(limit = 100) {
    return this.db.prepare("SELECT * FROM tool_audit ORDER BY created_at DESC LIMIT ?").all(limit).map((row) => ({
      id: row.id,
      taskId: row.task_id || "",
      serverId: row.server_id,
      toolName: row.tool_name,
      risk: row.risk,
      args: JSON.parse(row.args_json),
      status: row.status,
      resultSummary: row.result_summary,
      error: row.error,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
    }));
  }
}
