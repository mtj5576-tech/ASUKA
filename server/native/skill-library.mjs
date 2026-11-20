import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_GLOBAL_SKILLS_DIR = fileURLToPath(new URL("../../skills/", import.meta.url));

export function unpackedSkillRoot(rootDir) {
  const value = resolve(rootDir);
  const marker = `${sep}app.asar${sep}`;
  return value.includes(marker) ? value.replace(marker, `${sep}app.asar.unpacked${sep}`) : value;
}

const SKILL_STATE_KIND = "global-skill";
const AGENT_SKILL_STATE_KIND = "agent-global-skill";
const AGENT_SKILL_KIND = "agent-skill";
const SKILL_NAME = /^[a-z0-9-]+$/;
const SKILL_TRIGGERS = {
  documents: /(?:docx|word(?:\s+document)?|word\s*文档|生成.{0,20}文档|文档.{0,20}生成)/i,
  pdf: /(?:pdf|扫描件|版式文档)/i,
  presentations: /(?:pptx?|powerpoint|slide|slides|演示文稿|幻灯片)/i,
  spreadsheets: /(?:xlsx?|excel|csv|spreadsheet|表格|工作表)/i,
  "browser-skill": /(?:browser\s*skill|浏览器技能|bsk)/i,
  imagegen: /(?:imagegen|image\s+generation|生成图片|编辑图片|文生图)/i,
  visualize: /(?:visuali[sz]ation|可视化|图表|交互式演示)/i,
  "conversation-memory": /(?:conversation\s+memory|长期记忆|记住这个|回忆)/i,
};

function unquote(value) {
  const text = String(value || "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(String(text || ""));
  if (!match) return {};
  const values = {};
  let current = "";
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([a-zA-Z][\w-]*):\s*(.*)$/.exec(line);
    if (field) {
      current = field[1];
      const value = field[2].trim();
      values[current] = ["|", ">", "|-", ">-"].includes(value) ? "" : value;
      continue;
    }
    if (current && /^\s+/.test(line)) {
      values[current] = `${values[current] || ""} ${line.trim()}`.trim();
    }
  }
  return Object.fromEntries(Object.entries(values).map(([key, value]) => {
    return [key, unquote(value).replace(/\s+/g, " ")];
  }));
}

function skillText(rootDir, name) {
  if (!SKILL_NAME.test(name)) throw new Error("Global skill name is invalid");
  const path = join(rootDir, name, "SKILL.md");
  if (!existsSync(path)) throw new Error(`Global skill not found: ${name}`);
  return readFileSync(path, "utf8");
}

export class SkillLibrary {
  constructor({ rootDir = DEFAULT_GLOBAL_SKILLS_DIR, store }) {
    this.rootDir = unpackedSkillRoot(rootDir);
    this.store = store;
  }

  agentKey(agentId, name) {
    return `${agentId}:${name}`;
  }

  state(name, agentId = "") {
    if (agentId) {
      const override = this.store.getEntity(AGENT_SKILL_STATE_KIND, this.agentKey(agentId, name));
      if (override) return override;
    }
    return this.store.getEntity(SKILL_STATE_KIND, name);
  }

  names() {
    if (!existsSync(this.rootDir)) return [];
    return readdirSync(this.rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && SKILL_NAME.test(entry.name))
      .filter((entry) => {
        const path = join(this.rootDir, entry.name, "SKILL.md");
        return existsSync(path) && statSync(path).isFile();
      })
      .map((entry) => entry.name)
      .sort();
  }

  entry(name, agentId = "") {
    const text = skillText(this.rootDir, name);
    const meta = frontmatter(text);
    return {
      name,
      description: meta.description || "Global ASUKA skill",
      path: join(this.rootDir, name),
      enabled: this.state(name, agentId)?.enabled !== false,
      origin: "native",
      editable: false,
      everyBot: true,
      tags: ["global", "every-bot"],
    };
  }

  pathFor(name) {
    if (!SKILL_NAME.test(name)) throw new Error("Global skill name is invalid");
    if (!this.names().includes(name)) throw new Error(`Global skill not found: ${name}`);
    return join(this.rootDir, name);
  }

  privateRecord(agentId, name) {
    return this.store.getEntity(AGENT_SKILL_KIND, this.agentKey(agentId, name));
  }

  privateRecords(agentId) {
    return this.store.listEntities(AGENT_SKILL_KIND)
      .filter((record) => record.agentId === agentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  privateEntry(record) {
    return {
      name: record.name,
      description: record.description || "Agent private skill",
      enabled: Boolean(record.enabled),
      origin: "own",
      editable: true,
      everyBot: false,
      tags: ["private", "agent-only", ...(record.tags || [])],
      source: record.source || "asuka-paste",
    };
  }

  list(agentId = "") {
    const global = this.names().map((name) => this.entry(name, agentId));
    const own = agentId ? this.privateRecords(agentId).map((record) => this.privateEntry(record)) : [];
    return [...global, ...own];
  }

  get(name, agentId = "") {
    const privateRecord = agentId ? this.privateRecord(agentId, name) : null;
    if (privateRecord) return { ...this.privateEntry(privateRecord), text: privateRecord.text || "" };
    const entry = this.entry(name, agentId);
    return { ...entry, text: skillText(this.rootDir, name) };
  }

  set(name, enabled, agentId = "") {
    if (agentId && this.privateRecord(agentId, name)) {
      const record = this.privateRecord(agentId, name);
      this.store.putEntity(AGENT_SKILL_KIND, this.agentKey(agentId, name), { ...record, enabled: Boolean(enabled) });
      return { ok: true, skill: this.privateEntry(this.privateRecord(agentId, name)) };
    }
    this.entry(name, agentId);
    if (agentId) {
      this.store.putEntity(AGENT_SKILL_STATE_KIND, this.agentKey(agentId, name), { enabled: Boolean(enabled) });
      return { ok: true, skill: this.entry(name, agentId) };
    }
    this.store.putEntity(SKILL_STATE_KIND, name, { enabled: Boolean(enabled) });
    return { ok: true, skill: this.entry(name) };
  }

  saveTemplate(agentId, body = {}) {
    if (!agentId) throw new Error("Agent id is required");
    const name = String(body.name || "").trim();
    if (!SKILL_NAME.test(name)) throw new Error("Agent skill name is invalid");
    if (this.names().includes(name)) throw new Error("A global skill with this name already exists");
    const text = String(body.text || "").trim();
    if (!text) throw new Error("SKILL.md content is required");
    const meta = frontmatter(text);
    if (meta.name && meta.name !== name) throw new Error("SKILL.md name does not match the requested skill");
    const record = {
      agentId,
      name,
      description: String(body.description || meta.description || "Agent private skill").slice(0, 500),
      enabled: Boolean(body.enabled),
      source: String(body.source || "asuka-paste").slice(0, 200),
      tags: Array.isArray(body.tags) ? body.tags.map((tag) => String(tag).slice(0, 32)).slice(0, 8) : [],
      text: text.slice(0, 200_000),
    };
    this.store.putEntity(AGENT_SKILL_KIND, this.agentKey(agentId, name), record);
    return { ok: true, skill: this.privateEntry(record) };
  }

  remove(agentId, name) {
    if (!agentId) throw new Error("Agent id is required");
    if (!this.privateRecord(agentId, name)) throw new Error("Agent private skill not found");
    this.store.deleteEntity(AGENT_SKILL_KIND, this.agentKey(agentId, name));
    return { ok: true };
  }

  promptContext(taskText, agentId = "") {
    const enabled = this.list(agentId).filter((skill) => skill.enabled);
    if (!enabled.length) return { catalog: "", instructions: "", selected: [] };
    const catalog = [
      "Global and agent-private ASUKA skills available to this bot:",
      ...enabled.map((skill) => `- ${skill.name}: ${skill.description}${skill.path ? ` [path: ${skill.path}]` : ""}`),
      "Use a skill when the task matches its description. If the user names a skill, follow that skill's full instructions below.",
    ].join("\n");
    const normalized = String(taskText || "").toLowerCase();
    const selected = enabled.filter((skill) => {
      const named = new RegExp(`(^|[^a-z0-9-])${skill.name}([^a-z0-9-]|$)`, "i").test(normalized);
      const triggered = SKILL_TRIGGERS[skill.name]?.test(normalized) === true;
      return named || triggered;
    }).slice(0, 4);
    const instructions = selected.length
      ? selected.map((skill) => `## ${skill.name}\n${this.get(skill.name, agentId).text}`).join("\n\n").slice(0, 80_000)
      : "";
    return { catalog, instructions, selected: selected.map((skill) => skill.name) };
  }
}
