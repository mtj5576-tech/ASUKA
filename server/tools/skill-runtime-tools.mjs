import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";

const MAX_OUTPUT = 120_000;
const DEFAULT_TIMEOUT_MS = 5 * 60_000;
const MAX_TIMEOUT_MS = 15 * 60_000;

function appendOutput(current, chunk) {
  if (current.length >= MAX_OUTPUT) return current;
  return (current + String(chunk || "")).slice(0, MAX_OUTPUT);
}

function inside(root, target) {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export class SkillRuntimeTools {
  constructor({ library = null, workspace = process.cwd() } = {}) {
    this.library = library;
    this.workspace = resolve(workspace);
  }

  attach(library) {
    this.library = library;
    return this;
  }

  tools() {
    return [
      {
        name: "skill_list",
        modelName: "skill_list",
        description: "List installed ASUKA skills with name, description, enabled state, package path and resource folders. Safe read-only discovery.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        risk: "safe",
        builtin: true,
        serverId: "skill-runtime",
        serverName: "ASUKA Skill Runtime",
      },
      {
        name: "skill_read",
        modelName: "skill_read",
        description: "Read one file inside an installed skill package, such as SKILL.md, references/*.md, assets metadata or scripts. Paths are confined to the selected skill directory.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            path: { type: "string", description: "Relative path inside the skill, default SKILL.md." },
          },
          required: ["name"],
          additionalProperties: false,
        },
        risk: "safe",
        builtin: true,
        serverId: "skill-runtime",
        serverName: "ASUKA Skill Runtime",
      },
      {
        name: "skill_run",
        modelName: "skill_run",
        description: "Run a script entrypoint packaged inside an installed skill. Supports .py, .js/.mjs, .ps1, .cmd/.bat and explicit runtime selection. Arguments are passed without shell interpolation.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            entrypoint: { type: "string", description: "Relative script path inside the skill package." },
            args: { type: "array", items: { type: "string" }, description: "Arguments passed directly to the script." },
            runtime: { type: "string", enum: ["auto", "python", "node", "powershell", "cmd"] },
            cwd: { type: "string", description: "Optional working directory; defaults to the ASUKA workspace." },
            timeout_ms: { type: "integer" },
          },
          required: ["name", "entrypoint"],
          additionalProperties: false,
        },
        risk: "confirm",
        builtin: true,
        serverId: "skill-runtime",
        serverName: "ASUKA Skill Runtime",
      },
    ];
  }

  riskFor(name) {
    return name === "skill_run" ? "confirm" : "safe";
  }

  skill(name) {
    if (!this.library) throw new Error("ASUKA Skill Runtime is not attached to a skill library");
    const skill = this.library.get(String(name || "").trim());
    if (!skill?.enabled) throw new Error(`Skill is not enabled: ${name || "(empty)"}`);
    return skill;
  }

  resolveInside(root, requested, fallback = "") {
    const candidate = resolve(root, String(requested || fallback));
    if (!inside(root, candidate)) throw new Error("Skill path escapes the package directory");
    if (!existsSync(candidate)) throw new Error(`Skill path not found: ${requested || fallback}`);
    const realRoot = realpathSync(root);
    const realTarget = realpathSync(candidate);
    if (!inside(realRoot, realTarget)) throw new Error("Skill path escapes the package directory");
    return realTarget;
  }

  async call(name, args = {}) {
    if (name === "skill_list") {
      const skills = (this.library?.list() || []).map((skill) => ({ ...skill, path: skill.everyBot ? this.library.pathFor(skill.name) : "" }));
      return { content: [{ type: "text", text: JSON.stringify({ skills }, null, 2) }] };
    }
    if (name === "skill_read") {
      const skill = this.skill(args.name);
      if (!skill.everyBot) {
        const requestedPath = String(args.path || "SKILL.md").replaceAll("\\", "/");
        if (requestedPath !== "SKILL.md") throw new Error("Agent-private skills only expose SKILL.md through skill_read");
        return { content: [{ type: "text", text: String(skill.text || "").slice(0, 200_000) }] };
      }
      const root = this.library.pathFor(skill.name);
      const file = this.resolveInside(root, args.path, "SKILL.md");
      if (!statSync(file).isFile()) throw new Error("skill_read path must be a file");
      return { content: [{ type: "text", text: readFileSync(file, "utf8").slice(0, 200_000) }] };
    }
    if (name === "skill_run") {
      const skill = this.skill(args.name);
      if (!skill.everyBot) throw new Error("Agent-private skills do not have a package directory to execute");
      const root = this.library.pathFor(skill.name);
      const entrypoint = this.resolveInside(root, args.entrypoint);
      if (!statSync(entrypoint).isFile()) throw new Error("skill_run entrypoint must be a file");
      const extension = extname(entrypoint).toLowerCase();
      const requestedRuntime = args.runtime || "auto";
      const runtime = requestedRuntime === "auto"
        ? extension === ".py" ? "python" : [".js", ".mjs", ".cjs"].includes(extension) ? "node" : [".ps1"].includes(extension) ? "powershell" : [".cmd", ".bat"].includes(extension) ? "cmd" : "node"
        : requestedRuntime;
      const command = runtime === "python" ? "python" : runtime === "node" ? "node" : runtime === "powershell" ? "powershell.exe" : runtime === "cmd" ? "cmd.exe" : "";
      if (!command) throw new Error(`Unsupported skill runtime: ${runtime}`);
      const prefix = runtime === "powershell" ? ["-NoLogo", "-NoProfile", "-NonInteractive", "-File"] : runtime === "cmd" ? ["/d", "/s", "/c"] : [];
      const requestedArgs = Array.isArray(args.args) ? args.args.map((item) => String(item)) : [];
      const cwd = resolve(String(args.cwd || this.workspace));
      const timeoutMs = Math.max(1_000, Math.min(Number(args.timeout_ms) || DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS));
      return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(command, [...prefix, entrypoint, ...requestedArgs], {
          cwd,
          windowsHide: true,
          env: { ...process.env, ASUKA_SKILL_NAME: skill.name, ASUKA_SKILL_ROOT: root, ASUKA_WORKSPACE: this.workspace },
        });
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
        child.stdout.on("data", (chunk) => { stdout = appendOutput(stdout, chunk); });
        child.stderr.on("data", (chunk) => { stderr = appendOutput(stderr, chunk); });
        child.on("error", (error) => { clearTimeout(timer); rejectPromise(error); });
        child.on("close", (code) => {
          clearTimeout(timer);
          const text = [`skill=${skill.name}`, `entrypoint=${entrypoint}`, `cwd=${cwd}`, `exit=${code ?? "unknown"}${timedOut ? " (timed out)" : ""}`, stdout.trim() ? `stdout:\n${stdout.trim()}` : "", stderr.trim() ? `stderr:\n${stderr.trim()}` : ""].filter(Boolean).join("\n\n");
          if (timedOut || code !== 0) rejectPromise(new Error(timedOut ? `Skill command timed out after ${timeoutMs}ms\n${text}` : `Skill command failed with exit ${code}\n${text}`));
          else resolvePromise({ content: [{ type: "text", text }] });
        });
      });
    }
    throw new Error("Unknown ASUKA skill runtime tool");
  }
}
