import { z } from "zod";

export const DECISION_CORE_VERSION = "1.0.0";

export const TASK_TYPES = [
  "ai_product",
  "data_pipeline",
  "software",
  "automation",
  "research",
  "market_analysis",
  "content",
  "operations",
  "unknown",
];

export const SCALE_LEVELS = ["S", "M", "L", "XL"];

export const ROLE_IDS = [
  "product_owner",
  "domain_expert",
  "ai_engineer",
  "data_engineer",
  "software_engineer",
  "evaluator",
  "platform_security",
  "product_designer",
  "delivery_lead",
];

export const RISK_TAGS = [
  "irreversible_actions",
  "sensitive_data",
  "external_integration",
  "financial",
  "production",
  "regulated",
  "security",
  "user_facing",
  "model_uncertainty",
];

const taskTypeSchema = z.enum(TASK_TYPES);
const scaleSchema = z.enum(SCALE_LEVELS);
const roleIdSchema = z.enum(ROLE_IDS);
const riskTagSchema = z.enum(RISK_TAGS);

export const assessmentHintsSchema = z.object({
  taskType: taskTypeSchema.optional(),
  production: z.boolean().optional(),
  customerData: z.boolean().optional(),
  financial: z.boolean().optional(),
  regulated: z.boolean().optional(),
  publicRelease: z.boolean().optional(),
  multiTeam: z.boolean().optional(),
  irreversibleActions: z.boolean().optional(),
  userFacing: z.boolean().optional(),
}).strict().default({});

export const capabilityInventorySchema = z.object({
  roles: z.array(roleIdSchema.or(z.literal("*"))).default([]),
  runtimes: z.array(z.string().trim().min(1).max(120)).default([]),
  tools: z.array(z.string().trim().min(1).max(120)).default([]),
}).strict().default({ roles: [], runtimes: [], tools: [] });

export const taskEnvelopeSchema = z.object({
  id: z.string().trim().min(1).max(200),
  objective: z.string().trim().min(1).max(20_000),
  context: z.string().trim().max(50_000).default(""),
  constraints: z.array(z.string().trim().min(1).max(2_000)).max(100).default([]),
  requestedOutputs: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  deadline: z.string().trim().max(100).optional(),
  autonomy: z.enum(["suggest", "execute", "unattended"]).default("suggest"),
  assessmentHints: assessmentHintsSchema,
  capabilities: capabilityInventorySchema,
}).strict();

export const roleManifestSchema = z.object({
  id: roleIdSchema,
  label: z.string().trim().min(1).max(100),
  mission: z.string().trim().min(1).max(1_000),
  phases: z.array(z.enum(["scope", "discover", "design", "build", "evaluate", "secure", "deliver"])).min(1),
  defaultMode: z.enum(["dedicated_agent", "shared_agent", "review_gate"]),
  deliverables: z.array(z.string().trim().min(1).max(300)).min(1),
  vetoes: z.array(z.string().trim().min(1).max(300)).default([]),
  priority: z.number().int().min(0).max(1_000),
}).strict();

export const scoreCardSchema = z.object({
  impact: z.number().int().min(0).max(3),
  dataSensitivity: z.number().int().min(0).max(3),
  integrationComplexity: z.number().int().min(0).max(3),
  autonomy: z.number().int().min(0).max(3),
  duration: z.number().int().min(0).max(3),
  stakeholderComplexity: z.number().int().min(0).max(3),
  total: z.number().int().min(0).max(18),
}).strict();

export const roleAssignmentSchema = z.object({
  role: roleIdSchema,
  required: z.boolean(),
  mode: z.enum(["dedicated_agent", "shared_agent", "review_gate"]),
  status: z.enum(["ready", "gap"]),
  deliverables: z.array(z.string()),
  vetoes: z.array(z.string()),
  reasons: z.array(z.string()),
}).strict();

export const excludedRoleSchema = z.object({
  role: roleIdSchema,
  reason: z.string(),
}).strict();

export const evaluationGateSchema = z.object({
  id: z.string().trim().min(1).max(120),
  phase: z.enum(["scope", "discover", "design", "build", "evaluate", "secure", "deliver"]),
  ownerRole: roleIdSchema,
  blocking: z.boolean(),
  criteria: z.array(z.string().trim().min(1).max(500)).min(1),
  maxRetries: z.number().int().min(0).max(10),
}).strict();

export const approvalRequestSchema = z.object({
  id: z.string().trim().min(1).max(120),
  trigger: z.enum(["irreversible_action", "financial_spend", "sensitive_data", "production_release", "security_change"]),
  requiredBefore: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(1_000),
  riskLevel: z.enum(["medium", "high", "critical"]),
}).strict();

export const stopConditionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  type: z.enum(["gate_failure_limit", "budget_exceeded", "deadline_exceeded", "capability_gap", "approval_not_granted"]),
  reason: z.string().trim().min(1).max(1_000),
  threshold: z.number().nonnegative().optional(),
}).strict();

export const executionStepSchema = z.object({
  id: z.string().trim().min(1).max(120),
  phase: z.enum(["scope", "discover", "design", "build", "evaluate", "secure", "deliver"]),
  ownerRole: roleIdSchema,
  dependsOn: z.array(z.string().trim().min(1).max(120)).default([]),
  deliverable: z.string().trim().min(1).max(1_000),
  gateAfter: z.string().trim().min(1).max(120).optional(),
}).strict();

export const teamBudgetSchema = z.object({
  maxAgentRuns: z.number().int().positive(),
  maxTokens: z.number().int().positive(),
  maxMinutes: z.number().int().positive(),
  maxHandoffs: z.number().int().nonnegative(),
  maxRetries: z.number().int().nonnegative(),
}).strict();

export const teamPlanSchema = z.object({
  version: z.literal(DECISION_CORE_VERSION),
  planId: z.string().regex(/^tp-[a-f0-9]{16}$/),
  taskId: z.string().trim().min(1).max(200),
  taskType: taskTypeSchema,
  scale: scaleSchema,
  risks: z.array(riskTagSchema),
  scores: scoreCardSchema,
  roles: z.array(roleAssignmentSchema).min(1),
  excludedRoles: z.array(excludedRoleSchema),
  capabilityGaps: z.array(roleIdSchema),
  workflow: z.array(executionStepSchema).min(1),
  evaluationGates: z.array(evaluationGateSchema).min(1),
  approvalRequests: z.array(approvalRequestSchema),
  stopConditions: z.array(stopConditionSchema).min(1),
  budget: teamBudgetSchema,
}).strict();

export const decisionRecordSchema = z.object({
  version: z.literal(DECISION_CORE_VERSION),
  decisionId: z.string().regex(/^dn-[a-f0-9]{16}$/),
  taskId: z.string().trim().min(1).max(200),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  planHash: z.string().regex(/^[a-f0-9]{64}$/),
  confidence: z.number().min(0).max(1),
  rationale: z.array(z.string().trim().min(1).max(1_000)).min(1),
  scaleUpliftReasons: z.array(z.string()),
  plan: teamPlanSchema,
}).strict();

export const schemas = {
  taskEnvelope: taskEnvelopeSchema,
  decisionRecord: decisionRecordSchema,
  roleManifest: roleManifestSchema,
  teamPlan: teamPlanSchema,
  evaluationGate: evaluationGateSchema,
  approvalRequest: approvalRequestSchema,
  stopCondition: stopConditionSchema,
};
