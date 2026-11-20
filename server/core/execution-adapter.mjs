export class ExecutionAdapter {
  async snapshot() { throw new Error("snapshot is not implemented"); }
  async getTask() { throw new Error("getTask is not implemented"); }
  async stopTask() { throw new Error("stopTask is not implemented"); }
  async sendTask() { throw new Error("sendTask is not implemented"); }
  async updateAgent() { throw new Error("updateAgent is not implemented"); }
}

export function createExecutionAdapter(kind, options) {
  if (["native", "openmausbot", "codex", "claude", "dsh"].includes(kind)) return options.registry.resolve(kind, options.resolveOrigin);
  throw new Error(`unsupported execution adapter: ${kind}`);
}
