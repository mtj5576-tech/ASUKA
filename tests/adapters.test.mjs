import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { startAsukaServer } from "../server.mjs";
import { CodexAdapter } from "../server/adapters/cli-adapters.mjs";
import { CliAgentClient, createCliRuntime } from "../server/adapters/cli-runtime.mjs";
import { createAdapterRegistry } from "../server/adapters/registry.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForTask(origin, threadId, adapter, states) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const task = await fetch(`${origin}/__asuka/core/tasks/${threadId}`, { headers: { "x-asuka-adapter": adapter } }).then((response) => response.json());
    if (states.includes(task.job?.state)) return task;
    await sleep(25);
  }
  throw new Error(`task did not reach ${states.join(", ")}`);
}

test("adapter registry exposes the five final adapters and explicit OMB boundary", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-registry-"));
  const omb = http.createServer((request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ app: "openmausbot", version: "test-omb" }));
  });
  await new Promise((resolve) => omb.listen(0, "127.0.0.1", resolve));
  const address = omb.address();
  const nativeStub = {
    health: () => ({ ok: true, version: "native-test" }),
    providerInfo: () => ({ configured: true, model: "native-model", kind: "openai-compatible" }),
  };
  const cliStub = (kind) => ({
    health: () => ({ ok: kind !== "claude", version: `${kind}-test`, runtime: { available: kind !== "claude", model: `${kind}-model`, workspace: dataDir, reason: kind === "claude" ? "missing" : "" } }),
    close() {},
  });
  const registry = createAdapterRegistry({ nativeAdapter: nativeStub, codexAdapter: cliStub("codex"), claudeAdapter: cliStub("claude"), dshAdapter: cliStub("dsh") });
  try {
    const unprobed = await registry.descriptors();
    assert.equal(unprobed.find((item) => item.id === "openmausbot").available, false);
    assert.match(unprobed.find((item) => item.id === "openmausbot").reason, /optional/i);
    const adapters = await registry.descriptors(`http://127.0.0.1:${address.port}`, { probeOmb: true });
    assert.deepEqual(adapters.map((item) => item.id), ["native", "codex", "claude", "dsh", "openmausbot"]);
    assert.ok(adapters.every((item) => item.authOwner === "asuka"));
    assert.equal(adapters.find((item) => item.id === "claude").available, false);
    assert.equal(adapters.find((item) => item.id === "openmausbot").explicitOnly, true);
    assert.equal(adapters.find((item) => item.id === "openmausbot").available, true);
  } finally {
    await new Promise((resolve) => omb.close(resolve));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("Codex CLI parsing and CodexAdapter Core routing persist a completed task", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-codex-"));
  const script = join(dataDir, "fake-codex.mjs");
  writeFileSync(script, `
    process.stdin.resume();
    process.stdin.on('end', () => {
      process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'codex stream result' } }) + '\\n');
      process.stdout.write(JSON.stringify({ type: 'turn.completed' }) + '\\n');
    });
  `);
  const runtime = createCliRuntime("codex", {
    launcher: { command: process.execPath, prefixArgs: [script] },
    version: "test-codex",
    workspace: dataDir,
  });
  let streamed = "";
  const parsed = await new CliAgentClient(runtime).generate({ system: "system", messages: [{ role: "user", content: "task" }], onText: (_delta, full) => { streamed = full; } });
  assert.equal(parsed.text, "codex stream result");
  assert.equal(streamed, "codex stream result");

  const fakeClient = {
    async generate({ system }) {
      return { text: system.includes("independent reviewer") ? JSON.stringify({ passed: true, summary: "Codex output accepted.", issues: [] }) : "Codex local result" };
    },
    async test() { return { ok: true }; },
    async listModels() { return ["codex-test"]; },
  };
  const codexAdapter = new CodexAdapter({ dataDir, runtime, clientFactory: () => fakeClient });
  let asuka;
  try {
    asuka = await startAsukaServer({ port: 0, dataDir, codexAdapter });
    const defaultSnapshot = await fetch(`${asuka.origin}/__asuka/core/snapshot`).then((response) => response.json());
    assert.equal(defaultSnapshot.backend.kind, "native");
    const catalog = await fetch(`${asuka.origin}/__asuka/core/adapters`, { headers: { "x-asuka-adapter": "codex" } }).then((response) => response.json());
    assert.deepEqual(catalog.adapters.map((item) => item.id), ["native", "codex", "claude", "dsh", "openmausbot"]);
    const snapshot = await fetch(`${asuka.origin}/__asuka/core/snapshot`, { headers: { "x-asuka-adapter": "codex" } }).then((response) => response.json());
    assert.equal(snapshot.backend.kind, "codex");
    assert.equal(snapshot.backend.authOwner, "asuka");
    const auth = await fetch(`${asuka.origin}/__asuka/core/auth`, { headers: { "x-asuka-adapter": "codex" } }).then((response) => response.json());
    assert.equal(auth.owner, "asuka");
    assert.equal(auth.adapter, "codex");
    const created = await fetch(`${asuka.origin}/__asuka/core/rooms/asuka-native-room/messages`, {
      method: "POST",
      headers: { "x-asuka-adapter": "codex", "content-type": "application/json" },
      body: JSON.stringify({ text: "检查这个项目的适配器边界", mode: "goal" }),
    }).then((response) => response.json());
    const task = await waitForTask(asuka.origin, created.threadId, "codex", ["completed"]);
    assert.ok(task.messages.some((message) => message.text === "Codex local result"));
    assert.ok(task.messages.some((message) => message.kind === "digest" && message.text.startsWith("PASS:")));
  } finally {
    if (asuka) await asuka.close();
    else codexAdapter.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
