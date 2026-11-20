export const WORKER_CONTRACT_VERSION = "1.0.0";

function text(value, limit = 20_000) {
  return String(value || "").trim().slice(0, limit);
}

function list(value) {
  return Array.isArray(value) ? value.map((item) => text(item, 4_000)).filter(Boolean).slice(0, 40) : [];
}

function artifactList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return { type: "text", title: "", content: text(item) };
    return {
      type: text(item?.type || "text", 80),
      title: text(item?.title || "", 300),
      content: text(item?.content || item?.text || "", 30_000),
    };
  }).filter((item) => item.content).slice(0, 20);
}

export function createWorkerContract({ taskId, agent, assignment, status = "done", summary = "", artifacts = [], evidence = [], issues = [], nextAction = "", warnings = [] }) {
  return {
    version: WORKER_CONTRACT_VERSION,
    taskId: text(taskId, 200),
    assignmentId: text(assignment?.assignmentId || assignment?.decisionRole || "assignment", 300),
    agentId: text(agent?.id || assignment?.agentId || "", 200),
    agentName: text(agent?.name || assignment?.name || "", 200),
    role: text(assignment?.decisionRole || "", 120),
    status: ["done", "blocked", "needs-input", "failed"].includes(status) ? status : "done",
    summary: text(summary, 6_000),
    artifacts: artifactList(artifacts),
    evidence: list(evidence),
    issues: list(issues),
    nextAction: text(nextAction, 2_000),
    warnings: list(warnings),
    createdAt: new Date().toISOString(),
  };
}

export function parseWorkerContract(raw, { taskId, agent, assignment, reason = "" } = {}) {
  const value = text(raw, 40_000);
  let parsed = null;
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      parsed = JSON.parse(value.slice(start, end + 1));
    } catch {
      parsed = null;
    }
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return createWorkerContract({
      taskId,
      agent,
      assignment,
      status: parsed.status,
      summary: parsed.summary || parsed.deliverable || parsed.result,
      artifacts: parsed.artifacts,
      evidence: parsed.evidence,
      issues: parsed.issues,
      nextAction: parsed.nextAction || parsed.next_action,
      warnings: parsed.warnings,
    });
  }
  if (!value) {
    return createWorkerContract({ taskId, agent, assignment, status: "failed", summary: reason || "Worker returned no usable contribution.", issues: [reason || "empty contribution"] });
  }
  return createWorkerContract({
    taskId,
    agent,
    assignment,
    status: "done",
    summary: value.slice(0, 1_500),
    artifacts: [{ type: "text", title: assignment?.roleLabel || agent?.roleLabel || "Worker contribution", content: value }],
    warnings: ["Worker returned prose instead of the structured contract; content was preserved."],
  });
}

export function formatWorkerContract(contract) {
  return JSON.stringify(contract, null, 2);
}
