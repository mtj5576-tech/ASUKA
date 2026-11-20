import assert from "node:assert/strict";
import { test } from "node:test";

import { botLanguageInstruction, normalizeBotLanguage } from "../server/language.mjs";

test("Bot language defaults to Simplified Chinese and supports English", () => {
  assert.equal(normalizeBotLanguage(undefined), "zh-CN");
  assert.equal(normalizeBotLanguage("fr-FR"), "zh-CN");
  assert.equal(normalizeBotLanguage("en-US"), "en-US");
  assert.match(botLanguageInstruction("zh-CN"), /简体中文/);
  assert.match(botLanguageInstruction("en-US"), /English/);
});
