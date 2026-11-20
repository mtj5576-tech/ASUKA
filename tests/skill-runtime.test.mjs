import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { NativeStore } from "../server/native/store.mjs";
import { SkillLibrary, unpackedSkillRoot } from "../server/native/skill-library.mjs";
import { SkillRuntimeTools } from "../server/tools/skill-runtime-tools.mjs";
import { ToolManager } from "../server/tools/tool-manager.mjs";

test("Skill Runtime lists, reads and runs packaged skill entrypoints", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-skill-runtime-"));
  const skillsDir = join(dataDir, "skills");
  const skillDir = join(skillsDir, "sample-skill");
  mkdirSync(join(skillDir, "scripts"), { recursive: true });
  mkdirSync(join(skillDir, "references"), { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), "---\nname: sample-skill\ndescription: Sample runtime skill\n---\n\nSAMPLE FULL INSTRUCTIONS\n", "utf8");
  writeFileSync(join(skillDir, "references", "guide.md"), "REFERENCE GUIDE\n", "utf8");
  writeFileSync(join(skillDir, "scripts", "echo.mjs"), "console.log(JSON.stringify({skill: process.env.ASUKA_SKILL_NAME, args: process.argv.slice(2)}));\n", "utf8");
  const store = new NativeStore(join(dataDir, "native.sqlite"));
  const library = new SkillLibrary({ rootDir: skillsDir, store });
  const runtime = new SkillRuntimeTools({ library, workspace: dataDir });
  try {
    const listed = await runtime.call("skill_list", {});
    const skills = JSON.parse(listed.content[0].text).skills;
    assert.equal(skills[0].name, "sample-skill");
    assert.equal(skills[0].path, skillDir);

    const read = await runtime.call("skill_read", { name: "sample-skill", path: "references/guide.md" });
    assert.match(read.content[0].text, /REFERENCE GUIDE/);
    await assert.rejects(() => runtime.call("skill_read", { name: "sample-skill", path: "../SKILL.md" }), /escapes/);

    const run = await runtime.call("skill_run", { name: "sample-skill", entrypoint: "scripts/echo.mjs", args: ["one", "two"] });
    assert.match(run.content[0].text, /"skill":"sample-skill"/);
    assert.match(run.content[0].text, /"one","two"/);

    const manager = new ToolManager({
      dataDir,
      databasePath: join(dataDir, "tools.sqlite"),
      windowsMcpCommand: join(dataDir, "missing.exe"),
      skillRuntime: runtime,
    });
    manager.setSkillLibrary(library);
    const catalog = await manager.listModelTools();
    assert.ok(["skill_list", "skill_read", "skill_run"].every((name) => catalog.tools.some((tool) => tool.name === name)));
    manager.close();

    library.set("sample-skill", false);
    await assert.rejects(() => runtime.call("skill_read", { name: "sample-skill" }), /not enabled/);
  } finally {
    store.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("Skill library maps packaged ASAR skill paths to unpacked resources", () => {
  const packaged = "C:\\app\\resources\\app.asar\\skills\\documents";
  assert.equal(unpackedSkillRoot(packaged), "C:\\app\\resources\\app.asar.unpacked\\skills\\documents");
  assert.equal(unpackedSkillRoot("E:\\ASUKA\\skills\\documents"), "E:\\ASUKA\\skills\\documents");
});
