import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { NativeAdapter } from "../server/native/native-adapter.mjs";

function writeSkill(root, name, title) {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), [
    "---",
    `name: ${name}`,
    `description: ${title} workflow`,
    "---",
    "",
    `# ${name}`,
    "",
    `${title.toUpperCase()} FULL INSTRUCTIONS`,
    "",
  ].join("\n"), "utf8");
}

test("native global skills are enabled for every bot and load explicitly named bodies", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-skills-"));
  const skillsDir = join(dataDir, "skills");
  writeSkill(skillsDir, "documents", "Documents");
  writeSkill(skillsDir, "pdf", "PDF");
  writeSkill(skillsDir, "browser-skill", "Browser");
  const adapter = new NativeAdapter({
    dataDir,
    databasePath: join(dataDir, "native.sqlite"),
    skillsDir,
  });
  try {
    const listed = adapter.listSkills("asuka-native-builder");
    assert.deepEqual(listed.skills.map((skill) => skill.name), ["browser-skill", "documents", "pdf"]);
    assert.ok(listed.skills.every((skill) => skill.enabled && skill.everyBot && skill.origin === "native"));
    assert.equal(listed.assignedSkills.length, 3);
    assert.match(adapter.getSkill("asuka-native-builder", "pdf").text, /PDF FULL INSTRUCTIONS/);

    const system = adapter.executorSystem({
      id: "skill-task",
      requestText: "Use the pdf skill to inspect this document.",
      title: "Skill task",
    }, adapter.decisionFor("skill-task", "Use the pdf skill to inspect this document."));
    assert.match(system, /PDF FULL INSTRUCTIONS/);
    assert.doesNotMatch(system, /BROWSER FULL INSTRUCTIONS/);

    const browserSystem = adapter.executorSystem({
      id: "browser-skill-task",
      requestText: "Use browser-skill to open the page and read it.",
      title: "Browser skill task",
    }, adapter.decisionFor("browser-skill-task", "Use browser-skill to open the page and read it."));
    assert.match(browserSystem, /BROWSER FULL INSTRUCTIONS/);
    assert.match(browserSystem, /browser_skill_open/i);
    assert.match(browserSystem, /do not start a second session/i);

    const documentSystem = adapter.executorSystem({
      id: "document-skill-task",
      requestText: "调研肯尼亚建材市场，最终生成 Word 文档。",
      title: "Document task",
    }, adapter.decisionFor("document-skill-task", "调研肯尼亚建材市场，最终生成 Word 文档。"));
    assert.match(documentSystem, /DOCUMENTS FULL INSTRUCTIONS/);

    adapter.setSkill("asuka-native-planner", "browser-skill", false);
    const fromBuilder = adapter.listSkills("asuka-native-builder");
    const fromPlanner = adapter.listSkills("asuka-native-planner");
    assert.equal(fromPlanner.skills.find((skill) => skill.name === "browser-skill").enabled, false);
    assert.equal(fromBuilder.skills.find((skill) => skill.name === "browser-skill").enabled, true);

    adapter.saveSkillTemplate("asuka-native-builder", {
      name: "release-check",
      text: "---\nname: release-check\ndescription: Release readiness checks\n---\n\nRELEASE CHECK FULL INSTRUCTIONS\n",
      source: "asuka-paste",
      enabled: true,
    });
    const privateState = adapter.listSkills("asuka-native-builder");
    const privateSkill = privateState.skills.find((skill) => skill.name === "release-check");
    assert.equal(privateSkill.everyBot, false);
    assert.equal(privateSkill.origin, "own");
    assert.ok(privateState.assignedSkills.includes("release-check"));
    assert.equal(adapter.listSkills("asuka-native-planner").skills.some((skill) => skill.name === "release-check"), false);
    const privateSystem = adapter.executorSystem({
      id: "private-skill-task",
      requestText: "Use the release-check skill before delivery.",
      title: "Private skill task",
    }, adapter.decisionFor("private-skill-task", "Use the release-check skill before delivery."));
    assert.match(privateSystem, /RELEASE CHECK FULL INSTRUCTIONS/);
    adapter.removeSkill("asuka-native-builder", "release-check");
    assert.equal(adapter.listSkills("asuka-native-builder").skills.some((skill) => skill.name === "release-check"), false);
  } finally {
    adapter.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
