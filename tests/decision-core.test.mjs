import assert from "node:assert/strict";
import { test } from "node:test";

import { createDecisionRecord } from "../server/core/decision-engine.mjs";
import { decisionRecordSchema, taskEnvelopeSchema } from "../shared/decision/contracts.mjs";

const allRoles = ["product_owner", "domain_expert", "ai_engineer", "data_engineer", "software_engineer", "evaluator", "platform_security", "product_designer", "delivery_lead"];

test("Decision Core is deterministic for the same normalized task", () => {
  const input = {
    id: "task-deterministic",
    objective: "为客服团队构建一个 RAG 知识库 Agent，接入 CRM API，并提供黄金测试集",
    context: "最终进入生产环境，客服需要审核回答",
    requestedOutputs: ["可运行服务", "黄金测试集", "验收报告"],
    autonomy: "execute",
    assessmentHints: { production: true, customerData: true, userFacing: true },
    capabilities: { roles: allRoles },
  };
  const first = createDecisionRecord(input);
  const second = createDecisionRecord(structuredClone(input));
  assert.deepEqual(first, second);
  assert.equal(first.decisionId, second.decisionId);
  assert.equal(first.planHash, second.planHash);
  assert.match(first.planHash, /^[a-f0-9]{64}$/);
  assert.equal(decisionRecordSchema.safeParse(first).success, true);
});

test("small tasks choose a compact team instead of all nine roles", () => {
  const decision = createDecisionRecord({
    id: "task-small-script",
    objective: "写一个 PowerShell 脚本，把一个目录里的 CSV 文件改名",
    constraints: ["不需要界面"],
    requestedOutputs: ["脚本", "使用说明"],
    capabilities: { roles: allRoles },
  });
  assert.equal(decision.plan.scale, "S");
  assert.ok(decision.plan.roles.length <= 3);
  assert.deepEqual(decision.plan.roles.map((role) => role.role), ["product_owner", "software_engineer", "evaluator"]);
});

test("equivalent small automation tasks keep the same role combination", () => {
  const first = createDecisionRecord({ id: "a", objective: "写一个脚本批量重命名图片文件", capabilities: { roles: allRoles } });
  const second = createDecisionRecord({ id: "b", objective: "写一个脚本批量整理下载目录里的文件名", capabilities: { roles: allRoles } });
  assert.equal(first.plan.taskType, second.plan.taskType);
  assert.deepEqual(first.plan.roles.map((role) => role.role), second.plan.roles.map((role) => role.role));
});

test("browser and desktop actions route to a tool-capable automation team", () => {
  const decision = createDecisionRecord({
    id: "task-browser-action",
    objective: "使用 browser skill 打开浏览器并完成页面任务",
    requestedOutputs: ["完成结果", "关键证据"],
    capabilities: { roles: allRoles },
  });
  const roles = decision.plan.roles.map((role) => role.role);
  assert.equal(decision.plan.taskType, "automation");
  assert.ok(roles.includes("software_engineer"));
  assert.ok(decision.plan.workflow.some((step) => step.ownerRole === "software_engineer"));
});

test("browser-assisted market research keeps the market deliverable as the primary task", () => {
  const decision = createDecisionRecord({
    id: "task-browser-market",
    objective: "肯尼亚衣柜和橱柜市场考察：调用 browser skill 访问原始来源，分析竞争、价格与进入建议并生成报告",
    capabilities: { roles: allRoles, tools: ["mcp"] },
  });
  const roles = decision.plan.roles.map((role) => role.role);
  assert.equal(decision.plan.taskType, "market_analysis");
  assert.ok(roles.includes("domain_expert"));
  assert.ok(roles.includes("software_engineer"));
});

test("regulated financial data work forces security, data and approval gates", () => {
  const decision = createDecisionRecord({
    id: "task-regulated-payment",
    objective: "构建生产支付数据管道，处理客户 PII，并允许在异常时删除交易记录",
    context: "需要满足监管审计和权限隔离",
    autonomy: "unattended",
    assessmentHints: { production: true, customerData: true, financial: true, regulated: true, irreversibleActions: true },
    capabilities: { roles: ["product_owner", "evaluator"] },
  });
  const roles = decision.plan.roles.map((role) => role.role);
  assert.ok(["L", "XL"].includes(decision.plan.scale));
  assert.ok(roles.includes("platform_security"));
  assert.ok(roles.includes("data_engineer"));
  assert.ok(decision.plan.approvalRequests.some((approval) => approval.trigger === "sensitive_data"));
  assert.ok(decision.plan.approvalRequests.some((approval) => approval.trigger === "irreversible_action"));
  assert.ok(decision.plan.evaluationGates.some((gate) => gate.id === "gate-security"));
  assert.deepEqual(decision.plan.capabilityGaps.sort(), roles.filter((role) => !["product_owner", "evaluator"].includes(role)).sort());
});

test("TaskEnvelope rejects malformed input and unsupported capabilities", () => {
  assert.equal(taskEnvelopeSchema.safeParse({ id: "x" }).success, false);
  assert.equal(taskEnvelopeSchema.safeParse({ id: "x", objective: "test", capabilities: { roles: ["unknown-role"] } }).success, false);
});
