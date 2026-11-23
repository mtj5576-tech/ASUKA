const WRITE_ROLES = new Set([
  "ai_engineer",
  "data_engineer",
  "software_engineer",
  "platform_security",
  "delivery_lead",
]);

function clean(value, limit = 200) {
  return String(value || "").trim().slice(0, limit);
}

export function policyForAgent(agent, options = {}) {
  const purpose = clean(options.purpose, 40) || "contributor";
  const role = clean(agent?.roleLabel || agent?.title, 200);
  const writeCapable = WRITE_ROLES.has(clean(options.role, 120)) || /engineer|security|delivery|集成|工程师|安全|交付/i.test(role);
  const contributor = purpose !== "executor";
  const maxRounds = contributor ? 1 : Math.max(1, Math.min(Number(options.maxRounds) || 12, 24));
  return {
    version: "1.0.0",
    purpose,
    contributor,
    writeCapable,
    toolMode: contributor ? "read-only" : writeCapable ? "workspace" : "read-only",
    safeToolsOnly: contributor,
    toolsEnabled: !contributor,
    allowApproval: !contributor,
    maxRounds,
    maxToolCallsPerTurn: Math.max(1, Math.min(Number(options.maxToolCallsPerTurn) || (contributor ? 0 : 8), 16)),
    maxOutputChars: Math.max(1_200, Math.min(Number(options.maxOutputChars) || (contributor ? 4_000 : 80_000), 160_000)),
    maxContextChars: Math.max(12_000, Math.min(Number(options.maxContextChars) || (contributor ? 28_000 : 80_000), 160_000)),
  };
}

export function toolAllowedByPolicy(policy, tool) {
  if (!tool) return false;
  if (policy?.safeToolsOnly) return policy?.toolMode === "read-only" && tool.risk === "safe";
  return true;
}
