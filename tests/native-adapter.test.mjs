import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

import { startAsukaServer } from "../server.mjs";
import { NativeAdapter } from "../server/native/native-adapter.mjs";
import { createFileSecretStore } from "../server/native/secret-store.mjs";
import { NativeStore } from "../server/native/store.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function removeTempDir(path) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      rmSync(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!["EPERM", "EBUSY"].includes(error?.code) || attempt === 19) throw error;
      await sleep(100);
    }
  }
}

function writeSse(response, payload) {
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function waitForTask(origin, threadId, states, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(`${origin}/__asuka/core/tasks/${threadId}?limit=100`, {
      headers: { "x-asuka-adapter": "native" },
    });
    const task = await response.json();
    if (states.includes(task.job?.state)) return task;
    await sleep(25);
  }
  throw new Error(`timed out waiting for ${states.join(", ")}`);
}

async function providerMock() {
  let executorCalls = 0;
  let slowCalls = 0;
  let providerCallsAfterApproval = 0;
  let guidanceApplied = 0;
  const executorSystems = [];
  const executorModels = [];
  const reviewerInputs = [];
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "mock-model" }] }));
      return;
    }
    if (request.method !== "POST" || url.pathname !== "/v1/chat/completions") {
      response.writeHead(404).end("not found");
      return;
    }
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    const system = body.messages?.[0]?.content || "";
    const user = body.messages?.[1]?.content || "";
    const allUserText = (body.messages || []).filter((message) => message.role === "user").map((message) => typeof message.content === "string" ? message.content : JSON.stringify(message.content)).join("\n");
    if (system.includes("independent reviewer")) {
      reviewerInputs.push(allUserText);
      const review = allUserText.includes("invalid-review-json-test")
        ? "Review looks acceptable but this is intentionally not JSON."
        : allUserText.includes("review-repair-test") && !allUserText.includes("corrected final result")
          ? JSON.stringify({ passed: false, summary: "The deliverable needs the corrected result.", issues: ["Use the corrected final result."] })
          : JSON.stringify({ passed: true, summary: "Meets all blocking gates.", issues: [] });
      if (!body.stream) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ id: "review", choices: [{ message: { content: review }, finish_reason: "stop" }] }));
        return;
      }
      response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
      writeSse(response, { choices: [{ delta: { content: review } }] });
      response.write("data: [DONE]\n\n");
      response.end();
      return;
    }
    if (!body.stream) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ id: "test", choices: [{ message: { content: "ASUKA-OK" } }] }));
      return;
    }
    response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    if (system.includes("assigned by NOVA to one team phase")) {
      writeSse(response, { choices: [{ delta: { content: JSON.stringify({ status: "done", summary: "Specialist bounded contribution.", artifacts: [{ type: "text", title: "notes", content: "Bounded specialist artifact." }], evidence: ["mock contributor"], issues: [], nextAction: "" }) } }] });
      response.write("data: [DONE]\n\n");
      response.end();
      return;
    }
    executorSystems.push(system);
    executorModels.push(body.model);
    executorCalls += 1;
    if (user.includes("approval-test")) providerCallsAfterApproval += 1;
    if (user.includes("guidance-test") && !allUserText.includes("Guidance received during execution")) {
      writeSse(response, { choices: [{ delta: { content: "working before guidance" } }] });
      const timer = setTimeout(() => {
        writeSse(response, { choices: [{ delta: { content: " and continuing" } }] });
        response.write("data: [DONE]\n\n");
        response.end();
      }, 1_200);
      response.on("close", () => clearTimeout(timer));
      return;
    }
    if (user.includes("guidance-test") && allUserText.includes("focus on tests")) {
      guidanceApplied += 1;
      writeSse(response, { choices: [{ delta: { content: "guidance applied" } }] });
      response.write("data: [DONE]\n\n");
      response.end();
      return;
    }
    if (user.includes("slow-retry") && slowCalls++ === 0) {
      writeSse(response, { choices: [{ delta: { content: "partial output" } }] });
      const timer = setTimeout(() => {
        writeSse(response, { choices: [{ delta: { content: " too late" } }] });
        response.write("data: [DONE]\n\n");
        response.end();
      }, 10_000);
      response.on("close", () => clearTimeout(timer));
      return;
    }
    const text = user.includes("slow-retry")
      ? "completed after retry"
      : user.includes("review-repair-test") && allUserText.includes("Independent review rejected")
        ? "corrected final result"
        : user.includes("invalid-review-json-test")
          ? "deliverable survives invalid review"
          : user.includes("review-repair-test")
            ? "initial deliverable"
            : "executor delivered a concrete artifact";
    writeSse(response, { choices: [{ delta: { content: text.slice(0, 12) } }] });
    writeSse(response, { choices: [{ delta: { content: text.slice(12) } }] });
    response.write("data: [DONE]\n\n");
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    origin: `http://127.0.0.1:${address.port}`,
    stats: () => ({ executorCalls, providerCallsAfterApproval, guidanceApplied, executorSystems, executorModels, reviewerInputs }),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("native adapter migrates the existing DeepSeek provider into per-bot API profiles", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-native-provider-migration-"));
  const databasePath = join(dataDir, "native.sqlite");
  try {
    const store = new NativeStore(databasePath);
    const secretStore = createFileSecretStore(dataDir);
    store.setProvider({
      kind: "openai-compatible",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      apiKeyCipher: secretStore.encrypt("legacy-deepseek-key"),
    });
    store.close();

    const adapter = new NativeAdapter({ dataDir, databasePath });
    try {
      const snapshot = adapter.snapshot();
      assert.equal(snapshot.config.nativeProvider.id, "native-provider");
      assert.equal(snapshot.config.nativeProvider.label, "DeepSeek API");
      assert.equal(snapshot.config.nativeProviders.length, 1);
      assert.equal(snapshot.bots.length, 9);
      assert.ok(snapshot.bots.every((bot) => bot.modelSelection.instanceId === "native-provider"));
      assert.ok(snapshot.bots.every((bot) => bot.modelSelection.model === "deepseek-flash"));
    } finally {
      adapter.close();
    }
    const unreadable = new NativeAdapter({
      dataDir,
      databasePath,
      secretStore: { encrypt: () => "v1:unused", decrypt: () => { throw new Error("unreadable credential"); } },
    });
    try {
      const snapshot = unreadable.snapshot();
      assert.equal(snapshot.config.nativeProvider.configured, false);
      assert.match(snapshot.config.nativeProvider.credentialError, /unreadable credential/);
      assert.equal(snapshot.instances[0].snapshot.state, "unavailable");
    } finally {
      unreadable.close();
    }
  } finally {
    await removeTempDir(dataDir);
  }
});

test("native adapter runs, streams, stops, retries, approves, survives restart and never returns the API key", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-native-"));
  const databasePath = join(dataDir, "native.sqlite");
  const provider = await providerMock();
  let asuka;
  try {
    asuka = await startAsukaServer({ port: 0, dataDir, nativeDatabasePath: databasePath });
    const native = (path, options = {}) => fetch(`${asuka.origin}/__asuka/core${path}`, {
      ...options,
      headers: { "x-asuka-adapter": "native", ...(options.body ? { "content-type": "application/json" } : {}), ...options.headers },
    });

    const saved = await native("/native/provider", {
      method: "PUT",
      body: JSON.stringify({ kind: "openai-compatible", baseUrl: `${provider.origin}/v1`, model: "mock-model", apiKey: "secret-native-key" }),
    }).then((response) => response.json());
    assert.equal(saved.provider.configured, true);
    assert.equal(JSON.stringify(saved).includes("secret-native-key"), false);
    await native("/native/provider", {
      method: "PUT",
      body: JSON.stringify({ kind: "openai-compatible", baseUrl: `${provider.origin}/v1`, model: "mock-model" }),
    });

    const tested = await native("/native/provider/test", { method: "POST", body: "{}" }).then((response) => response.json());
    assert.equal(tested.ok, true);
    assert.deepEqual(tested.models, ["mock-model"]);

    const snapshot = await native("/snapshot").then((response) => response.json());
    assert.equal(snapshot.backend.kind, "native");
    assert.equal(snapshot.bots.length, 9);
    const nova = snapshot.bots.find((bot) => bot.id === "asuka-native-planner");
    assert.equal(nova.name, "NOVA");
    assert.equal(nova.isOrchestrator, true);
    assert.ok(["ASUKA LENS", "ASUKA GRID", "ASUKA BLOOM", "ASUKA RELAY", "ASUKA SPROUT", "ASUKA LUNA"].every((name) => snapshot.bots.some((bot) => bot.name === name)));
    assert.ok(snapshot.bots.every((bot) => bot.roleLabel && bot.deliverable && bot.missingRisk && bot.skillSummary?.total >= 0));
    assert.equal(snapshot.groups[0].name, "ASUKA Command");
    assert.equal(snapshot.instances[0].snapshot.state, "available");
    assert.equal(snapshot.config.nativeProviders.length, 1);
    assert.equal(snapshot.config.nativeProviders[0].id, "native-provider");
    assert.ok(snapshot.bots.every((bot) => bot.modelSelection.instanceId === "native-provider"));
    const architectureResponse = await fetch(`${asuka.origin}/__asuka/core/rooms/asuka-native-room/architecture?adapter=native`);
    assert.equal(architectureResponse.status, 200);
    assert.match(architectureResponse.headers.get("content-type"), /text\/html/);
    const architectureHtml = await architectureResponse.text();
    assert.match(architectureHtml, /^<!DOCTYPE html>/i);
    assert.match(architectureHtml, /团队架构/);

    const skillList = await native("/agents/asuka-native-builder/skills").then((response) => response.json());
    assert.equal(skillList.skills.length, 16);
    assert.ok(skillList.skills.every((skill) => skill.enabled && skill.everyBot && skill.origin === "native"));
    const disabled = await native("/agents/asuka-native-builder/skills/openai-docs", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
    }).then((response) => response.json());
    assert.equal(disabled.skill.enabled, false);
    const sharedState = await native("/agents/asuka-native-planner/skills").then((response) => response.json());
    assert.equal(sharedState.skills.find((skill) => skill.name === "openai-docs").enabled, true);
    await native("/agents/asuka-native-builder/skills/openai-docs", {
      method: "PATCH",
      body: JSON.stringify({ enabled: true }),
    });

    const created = await native("/rooms/asuka-native-room/messages", {
      method: "POST",
      body: JSON.stringify({ text: "写一个简单的 PowerShell 脚本，输出当前目录文件数量", mode: "goal" }),
    }).then((response) => response.json());
    const completed = await waitForTask(asuka.origin, created.threadId, ["completed"]);
    assert.equal(completed.job.decision.plan.scale, "S");
    assert.equal(completed.job.stage, "ended");
    assert.equal(completed.job.mandate.adapter, "native");
    assert.equal(completed.job.report.state, "ready");
    assert.ok(completed.job.decision.plan.roles.length <= 3);
    assert.ok(completed.messages.some((message) => message.text === "executor delivered a concrete artifact"));
    assert.match(provider.stats().executorSystems.at(-1), /简体中文/);
    assert.ok(completed.messages.some((message) => message.kind === "digest" && message.text.startsWith("PASS:")));

    const autoTeamSnapshot = await native("/snapshot").then((response) => response.json());
    const autoTeamRoom = autoTeamSnapshot.groups.find((group) => group.id === "asuka-native-room");
    assert.equal(autoTeamRoom.leadBotId, "asuka-native-planner");
    assert.equal(autoTeamRoom.teamPlan.orchestratorId, "asuka-native-planner");
    assert.equal(autoTeamRoom.teamPlan.primaryWorkerId, "asuka-native-night");
    assert.equal(autoTeamRoom.teamPlan.assignments.some((item) => item.agentId === "asuka-native-planner"), false);
    assert.ok(autoTeamRoom.memberIds.includes("asuka-native-planner"));
    assert.ok(autoTeamRoom.memberIds.includes("asuka-native-night"));
    assert.ok(autoTeamRoom.memberIds.includes("asuka-native-reviewer"));
    assert.equal(autoTeamRoom.memberIds.includes("asuka-native-research"), false);
    assert.ok(autoTeamRoom.teamPlan.assignments.some((item) => item.decisionRole === "software_engineer"));
    assert.ok(completed.messages.some((message) => message.text.includes("NOVA 已按 automation 组建团队")));

    await native("/rooms/asuka-native-room", {
      method: "PATCH",
      body: JSON.stringify({
        memberIds: [...autoTeamRoom.memberIds, "asuka-native-design"],
        manualMemberIds: ["asuka-native-design"],
      }),
    });
    const manualTask = await native("/rooms/asuka-native-room/messages", {
      method: "POST",
      body: JSON.stringify({ text: "1", mode: "goal" }),
    }).then((response) => response.json());
    await waitForTask(asuka.origin, manualTask.threadId, ["completed"]);
    const manualSnapshot = await native("/snapshot").then((response) => response.json());
    const manualRoom = manualSnapshot.groups.find((group) => group.id === "asuka-native-room");
    assert.ok(manualRoom.memberIds.includes("asuka-native-design"));
    assert.equal(manualRoom.memberIds.includes("asuka-native-night"), false);
    assert.deepEqual(manualRoom.manualMemberIds, ["asuka-native-design"]);

    const marketTask = await native("/rooms/asuka-native-room/messages", {
      method: "POST",
      body: JSON.stringify({ text: "调研这个市场并分析竞品定价，给出证据、反证和进入建议。", mode: "goal" }),
    }).then((response) => response.json());
    const marketCompleted = await waitForTask(asuka.origin, marketTask.threadId, ["completed"]);
    const marketSnapshot = await native("/snapshot").then((response) => response.json());
    const marketRoom = marketSnapshot.groups.find((group) => group.id === "asuka-native-room");
    assert.ok(marketRoom.memberIds.includes("asuka-native-research"));
    assert.ok(marketRoom.memberIds.includes("asuka-native-design"));
    assert.equal(marketRoom.teamPlan.leadAgentId, "asuka-native-research");
    assert.ok(marketCompleted.messages.some((message) => message.from?.name === "ASUKA LENS"));
    assert.ok(provider.stats().executorSystems.some((system) => system.includes("ASUKA LENS")));
    assert.ok(provider.stats().reviewerInputs.some((input) => input.includes("Team contributions:") && input.includes("Tool evidence:")));

    const repairedTask = await native("/rooms/asuka-native-room/messages", {
      method: "POST",
      body: JSON.stringify({ text: "review-repair-test: produce the requested deliverable", mode: "goal" }),
    }).then((response) => response.json());
    const repaired = await waitForTask(asuka.origin, repairedTask.threadId, ["completed"]);
    assert.ok(repaired.messages.some((message) => message.text === "corrected final result"));
    assert.ok(repaired.messages.some((message) => message.text.includes("自动修正")));

    const degradedTask = await native("/rooms/asuka-native-room/messages", {
      method: "POST",
      body: JSON.stringify({ text: "invalid-review-json-test: deliver a useful result", mode: "goal" }),
    }).then((response) => response.json());
    const degraded = await waitForTask(asuka.origin, degradedTask.threadId, ["completed"]);
    assert.ok(degraded.messages.some((message) => message.text === "deliverable survives invalid review"));
    assert.ok(degraded.messages.some((message) => message.kind === "digest" && message.text.startsWith("DEGRADED:")));

    const secondaryProvider = await native("/native/provider", {
      method: "PUT",
      body: JSON.stringify({
        id: "native-provider-research",
        label: "Research API",
        kind: "openai-compatible",
        baseUrl: `${provider.origin}/v1`,
        model: "research-model",
        apiKey: "secret-research-key",
      }),
    }).then((response) => response.json());
    assert.equal(secondaryProvider.provider.id, "native-provider-research");
    await native("/agents/asuka-native-research", {
      method: "PATCH",
      body: JSON.stringify({ patch: { modelSelection: { instanceId: "native-provider-research", model: "research-model" } } }),
    });
    const assignedSnapshot = await native("/snapshot").then((response) => response.json());
    assert.equal(assignedSnapshot.instances.length, 2);
    assert.equal(assignedSnapshot.bots.find((bot) => bot.id === "asuka-native-research").modelSelection.instanceId, "native-provider-research");
    assert.equal(assignedSnapshot.bots.find((bot) => bot.id === "asuka-native-planner").modelSelection.instanceId, "native-provider");

    const secondaryTask = await native("/rooms/asuka-native-room/messages", {
      method: "POST",
      body: JSON.stringify({ text: "secondary-provider-test: prepare a research brief", mode: "goal", mentions: ["asuka-native-research"] }),
    }).then((response) => response.json());
    await waitForTask(asuka.origin, secondaryTask.threadId, ["completed"]);
    assert.equal(provider.stats().executorModels.at(-1), "research-model");
    assert.match(provider.stats().executorSystems.at(-1), /ASUKA LENS/);

    const createdRoom = await native("/rooms", {
      method: "POST",
      body: JSON.stringify({
        name: "Research Room",
        section: "ASUKA",
        setup: { bulletin: "Research tasks stay in this room." },
      }),
    }).then((response) => response.json());
    assert.match(createdRoom.group.id, /^asuka-room-/);
    assert.equal(createdRoom.group.name, "Research Room");
    assert.equal(createdRoom.group.memberIds.length, 9);

    const eventTask = await native("/events", {
      method: "POST",
      body: JSON.stringify({
        source: "test-webhook",
        type: "test.event",
        subject: "event-smoke",
        text: "整理一段简短的事件总台测试结果",
        roomId: createdRoom.group.id,
        dedupeKey: "event-smoke-1",
      }),
    }).then((response) => response.json());
    const duplicateEvent = await native("/events", {
      method: "POST",
      body: JSON.stringify({
        source: "test-webhook",
        type: "test.event",
        subject: "event-smoke",
        text: "整理一段简短的事件总台测试结果",
        roomId: createdRoom.group.id,
        dedupeKey: "event-smoke-1",
      }),
    }).then((response) => response.json());
    assert.equal(duplicateEvent.threadId, eventTask.threadId);
    assert.equal(duplicateEvent.deduplicated, true);
    await waitForTask(asuka.origin, eventTask.threadId, ["completed"]);
    const eventLog = await native(`/events?taskId=${eventTask.threadId}`).then((response) => response.json());
    assert.ok(eventLog.events.some((event) => event.type === "task.routed"));
    assert.ok(eventLog.events.some((event) => event.type === "task.completed"));

    const roomTask = await native(`/rooms/${createdRoom.group.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text: "整理当前项目的一份简短研究摘要", mode: "goal" }),
    }).then((response) => response.json());
    const roomCompleted = await waitForTask(asuka.origin, roomTask.threadId, ["completed"]);
    assert.equal(roomCompleted.task.roomId, createdRoom.group.id);
    const corrected = await native(`/tasks/${roomTask.threadId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text: "补充修正：保持 Room 与 Task 一一对应", mode: "goal" }),
    }).then((response) => response.json());
    assert.equal(corrected.threadId, roomTask.threadId);
    const correctedTask = await waitForTask(asuka.origin, roomTask.threadId, ["completed"]);
    assert.ok(correctedTask.messages.some((message) => message.text.includes("保持 Room 与 Task 一一对应")));
    const roomSnapshot = await native("/snapshot").then((response) => response.json());
    const researchGroup = roomSnapshot.groups.find((group) => group.id === createdRoom.group.id);
    const defaultGroup = roomSnapshot.groups.find((group) => group.id === "asuka-native-room");
    assert.equal(researchGroup.tasks.length, 1);
    assert.equal(researchGroup.tasks[0].threadId, roomTask.threadId);
    assert.equal(defaultGroup.tasks.some((task) => task.threadId === roomTask.threadId), false);

    await native(`/tasks/${roomTask.threadId}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    });
    const archivedRoomSnapshot = await native("/snapshot").then((response) => response.json());
    assert.equal(archivedRoomSnapshot.groups.find((group) => group.id === createdRoom.group.id).archived, true);
    await native(`/tasks/${roomTask.threadId}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: false }),
    });
    const restoredRoomSnapshot = await native("/snapshot").then((response) => response.json());
    assert.equal(restoredRoomSnapshot.groups.find((group) => group.id === createdRoom.group.id).archived, false);

    const fabric = await native("/fabric").then((response) => response.json());
    assert.equal(fabric.adapter, "native");
    assert.equal(new Set(fabric.tasks.map((task) => task.roomId)).size, fabric.tasks.length);

    const categorized = await native(`/tasks/${created.threadId}`, {
      method: "PATCH",
      body: JSON.stringify({ category: "research", archived: true }),
    }).then((response) => response.json());
    assert.equal(categorized.task.category, "research");
    assert.equal(categorized.task.archived, true);
    const archivedDetail = await native(`/tasks/${created.threadId}`).then((response) => response.json());
    assert.equal(archivedDetail.job.category, "research");
    assert.equal(archivedDetail.job.archived, true);
    const restored = await native(`/tasks/${created.threadId}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: false }),
    }).then((response) => response.json());
    assert.equal(restored.task.archived, false);

    const organized = await native(`/tasks/${created.threadId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "文件计数脚本", project: "asuka-core", pinned: true, unread: true }),
    }).then((response) => response.json());
    assert.equal(organized.task.title, "文件计数脚本");
    assert.equal(organized.task.project, "asuka-core");
    assert.equal(organized.task.pinned, true);
    assert.equal(organized.task.unread, true);

    const forked = await native(`/tasks/${created.threadId}/fork`, { method: "POST" }).then((response) => response.json());
    assert.notEqual(forked.threadId, created.threadId);
    assert.equal(forked.task.project, "asuka-core");
    assert.equal(forked.task.forkedFrom, created.threadId);
    assert.match(forked.task.title, /Fork$/);
    assert.equal(forked.task.requestText, "写一个简单的 PowerShell 脚本，输出当前目录文件数量");
    const deletedFork = await native(`/tasks/${forked.threadId}`, { method: "DELETE" });
    assert.equal(deletedFork.ok, true);
    const missingFork = await native(`/tasks/${forked.threadId}`);
    assert.equal(missingFork.ok, false);

    const beforeApproval = provider.stats().executorCalls;
    const gated = await native("/rooms/asuka-native-room/messages", {
      method: "POST",
      body: JSON.stringify({ text: "approval-test：在生产环境删除客户交易记录，并处理监管 PII 数据" }),
    }).then((response) => response.json());
    let gatedTask = await waitForTask(asuka.origin, gated.threadId, ["needs-input"]);
    assert.equal(gatedTask.job.stage, "person/answer");
    assert.ok(gatedTask.approvals.filter((approval) => approval.status === "pending").length >= 1);
    assert.equal(provider.stats().executorCalls, beforeApproval);
    for (const approval of gatedTask.approvals.filter((item) => item.status === "pending")) {
      await native(`/approvals/${gated.threadId}/respond`, {
        method: "POST",
        body: JSON.stringify({ requestId: approval.requestId, behavior: "allow" }),
      });
      gatedTask = await waitForTask(asuka.origin, gated.threadId, ["needs-input", "completed", "failed"]);
    }
    gatedTask = await waitForTask(asuka.origin, gated.threadId, ["completed"]);
    assert.ok(provider.stats().executorCalls > beforeApproval);

    const guided = await native("/rooms/asuka-native-room/messages", {
      method: "POST",
      body: JSON.stringify({ text: "guidance-test: inspect the current project" }),
    }).then((response) => response.json());
    await waitForTask(asuka.origin, guided.threadId, ["running"]);
    await native(`/tasks/${guided.threadId}/guidance`, {
      method: "POST",
      body: JSON.stringify({ text: "focus on tests" }),
    });
    const guidedTask = await waitForTask(asuka.origin, guided.threadId, ["completed"]);
    assert.equal(provider.stats().guidanceApplied, 1);
    assert.ok(guidedTask.messages.some((message) => message.kind === "guidance" && message.text === "focus on tests"));
    assert.ok(guidedTask.messages.some((message) => message.text === "guidance applied"));

    await native("/settings", { method: "PATCH", body: JSON.stringify({ general: { language: "en-US" } }) });
    const slow = await native("/rooms/asuka-native-room/messages", {
      method: "POST",
      body: JSON.stringify({ text: "slow-retry: 写一个最小脚本" }),
    }).then((response) => response.json());
    let slowTask = await waitForTask(asuka.origin, slow.threadId, ["running"]);
    for (let attempt = 0; attempt < 80 && !slowTask.messages.some((message) => message.text.includes("partial output")); attempt += 1) {
      await sleep(25);
      slowTask = await waitForTask(asuka.origin, slow.threadId, ["running", "cancelled"]);
    }
    assert.ok(slowTask.messages.some((message) => message.text.includes("partial output")), slowTask.messages.map((message) => `${message.from?.name || message.role}: ${message.text}`).join("\n"));
    await native(`/tasks/${slow.threadId}/stop`, { method: "POST", body: "{}" });
    const cancelled = await waitForTask(asuka.origin, slow.threadId, ["cancelled"]);
    assert.equal(cancelled.job.reason, "Stopped by user");
    assert.ok(cancelled.messages.some((message) => message.text.includes("partial output")));
    await native(`/tasks/${slow.threadId}/retry`, { method: "POST", body: "{}" });
    const retried = await waitForTask(asuka.origin, slow.threadId, ["completed"]);
    assert.ok(retried.messages.some((message) => message.text === "completed after retry"));
    assert.match(provider.stats().executorSystems.at(-1), /English/);
    assert.ok(retried.task.attempts >= 2);

    await asuka.close();
    asuka = null;
    const db = new DatabaseSync(databasePath);
    db.prepare("UPDATE native_tasks SET status = 'running' WHERE id = ?").run(slow.threadId);
    db.close();
    const recovered = new NativeAdapter({ dataDir, databasePath });
    const interrupted = recovered.getTask(slow.threadId);
    assert.equal(interrupted.job.state, "interrupted");
    assert.ok(interrupted.messages.some((message) => message.text.includes("restarted before")));
    assert.equal(recovered.snapshot().bots.find((bot) => bot.id === "asuka-native-research").modelSelection.instanceId, "native-provider-research");
    recovered.close();
  } finally {
    if (asuka) await asuka.close();
    await provider.close();
    await removeTempDir(dataDir);
  }
});
