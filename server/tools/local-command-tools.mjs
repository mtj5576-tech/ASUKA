import { spawn } from "node:child_process";
import { resolve } from "node:path";

const MAX_OUTPUT = 120_000;
const DEFAULT_TIMEOUT_MS = 5 * 60_000;
const MAX_TIMEOUT_MS = 15 * 60_000;

function appendOutput(current, chunk) {
  if (current.length >= MAX_OUTPUT) return current;
  return (current + String(chunk || "")).slice(0, MAX_OUTPUT);
}

export class LocalCommandTools {
  constructor({ defaultCwd = process.cwd() } = {}) {
    this.defaultCwd = resolve(defaultCwd);
  }

  tools() {
    return [{
      name: "local_command",
      modelName: "local_command",
      description: "ASUKA Full Access local shell. Run a PowerShell command in the workspace or an explicit cwd. Use this to execute loaded skill scripts, inspect files, create artifacts and run verification commands. All calls are audited.",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "PowerShell command to execute." },
          cwd: { type: "string", description: "Optional absolute working directory. Defaults to the configured ASUKA workspace." },
          timeout_ms: { type: "integer", description: "Optional timeout in milliseconds, capped at 15 minutes." },
        },
        required: ["command"],
        additionalProperties: false,
      },
      risk: "full",
      builtin: true,
      serverId: "local-command",
      serverName: "ASUKA Local Command",
    }];
  }

  riskFor() {
    return "full";
  }

  async call(name, args = {}) {
    if (name !== "local_command") throw new Error("Unknown local command tool");
    const command = String(args.command || "").trim();
    if (!command) throw new Error("local_command requires a command");
    const cwd = resolve(String(args.cwd || this.defaultCwd));
    const timeoutMs = Math.max(1_000, Math.min(Number(args.timeout_ms) || DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS));
    const executable = process.platform === "win32" ? "powershell.exe" : (process.env.SHELL || "/bin/sh");
    const commandArgs = process.platform === "win32"
      ? ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command]
      : ["-lc", command];

    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(executable, commandArgs, {
        cwd,
        windowsHide: true,
        env: process.env,
      });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);
      child.stdout.on("data", (chunk) => { stdout = appendOutput(stdout, chunk); });
      child.stderr.on("data", (chunk) => { stderr = appendOutput(stderr, chunk); });
      child.on("error", (error) => {
        clearTimeout(timer);
        rejectPromise(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        const parts = [
          `cwd=${cwd}`,
          `exit=${code ?? "unknown"}${timedOut ? " (timed out)" : ""}`,
          stdout.trim() ? `stdout:\n${stdout.trim()}` : "",
          stderr.trim() ? `stderr:\n${stderr.trim()}` : "",
        ].filter(Boolean);
        const text = parts.join("\n\n");
        if (timedOut) {
          rejectPromise(new Error(`Local command timed out after ${timeoutMs}ms\n${text}`));
          return;
        }
        if (code !== 0) {
          rejectPromise(new Error(`Local command failed with exit ${code}\n${text}`));
          return;
        }
        resolvePromise({ content: [{ type: "text", text }] });
      });
    });
  }
}
