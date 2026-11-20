export const FABRIC_VERSION = "1.0.0";

export const TICKET_STAGES = [
  "person/delivery",
  "person/answer",
  "person/review",
  "person/blocked",
  "person/failed",
  "person/recovery",
  "working/queued",
  "working",
  "idle",
  "ended",
];

export const REPORT_STATES = ["progress", "waiting", "ready", "blocked", "failed", "dropped"];

function text(value, max = 2_000) {
  return String(value || "").trim().slice(0, max);
}

export function createMandate({ taskId, adapter, request, autonomy = "execute", approvalMode = "ask", policyVersion = "decision-core-v1" }) {
  return {
    version: FABRIC_VERSION,
    taskId: text(taskId, 200),
    adapter: text(adapter, 40),
    source: "asuka-desktop",
    scope: text(request, 2_000),
    autonomy: autonomy === "unattended" ? "unattended" : autonomy === "suggest" ? "suggest" : "execute",
    approvalMode: approvalMode === "full" ? "full" : approvalMode === "auto" ? "auto" : "ask",
    policyVersion: text(policyVersion, 120),
    issuedAt: new Date().toISOString(),
  };
}

export function createReport({ state = "waiting", summary = "", adapter = "unknown", at = new Date().toISOString() }) {
  if (!REPORT_STATES.includes(state)) throw new Error(`unsupported report state: ${state}`);
  return { state, summary: text(summary, 4_000), adapter: text(adapter, 40), at };
}

export function ticketStage({ status = "idle", report, pendingApprovals = 0 } = {}) {
  if (status === "completed" || status === "cancelled") return { stage: "ended", action: null };
  if (pendingApprovals > 0 || status === "needs-input") return { stage: "person/answer", action: "answer" };
  if (status === "interrupted") return { stage: "person/recovery", action: "recovery" };
  if (report?.state === "blocked") return { stage: "person/blocked", action: "blocked" };
  if (status === "failed" || report?.state === "failed") return { stage: "person/failed", action: "failed" };
  if (report?.state === "ready") return { stage: "person/review", action: "review" };
  if (status === "queued") return { stage: "working/queued", action: "queued" };
  if (status === "running") return { stage: "working", action: null };
  if (report?.state === "waiting") return { stage: "idle", action: null };
  return { stage: "idle", action: null };
}

export function stageMeta(stage) {
  if (stage.startsWith("person/")) return { lane: "attention", label: stage.slice("person/".length), human: true };
  if (stage === "working/queued") return { lane: "queued", label: "queued", human: false };
  if (stage === "working") return { lane: "working", label: "working", human: false };
  if (stage === "ended") return { lane: "ended", label: "ended", human: false };
  return { lane: "idle", label: "idle", human: false };
}

export function fabricTask(task, pendingApprovals = 0) {
  const classified = ticketStage({ status: task.status, report: task.report, pendingApprovals });
  return {
    ...task,
    stage: classified.stage,
    stageAction: classified.action,
    stageMeta: stageMeta(classified.stage),
  };
}
