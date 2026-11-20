import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { startAsukaServer } from "../server.mjs";
import { AsukaSettingsStore } from "../server/settings-store.mjs";

test("ASUKA settings persist sanitized preferences and expose Core routes", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-settings-"));
  const settingsStore = new AsukaSettingsStore({ dataDir, defaultWorkspace: dataDir });
  let asuka;
  try {
    asuka = await startAsukaServer({ port: 0, dataDir, settingsStore, nativeDatabasePath: join(dataDir, "native.sqlite"), toolDatabasePath: join(dataDir, "tools.sqlite") });
    const initial = await fetch(`${asuka.origin}/__asuka/core/settings`).then((response) => response.json());
    assert.equal(initial.settings.general.workspace, dataDir);
    assert.equal(initial.settings.permissions.fullAccess, false);
    assert.equal(initial.settings.permissions.workspaceWrite, false);
    assert.equal(initial.settings.appearance.accent, "nova");
    assert.equal(initial.settings.general.language, "zh-CN");

    const updated = await fetch(`${asuka.origin}/__asuka/core/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        appearance: { accent: "bloom", density: "compact" },
        general: { language: "en-US" },
        permissions: { fullAccess: true },
        computerUse: { requireObservation: false },
        personalization: { instructions: "Prefer concise evidence." },
      }),
    }).then((response) => response.json());
    assert.equal(updated.settings.appearance.accent, "bloom");
    assert.equal(updated.settings.appearance.density, "compact");
    assert.equal(updated.settings.general.language, "en-US");
    assert.equal(updated.settings.permissions.fullAccess, true);
    assert.equal(updated.settings.permissions.workspaceWrite, true);
    assert.equal(updated.settings.permissions.shellCommands, "full");
    assert.equal(updated.settings.permissions.networkAccess, "full");
    assert.equal(updated.settings.git.readOnly, false);
    assert.equal(updated.settings.computerUse.requireObservation, false);
    assert.equal(updated.settings.personalization.instructions, "Prefer concise evidence.");

    const reloaded = new AsukaSettingsStore({ dataDir, defaultWorkspace: dataDir });
    assert.equal(reloaded.get().appearance.accent, "bloom");
    assert.equal(reloaded.get().general.language, "en-US");
    assert.equal(reloaded.get().permissions.fullAccess, true);
    assert.equal(reloaded.get().permissions.workspaceWrite, true);
    assert.equal(reloaded.sanitize({ appearance: { accent: "ember" } }).appearance.accent, "nova");
    assert.equal(reloaded.sanitize({ general: { language: "fr-FR" } }).general.language, "zh-CN");
  } finally {
    if (asuka) await asuka.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
