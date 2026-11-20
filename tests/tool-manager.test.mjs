import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { ToolManager } from "../server/tools/tool-manager.mjs";
import { ToolStore } from "../server/tools/tool-store.mjs";

test("tool store disables connectors with unreadable credentials instead of blocking startup", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-tools-credentials-"));
  const databasePath = join(dataDir, "tools.sqlite");
  try {
    const writer = new ToolStore(databasePath, {
      encrypt: (value) => `v1:${value}`,
      decrypt: (value) => String(value).replace(/^v1:/, ""),
    });
    writer.saveServer({ id: "broken", name: "Broken", transport: "http", url: "https://example.com/mcp", headers: { Authorization: "Bearer secret" } });
    writer.close();

    const reader = new ToolStore(databasePath, {
      encrypt: (value) => `v1:${value}`,
      decrypt: () => { throw new Error("unsupported native credential format"); },
    });
    const server = reader.getServer("broken");
    assert.equal(server.enabled, false);
    assert.match(server.credentialError, /unsupported native credential format/);
    assert.deepEqual(server.headers, {});
    reader.close();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("MCP Tool Fabric classifies tools, enforces one-time approval and audits calls", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-tools-"));
  const calls = [];
  const fakeClient = {
    async listTools() {
      return [
        { name: "Snapshot", description: "Read screen", annotations: { readOnlyHint: true, destructiveHint: false }, inputSchema: { type: "object" } },
        { name: "Click", description: "Click UI", annotations: { readOnlyHint: false, destructiveHint: true }, inputSchema: { type: "object" } },
        { name: "Shortcut", description: "Keyboard", annotations: { readOnlyHint: false, destructiveHint: true }, inputSchema: { type: "object" } },
      ];
    },
    async callTool(name, args) { calls.push({ name, args }); return { content: [{ type: "text", text: `${name} ok` }] }; },
    close() {},
  };
  const manager = new ToolManager({ dataDir, databasePath: join(dataDir, "tools.sqlite"), windowsMcpCommand: join(dataDir, "missing.exe"), clientFactory: () => fakeClient });
  try {
    manager.saveServer({ id: "test", name: "Test", command: process.execPath, args: [], env: {} });
    const remote = manager.saveServer({ id: "remote", name: "Remote", transport: "http", url: "https://example.com/mcp", headers: { Authorization: "Bearer secret" } });
    assert.equal(remote.transport, "http");
    assert.deepEqual(remote.headerKeys, ["Authorization"]);
    assert.equal(JSON.stringify(remote).includes("secret"), false);
    assert.throws(() => manager.saveServer({ id: "bad-remote", name: "Bad", transport: "http", url: "http://example.com/mcp" }), /HTTPS/i);
    const tools = await manager.listTools("test");
    assert.equal(tools.find((tool) => tool.name === "Snapshot").risk, "safe");
    assert.equal(tools.find((tool) => tool.name === "Click").risk, "high");
    assert.equal(await manager.createApproval({ serverId: "test", toolName: "Snapshot", args: {} }), null);
    const read = await manager.call({ serverId: "test", toolName: "Snapshot", args: {} });
    assert.equal(read.risk, "safe");
    await assert.rejects(() => manager.call({ serverId: "test", toolName: "Click", args: { loc: [10, 20] } }), /approval/i);
    const approval = await manager.createApproval({ serverId: "test", toolName: "Click", args: { loc: [10, 20] } });
    manager.decideApproval(approval.id, true);
    await assert.rejects(() => manager.call({ serverId: "test", toolName: "Click", args: { loc: [30, 40] }, approvalId: approval.id }), /arguments changed/i);
    const clicked = await manager.call({ serverId: "test", toolName: "Click", args: { loc: [10, 20] }, approvalId: approval.id });
    assert.equal(clicked.result.content[0].text, "Click ok");
    await assert.rejects(() => manager.call({ serverId: "test", toolName: "Click", args: { loc: [10, 20] }, approvalId: approval.id }), /not usable/i);
    await assert.rejects(() => manager.createApproval({ serverId: "test", toolName: "Shortcut", args: { shortcut: "win+r" } }), /blocked/i);
    assert.ok(manager.listAudit().length >= 2);
    assert.equal(calls.length, 2);
  } finally {
    manager.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
