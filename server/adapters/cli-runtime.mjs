import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { botLanguageInstruction } from "../language.mjs";

const ANSI = /\u001b\[[0-9;]*m/g;

function cleanOutput(value) {
  return String(value || "").replace(ANSI, "").trim();
}

function where(command) {
  const result = spawnSync(process.platform === "win32" ? "where.exe" : "which", [command], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5_000,
  });
  return cleanOutput(result.stdout).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function npmPackageBin(shimPath, packageName, bins) {
  const root = dirname(shimPath);
  for (const relative of bins) {
    const candidate = join(root, "node_modules", ...packageName.split("/"), relative);
    if (existsSync(candidate)) return candidate;
  }
  return "";
}

function resolveLauncher(spec) {
  const candidates = where(spec.command);
  if (!candidates.length) return null;
  const exe = candidates.find((path) => path.toLowerCase().endsWith(".exe"));
  if (exe) return { command: exe, prefixArgs: [] };
  const cmd = candidates.find((path) => path.toLowerCase().endsWith(".cmd"));
  if (cmd && spec.packageName) {
    const bin = npmPackageBin(cmd, spec.packageName, spec.packageBins || []);
    if (bin) return { command: process.execPath, prefixArgs: [bin] };
  }
  const direct = candidates.find((path) => path.toLowerCase().endsWith(".cmd") || path.toLowerCase().endsWith(".exe"));
  return direct ? { command: direct, prefixArgs: [] } : null;
}

function detectVersion(launcher) {
  if (!launcher) return null;
  const result = spawnSync(launcher.command, [...launcher.prefixArgs, "--version"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 8_000,
  });
  return cleanOutput(result.stdout) || cleanOutput(result.stderr) || null;
}

const SPECS = {
  codex: {
    command: "codex",
    label: "Codex",
    model: "codex-default",
    description: "Local Codex coding agent with the current host authentication.",
  },
  claude: {
    command: "claude",
    label: "Claude Code",
    model: "claude-code",
    description: "Local Claude Code CLI with the current host authentication.",
    packageName: "@anthropic-ai/claude-code",
    packageBins: ["cli.js", "cli.mjs", "index.js"],
  },
  dsh: {
    command: "dsh",
    label: "DeepSeek Harness",
    model: "dsh-default",
    description: "DeepSeek Harness headless profile with the current local configuration.",
    packageName: "@deepseek-ai/dsh",
    packageBins: ["lib/bin.js", "bin.js"],
  },
};

export function createCliRuntime(kind, options = {}) {
  const spec = SPECS[kind];
  if (!spec) throw new Error(`unsupported CLI runtime: ${kind}`);
  const launcher = options.launcher || resolveLauncher(spec);
  const version = options.version || detectVersion(launcher);
  return {
    kind,
    label: spec.label,
    model: options.model || spec.model,
    description: spec.description,
    available: Boolean(launcher),
    reason: launcher ? "" : `${spec.command} CLI was not found in PATH`,
    command: launcher?.command || "",
    prefixArgs: launcher?.prefixArgs || [],
    version,
    workspace: options.workspace || process.cwd(),
  };
}

function promptFor({ system, messages }) {
  const history = (messages || []).map((message) => `${message.role === "assistant" ? "Assistant" : "User"}:\n${message.content}`).join("\n\n");
  return `${system || ""}\n\n${history}`.trim();
}

function extractClaudeText(payload) {
  const content = payload?.message?.content;
  if (!Array.isArray(content)) return "";
  return content.filter((item) => item?.type === "text").map((item) => item.text || "").join("");
}

function commandFor(runtime, prompt, settings = null) {
  if (runtime.kind === "codex") {
    const fullAccess = settings?.permissions?.fullAccess === true;
    const workspaceWrite = settings?.permissions?.workspaceWrite === true && settings?.git?.readOnly === false;
    return {
      args: [
        ...runtime.prefixArgs,
        "exec",
        "--json",
        "--ephemeral",
        "--skip-git-repo-check",
        "--sandbox",
        fullAccess ? "danger-full-access" : workspaceWrite ? "workspace-write" : "read-only",
        "-C",
        runtime.workspace,
        "-",
      ],
      stdin: prompt,
    };
  }
  if (runtime.kind === "claude") {
    return {
      args: [...runtime.prefixArgs, "-p", "--output-format", "stream-json", "--verbose"],
      stdin: prompt,
    };
  }
  if (runtime.kind === "dsh") {
    if (prompt.length > 5_000) throw new Error("DSH adapter prompt exceeds the Windows one-shot command limit");
    return { args: [...runtime.prefixArgs, "headless", prompt], stdin: "" };
  }
  throw new Error(`unsupported CLI runtime: ${runtime.kind}`);
}

async function runProcess(runtime, prompt, { signal, onStdout, settingsStore } = {}) {
  if (!runtime.available) throw new Error(runtime.reason || `${runtime.label} is unavailable`);
  const spec = commandFor(runtime, prompt, settingsStore?.get());
  return new Promise((resolve, reject) => {
    const child = spawn(runtime.command, spec.args, {
      cwd: runtime.workspace,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    });
    const decoder = new TextDecoder();
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve({ stdout, stderr, code: child.exitCode ?? 0 });
    };
    const abort = () => {
      child.kill();
      finish(new DOMException("The operation was aborted", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk) => {
      const text = decoder.decode(chunk, { stream: true });
      stdout += text;
      onStdout?.(text, stdout);
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + decoder.decode(chunk, { stream: true })).slice(-30_000);
    });
    child.on("error", finish);
    child.on("close", (code) => {
      if (code === 0) return finish();
      finish(new Error(`${runtime.label} exited with code ${code}${cleanOutput(stderr) ? `: ${cleanOutput(stderr).slice(-1_000)}` : ""}`));
    });
    if (spec.stdin) child.stdin.end(spec.stdin);
    else child.stdin.end();
  });
}

export class CliAgentClient {
  constructor(runtime, options = {}) {
    this.runtime = runtime;
    this.settingsStore = options.settingsStore || null;
  }

  async generate({ system, messages, signal, onText }) {
    const language = this.settingsStore?.get().general.language;
    const prompt = promptFor({ system: [system, botLanguageInstruction(language)].filter(Boolean).join("\n\n"), messages });
    let text = "";
    let lineBuffer = "";
    const emit = (delta, full) => {
      Promise.resolve(onText?.(delta, full)).catch(() => {});
    };
    const consumeLine = (line) => {
      if (!line.trim()) return;
      let payload;
      try {
        payload = JSON.parse(line);
      } catch {
        return;
      }
      if (this.runtime.kind === "codex" && payload.type === "item.completed" && payload.item?.type === "agent_message") {
        text = payload.item.text || text;
        emit(text, text);
      }
      if (this.runtime.kind === "claude") {
        if (payload.type === "assistant") {
          const delta = extractClaudeText(payload);
          if (delta) {
            text += delta;
            emit(delta, text);
          }
        }
        if (payload.type === "result" && payload.result && !text) {
          text = payload.result;
          emit(text, text);
        }
      }
    };
    const result = await runProcess(this.runtime, prompt, {
      signal,
      settingsStore: this.settingsStore,
      onStdout: (chunk) => {
        if (this.runtime.kind === "dsh") {
          text += chunk;
          emit(chunk, text);
          return;
        }
        lineBuffer += chunk;
        let newline = lineBuffer.indexOf("\n");
        while (newline >= 0) {
          const line = lineBuffer.slice(0, newline).replace(/\r$/, "");
          lineBuffer = lineBuffer.slice(newline + 1);
          consumeLine(line);
          newline = lineBuffer.indexOf("\n");
        }
      },
    });
    if (lineBuffer.trim()) consumeLine(lineBuffer.replace(/\r$/, ""));
    if (!text && this.runtime.kind === "dsh") text = cleanOutput(result.stdout);
    if (!text) text = cleanOutput(result.stdout);
    return { text, usage: null };
  }

  async test() {
    return { ok: this.runtime.available, version: this.runtime.version || null };
  }

  async listModels() {
    return [this.runtime.model];
  }
}
