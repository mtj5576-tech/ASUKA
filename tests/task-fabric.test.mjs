import assert from "node:assert/strict";
import { test } from "node:test";

import { createMandate, createReport, fabricTask, ticketStage } from "../server/fabric/task-fabric.mjs";

test("Task Fabric maps ticket facts to deterministic stages", () => {
  assert.equal(ticketStage({ status: "needs-input" }).stage, "person/answer");
  assert.equal(ticketStage({ status: "interrupted" }).stage, "person/recovery");
  assert.equal(ticketStage({ status: "running", report: { state: "progress" } }).stage, "working");
  assert.equal(ticketStage({ status: "queued" }).stage, "working/queued");
  assert.equal(ticketStage({ status: "idle", report: { state: "waiting" } }).stage, "idle");
  assert.equal(ticketStage({ status: "failed", report: { state: "failed" } }).stage, "person/failed");
  assert.equal(ticketStage({ status: "completed", report: { state: "ready" } }).stage, "ended");
  assert.equal(ticketStage({ status: "cancelled", report: { state: "dropped" } }).stage, "ended");
});

test("Task Fabric mandate and report keep authorization and execution facts separate", () => {
  const mandate = createMandate({ taskId: "t1", adapter: "codex", request: "inspect repo" });
  const report = createReport({ state: "progress", summary: "Reading modules", adapter: "codex" });
  const ticket = fabricTask({ id: "t1", title: "Inspect", status: "running", mandate, report }, 0);
  assert.equal(mandate.source, "asuka-desktop");
  assert.equal(mandate.adapter, "codex");
  assert.equal(report.state, "progress");
  assert.equal(ticket.stage, "working");
  assert.equal(ticket.stageMeta.lane, "working");
});
