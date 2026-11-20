import { createDecisionRecord } from "../core/decision-engine.mjs";

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

export class TaskRouter {
  constructor({ orchestratorId, roleAgent, leadByTaskType, fallbackWorkerId }) {
    this.orchestratorId = orchestratorId;
    this.roleAgent = roleAgent;
    this.leadByTaskType = leadByTaskType;
    this.fallbackWorkerId = fallbackWorkerId;
  }

  route({ taskId, text, context = "", room, targetAgentId = "", providerId = "", agents = [] }) {
    const decision = createDecisionRecord({
      id: taskId,
      objective: text,
      context,
      autonomy: "execute",
      capabilities: { roles: ["*"], runtimes: [providerId].filter(Boolean), tools: ["mcp"] },
    });
    const byId = new Map(agents.map((agent) => [agent.id, agent]));
    const target = byId.get(targetAgentId) || byId.get(this.orchestratorId) || null;
    const orchestrated = !target || target.id === this.orchestratorId || target.isOrchestrator === true;
    if (!orchestrated) {
      return {
        decision,
        orchestrated: false,
        orchestratorId: this.orchestratorId,
        leadAgentId: target.id,
        primaryWorkerId: target.id,
        assignments: [],
        autoMemberIds: [this.orchestratorId, target.id],
        manualMemberIds: unique(room?.manualMemberIds || []).filter((id) => byId.has(id)),
        memberIds: unique([this.orchestratorId, target.id, ...(room?.manualMemberIds || [])]).filter((id) => byId.has(id)),
      };
    }

    const assignments = decision.plan.roles.map((role) => {
      const agentId = this.roleAgent[role.role];
      const agent = byId.get(agentId);
      if (!agent || agent.isOrchestrator) return null;
      return {
        assignmentId: `${taskId}:${role.role}:${agent.id}`,
        decisionRole: role.role,
        agentId: agent.id,
        name: agent.name,
        roleLabel: agent.roleLabel || agent.title || role.role,
        deliverables: role.deliverables || [],
        mode: role.mode,
        required: Boolean(role.required),
      };
    }).filter(Boolean);

    const requestedLead = this.leadByTaskType[decision.plan.taskType];
    const workers = unique(assignments.map((assignment) => assignment.agentId))
      .filter((id) => id !== this.orchestratorId);
    const leadAgentId = byId.has(requestedLead) && !byId.get(requestedLead)?.isOrchestrator
      ? requestedLead
      : workers[0] || this.fallbackWorkerId;
    const autoMemberIds = unique([this.orchestratorId, leadAgentId, ...workers]);
    const manualMemberIds = unique(room?.manualMemberIds || []).filter((id) => byId.has(id));
    return {
      decision,
      orchestrated: true,
      orchestratorId: this.orchestratorId,
      leadAgentId,
      primaryWorkerId: leadAgentId,
      assignments,
      autoMemberIds,
      manualMemberIds,
      memberIds: unique([...autoMemberIds, ...manualMemberIds]),
    };
  }
}
