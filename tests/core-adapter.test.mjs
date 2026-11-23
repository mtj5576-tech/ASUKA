import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { startAsukaServer } from "../server.mjs";

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

test("portable launcher and package use the same version and preserve the E-drive profile", () => {
  const packageInfo = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const launcher = readFileSync(new URL("../Start-ASUKA.cmd", import.meta.url), "utf8");
  assert.equal(packageInfo.version, "0.8.39");
  assert.match(launcher, /ASUKA-0\.8\.39-portable\.exe/i);
  assert.match(launcher, /ASUKA_DATA_DIR=E:\\ASUKA\\data\\user-data/i);
  assert.match(launcher, /ASUKA_USER_DATA_DIR=E:\\ASUKA\\data\\user-data/i);
});

test("ASUKA Core routes snapshot, task and agent operations through its adapter", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-core-"));
  const calls = [];
  const omb = http.createServer((request, response) => {
    calls.push(`${request.method} ${request.url}`);
    if (request.method === "GET" && request.url === "/api/health") return json(response, 200, { app: "openmausbot", version: "test" });
    if (request.method === "GET" && request.url === "/api/bots?messages=0") return json(response, 200, { bots: [{ id: "b1" }], groups: [{ id: "r1", section: "ASUKA", memberIds: [] }] });
    if (request.method === "GET" && request.url === "/api/instances") return json(response, 200, { instances: [] });
    if (request.method === "GET" && request.url === "/api/config") return json(response, 200, { profile: {} });
    if (request.method === "GET" && request.url === "/api/threads/t1/job") return json(response, 200, { state: "idle" });
    if (request.method === "GET" && request.url === "/api/threads/t1/messages?limit=20") return json(response, 200, { messages: [{ id: "m1" }] });
    if (request.method === "POST" && request.url === "/api/groups/r1/interrupt") return json(response, 200, { ok: true, action: "stop" });
    if (request.method === "PATCH" && request.url === "/api/bots/b1") return json(response, 200, { bot: { id: "b1", name: "Updated" } });
    if (request.method === "PATCH" && request.url === "/api/groups/r1") return json(response, 200, { group: { id: "r1", memberIds: [] } });
    return json(response, 404, { error: "not found" });
  });
  await new Promise((resolve) => omb.listen(0, "127.0.0.1", resolve));
  const address = omb.address();
  const ombOrigin = `http://127.0.0.1:${address.port}`;
  const asuka = await startAsukaServer({ port: 0, ombUrl: ombOrigin, dataDir, appVersion: "test-asuka-version" });
  const headers = { "x-asuka-adapter": "openmausbot" };
  try {
    const build = await fetch(`${asuka.origin}/__asuka/core/build`).then((response) => response.json());
    assert.equal(build.version, "test-asuka-version");
    assert.equal(build.adapterBuild, "native-kernel-v1");
    const snapshot = await fetch(`${asuka.origin}/__asuka/core/snapshot`, { headers }).then((response) => response.json());
    assert.equal(snapshot.backend.kind, "openmausbot");
    assert.equal(snapshot.backend.authOwner, "asuka");
    assert.equal(snapshot.backend.version, "test");
    assert.equal(snapshot.bots.length, 1);

    const roles = await fetch(`${asuka.origin}/__asuka/core/roles`).then((response) => response.json());
    assert.equal(roles.roles.length, 9);
    const decision = await fetch(`${asuka.origin}/__asuka/core/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "t-small", objective: "写一个简单脚本", capabilities: { roles: ["product_owner", "software_engineer", "evaluator"] } }),
    }).then((response) => response.json());
    assert.equal(decision.plan.scale, "S");
    assert.ok(decision.plan.roles.length <= 3);

    const task = await fetch(`${asuka.origin}/__asuka/core/tasks/t1?limit=20`, { headers }).then((response) => response.json());
    assert.equal(task.job.state, "idle");
    assert.equal(task.messages.length, 1);

    const stopped = await fetch(`${asuka.origin}/__asuka/core/tasks/t1/stop`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ kind: "room", ownerId: "r1" }),
    }).then((response) => response.json());
    assert.equal(stopped.action, "stop");

    const updated = await fetch(`${asuka.origin}/__asuka/core/agents/b1`, {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ patch: { name: "Updated" }, roomIds: ["r1"] }),
    }).then((response) => response.json());
    assert.equal(updated.bot.name, "Updated");
    assert.ok(calls.includes("POST /api/groups/r1/interrupt"));
    assert.ok(calls.includes("PATCH /api/bots/b1"));
    assert.ok(calls.includes("PATCH /api/groups/r1"));
  } finally {
    await asuka.close();
    await new Promise((resolve) => omb.close(resolve));
    rmSync(dataDir, { recursive: true, force: true });
  }
});
