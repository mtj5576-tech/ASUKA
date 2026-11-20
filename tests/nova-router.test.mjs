import assert from "node:assert/strict";
import { test } from "node:test";

import { TaskRouter } from "../server/native/task-router.mjs";
import { parseWorkerContract } from "../server/native/worker-contracts.mjs";

const agents = [
  { id: "nova", name: "NOVA", roleLabel: "ASUKA 中台", isOrchestrator: true },
  { id: "lens", name: "LENS", roleLabel: "领域专家" },
  { id: "bloom", name: "BLOOM", roleLabel: "产品设计师" },
  { id: "luna", name: "LUNA", roleLabel: "软件工程师" },
  { id: "guard", name: "GUARD", roleLabel: "评测与质量" },
  { id: "sprout", name: "SPROUT", roleLabel: "交付负责人" },
  { id: "relay", name: "RELAY", roleLabel: "平台与安全" },
];

const router = new TaskRouter({
  orchestratorId: "nova",
  fallbackWorkerId: "luna",
  roleAgent: {
    product_owner: "sprout",
    domain_expert: "lens",
    product_designer: "bloom",
    ai_engineer: "luna",
    data_engineer: "relay",
    software_engineer: "luna",
    evaluator: "guard",
    platform_security: "relay",
    delivery_lead: "sprout",
  },
  leadByTaskType: { market_analysis: "lens", automation: "luna" },
});

test("NOVA routes market work to one primary worker and never becomes a worker", () => {
  const route = router.route({
    taskId: "task-market",
    text: "肯尼亚衣柜市场调研，调用 browser skill 并生成报告",
    room: { manualMemberIds: [] },
    targetAgentId: "nova",
    providerId: "native-provider",
    agents,
  });
  assert.equal(route.orchestrated, true);
  assert.equal(route.primaryWorkerId, "lens");
  assert.ok(route.assignments.length >= 2);
  assert.equal(route.assignments.some((assignment) => assignment.agentId === "nova"), false);
  assert.ok(route.memberIds.includes("nova"));
});

test("explicit worker targeting bypasses NOVA team assembly", () => {
  const route = router.route({
    taskId: "task-direct",
    text: "整理一段简短说明",
    room: { manualMemberIds: [] },
    targetAgentId: "luna",
    providerId: "native-provider",
    agents,
  });
  assert.equal(route.orchestrated, false);
  assert.equal(route.primaryWorkerId, "luna");
  assert.deepEqual(route.assignments, []);
});

test("worker contracts preserve structured output and degrade prose safely", () => {
  const structured = parseWorkerContract(JSON.stringify({
    status: "done",
    summary: "Pricing table prepared",
    artifacts: [{ type: "table", title: "Price bands", content: "low|mid|high" }],
    evidence: ["https://example.com/report"],
    issues: [],
  }), { taskId: "task", agent: agents[2], assignment: { decisionRole: "product_designer", roleLabel: "设计" } });
  assert.equal(structured.status, "done");
  assert.equal(structured.artifacts[0].type, "table");
  assert.equal(structured.evidence.length, 1);

  const prose = parseWorkerContract("A plain but useful specialist note.", { taskId: "task", agent: agents[2], assignment: { decisionRole: "product_designer" } });
  assert.equal(prose.status, "done");
  assert.match(prose.warnings[0], /prose/);
  assert.match(prose.artifacts[0].content, /plain but useful/);

  const failed = parseWorkerContract("", { taskId: "task", agent: agents[2], assignment: {}, reason: "timeout" });
  assert.equal(failed.status, "failed");
  assert.match(failed.issues[0], /timeout/);
});
