# Adapter Registry

ASUKA Core uses one execution contract with five adapters. The default is Native Adapter; OpenMausBot is never selected implicitly.

| Adapter | Execution | Authentication | Intended use |
|---|---|---|---|
| `native` | OpenAI-compatible or Anthropic HTTP API | ASUKA encrypted provider key | Research, analysis and API-only tasks |
| `codex` | `codex exec --json` | Existing Codex host login | Local repository inspection and coding tasks |
| `claude` | `claude -p --output-format stream-json` | Existing Claude Code host login | Local Claude Code tasks |
| `dsh` | `dsh headless` | Existing DSH profile configuration | DeepSeek Harness tasks |
| `openmausbot` | OpenMausBot REST API | OpenMausBot host credentials | Explicit compatibility workflows only |

## Selection

Core requests select an adapter with:

```text
x-asuka-adapter: native | codex | claude | dsh | openmausbot
```

EventSource clients can use `?adapter=codex` because they cannot attach custom headers. Invalid values fail closed to Native; there is no automatic fallback to OpenMausBot.

`GET /__asuka/core/adapters` returns the detected state of every adapter, including:

- availability and version;
- model or workspace;
- unavailable reason;
- `explicitOnly` for OpenMausBot;
- recommended task category.

## Authentication ownership

ASUKA Core is the authentication owner for adapter routing and status. Every snapshot and adapter descriptor reports `authOwner: "asuka"` plus the adapter-specific `credentialSource`:

- `asuka-provider-store`: encrypted Native Provider key;
- `host-cli`: existing Codex, Claude or DSH login;
- `openmausbot-adapter`: downstream runtime credentials delegated only by the explicit OMB adapter.

`GET /__asuka/core/auth` returns the active adapter and its credential source. OpenMausBot is not the global authentication authority.

## Local coding adapters

Codex, Claude and DSH reuse their existing CLI authentication. A missing CLI is shown as unavailable and cannot be selected.

CLI adapters share the local task engine:

- deterministic Decision Core evaluation;
- NOVA routing, one primary Worker, bounded Worker Contracts and one independent Reviewer;
- SQLite task and approval records;
- stop, retry and interrupted-task recovery;
- native approval cards.

Each CLI adapter has an isolated database under `<dataDir>/adapters/<kind>/`.

Codex runs in read-only sandbox mode by default. Claude and DSH retain their own CLI permission configuration. ASUKA does not silently escalate filesystem permissions.

## Workspace

CLI workspace defaults to `ASUKA_WORKSPACE`; otherwise the server process working directory is used. The detected workspace is returned in adapter metadata and displayed in Settings and Runtimes.

The first registry slice does not provide a workspace picker or per-directory ACLs. Use a dedicated project directory when launching a Cockpit instance intended for coding work.

## OpenMausBot compatibility

OpenMausBot remains a full adapter and can still expose its broader multi-runtime, Skills, MCP and approval bridge. Selecting it is explicit in Settings or in the composer engine selector. Other adapters never proxy through it automatically.

## Verification

Automated tests cover registry ordering, explicit-only OMB state, Codex JSONL parsing, Core routing and persisted Codex tasks. Manual smoke tests exercise the installed `codex` and `dsh` CLIs; Claude remains unavailable until its CLI is installed.
