import assert from "node:assert/strict";
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { collectTaskArtifacts } from "../server/native/artifact-index.mjs";

test("artifact index surfaces real task files and ignores missing or stale files", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-artifacts-"));
  const report = join(dataDir, "market report.docx");
  const image = join(dataDir, "chart.png");
  const stale = join(dataDir, "old.docx");
  writeFileSync(report, "docx placeholder", "utf8");
  writeFileSync(image, "png placeholder", "utf8");
  writeFileSync(stale, "old", "utf8");
  const oldTime = new Date(Date.now() - 60_000);
  utimesSync(stale, oldTime, oldTime);
  const task = { id: "task-artifacts", createdAt: new Date(Date.now() - 500).toISOString() };
  try {
    const artifacts = collectTaskArtifacts({
      task,
      modelMessages: [{
        role: "assistant",
        content: `Created ${report} and ${image}. Missing ${join(dataDir, "missing.pdf")}. Old ${stale}.`,
      }],
      messages: [{ role: "assistant", text: `Final files: ${report} and ${image}` }],
    });
    assert.deepEqual(artifacts.map((item) => item.name).sort(), ["chart.png", "market report.docx"]);
    assert.equal(artifacts.find((item) => item.name.endsWith(".docx"))?.kind, "document");
    assert.equal(artifacts.find((item) => item.name.endsWith(".png"))?.kind, "image");
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("artifact index prefers the requested file type over helper scripts", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-artifact-priority-"));
  const report = join(dataDir, "report.docx");
  const script = join(dataDir, "build_report.py");
  writeFileSync(report, "docx", "utf8");
  writeFileSync(script, "print('build')", "utf8");
  try {
    const artifacts = collectTaskArtifacts({
      task: { id: "word-task", requestText: "调研市场并生成 Word 文档", createdAt: new Date(Date.now() - 500).toISOString() },
      messages: [{ role: "assistant", text: `完成：${report}，构建脚本：${script}` }],
    });
    assert.deepEqual(artifacts.map((item) => item.name), ["report.docx"]);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
