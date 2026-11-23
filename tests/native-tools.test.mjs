import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { startAsukaServer } from "../server.mjs";
import { NativeAdapter } from "../server/native/native-adapter.mjs";
import { ToolManager } from "../server/tools/tool-manager.mjs";
import { AsukaSettingsStore } from "../server/settings-store.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function writeSse(response, payload) {
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function toolCall(response, id, name, args) {
  response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  writeSse(response, {
    choices: [{ delta: { tool_calls: [{ index: 0, id, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: "tool_calls" }],
  });
  response.write("data: [DONE]\n\n");
  response.end();
}

function textReply(response, text) {
  response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  writeSse(response, { choices: [{ delta: { content: text } }] });
  response.write("data: [DONE]\n\n");
  response.end();
}

async function waitForTask(origin, threadId, states, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(`${origin}/__asuka/core/tasks/${threadId}?limit=200`, { headers: { "x-asuka-adapter": "native" } });
    const task = await response.json();
    if (states.includes(task.job?.state)) return task;
    await sleep(25);
  }
  throw new Error(`timed out waiting for ${states.join(", ")}`);
}

function fakeMcpClient(calls, names, controlStatusText = "") {
  return {
    async listTools() {
      return [
        { name: "ControlStatus", description: "Read control state", annotations: { readOnlyHint: true, destructiveHint: false }, inputSchema: { type: "object", properties: {} } },
        { name: "Snapshot", description: "Read desktop", annotations: { readOnlyHint: true, destructiveHint: false }, inputSchema: { type: "object", properties: {} } },
        { name: "Click", description: "Click desktop", annotations: { readOnlyHint: false, destructiveHint: true }, inputSchema: { type: "object", properties: { loc: { type: "array" } } } },
        { name: "Type", description: "Type text", annotations: { readOnlyHint: false, destructiveHint: true }, inputSchema: { type: "object", properties: { text: { type: "string" } } } },
      ];
    },
    async callTool(name, args) {
      calls.push({ name, args });
      if (name === "ControlStatus" && controlStatusText && calls.filter((call) => call.name === "ControlStatus").length > 1) {
        return { content: [{ type: "text", text: controlStatusText }] };
      }
      if (name === "Snapshot" || name === "Screenshot") {
        return { content: [{ type: "text", text: "desktop ready" }, { type: "image", mimeType: "image/png", data: "iVBORw0KGgo=" }] };
      }
      return { content: [{ type: "text", text: `${name} ok` }] };
    },
    close() {},
  };
}

async function providerMock(names) {
  let seenTools = [];
  let contributorTools = [];
  let contributorCalls = 0;
  const server = http.createServer(async (request, response) => {
    if (request.method !== "POST" || !request.url?.endsWith("/chat/completions")) {
      response.writeHead(404).end("not found");
      return;
    }
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    if (body.tools?.length) seenTools = body.tools;
    const system = body.messages?.[0]?.content || "";
    if (system.includes("independent reviewer")) return textReply(response, JSON.stringify({ passed: true, summary: "Meets gates.", issues: [] }));
    const allUserText = (body.messages || []).filter((message) => message.role === "user").map((message) => typeof message.content === "string" ? message.content : JSON.stringify(message.content)).join("\n");
    const toolResults = body.messages?.filter((message) => message.role === "tool") || [];
    if (system.includes("assigned by NOVA to one team phase")) {
      contributorCalls += 1;
      contributorTools = body.tools || [];
      if (allUserText.includes("empty-contributor-test")) return textReply(response, "");
      return textReply(response, JSON.stringify({
        status: "done",
        summary: "specialist contribution for the market task",
        artifacts: [{ type: "text", title: "Specialist evidence", content: "Contributor used its Agent Kernel thread." }],
        evidence: toolResults.length ? ["contributor ControlStatus tool result"] : [],
        issues: [],
        nextAction: "",
      }));
    }
    const firstUser = body.messages?.find((message) => message.role === "user")?.content || "";
    const prompt = typeof firstUser === "string" ? firstUser : JSON.stringify(firstUser);
    if (prompt.includes("empty-contributor-test")) return textReply(response, "lead delivered after optional contributor failure");
    if (prompt.includes("user-control-test")) {
      return toolCall(response, `call_status_${toolResults.length}`, names.ControlStatus, {});
    }
    if (prompt.includes("safe-tool")) {
      if (!toolResults.length) return toolCall(response, "call_status", names.ControlStatus, {});
      return textReply(response, "safe tool complete");
    }
    if (prompt.includes("approval-tool") || prompt.includes("approval-market-test")) {
      if (!toolResults.some((message) => message.content?.includes("desktop ready"))) return toolCall(response, "call_snapshot", names.Snapshot, { use_vision: true });
      if (!toolResults.some((message) => message.content?.includes("Click ok"))) return toolCall(response, "call_click", names.Click, { loc: [10, 20] });
      return textReply(response, "approved click complete");
    }
    if (prompt.includes("deny-tool")) {
      if (!toolResults.some((message) => message.content?.includes("desktop ready"))) return toolCall(response, "call_snapshot", names.Snapshot, { use_vision: true });
      if (!toolResults.some((message) => message.content?.includes("Type ok"))) return toolCall(response, "call_type", names.Type, { text: "secret" });
      return textReply(response, "denied tool continued");
    }
    return textReply(response, "plain response");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    origin: `http://127.0.0.1:${address.port}`,
    tools: () => seenTools,
    stats: () => ({ contributorCalls, contributorTools }),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("Native agent discovers MCP tools, executes safe calls, and gates Computer Use actions", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-native-tools-"));
  const calls = [];
  const manager = new ToolManager({
    dataDir,
    databasePath: join(dataDir, "tools.sqlite"),
    windowsMcpCommand: join(dataDir, "missing.exe"),
    clientFactory: () => fakeMcpClient(calls, {}, '{"state":"user","generation":2}'),
  });
  manager.saveServer({ id: "windows-mcp", name: "Windows MCP", command: process.execPath, args: [], env: {} });
  const catalog = await manager.listModelTools();
  const names = Object.fromEntries(catalog.tools.map((tool) => {
    const match = / \/ ([^:]+):/.exec(tool.description || "");
    return [match?.[1] || tool.name, tool.name];
  }));
  const provider = await providerMock(names);
  let asuka;
  try {
    asuka = await startAsukaServer({ port: 0, dataDir, toolManager: manager, nativeDatabasePath: join(dataDir, "native.sqlite") });
    const native = (path, options = {}) => fetch(`${asuka.origin}/__asuka/core${path}`, {
      ...options,
      headers: { "x-asuka-adapter": "native", ...(options.body ? { "content-type": "application/json" } : {}), ...options.headers },
    });
    await native("/native/provider", {
      method: "PUT",
      body: JSON.stringify({ kind: "openai-compatible", baseUrl: `${provider.origin}/v1`, model: "mock-model", apiKey: "tool-key" }),
    });

    const safe = await native("/rooms/asuka-native-room/messages", { method: "POST", body: JSON.stringify({ text: "safe-tool: inspect desktop control status" }) }).then((response) => response.json());
    const safeTask = await waitForTask(asuka.origin, safe.threadId, ["completed"]);
    assert.ok(calls.some((call) => call.name === "ControlStatus"));
    assert.ok(provider.tools().some((tool) => tool.function?.name === names.ControlStatus));
    assert.ok(safeTask.messages.some((message) => message.text === "safe tool complete"));

    const contributorsBeforeMarket = provider.stats().contributorCalls;
    const marketGated = await native("/rooms/asuka-native-room/messages", {
      method: "POST",
      body: JSON.stringify({ text: "approval-market-test: 市场调研期间调用 browser skill，并 click the target" }),
    }).then((response) => response.json());
    const marketWaiting = await waitForTask(asuka.origin, marketGated.threadId, ["needs-input"]);
    const marketApproval = marketWaiting.approvals.find((item) => item.status === "pending");
    await native(`/approvals/${marketGated.threadId}/respond`, { method: "POST", body: JSON.stringify({ requestId: marketApproval.requestId, behavior: "allow" }) });
    const marketClicked = await waitForTask(asuka.origin, marketGated.threadId, ["completed"]);
    assert.ok(marketClicked.messages.some((message) => message.text === "approved click complete"));
    assert.ok(provider.stats().contributorCalls >= contributorsBeforeMarket + 1);
    assert.ok(marketClicked.job.agentKernel.threads.some((thread) => thread.toolCalls === 0));
    assert.equal(provider.stats().contributorTools.length, 0);
    const kernelThread = marketClicked.job.agentKernel.threads.find((thread) => thread.toolCalls === 0);
    const kernelDetail = await native(`/agents/${kernelThread.botId}/kernel?taskId=${marketGated.threadId}`).then((response) => response.json());
    assert.equal(kernelDetail.thread.status, "completed", JSON.stringify(kernelDetail.thread.events.slice(-8)));
    assert.equal(kernelDetail.thread.messages.some((message) => message.role === "tool"), false);

    const optionalFailure = await native("/rooms/asuka-native-room/messages", {
      method: "POST",
      body: JSON.stringify({ text: "empty-contributor-test: market analysis with browser skill and report" }),
    }).then((response) => response.json());
    const optionalRecovered = await waitForTask(asuka.origin, optionalFailure.threadId, ["completed"]);
    assert.ok(optionalRecovered.messages.some((message) => message.text.includes("lead delivered after optional contributor failure")));
    assert.ok(optionalRecovered.messages.some((message) => /未产出独立贡献|No separate contribution/i.test(message.text)));

    const blocked = await native("/rooms/asuka-native-room/messages", {
      method: "POST",
      body: JSON.stringify({ text: "user-control-test: open the browser for me" }),
    }).then((response) => response.json());
    const blockedTask = await waitForTask(asuka.origin, blocked.threadId, ["needs-input"]);
    assert.match(blockedTask.job.reason, /用户控制|user control/i);
    assert.ok(blockedTask.messages.some((message) => /用户控制|user control/i.test(message.text)));
    assert.equal(blockedTask.messages.some((message) => message.text.includes("MCP tool round limit")), false);

    const clicksBeforeGated = calls.filter((call) => call.name === "Click").length;
    const gated = await native("/rooms/asuka-native-room/messages", { method: "POST", body: JSON.stringify({ text: "approval-tool: click the target" }) }).then((response) => response.json());
    const waiting = await waitForTask(asuka.origin, gated.threadId, ["needs-input"]);
    assert.equal(calls.filter((call) => call.name === "Click").length, clicksBeforeGated);
    const approval = waiting.approvals.find((item) => item.status === "pending");
    assert.ok(approval);
    await native(`/approvals/${gated.threadId}/respond`, { method: "POST", body: JSON.stringify({ requestId: approval.requestId, behavior: "allow" }) });
    const clicked = await waitForTask(asuka.origin, gated.threadId, ["completed"]);
    assert.deepEqual(calls.find((call) => call.name === "Click")?.args, { loc: [10, 20] });
    assert.ok(calls.some((call) => call.name === "Snapshot"));
    assert.ok(clicked.messages.some((message) => message.text === "approved click complete"));

    const denied = await native("/rooms/asuka-native-room/messages", { method: "POST", body: JSON.stringify({ text: "deny-tool: type into the target" }) }).then((response) => response.json());
    const deniedWaiting = await waitForTask(asuka.origin, denied.threadId, ["needs-input"]);
    const deniedApproval = deniedWaiting.approvals.find((item) => item.status === "pending");
    await native(`/approvals/${denied.threadId}/respond`, { method: "POST", body: JSON.stringify({ requestId: deniedApproval.requestId, behavior: "deny" }) });
    await waitForTask(asuka.origin, denied.threadId, ["cancelled"]);
    assert.equal(calls.some((call) => call.name === "Type"), false);
    assert.ok(manager.listAudit().some((entry) => entry.taskId === safe.threadId && entry.status === "ok"));
  } finally {
    if (asuka) await asuka.close();
    manager.close();
    await provider.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("Full Access exposes audited local commands and bypasses one-time tool approvals", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-full-access-"));
  const settingsStore = new AsukaSettingsStore({ dataDir, defaultWorkspace: dataDir });
  settingsStore.update({ permissions: { fullAccess: true } });
  const manager = new ToolManager({
    dataDir,
    databasePath: join(dataDir, "tools.sqlite"),
    settingsStore,
    windowsMcpCommand: join(dataDir, "missing.exe"),
  });
  try {
    const catalog = await manager.listModelTools();
    assert.ok(catalog.tools.some((tool) => tool.name === "local_command"));
    const execution = await manager.callModel({
      modelName: "local_command",
      args: { command: "node -e \"console.log('full-access-ok')\"", cwd: dataDir },
    });
    assert.match(execution.result.content[0].text, /full-access-ok/);
    assert.equal(manager.approvalRequired({ serverId: "browser-skill", name: "browser_skill_session" }, { action: "start" }), false);
    const approval = await manager.createApproval({
      id: "full-access-no-approval",
      serverId: "browser-skill",
      toolName: "browser_skill_session",
      args: { action: "start" },
    });
    assert.equal(approval, null);
    assert.ok(manager.listAudit().some((entry) => entry.serverId === "local-command" && entry.status === "ok"));
  } finally {
    manager.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("Native adapter reuses the task browser session instead of requesting another session", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-browser-session-reuse-"));
  let browserCalls = 0;
  const browserCallNames = [];
  const browserSkill = {
    tools() {
      return ["browser_skill_session", "browser_skill_open", "browser_skill_navigate", "browser_skill_sync"].map((name) => ({
        name,
        modelName: name,
        description: name,
        inputSchema: { type: "object", properties: {} },
        risk: name === "browser_skill_session" ? "confirm" : "safe",
        builtin: true,
        serverId: "browser-skill",
        serverName: "BrowserSkill CLI",
      }));
    },
    riskFor(name) {
      return name === "browser_skill_session" ? "confirm" : "safe";
    },
    async call(name) {
      browserCalls += 1;
      browserCallNames.push(name);
      return { content: [{ type: "text", text: JSON.stringify({ name, session_id: "session-new" }) }] };
    },
  };
  const manager = new ToolManager({
    dataDir,
    databasePath: join(dataDir, "tools.sqlite"),
    windowsMcpCommand: join(dataDir, "missing.exe"),
    browserSkill,
  });
  const adapter = new NativeAdapter({
    dataDir,
    databasePath: join(dataDir, "native.sqlite"),
    toolManager: manager,
  });
  try {
    const task = adapter.store.createTask({ title: "Browser session reuse", requestText: "research" });
    adapter.store.appendModelMessage(task.id, {
      role: "assistant",
      content: "",
      tool_calls: [
        { id: "call-session-2", name: "browser_skill_session", arguments: JSON.stringify({ action: "start" }) },
        { id: "call-open-2", name: "browser_skill_open", arguments: JSON.stringify({ url: "https://example.com" }) },
      ],
    });
    const result = await adapter.executePendingToolCalls(task.id, task, new AbortController(), {
      browserSessions: new Set(["session-existing"]),
      browserEvidence: null,
    });
    assert.equal(result.handled, true);
    assert.equal(result.approvalCreated, false);
    assert.equal(browserCalls, 2);
    assert.deepEqual(browserCallNames, ["browser_skill_navigate", "browser_skill_sync"]);
    assert.equal(adapter.store.listApprovals(task.id).length, 0);
    assert.ok(adapter.store.listModelMessages(task.id).some((message) => message.role === "tool" && message.content.includes("session-existing")));
  } finally {
    adapter.close();
    manager.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
