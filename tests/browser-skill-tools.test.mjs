import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { BrowserSkillTools } from "../server/tools/browser-skill-tools.mjs";
import { ToolManager } from "../server/tools/tool-manager.mjs";

function writeFakeBsk(root) {
  const script = join(root, "fake-bsk.mjs");
  writeFileSync(script, [
    "const args = process.argv.slice(2);",
    "if (args[0] === 'status') console.log(JSON.stringify({ daemon: 'ready' }));",
    "else if (args[0] === 'browsers') console.log(JSON.stringify([{ instance_id: 'browser-1', connected: true }]));",
    "else if (args[0] === 'session' && args[1] === 'start') console.log(JSON.stringify({ session_id: 'session-1' }));",
    "else if (args[0] === 'cooperate') console.log(JSON.stringify({ context_id: 'context-1', args }));",
    "else console.log(JSON.stringify({ args }));",
  ].join("\n"), "utf8");
  return script;
}

test("BrowserSkill built-in tools execute only scoped bsk commands", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-browser-skill-"));
  const script = writeFakeBsk(dataDir);
  const browser = new BrowserSkillTools({ command: process.execPath, prefixArgs: [script] });
  try {
    assert.deepEqual(browser.tools().map((tool) => tool.name), [
      "browser_skill_status",
      "browser_skill_session",
      "browser_skill_navigate",
      "browser_skill_sync",
    ]);
    const status = await browser.call("browser_skill_status");
    assert.match(status.content[0].text, /daemon/);
    assert.match(status.content[0].text, /browser-1/);
    const started = await browser.call("browser_skill_session", { action: "start" });
    assert.match(started.content[0].text, /session-1/);
    const synced = await browser.call("browser_skill_sync", { session_id: "session-1" });
    assert.match(synced.content[0].text, /cooperate/);
    const navigated = await browser.call("browser_skill_navigate", { session_id: "session-1", url: "https://example.com" });
    assert.match(navigated.content[0].text, /--context/);
    await assert.rejects(browser.call("browser_skill_navigate", { session_id: "session-1", url: "file:///secret" }), /http or https/);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("ToolManager exposes BrowserSkill tools and keeps state-changing commands behind approval", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-browser-manager-"));
  const script = writeFakeBsk(dataDir);
  const browserSkill = new BrowserSkillTools({ command: process.execPath, prefixArgs: [script] });
  const manager = new ToolManager({
    dataDir,
    databasePath: join(dataDir, "tools.sqlite"),
    windowsMcpCommand: join(dataDir, "missing.exe"),
    browserSkill,
  });
  try {
    const catalog = await manager.listModelTools();
    assert.ok(catalog.tools.some((tool) => tool.name === "browser_skill_status"));
    assert.equal(manager.riskForTool({ serverId: "browser-skill", name: "browser_skill_navigate" }, { session_id: "session-1", url: "https://example.com" }), "safe");
    assert.equal(manager.riskForTool({ serverId: "browser-skill", name: "browser_skill_session" }, { action: "start" }), "confirm");
    assert.equal(manager.riskForTool({ serverId: "browser-skill", name: "browser_skill_session" }, { action: "stop", session_id: "session-1" }), "safe");
    const safe = await manager.call({ serverId: "browser-skill", toolName: "browser_skill_status" });
    assert.match(safe.result.content[0].text, /daemon/);
    await assert.rejects(
      manager.call({ serverId: "browser-skill", toolName: "browser_skill_session", args: { action: "start" } }),
      /requires one-time user approval/,
    );
    const approval = await manager.createApproval({
      id: "browser-approval",
      taskId: "task-browser",
      serverId: "browser-skill",
      toolName: "browser_skill_session",
      args: { action: "start" },
      ttlMs: 60_000,
    });
    manager.decideApproval(approval.id, true);
    const started = await manager.call({
      taskId: "task-browser",
      serverId: "browser-skill",
      toolName: "browser_skill_session",
      args: { action: "start" },
      approvalId: approval.id,
    });
    assert.match(started.result.content[0].text, /session-1/);
    const navigated = await manager.call({
      taskId: "task-browser",
      serverId: "browser-skill",
      toolName: "browser_skill_navigate",
      args: { session_id: "session-1", url: "https://example.com" },
    });
    assert.match(navigated.result.content[0].text, /navigate/);
  } finally {
    manager.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
