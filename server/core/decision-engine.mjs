import { createHash } from "node:crypto";

import {
  DECISION_CORE_VERSION,
  RISK_TAGS,
  ROLE_IDS,
  SCALE_LEVELS,
  decisionRecordSchema,
  taskEnvelopeSchema,
  teamPlanSchema,
} from "../../shared/decision/contracts.mjs";
import { ROLE_BY_ID, ROLE_MANIFESTS } from "../../shared/decision/roles.mjs";

const TASK_KEYWORDS = {
  ai_product: ["ai", "人工智能", "agent", "智能体", "llm", "大模型", "rag", "微调", "embedding", "推理服务", "prompt"],
  data_pipeline: ["数据管道", "etl", "数据仓库", "data pipeline", "dataset", "数据质量", "标注", "lineage", "血缘"],
  software: ["软件", "应用", "app", "api", "前端", "后端", "系统", "网站", "平台", "database", "数据库", "部署"],
  automation: ["自动化", "automat", "脚本", "script", "爬虫", "crawler", "定时", "scheduled", "workflow", "浏览器", "browser", "打开", "launch", "点击", "click", "鼠标", "mouse", "桌面", "desktop", "computer use", "bsk", "browser skill", "应用"],
  research: ["研究", "调研", "分析", "report", "evidence", "来源", "literature", "interview"],
  market_analysis: ["市场", "market", "competitor", "竞品", "定价", "pricing", "销售", "sales", "客户", "customer", "外贸", "渠道"],
  content: ["文章", "视频", "文案", "ppt", "演示", "presentation", "content"],
  operations: ["运营", "流程", "供应链", "采购", "交付", "客服", "support"],
};

const TASK_TYPE_ORDER = ["ai_product", "data_pipeline", "software", "automation", "research", "market_analysis", "content", "operations"];
const SCALE_RANK = Object.fromEntries(SCALE_LEVELS.map((level, index) => [level, index]));
const SCALE_LIMITS = { S: 3, M: 6, L: 8, XL: 9 };
const ROLE_ORDER = Object.fromEntries(ROLE_MANIFESTS.map((role) => [role.id, role.priority]));

const RISK_KEYWORDS = {
  irreversible_actions: ["删除", "delete", "付款", "支付", "payment", "转账", "发送", "publish", "发布", "清理", "drop table"],
  sensitive_data: ["客户数据", "personal data", "pii", "隐私", "privacy", "财务数据", "医疗", "credential", "密钥", "secret"],
  external_integration: ["api", "webhook", "oauth", "第三方", "integration", "集成", "数据库连接"],
  financial: ["金融", "financial", "交易", "trading", "invoice", "账务", "预算", "cost"],
  production: ["生产环境", "production", "上线", "launch", "release", "客户使用"],
  regulated: ["合规", "regulated", "gdpr", "监管", "license", "许可", "安全审查"],
  security: ["权限", "security", "安全", "审计", "access control", "rbac", "认证"],
  user_facing: ["用户", "user", "客户", "界面", "ui", "ux", "体验"],
  model_uncertainty: ["准确率", "accuracy", "hallucination", "幻觉", "评测", "evaluation", "模型效果"],
};

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function clamp(value, min = 0, max = 3) {
  return Math.max(min, Math.min(max, value));
}

function matches(text, keyword) {
  const needle = keyword.toLowerCase();
  if (/^[a-z0-9]{1,4}$/.test(needle)) {
    return new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(text);
  }
  return text.includes(needle);
}

function hasAny(text, keywords) {
  return keywords.some((keyword) => matches(text, keyword));
}

function normalizeTask(input) {
  const parsed = taskEnvelopeSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".") || "task"}: ${issue.message}`).join("; "));
  return parsed.data;
}

function fullText(task) {
  return [task.objective, task.context, ...task.constraints, ...task.requestedOutputs].join("\n").toLowerCase();
}

export function classifyTask(task) {
  const text = fullText(task);
  if (task.assessmentHints.taskType) {
    return { taskType: task.assessmentHints.taskType, confidence: 0.98, scores: Object.fromEntries(TASK_TYPE_ORDER.map((type) => [type, type === task.assessmentHints.taskType ? 1 : 0])), reason: "用户提供了显式任务类型" };
  }
  const scores = Object.fromEntries(TASK_TYPE_ORDER.map((type) => [type, TASK_KEYWORDS[type].filter((keyword) => matches(text, keyword)).length]));
  let taskType = "unknown";
  let top = 0;
  for (const type of TASK_TYPE_ORDER) {
    if (scores[type] > top) {
      taskType = type;
      top = scores[type];
    }
  }
  const evidenceTask = scores.market_analysis > 0 ? "market_analysis" : scores.research > 0 ? "research" : "";
  const browserAsMethod = evidenceTask
    && hasAny(text, ["browser skill", "browser", "bsk", "浏览器", "scrape", "抓取"])
    && !hasAny(text, ["自动化", "automat", "脚本", "script", "爬虫", "crawler", "workflow"]);
  if (browserAsMethod) {
    taskType = evidenceTask;
    top = Math.max(1, scores[evidenceTask]);
  }
  return { taskType, confidence: taskType === "unknown" ? 0.3 : Math.min(0.92, 0.55 + top * 0.05), scores, reason: taskType === "unknown" ? "没有命中稳定的任务类型特征" : `命中 ${top} 个 ${taskType} 特征` };
}

function detectRisks(task, taskType) {
  const text = fullText(task);
  const hints = task.assessmentHints;
  const found = new Map();
  for (const risk of RISK_TAGS) if (hasAny(text, RISK_KEYWORDS[risk])) found.set(risk, `输入包含 ${risk} 风险特征`);
  if (hints.production) found.set("production", "用户标记为生产环境");
  if (hints.customerData) found.set("sensitive_data", "用户标记包含客户数据");
  if (hints.financial) found.set("financial", "用户标记为金融或资金相关");
  if (hints.regulated) found.set("regulated", "用户标记受监管");
  if (hints.publicRelease) found.set("production", "用户标记将公开发布");
  if (hints.irreversibleActions) found.set("irreversible_actions", "用户标记包含不可逆动作");
  if (hints.userFacing) found.set("user_facing", "用户标记面向终端用户");
  if (taskType === "ai_product") found.set("model_uncertainty", "AI 产品需要效果与回归评测");
  if (taskType === "data_pipeline" || hints.customerData) found.set("sensitive_data", found.get("sensitive_data") || "数据处理需要权限与血缘控制");
  if (taskType === "software" || taskType === "ai_product") found.set("external_integration", found.get("external_integration") || "系统实现通常涉及外部接口");
  return RISK_TAGS.filter((risk) => found.has(risk));
}

function baseScores(task, taskType, risks) {
  const text = fullText(task);
  const hints = task.assessmentHints;
  const scores = { impact: 0, dataSensitivity: 0, integrationComplexity: 0, autonomy: 0, duration: 0, stakeholderComplexity: 0 };
  const bump = (key, amount) => { scores[key] = clamp(scores[key] + amount); };
  if (["ai_product", "software", "market_analysis"].includes(taskType)) bump("impact", 1);
  if (["production", "financial", "user_facing"].some((risk) => risks.includes(risk))) bump("impact", 1);
  if (hints.publicRelease || hints.production) bump("impact", 1);
  if (risks.includes("sensitive_data") || risks.includes("regulated")) bump("dataSensitivity", 2);
  else if (taskType === "data_pipeline") bump("dataSensitivity", 1);
  if (risks.includes("external_integration")) bump("integrationComplexity", 1);
  if (["software", "ai_product"].includes(taskType)) bump("integrationComplexity", 1);
  if (task.autonomy === "execute") bump("autonomy", 1);
  if (task.autonomy === "unattended") bump("autonomy", 2);
  if (hasAny(text, ["tool", "shell", "mcp", "browser", "api call"])) bump("autonomy", 1);
  if (task.deadline) bump("duration", 1);
  if (hasAny(text, ["migration", "multi-week", "多周", "long-term", "长期", "series", "phase"])) bump("duration", 2);
  if (hints.multiTeam || hasAny(text, ["team", "团队", "stakeholder", "跨部门", "enterprise"])) bump("stakeholderComplexity", 2);
  scores.total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  return scores;
}

function levelForScore(total) {
  if (total <= 5) return "S";
  if (total <= 10) return "M";
  if (total <= 15) return "L";
  return "XL";
}

function applyRiskUplift(level, risks, scores) {
  let next = level;
  const reasons = [];
  const raise = (target, reason) => {
    if (SCALE_RANK[target] > SCALE_RANK[next]) {
      next = target;
      reasons.push(reason);
    }
  };
  if (["irreversible_actions", "sensitive_data", "security"].some((risk) => risks.includes(risk)) && next === "S") raise("M", "高风险动作至少需要 M 级团队");
  if (["regulated", "financial"].some((risk) => risks.includes(risk)) && SCALE_RANK[next] < SCALE_RANK.L) raise("L", "受监管或资金风险至少需要 L 级团队");
  if (risks.length >= 4 && SCALE_RANK[next] < SCALE_RANK.L) raise("L", "多个风险叠加至少需要 L 级团队");
  if (risks.length >= 6) raise("XL", "风险面覆盖多个职能，需要 XL 级协调");
  if (scores.autonomy === 3 && risks.includes("irreversible_actions") && SCALE_RANK[next] < SCALE_RANK.L) raise("L", "无人值守且包含不可逆动作");
  return { level: next, reasons };
}

function requestedRoles(task, taskType, scale, risks, scores) {
  const map = new Map();
  const request = (role, required, reason) => {
    const current = map.get(role);
    if (!current) map.set(role, { role, required, reasons: [reason] });
    else {
      current.required ||= required;
      if (!current.reasons.includes(reason)) current.reasons.push(reason);
    }
  };
  request("product_owner", true, "任何任务都需要场景、成功指标和停止条件");
  request("evaluator", true, "交付物必须经过独立验收门");

  if (taskType === "ai_product") request("ai_engineer", true, "AI 产品需要模型、RAG 或 Agent 方案");
  if (taskType === "data_pipeline") request("data_engineer", true, "数据管道需要质量、权限和血缘负责人");
  if (["software", "automation"].includes(taskType)) request("software_engineer", true, "任务需要可进入工作流的软件实现");
  if (["research", "market_analysis"].includes(taskType)) request("domain_expert", true, "需要领域正确标准和验收样本");
  if (["research", "market_analysis"].includes(taskType) && hasAny(fullText(task), ["browser skill", "browser", "bsk", "浏览器", "scrape", "抓取"])) {
    request("software_engineer", true, "任务要求通过浏览器工具执行真实取证");
  }
  if (["L", "XL"].includes(scale) && ["ai_product", "software", "automation"].includes(taskType)) request("domain_expert", true, "大型业务系统需要领域正确标准和例外样本");
  if (hasAny(fullText(task), ["客服", "业务规则", "行业", "领域规则", "customer support"])) request("domain_expert", true, "输入涉及行业规则和例外情况");
  if (taskType === "content") request("product_designer", scale !== "S", "内容任务需要受众、体验与错误恢复设计");

  if (risks.includes("sensitive_data")) request("data_engineer", true, "敏感数据需要权限、质量和血缘控制");
  if (["regulated", "financial"].some((risk) => risks.includes(risk))) request("domain_expert", true, "受监管或资金任务需要领域正确标准");
  if (risks.includes("model_uncertainty") && !map.has("ai_engineer")) request("ai_engineer", scale !== "S", "存在模型效果不确定性");
  if (["production", "external_integration"].some((risk) => risks.includes(risk)) && !map.has("software_engineer")) request("software_engineer", scale !== "S", "需要生产集成与可回滚实现");
  if (["irreversible_actions", "sensitive_data", "financial", "security"].some((risk) => risks.includes(risk)) || ["L", "XL"].includes(scale)) request("platform_security", true, "需要访问控制、监控、成本和安全边界");
  if (risks.includes("user_facing") || task.assessmentHints.userFacing) request("product_designer", scale !== "S", "面向用户的流程需要信任与恢复设计");
  if (["L", "XL"].includes(scale) || task.assessmentHints.multiTeam || scores.stakeholderComplexity >= 2) request("delivery_lead", true, "存在跨团队依赖和交付协调需求");

  const limit = SCALE_LIMITS[scale];
  const sorted = [...map.values()].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const required = sorted.filter((role) => role.required);
  const selected = [...required, ...sorted.filter((role) => !role.required)].slice(0, Math.max(limit, required.length)).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  return { selected, skipped: sorted.filter((role) => !selected.some((entry) => entry.role === role.role)) };
}

function roleAssignments(task, selected) {
  const available = new Set(task.capabilities.roles.includes("*") ? ROLE_IDS : task.capabilities.roles);
  return selected.map((entry) => {
    const manifest = ROLE_BY_ID[entry.role];
    return {
      role: entry.role,
      required: entry.required,
      mode: manifest.defaultMode,
      status: available.has(entry.role) ? "ready" : "gap",
      deliverables: manifest.deliverables,
      vetoes: manifest.vetoes,
      reasons: [...new Set(entry.reasons)],
    };
  });
}

function gatesFor(roles) {
  const has = (role) => roles.some((entry) => entry.role === role);
  const gates = [{
    id: "gate-scope", phase: "scope", ownerRole: "product_owner", blocking: true,
    criteria: ["成功指标已定义", "范围与停止条件已确认"], maxRetries: 1,
  }];
  if (has("domain_expert")) gates.push({ id: "gate-domain", phase: "discover", ownerRole: "domain_expert", blocking: true, criteria: ["领域规则已确认", "至少一个代表性验收样本已准备"], maxRetries: 2 });
  if (has("evaluator")) gates.push({ id: "gate-artifact", phase: "evaluate", ownerRole: "evaluator", blocking: true, criteria: ["请求的交付物完整", "黄金测试集与回归结果通过"], maxRetries: 2 });
  if (has("platform_security")) gates.push({ id: "gate-security", phase: "secure", ownerRole: "platform_security", blocking: true, criteria: ["权限与数据边界通过", "监控、成本和回滚方案已确认"], maxRetries: 1 });
  gates.push({ id: "gate-delivery", phase: "deliver", ownerRole: has("delivery_lead") ? "delivery_lead" : "product_owner", blocking: true, criteria: ["验收门全部通过", "产物与决策记录已归档"], maxRetries: 1 });
  return gates;
}

function approvalsFor(risks, scale) {
  const approvals = [];
  const add = (trigger, reason, riskLevel) => approvals.push({ id: `approval-${trigger}`, trigger, requiredBefore: trigger === "production_release" ? "workflow-deliver" : "workflow-build", reason, riskLevel });
  if (risks.includes("irreversible_actions")) add("irreversible_action", "计划包含不可逆动作，执行前必须人工批准", "critical");
  if (risks.includes("sensitive_data")) add("sensitive_data", "敏感数据访问、导出或训练前必须人工批准", "high");
  if (risks.includes("financial")) add("financial_spend", "涉及资金或付费调用前必须批准预算", "high");
  if (risks.includes("production") || scale === "XL") add("production_release", "生产发布前必须批准发布与回滚方案", scale === "XL" ? "critical" : "high");
  return approvals;
}

function workflowFor(roles, gates) {
  const has = (role) => roles.some((entry) => entry.role === role);
  const gate = (id) => gates.find((entry) => entry.id === id)?.id;
  const steps = [];
  const add = (id, phase, ownerRole, dependsOn, deliverable, gateAfter) => steps.push({ id, phase, ownerRole, dependsOn, deliverable, ...(gateAfter ? { gateAfter } : {}) });
  add("step-scope", "scope", "product_owner", [], "冻结目标、用户、成功指标、范围与停止条件", gate("gate-scope"));
  if (has("domain_expert")) add("step-domain", "discover", "domain_expert", ["step-scope"], "领域规则、例外清单和验收样本", gate("gate-domain"));
  const scopeTail = has("domain_expert") ? "step-domain" : "step-scope";
  if (has("product_designer")) add("step-design", "design", "product_designer", [scopeTail], "人机协作流程、错误恢复与人工审核点");
  const designTail = has("product_designer") ? "step-design" : scopeTail;
  const builders = roles.filter((entry) => ["ai_engineer", "data_engineer", "software_engineer"].includes(entry.role));
  let buildTail = designTail;
  for (const role of builders) {
    const id = `step-build-${role.role}`;
    add(id, "build", role.role, [buildTail], `${ROLE_BY_ID[role.role].label}交付物`);
    buildTail = id;
  }
  if (!builders.length) {
    add("step-produce", "build", has("domain_expert") ? "domain_expert" : "product_owner", [designTail], "完成请求的知识型交付物");
    buildTail = "step-produce";
  }
  if (has("evaluator")) {
    add("step-evaluate", "evaluate", "evaluator", [buildTail], "黄金测试、验收报告与回归结果", gate("gate-artifact"));
    buildTail = "step-evaluate";
  }
  if (has("platform_security")) {
    add("step-secure", "secure", "platform_security", [buildTail], "权限、监控、成本与回滚检查", gate("gate-security"));
    buildTail = "step-secure";
  }
  add("workflow-deliver", "deliver", has("delivery_lead") ? "delivery_lead" : "product_owner", [buildTail], "最终产物、验收记录和交付说明", gate("gate-delivery"));
  return steps;
}

function budgetFor(scale, roles) {
  const values = {
    S: { maxAgentRuns: 3, maxTokens: 120_000, maxMinutes: 60, maxHandoffs: 4, maxRetries: 1 },
    M: { maxAgentRuns: 6, maxTokens: 400_000, maxMinutes: 240, maxHandoffs: 8, maxRetries: 2 },
    L: { maxAgentRuns: 8, maxTokens: 1_200_000, maxMinutes: 1_440, maxHandoffs: 14, maxRetries: 2 },
    XL: { maxAgentRuns: 9, maxTokens: 3_000_000, maxMinutes: 4_320, maxHandoffs: 20, maxRetries: 3 },
  };
  return { ...values[scale], maxAgentRuns: Math.max(values[scale].maxAgentRuns, roles.length) };
}

function stopConditionsFor(roles, gaps, gates, budget, approvals, task) {
  const conditions = [];
  if (gaps.length) conditions.push({ id: "stop-capability-gap", type: "capability_gap", reason: `缺少必需能力：${gaps.join(", ")}` });
  if (approvals.length) conditions.push({ id: "stop-approval", type: "approval_not_granted", reason: "关键审批未获批准时不得执行对应动作" });
  conditions.push({ id: "stop-gate", type: "gate_failure_limit", reason: "同一阻塞验收门连续失败达到上限", threshold: Math.max(...gates.map((gate) => gate.maxRetries)) });
  conditions.push({ id: "stop-budget", type: "budget_exceeded", reason: `超过 ${budget.maxTokens} tokens 或 ${budget.maxMinutes} 分钟` });
  if (task.deadline) conditions.push({ id: "stop-deadline", type: "deadline_exceeded", reason: `超过截止时间 ${task.deadline}` });
  return conditions;
}

export function createDecisionRecord(input) {
  const task = normalizeTask(input);
  const inputHash = hashJson(task);
  const classification = classifyTask(task);
  const risks = detectRisks(task, classification.taskType);
  const scores = baseScores(task, classification.taskType, risks);
  const baseScale = levelForScore(scores.total);
  const uplift = applyRiskUplift(baseScale, risks, scores);
  const selection = requestedRoles(task, classification.taskType, uplift.level, risks, scores);
  const roles = roleAssignments(task, selection.selected);
  const gaps = roles.filter((role) => role.status === "gap").map((role) => role.role);
  const excluded = ROLE_MANIFESTS.filter((manifest) => !roles.some((role) => role.role === manifest.id)).map((manifest) => ({
    role: manifest.id,
    reason: selection.skipped.some((role) => role.role === manifest.id) ? "已触发但在当前规模下由其他角色合并承担" : "当前任务类型与风险不需要独立启用",
  }));
  const evaluationGates = gatesFor(roles);
  const approvalRequests = approvalsFor(risks, uplift.level);
  const workflow = workflowFor(roles, evaluationGates);
  const budget = budgetFor(uplift.level, roles);
  const stopConditions = stopConditionsFor(roles, gaps, evaluationGates, budget, approvalRequests, task);
  const planBase = {
    version: DECISION_CORE_VERSION,
    taskId: task.id,
    taskType: classification.taskType,
    scale: uplift.level,
    risks,
    scores,
    roles,
    excludedRoles: excluded,
    capabilityGaps: gaps,
    workflow,
    evaluationGates,
    approvalRequests,
    stopConditions,
    budget,
  };
  const provisionalHash = hashJson(planBase);
  const plan = teamPlanSchema.parse({ ...planBase, planId: `tp-${provisionalHash.slice(0, 16)}` });
  const planHash = hashJson(plan);
  const rationale = [
    `任务类型：${classification.taskType}，${classification.reason}`,
    `规模：${uplift.level}，评分 ${scores.total}/18${baseScale !== uplift.level ? `，从 ${baseScale} 风险上调` : ""}`,
    `风险：${risks.length ? risks.join(", ") : "未识别到显式高风险"}`,
    `角色数：${roles.length}，${roles.map((role) => ROLE_BY_ID[role.role].label).join("、")}`,
    gaps.length ? `能力缺口：${gaps.join(", ")}` : "所有必需角色均有可用能力",
  ];
  const decisionBase = {
    version: DECISION_CORE_VERSION,
    taskId: task.id,
    inputHash,
    planHash,
    confidence: classification.confidence,
    rationale,
    scaleUpliftReasons: uplift.reasons,
    plan,
  };
  const decisionHash = hashJson(decisionBase);
  return decisionRecordSchema.parse({ ...decisionBase, decisionId: `dn-${decisionHash.slice(0, 16)}` });
}

export { canonical, hashJson };
