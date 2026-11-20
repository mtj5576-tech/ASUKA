import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const now = () => new Date().toISOString();

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function publicMessage(row) {
  return {
    id: row.id,
    threadId: row.thread_id,
    role: row.role,
    kind: row.kind,
    text: row.text,
    from: parseJson(row.from_json),
    card: parseJson(row.card_json),
    tool: parseJson(row.tool_json),
    at: row.at,
  };
}

export class NativeStore {
  constructor(databasePath) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS native_entities (
        kind TEXT NOT NULL,
        id TEXT NOT NULL,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (kind, id)
      );
      CREATE TABLE IF NOT EXISTS native_provider (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        kind TEXT NOT NULL,
        base_url TEXT NOT NULL,
        model TEXT NOT NULL,
        api_key_cipher TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS native_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        request_text TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'unknown',
        project TEXT NOT NULL DEFAULT 'inbox',
        room_id TEXT NOT NULL DEFAULT 'asuka-native-room',
        pinned INTEGER NOT NULL DEFAULT 0,
        unread INTEGER NOT NULL DEFAULT 0,
        forked_from TEXT,
        archived_at TEXT,
        decision_json TEXT,
        mandate_json TEXT,
        report_json TEXT,
        error TEXT,
        run_id TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS native_tasks_updated ON native_tasks(updated_at DESC);
      CREATE TABLE IF NOT EXISTS native_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES native_tasks(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        role TEXT NOT NULL,
        kind TEXT NOT NULL,
        text TEXT NOT NULL DEFAULT '',
        from_json TEXT,
        card_json TEXT,
        tool_json TEXT,
        at TEXT NOT NULL,
        UNIQUE (thread_id, seq)
      );
      CREATE INDEX IF NOT EXISTS native_messages_thread ON native_messages(thread_id, seq);
      CREATE TABLE IF NOT EXISTS native_approvals (
        request_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES native_tasks(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        trigger TEXT NOT NULL,
        required_before TEXT NOT NULL,
        reason TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        created_at TEXT NOT NULL,
        responded_at TEXT
      );
      CREATE INDEX IF NOT EXISTS native_approvals_task ON native_approvals(task_id, status);
      CREATE TABLE IF NOT EXISTS native_model_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES native_tasks(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        role TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        at TEXT NOT NULL,
        UNIQUE (thread_id, seq)
      );
      CREATE INDEX IF NOT EXISTS native_model_messages_thread ON native_model_messages(thread_id, seq);
      CREATE TABLE IF NOT EXISTS native_events (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        source TEXT NOT NULL,
        type TEXT NOT NULL,
        subject TEXT,
        dedupe_key TEXT,
        payload_json TEXT NOT NULL,
        hop INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS native_events_task ON native_events(task_id, created_at);
      CREATE INDEX IF NOT EXISTS native_events_created ON native_events(created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS native_events_dedupe ON native_events(dedupe_key) WHERE dedupe_key IS NOT NULL;
    `);
    const columns = new Set(this.db.prepare("PRAGMA table_info(native_tasks)").all().map((column) => column.name));
    if (!columns.has("mandate_json")) this.db.exec("ALTER TABLE native_tasks ADD COLUMN mandate_json TEXT");
    if (!columns.has("report_json")) this.db.exec("ALTER TABLE native_tasks ADD COLUMN report_json TEXT");
    if (!columns.has("category")) this.db.exec("ALTER TABLE native_tasks ADD COLUMN category TEXT NOT NULL DEFAULT 'unknown'");
    if (!columns.has("project")) this.db.exec("ALTER TABLE native_tasks ADD COLUMN project TEXT NOT NULL DEFAULT 'inbox'");
    if (!columns.has("room_id")) this.db.exec("ALTER TABLE native_tasks ADD COLUMN room_id TEXT NOT NULL DEFAULT 'asuka-native-room'");
    if (!columns.has("pinned")) this.db.exec("ALTER TABLE native_tasks ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");
    if (!columns.has("unread")) this.db.exec("ALTER TABLE native_tasks ADD COLUMN unread INTEGER NOT NULL DEFAULT 0");
    if (!columns.has("forked_from")) this.db.exec("ALTER TABLE native_tasks ADD COLUMN forked_from TEXT");
    if (!columns.has("archived_at")) this.db.exec("ALTER TABLE native_tasks ADD COLUMN archived_at TEXT");
  }

  close() {
    this.db.close();
  }

  getEntity(kind, id) {
    const row = this.db.prepare("SELECT data_json FROM native_entities WHERE kind = ? AND id = ?").get(kind, id);
    return row ? parseJson(row.data_json) : null;
  }

  listEntities(kind) {
    return this.db.prepare("SELECT data_json FROM native_entities WHERE kind = ? ORDER BY updated_at ASC").all(kind)
      .map((row) => parseJson(row.data_json))
      .filter(Boolean);
  }

  putEntity(kind, id, data) {
    this.db.prepare(`
      INSERT INTO native_entities (kind, id, data_json, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(kind, id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at
    `).run(kind, id, JSON.stringify(data), now());
    return data;
  }

  deleteEntity(kind, id) {
    return this.db.prepare("DELETE FROM native_entities WHERE kind = ? AND id = ?").run(kind, id).changes > 0;
  }

  getProvider() {
    const row = this.db.prepare("SELECT kind, base_url, model, api_key_cipher, updated_at FROM native_provider WHERE id = 1").get();
    return row ? {
      kind: row.kind,
      baseUrl: row.base_url,
      model: row.model,
      apiKeyCipher: row.api_key_cipher,
      updatedAt: row.updated_at,
    } : null;
  }

  setProvider({ kind, baseUrl, model, apiKeyCipher }) {
    this.db.prepare(`
      INSERT INTO native_provider (id, kind, base_url, model, api_key_cipher, updated_at) VALUES (1, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, base_url = excluded.base_url, model = excluded.model,
        api_key_cipher = excluded.api_key_cipher, updated_at = excluded.updated_at
    `).run(kind, baseUrl, model, apiKeyCipher, now());
  }

  clearProvider() {
    this.db.prepare("DELETE FROM native_provider WHERE id = 1").run();
  }

  createTask({ id = randomUUID(), title, requestText, status = "queued", category = "unknown", project = "inbox", roomId = "asuka-native-room", pinned = false, unread = false, forkedFrom = null, decision = null, mandate = null, report = null }) {
    const at = now();
    this.db.prepare(`
      INSERT INTO native_tasks (id, title, status, request_text, category, project, room_id, pinned, unread, forked_from, archived_at, decision_json, mandate_json, report_json, run_id, attempts, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, title, status, requestText, category, project || "inbox", roomId || "asuka-native-room", Number(Boolean(pinned)), Number(Boolean(unread)), forkedFrom || null, decision ? JSON.stringify(decision) : null, mandate ? JSON.stringify(mandate) : null, report ? JSON.stringify(report) : null, randomUUID(), at, at);
    return this.getTask(id);
  }

  getTask(id) {
    const row = this.db.prepare("SELECT * FROM native_tasks WHERE id = ?").get(id);
    return row ? {
      id: row.id,
      title: row.title,
      status: row.status,
      requestText: row.request_text,
      category: row.category || "unknown",
      project: row.project || "inbox",
      roomId: row.room_id || "asuka-native-room",
      pinned: Boolean(row.pinned),
      unread: Boolean(row.unread),
      forkedFrom: row.forked_from || null,
      archivedAt: row.archived_at || null,
      archived: Boolean(row.archived_at),
      decision: parseJson(row.decision_json),
      mandate: parseJson(row.mandate_json),
      report: parseJson(row.report_json),
      error: row.error || "",
      runId: row.run_id,
      attempts: row.attempts,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } : null;
  }

  listTasks(limit = 30) {
    return this.db.prepare("SELECT * FROM native_tasks ORDER BY updated_at DESC LIMIT ?").all(Math.max(1, Math.min(Number(limit) || 30, 200)))
      .map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        requestText: row.request_text,
        category: row.category || "unknown",
        project: row.project || "inbox",
        roomId: row.room_id || "asuka-native-room",
        pinned: Boolean(row.pinned),
        unread: Boolean(row.unread),
        forkedFrom: row.forked_from || null,
        archivedAt: row.archived_at || null,
        archived: Boolean(row.archived_at),
        decision: parseJson(row.decision_json),
        mandate: parseJson(row.mandate_json),
        report: parseJson(row.report_json),
        error: row.error || "",
        runId: row.run_id,
        attempts: row.attempts,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }

  updateTask(id, patch) {
    const current = this.getTask(id);
    if (!current) throw new Error("native task not found");
    const next = { ...current, ...patch, updatedAt: now() };
    next.project = next.project || "inbox";
    next.pinned = Boolean(next.pinned);
    next.unread = Boolean(next.unread);
    next.forkedFrom = next.forkedFrom || null;
    next.archivedAt = next.archivedAt || null;
    next.archived = Boolean(next.archivedAt);
    this.db.prepare(`
      UPDATE native_tasks SET title = ?, status = ?, request_text = ?, category = ?, project = ?, room_id = ?, pinned = ?, unread = ?, forked_from = ?, archived_at = ?, decision_json = ?, mandate_json = ?, report_json = ?, error = ?, run_id = ?,
        attempts = ?, updated_at = ? WHERE id = ?
    `).run(
      next.title,
      next.status,
      next.requestText,
      next.category || "unknown",
      next.project,
      next.roomId || "asuka-native-room",
      Number(next.pinned),
      Number(next.unread),
      next.forkedFrom,
      next.archivedAt || null,
      next.decision ? JSON.stringify(next.decision) : null,
      next.mandate ? JSON.stringify(next.mandate) : null,
      next.report ? JSON.stringify(next.report) : null,
      next.error || null,
      next.runId || null,
      Number(next.attempts) || 1,
      next.updatedAt,
      id,
    );
    return next;
  }

  deleteTask(id) {
    return this.db.prepare("DELETE FROM native_tasks WHERE id = ?").run(id).changes > 0;
  }

  beginAttempt(id) {
    const task = this.getTask(id);
    if (!task) throw new Error("native task not found");
    return this.updateTask(id, { status: "running", error: "", runId: randomUUID(), attempts: task.attempts + 1 });
  }

  appendMessage(message) {
    const seqRow = this.db.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM native_messages WHERE thread_id = ?").get(message.threadId);
    const row = {
      id: message.id || randomUUID(),
      thread_id: message.threadId,
      seq: seqRow.seq,
      role: message.role || "assistant",
      kind: message.kind || "text",
      text: message.text || "",
      from_json: message.from ? JSON.stringify(message.from) : null,
      card_json: message.card ? JSON.stringify(message.card) : null,
      tool_json: message.tool ? JSON.stringify(message.tool) : null,
      at: message.at || now(),
    };
    this.db.prepare(`
      INSERT INTO native_messages (id, thread_id, seq, role, kind, text, from_json, card_json, tool_json, at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.id, row.thread_id, row.seq, row.role, row.kind, row.text, row.from_json, row.card_json, row.tool_json, row.at);
    this.db.prepare("UPDATE native_tasks SET updated_at = ? WHERE id = ?").run(row.at, message.threadId);
    return publicMessage(row);
  }

  updateMessage(id, patch) {
    const row = this.db.prepare("SELECT * FROM native_messages WHERE id = ?").get(id);
    if (!row) throw new Error("native message not found");
    const next = {
      text: patch.text ?? row.text,
      card_json: patch.card === undefined ? row.card_json : patch.card ? JSON.stringify(patch.card) : null,
      at: patch.at || row.at,
    };
    this.db.prepare("UPDATE native_messages SET text = ?, card_json = ?, at = ? WHERE id = ?")
      .run(next.text, next.card_json, next.at, id);
    this.db.prepare("UPDATE native_tasks SET updated_at = ? WHERE id = ?").run(next.at, row.thread_id);
    return publicMessage({ ...row, text: next.text, card_json: next.card_json, at: next.at });
  }

  getMessage(id) {
    const row = this.db.prepare("SELECT * FROM native_messages WHERE id = ?").get(id);
    return row ? publicMessage(row) : null;
  }

  getMessages(threadId, limit = 100) {
    return this.db.prepare("SELECT * FROM native_messages WHERE thread_id = ? ORDER BY seq DESC LIMIT ?")
      .all(threadId, Math.max(1, Math.min(Number(limit) || 100, 300)))
      .reverse()
      .map(publicMessage);
  }

  createApprovals(taskId, approvals) {
    const at = now();
    const statement = this.db.prepare(`
      INSERT OR IGNORE INTO native_approvals (request_id, task_id, status, trigger, required_before, reason, risk_level, created_at)
      VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)
    `);
    for (const approval of approvals) {
      statement.run(approval.id, taskId, approval.trigger, approval.requiredBefore, approval.reason, approval.riskLevel, at);
    }
    return this.listApprovals(taskId);
  }

  listApprovals(taskId) {
    return this.db.prepare("SELECT * FROM native_approvals WHERE task_id = ? ORDER BY created_at ASC").all(taskId)
      .map((row) => ({
        requestId: row.request_id,
        taskId: row.task_id,
        status: row.status,
        trigger: row.trigger,
        requiredBefore: row.required_before,
        reason: row.reason,
        riskLevel: row.risk_level,
        createdAt: row.created_at,
        respondedAt: row.responded_at,
      }));
  }

  respondApproval(taskId, requestId, status) {
    const approval = this.db.prepare("SELECT * FROM native_approvals WHERE task_id = ? AND request_id = ?").get(taskId, requestId);
    if (!approval) throw new Error("native approval not found");
    if (approval.status !== "pending") throw new Error("native approval is already resolved");
    this.db.prepare("UPDATE native_approvals SET status = ?, responded_at = ? WHERE task_id = ? AND request_id = ?")
      .run(status, now(), taskId, requestId);
    return this.listApprovals(taskId).find((item) => item.requestId === requestId);
  }

  pendingApprovals(taskId) {
    return this.listApprovals(taskId).filter((approval) => approval.status === "pending");
  }

  appendModelMessage(taskId, payload) {
    const seqRow = this.db.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM native_model_messages WHERE thread_id = ?").get(taskId);
    const row = {
      id: randomUUID(),
      thread_id: taskId,
      seq: seqRow.seq,
      role: payload?.role || "user",
      payload_json: JSON.stringify(payload || {}),
      at: now(),
    };
    this.db.prepare(`
      INSERT INTO native_model_messages (id, thread_id, seq, role, payload_json, at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(row.id, row.thread_id, row.seq, row.role, row.payload_json, row.at);
    this.db.prepare("UPDATE native_tasks SET updated_at = ? WHERE id = ?").run(row.at, taskId);
    return { id: row.id, threadId: taskId, seq: row.seq, ...payload, at: row.at };
  }

  listModelMessages(taskId, limit = 200) {
    return this.db.prepare("SELECT * FROM native_model_messages WHERE thread_id = ? ORDER BY seq ASC LIMIT ?")
      .all(taskId, Math.max(1, Math.min(Number(limit) || 200, 500)))
      .map((row) => ({ id: row.id, threadId: row.thread_id, seq: row.seq, ...parseJson(row.payload_json, {}), at: row.at }));
  }

  clearModelMessages(taskId) {
    this.db.prepare("DELETE FROM native_model_messages WHERE thread_id = ?").run(taskId);
  }

  appendEvent({ id = randomUUID(), taskId = null, source, type, subject = "", dedupeKey = null, payload = {}, hop = 0, status = "accepted" }) {
    const at = now();
    this.db.prepare(`
      INSERT INTO native_events (id, task_id, source, type, subject, dedupe_key, payload_json, hop, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, taskId || null, source || "unknown", type || "unknown", subject || null, dedupeKey || null, JSON.stringify(payload || {}), Math.max(0, Number(hop) || 0), status, at, at);
    return this.getEvent(id);
  }

  getEvent(id) {
    const row = this.db.prepare("SELECT * FROM native_events WHERE id = ?").get(id);
    return row ? {
      id: row.id,
      taskId: row.task_id || null,
      source: row.source,
      type: row.type,
      subject: row.subject || "",
      dedupeKey: row.dedupe_key || null,
      payload: parseJson(row.payload_json, {}),
      hop: row.hop,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } : null;
  }

  findEventByDedupe(dedupeKey) {
    if (!dedupeKey) return null;
    const row = this.db.prepare("SELECT id FROM native_events WHERE dedupe_key = ?").get(dedupeKey);
    return row ? this.getEvent(row.id) : null;
  }

  updateEvent(id, patch = {}) {
    const current = this.getEvent(id);
    if (!current) throw new Error("native event not found");
    const next = { ...current, ...patch, updatedAt: now() };
    this.db.prepare("UPDATE native_events SET task_id = ?, status = ?, payload_json = ?, hop = ?, updated_at = ? WHERE id = ?")
      .run(next.taskId || null, next.status || current.status, JSON.stringify(next.payload || {}), Math.max(0, Number(next.hop) || 0), next.updatedAt, id);
    return this.getEvent(id);
  }

  listEvents({ taskId = "", limit = 100 } = {}) {
    const bounded = Math.max(1, Math.min(Number(limit) || 100, 500));
    const rows = taskId
      ? this.db.prepare("SELECT id FROM native_events WHERE task_id = ? ORDER BY created_at DESC LIMIT ?").all(taskId, bounded)
      : this.db.prepare("SELECT id FROM native_events ORDER BY created_at DESC LIMIT ?").all(bounded);
    return rows.map((row) => this.getEvent(row.id));
  }

  markRunningInterrupted() {
    const at = now();
    const rows = this.db.prepare("SELECT id FROM native_tasks WHERE status = 'running'").all();
    if (!rows.length) return [];
    const statement = this.db.prepare("UPDATE native_tasks SET status = 'interrupted', error = ?, updated_at = ? WHERE id = ?");
    for (const row of rows) statement.run("ASUKA restarted before this run completed. Retry is available.", at, row.id);
    return rows.map((row) => row.id);
  }
}
