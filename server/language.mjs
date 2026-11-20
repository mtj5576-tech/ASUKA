export const BOT_LANGUAGES = ["zh-CN", "en-US"];

export function normalizeBotLanguage(value) {
  return value === "en-US" ? "en-US" : "zh-CN";
}

export function botLanguageInstruction(value) {
  if (normalizeBotLanguage(value) === "en-US") {
    return "Output language: English. Write the response in English while keeping code, commands, file paths, JSON keys, and quoted source text unchanged.";
  }
  return "输出语言：简体中文。除代码、命令、文件路径、JSON 键名和引用的原文外，始终使用简体中文回复。";
}

export function localized(value, chinese, english) {
  return normalizeBotLanguage(value) === "en-US" ? english : chinese;
}
