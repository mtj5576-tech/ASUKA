import { join } from "node:path";

import { NativeAdapter } from "../native/native-adapter.mjs";
import { CliAgentClient, createCliRuntime } from "./cli-runtime.mjs";

class CliCodingAdapter extends NativeAdapter {
  constructor(kind, options = {}) {
    const runtime = options.runtime || createCliRuntime(kind, { workspace: options.workspaceDir });
    const adapterDataDir = join(options.dataDir, "adapters", kind);
    super({
      ...options,
      dataDir: adapterDataDir,
      databasePath: options.databasePath || join(adapterDataDir, `${kind}.sqlite`),
      runtimeId: `${kind}-cli`,
    });
    this.kind = kind;
    this.cliRuntime = runtime;
    this.settingsStore = options.settingsStore || null;
    this.clientFactory = options.clientFactory || (() => new CliAgentClient(runtime, { settingsStore: this.settingsStore }));
  }

  providerInfo() {
    return {
      kind: this.cliRuntime.kind,
      baseUrl: this.cliRuntime.workspace,
      model: this.cliRuntime.model,
      configured: this.cliRuntime.available,
      updatedAt: null,
    };
  }

  currentClient() {
    if (!this.cliRuntime.available) throw new Error(this.cliRuntime.reason || `${this.cliRuntime.label} is unavailable`);
    const configuredWorkspace = this.settingsStore?.get().general.workspace;
    if (configuredWorkspace) this.cliRuntime.workspace = configuredWorkspace;
    return this.clientFactory();
  }

  health() {
    return {
      app: `asuka-${this.kind}`,
      ok: this.cliRuntime.available,
      version: this.cliRuntime.version,
      runtime: this.publicRuntime(),
    };
  }

  publicRuntime() {
    return {
      kind: this.cliRuntime.kind,
      label: this.cliRuntime.label,
      model: this.cliRuntime.model,
      available: this.cliRuntime.available,
      reason: this.cliRuntime.reason,
      version: this.cliRuntime.version,
      workspace: this.cliRuntime.workspace,
    };
  }

  snapshot() {
    const snapshot = super.snapshot();
    const runtime = this.publicRuntime();
    snapshot.backend = { kind: this.kind, version: runtime.version || "cli", origin: "local", authOwner: "asuka", credentialSource: "host-cli" };
    snapshot.health = this.health();
    snapshot.instances = [{
      instanceId: `${this.kind}-cli`,
      displayName: runtime.label,
      driverKind: this.kind,
      url: runtime.workspace,
      snapshot: runtime.available
        ? { state: "available", authenticated: true, account: { method: "host-cli" }, reason: runtime.version || "" }
        : { state: "unavailable", authenticated: false, reason: runtime.reason },
      models: { default: runtime.model, options: [{ id: runtime.model }] },
    }];
    snapshot.bots = snapshot.bots.map((bot) => ({ ...bot, modelSelection: { instanceId: `${this.kind}-cli`, model: runtime.model } }));
    snapshot.config = { executionAdapter: runtime };
    return snapshot;
  }

  async testProvider() {
    const response = await this.currentClient().test();
    return { ok: response.ok, check: "host-cli", models: [this.cliRuntime.model], version: response.version };
  }

  async providerModels() {
    return { models: [this.cliRuntime.model] };
  }

  saveProvider() {
    throw new Error(`${this.cliRuntime.label} uses host CLI authentication and has no API key to save`);
  }

  clearProvider() {
    throw new Error(`${this.cliRuntime.label} authentication is managed by the host CLI`);
  }
}

export class CodexAdapter extends CliCodingAdapter {
  constructor(options = {}) {
    super("codex", options);
  }
}

export class ClaudeAdapter extends CliCodingAdapter {
  constructor(options = {}) {
    super("claude", options);
  }
}

export class DSHAdapter extends CliCodingAdapter {
  constructor(options = {}) {
    super("dsh", options);
  }
}
