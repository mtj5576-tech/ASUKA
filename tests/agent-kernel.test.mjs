import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { AgentKernel, policyForAgent } from "../server/kernel/index.mjs";
import { NativeStore } from "../server/native/store.mjs";

const AGENT = { id: "asuka-native-research", name: "ASUKA LENS", roleLabel: "领域专家/流程负责人" };

function fakeToolManager(calls, risk = "safe") {
  return {
    async resolveModelTool(name) {
      return { name, serverId: "mock", toolName: name };
    },
    riskForTool() {
      return risk;
    },
    async callModel({ modelName, args }) {
      calls.push({ modelName, args });
      return { result: { content: [{ type: "text", text: "tool evidence from kernel" }] }, durationMs: 4 };
    },
  };
}

test("primary Agent Kernel runs a persistent tool loop and records evidence", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-agent-kernel-"));
  const store = new NativeStore(join(dataDir, "native.sqlite"));
  const toolCalls = [];
  let modelTurn = 0;
  const kernel = new AgentKernel({
    store,
    toolManager: fakeToolManager(toolCalls),
    clientForAgent: () => ({
      async generate() {
        modelTurn += 1;
        if (modelTurn === 1) {
          return { text: "", toolCalls: [{ id: "call-1", name: "mock_search", arguments: "{\"q\":\"evidence\"}" }] };
        }
        return { text: "{\"status\":\"done\",\"summary\":\"Kernel completed\",\"evidence\":[\"tool evidence from kernel\"]}", toolCalls: [] };
      },
    }),
  });
  try {
    const result = await kernel.run({
      taskId: "task-1",
      agent: AGENT,
      purpose: "executor",
      system: "test contributor",
      messages: [{ role: "user", content: "collect evidence" }],
      tools: [{ type: "function", name: "mock_search", description: "search", parameters: { type: "object" } }],
      policy: policyForAgent(AGENT, { purpose: "executor" }),
    });

    assert.equal(result.status, "completed");
    assert.match(result.output, /Kernel completed/);
    assert.equal(toolCalls.length, 1);
    assert.equal(toolCalls[0].modelName, "mock_search");
    assert.equal(result.thread.toolCalls, 1);

    const persisted = kernel.readThread("task-1", AGENT.id, "executor");
    assert.equal(persisted.status, "completed");
    assert.ok(persisted.messages.some((message) => message.role === "tool" && message.content.includes("tool evidence")));
    assert.ok(persisted.events.some((event) => event.type === "turn.completed"));
    assert.deepEqual(kernel.listThreads("task-1").map((thread) => thread.botId), [AGENT.id]);
  } finally {
    store.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("contributor Agent Kernel stays advisory, ignores tools and bounds output", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-agent-kernel-policy-"));
  const store = new NativeStore(join(dataDir, "native.sqlite"));
  const toolCalls = [];
  let modelTurn = 0;
  const kernel = new AgentKernel({
    store,
    toolManager: fakeToolManager(toolCalls, "confirm"),
    clientForAgent: () => ({
      async generate() {
        modelTurn += 1;
        return { text: `{\"status\":\"done\",\"summary\":\"${"x".repeat(5_000)}\"}` , toolCalls: [{ id: "call-confirm", name: "mock_write", arguments: "{}" }] };
      },
    }),
  });
  try {
    const result = await kernel.run({
      taskId: "task-policy",
      agent: AGENT,
      purpose: "contributor",
      messages: [{ role: "user", content: "change something" }],
      tools: [{ type: "function", name: "mock_write", description: "write", parameters: { type: "object" } }],
    });
    assert.equal(toolCalls.length, 0);
    assert.equal(result.status, "completed");
    assert.ok(result.output.length <= policyForAgent(AGENT, { purpose: "contributor" }).maxOutputChars);
    const persisted = kernel.readThread("task-policy", AGENT.id, "contributor");
    assert.equal(persisted.stats.toolCalls, 0);
    assert.ok(persisted.events.some((event) => event.type === "output.bounded"));
  } finally {
    store.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("Agent Kernel marks unfinished Bot threads interrupted after restart", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-agent-kernel-restart-"));
  const store = new NativeStore(join(dataDir, "native.sqlite"));
  try {
    const policy = policyForAgent(AGENT, { purpose: "contributor" });
    const first = new AgentKernel({
      store,
      clientForAgent: () => ({ async generate() { return { text: "unused", toolCalls: [] }; } }),
    });
    const thread = first.ensureThread({ taskId: "task-restart", agent: AGENT, purpose: "contributor", policy });
    thread.status = "running";
    store.putEntity("agent-kernel-thread", thread.id, thread);

    const restarted = new AgentKernel({
      store,
      clientForAgent: () => ({ async generate() { return { text: "unused", toolCalls: [] }; } }),
    });
    const recovered = restarted.readThread("task-restart", AGENT.id, "contributor");
    assert.equal(recovered.status, "interrupted");
    assert.match(recovered.lastError, /restarted/i);
    assert.ok(recovered.events.some((event) => event.type === "thread.interrupted"));
  } finally {
    store.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
