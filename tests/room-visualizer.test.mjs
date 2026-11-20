import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { RoomVisualizer, architectureInput } from "../server/native/room-visualizer.mjs";

function snapshot() {
  return {
    bots: [
      { id: "asuka-native-planner", name: "NOVA", title: "Planner", description: "Decision" },
      { id: "asuka-native-builder", name: "BYTE", title: "Builder", description: "Execution" },
      { id: "asuka-native-reviewer", name: "GUARD", title: "Reviewer", description: "Review" },
    ],
    groups: [{
      id: "asuka-native-room",
      name: "ASUKA Command",
      section: "ASUKA",
      threadId: "task-1",
      tasks: [{
        threadId: "task-1",
        title: "可视化房间架构",
        project: "ASUKA",
        category: "software",
        activity: "completed",
        decision: { plan: { roles: [{ role: "planner" }, { role: "executor" }] } },
      }],
    }],
  };
}

test("room visualization builds an Archify architecture and renders standalone HTML", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-archify-"));
  try {
    const input = architectureInput(snapshot(), "asuka-native-room");
    assert.equal(input.diagram_type, "architecture");
    assert.equal(input.meta.locale, "zh-CN");
    assert.match(input.meta.title, /团队架构$/);
    assert.equal(input.meta.visual_preset, "signal-flow");
    assert.deepEqual(input.components.map((component) => component.id), [
      "room-entry", "decision", "executor", "reviewer", "delivery", "skills", "tasks", "tools", "approvals", "storage",
    ]);
    assert.equal(input.components.find((component) => component.id === "tasks").label, "任务");
    assert.equal(input.components.find((component) => component.id === "approvals").label, "审批");
    assert.match(input.connections.find((connection) => connection.id === "executor-to-tools").label, /工具/);
    assert.equal(input.cards[0].title, "房间状态");
    assert.match(input.cards[0].items[0], /1 个任务/);

    const visualizer = new RoomVisualizer({ dataDir });
    const html = await visualizer.render(snapshot(), "asuka-native-room", { force: true });
    assert.match(html, /^<!DOCTYPE html>/i);
    assert.match(html, /团队架构/);
    assert.match(html, /archify-reader-contract/);
    assert.match(html, /NOVA|BYTE|GUARD/);
    assert.match(html, /id="asuka-archify-theme"/);
    assert.match(html, /--bg: #ffffff/);
    assert.doesNotMatch(html, /Task Fabric|Approval Gate|Room pulse|Latest task/);

    const cachedHtml = await visualizer.render(snapshot(), "asuka-native-room");
    assert.equal(cachedHtml, html);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
