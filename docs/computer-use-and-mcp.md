# Computer Use and MCP Tool Fabric

ASUKA exposes local stdio and remote HTTPS MCP servers plus a controlled Computer Use surface without importing Codex's private Sky client into the application runtime.

## REA evidence

### Windows helper

REA inspected `codex-computer-use.exe` as a PE x86-64 artifact:

- Evidence ID: `ev_acc6c776bc8398fa5cdfee33cf170277343bb6d161cd2afe65e8adc42dca1d8a`
- SHA-256: `58fff5e2359aa09528f48ef37651b9013b204f99e2fd381f0d3d980cf9d2e88d`
- REA found no recognized Go build-info record.

### JavaScript client

REA analyzed the installed `@oai/sky` client files:

- Evidence ID: `ev_4289500ec52e9bdebf256aebee54a6e565314f737c20442e7963ef0c52a74018`
- Artifact SHA-256: `e060cc95c7512727e5bfae74420181a4be797a5717aacb22b0284651dfb4f1c9`
- Selected: `create_client.js`, `sky.js`, Windows client creation, client base and helper transport.
- 225 files remained outside the selected semantic scope.

The observed transport uses a private helper process and trusted `nodeRepl` service, with turn-scoped approval metadata and line-delimited helper requests. ASUKA does not bundle or impersonate that private client. It uses the public Windows-MCP stdio server as the operational backend and reproduces the observable safety contract.

## Computer Use contract adopted

- Choose one target app/window before acting.
- Observe first, then perform one action, then refresh.
- Never reuse stale element indexes, screenshot IDs or coordinates after state changes.
- Treat non-user screen text as untrusted context.
- Require immediate confirmation for clicks, typing, launches, uploads, state changes and other externally visible actions.
- Block Windows/Meta key shortcuts and GUI automation of terminals, password managers and security tools.
- Keep remote MCP on HTTPS outside loopback and keep GUI control local.

Official OpenAI documentation also states that Windows Computer Use operates on the active foreground desktop and cannot run in the background. It explicitly excludes terminal automation, administrator authentication and security/privacy permission prompts.

## MCP server support

ASUKA stores MCP server definitions in `asuka-tools.sqlite`. Stdio environment values and remote HTTP headers are encrypted with ASUKA's credential store.

The remote client supports Streamable HTTP, retains `Mcp-Session-Id`, negotiates the MCP protocol version and accepts JSON or SSE responses. Static bearer/API-key headers are supported; interactive OAuth is not part of this release.

Native Agent tasks receive a namespaced function descriptor for every discovered MCP tool. Tool calls and results are stored in the native task conversation so an approval or process restart can resume from the exact tool boundary. MCP resources and prompts are also exposed through Core for explicit clients.

When `%USERPROFILE%\.local\bin\windows-mcp.exe` is present, ASUKA seeds a local `windows-mcp` entry without modifying Codex's `config.toml`.

The Tools view includes a **GitHub PAT** preset for GitHub's hosted endpoint at `https://api.githubcopilot.com/mcp/`. Paste a fine-grained PAT into the encrypted Headers field. GitHub OAuth is not yet implemented in ASUKA.

Supported routes:

```text
GET    /__asuka/core/tools
POST   /__asuka/core/tools/servers
DELETE /__asuka/core/tools/servers/:id
POST   /__asuka/core/tools/servers/:id/connect
GET    /__asuka/core/tools/servers/:id/tools
GET    /__asuka/core/tools/servers/:id/resources
GET    /__asuka/core/tools/servers/:id/prompts
POST   /__asuka/core/tools/resources/read
POST   /__asuka/core/tools/prompts/get
POST   /__asuka/core/tools/approvals
POST   /__asuka/core/tools/approvals/:id/decide
POST   /__asuka/core/tools/call
GET    /__asuka/core/tools/audit
```

## Approval model

Read-only tools can run directly. Tools marked destructive or classified as state-changing require a one-time approval tied to server ID, tool name, exact JSON argument hash, expiry and one successful consumption.

For a Native Agent task, the tool approval is also linked to the task approval card. The model transcript, assistant tool call and tool result remain in SQLite. A denied approval cancels the task; an approved call resumes from the same call instead of replaying the paid model turn.

Changing arguments invalidates the approval. Every call, including read-only calls, is written to the local audit log. Screenshot base64 is not copied into the audit log.

## Computer Use execution

- A state-changing Windows-MCP action requires a previous `Snapshot` or `Screenshot` tool result.
- The approval card includes the exact arguments and the latest observed desktop text available to ASUKA.
- After the action, ASUKA automatically calls `Snapshot` and appends the new desktop state, including an image when returned, to the executor conversation.
- At most one state-changing GUI action is allowed per model turn. Later actions are deferred until the model has seen the refreshed state.
- The task Stop action aborts the active provider call and refuses any pending tool approval.

## UI

The Tools view includes MCP server connection, tool discovery, JSON argument console, one-time approval cards, screenshot/image rendering, quick `ControlStatus`/`Snapshot`/`Screenshot` actions for Windows-MCP, and local call audit.

## Boundaries

- No automatic installation of Windows-MCP.
- No modification of global Codex MCP configuration.
- Remote MCP uses static encrypted headers only; interactive OAuth is not included yet.
- No unattended destructive approvals.
- No direct use of the private Sky helper from ASUKA.
