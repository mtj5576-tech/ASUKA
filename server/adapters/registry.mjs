import { OpenMausBotAdapter } from "../core/openmausbot-adapter.mjs";
import { NativeAdapter } from "../native/native-adapter.mjs";
import { ClaudeAdapter, CodexAdapter, DSHAdapter } from "./cli-adapters.mjs";

export const ADAPTER_IDS = ["native", "codex", "claude", "dsh", "openmausbot"];

function normalizeAdapterId(value) {
  const id = String(value || "").toLowerCase();
  return ADAPTER_IDS.includes(id) ? id : "native";
}

function timeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("adapter health check timed out")), ms)),
  ]);
}

export function createAdapterRegistry(options = {}) {
  const dataDir = options.dataDir || process.cwd();
  const native = options.nativeAdapter || new NativeAdapter({
    dataDir,
    databasePath: options.nativeDatabasePath,
    secretStore: options.secretStore,
    providerFactory: options.nativeProviderFactory,
    toolManager: options.toolManager,
    settingsStore: options.settingsStore,
    skillsDir: options.skillsDir,
    maxToolRounds: options.maxToolRounds,
  });
  const localAdapters = {
    native,
    codex: options.codexAdapter || new CodexAdapter({ dataDir, workspaceDir: options.workspaceDir, settingsStore: options.settingsStore }),
    claude: options.claudeAdapter || new ClaudeAdapter({ dataDir, workspaceDir: options.workspaceDir, settingsStore: options.settingsStore }),
    dsh: options.dshAdapter || new DSHAdapter({ dataDir, workspaceDir: options.workspaceDir, settingsStore: options.settingsStore }),
  };

  function resolve(kind, resolveOrigin) {
    const id = normalizeAdapterId(kind);
    if (id === "openmausbot") return new OpenMausBotAdapter(resolveOrigin);
    return localAdapters[id];
  }

  async function descriptors(resolveOrigin, { probeOmb = false } = {}) {
    const nativeHealth = native.health();
    const nativeProvider = native.providerInfo();
    let omb = { available: false, version: null, reason: "OpenMausBot is optional and was not probed" };
    if (probeOmb && resolveOrigin) {
      try {
        const health = await timeout(new OpenMausBotAdapter(resolveOrigin).health(), 1500);
        omb = { available: health?.app === "openmausbot", version: health?.version || null, reason: "" };
      } catch (error) {
        omb.reason = error instanceof Error ? error.message : String(error);
      }
    }
    const cli = (adapter) => {
      const health = adapter.health();
      return {
        available: Boolean(health.ok),
        version: health.version || null,
        reason: health.runtime?.reason || "",
        model: health.runtime?.model || "",
        workspace: health.runtime?.workspace || "",
      };
    };
    return [
      {
        id: "native",
        label: "Bot API · Native",
        category: "pure-api",
        available: Boolean(nativeProvider.configured),
        version: nativeHealth.version,
        reason: nativeProvider.configured ? "" : "Configure an OpenAI-compatible or Anthropic provider",
        model: nativeProvider.model || "",
        authOwner: "asuka",
        credentialSource: "asuka-provider-store",
        explicitOnly: false,
        recommendedFor: "Research, analysis and API-only work",
      },
      {
        id: "codex",
        label: "Codex Adapter",
        category: "coding-agent",
        ...cli(localAdapters.codex),
        authOwner: "asuka",
        credentialSource: "host-cli",
        explicitOnly: false,
        recommendedFor: "Local repository inspection and coding work",
      },
      {
        id: "claude",
        label: "Claude Adapter",
        category: "coding-agent",
        ...cli(localAdapters.claude),
        authOwner: "asuka",
        credentialSource: "host-cli",
        explicitOnly: false,
        recommendedFor: "Local Claude Code workflows",
      },
      {
        id: "dsh",
        label: "DSH Adapter",
        category: "coding-agent",
        ...cli(localAdapters.dsh),
        authOwner: "asuka",
        credentialSource: "host-cli",
        explicitOnly: false,
        recommendedFor: "DeepSeek Harness headless tasks",
      },
      {
        id: "openmausbot",
        label: "OpenMausBot Adapter",
        category: "compatibility",
        ...omb,
        authOwner: "asuka",
        credentialSource: "openmausbot-adapter",
        model: "runtime-managed",
        workspace: "",
        explicitOnly: true,
        recommendedFor: "Explicit compatibility, multi-runtime and approval bridge workflows",
      },
    ];
  }

  function close() {
    for (const adapter of Object.values(localAdapters)) adapter.close();
  }

  return { resolve, descriptors, close, localAdapters, nativeAdapter: native };
}

export { normalizeAdapterId };
