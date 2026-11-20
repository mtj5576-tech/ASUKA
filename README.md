# ASUKA

ASUKA is a local-first personal agent desk with five execution adapters: Native, Codex, Claude, DSH and OpenMausBot. Native is the default, local coding agents are selected by capability, and OpenMausBot is an explicit compatibility mode rather than a required backend.

## Run

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

The Vite dev server proxies `/omb` to `http://127.0.0.1:8799`. Set `OMB_URL` for the production proxy if OpenMausBot listens elsewhere.

The client can switch or auto-discover the OpenMausBot address from **设置**. The local proxy accepts `8799`, `18799`, and `28799` during discovery and applies the selected address to subsequent API requests.

Provider setup is available in **设置 → 接入模型 API**. The wizard tests a key with OpenMausBot, saves it through `PUT /api/config`, and refreshes the corresponding model catalog. The key is sent only to OpenMausBot and is never written to browser storage.

Native setup is available in **设置 → 本地模型执行**. Saving a Native Provider keeps the key out of the renderer; the desktop client encrypts it with Windows credential protection. Enabling Native makes tasks run without an OpenMausBot process.

Built-in platform presets include OpenAI, Anthropic, OpenRouter, xAI, Mistral, Groq, Cerebras, Greenference, ModelGo, Meta, DeepSeek, Qwen/DashScope, Z.ai/GLM, Moonshot/Kimi, and a custom OpenAI-compatible endpoint. Compatible presets create separate endpoint instances, so one platform does not overwrite another.

## Native first use

1. Open **设置 → 本地模型执行**.
2. Select `OpenAI-compatible` or `Anthropic`, enter Base URL, model ID and API key.
3. Test the connection, save, then select **启用 Native**.
4. Open **指挥台**, keep `ENGINE = Native`, and submit a research or API-only task.
5. Native Adapter routes through NOVA, chooses one primary worker, collects bounded Worker Contracts and sends the result plus tool evidence to an independent Reviewer. The primary worker can call enabled local MCP tools; state-changing calls and Computer Use actions pause for one-time approval. Results, streams, tool transcripts and approvals stay in local SQLite.

Native uses deterministic orchestration rather than free-form Bot discussion: NOVA is not a worker, only one Bot owns the final deliverable at a time, and specialist contributions cannot block the primary worker. See [docs/multi-agent-workflow.md](docs/multi-agent-workflow.md) and [docs/native-adapter.md](docs/native-adapter.md).

Skills use Codex-compatible progressive disclosure. ASUKA discovers each `SKILL.md` automatically, exposes `skill_list`, `skill_read` and `skill_run`, and loads references or scripts only when the selected workflow needs them. See [docs/skill-runtime.md](docs/skill-runtime.md).

Task-generated files are indexed by path and shown as clickable deliverable cards in the room conversation and task detail view, regardless of file type. See [docs/artifacts.md](docs/artifacts.md).

ASUKA ships with a global Native skill library under `skills/`. The bundled skills are enabled for every bot by default, and their enabled state is shared across bots. The executor receives a compact catalog on every task and loads the full `SKILL.md` body when the user names a skill explicitly.

## Coding Agent adapters

ASUKA detects `codex`, `claude` and `dsh` from PATH. Available agents can be selected in **设置 → Adapter Registry** or directly from the composer `ENGINE` menu.

- Codex uses `codex exec --json` with the existing Codex host login.
- Claude uses `claude -p --output-format stream-json` when its CLI is installed.
- DSH uses `dsh headless` with the existing DSH profile.

Set `ASUKA_WORKSPACE` to the project directory the local coding adapters should inspect. Codex runs read-only in this registry slice. See [docs/adapter-registry.md](docs/adapter-registry.md).

## OpenMausBot compatibility

1. Start OpenMausBot only when its broader runtime, Skills or MCP compatibility is needed.
2. In **设置 → Adapter Registry**, explicitly choose **OpenMausBot Adapter**.
3. ASUKA creates a separate `ASUKA` section, three agents using available runtimes, and the `ASUKA Command` room.
4. Dispatch a task from the room composer.

The UI exposes unavailable adapters without silently substituting them. Configure Native keys in ASUKA, use the existing host login for coding CLIs, or explicitly select OpenMausBot when its downstream runtime credentials are required.

## Integration boundary

- ASUKA Core owns adapter selection, authentication state and credential routing. Native keys are held in the ASUKA encrypted store, coding adapters reference host CLI authentication, and the OpenMausBot adapter delegates only its downstream runtime credentials to OpenMausBot.
- Codex runs through `codex exec --json`; Claude and DSH use their corresponding local CLI contracts.
- The UI reads its snapshot, task details, task actions, and Agent edits through ASUKA Core. The selected adapter owns those operations.
- OpenMausBot-specific HTTP is confined to `server/core/openmausbot-adapter.mjs`; Native execution is confined to `server/native/`; MCP transport and tool policy live under `server/tools/`; CLI adapters live under `server/adapters/`. All expose the same normalized Core contract.
- ASUKA also keeps a local OpenMausBot HTTP proxy for provider and skill operations not yet normalized by Core. Its MCP server can be used by external MCP clients, but the browser UI cannot launch a stdio MCP process directly.
- OpenMausBot approval cards are written back through `POST /api/threads/:id/respond`. Native approval cards are resolved in local SQLite through the same ASUKA approval UI.

## Production build

```powershell
npm run build
npm start
```

The production server listens on `http://127.0.0.1:4173` by default and proxies `/omb` to the local OpenMausBot API.

## Desktop client

```powershell
npm run desktop
```

This builds the web client and opens it in Electron. The desktop process starts its own local proxy on an available loopback port, so it does not conflict with the browser build on `4173`.

The connection screen can also launch OpenMausBot when it is not already running. It checks `OPENMAUSBOT_APP`, the standard per-user Windows install locations, and `OPENMAUSBOT_SOURCE` or `E:\grok` source checkouts with an Electron launcher.

Build a Windows portable executable with:

```powershell
npm run desktop:dist
```

The output is `release/ASUKA-0.8.38-portable.exe`. Native and coding adapters run without OpenMausBot and store independent task state under Electron's per-user data directory.

## P0 operations

- Edit an Agent's name, responsibilities, instructions, Runtime, model, approval level, and ASUKA room membership.
- Open the task inbox to inspect job state, stop a running task, retry the latest user request, or continue the task with another message.
- Configure OpenAI, Anthropic, OpenRouter, or an OpenAI-compatible endpoint from the desktop client.
- Start or reconnect OpenMausBot from the connection screen without editing configuration files.

## Decision Core

Decision Core v1 is frozen in `shared/decision/contracts.mjs`. It provides deterministic task classification, scale/risk scoring, compact team selection, capability-gap detection, workflow ordering, evaluation gates, approvals, stop conditions, and budgets. See [docs/decision-core.md](docs/decision-core.md).

## Native Adapter

Native Adapter implements OpenAI-compatible and Anthropic streaming, MCP tool calling, SQLite conversation and event storage, NOVA routing, one primary worker, bounded Worker Contracts, one independent Reviewer, stop, retry, task-bound approvals, output continuation and interrupted-task recovery. It uses `x-asuka-adapter: native` on the same ASUKA Core routes. See [docs/native-adapter.md](docs/native-adapter.md).

## Adapter Registry

The final registry is `NativeAdapter`, `CodexAdapter`, `ClaudeAdapter`, `DSHAdapter` and `OpenMausBotAdapter`. `GET /__asuka/core/adapters` reports availability and versions. Requests default to Native and never fall back to OpenMausBot implicitly. See [docs/adapter-registry.md](docs/adapter-registry.md).

## Task Fabric

ASUKA tasks now persist an immutable Mandate, a structured executor Report and a deterministic Ticket Stage. The Fabric view groups tasks into Human Attention, Working, Queued, Idle and Ended, with retry and stop controls. This contract is adapted from dsh-superagent without embedding DSH or Cordis. See [docs/task-fabric.md](docs/task-fabric.md).

## Mission Control

The command room now displays a live decision workflow derived from the real TeamPlan: decision/architecture, grouped execution, review/security and delivery. Each group can be opened to inspect assigned roles, deliverables, gates and execution events. While a Native task runs, the composer switches to guidance mode and feeds user direction into the next execution stage without bypassing approvals. See [docs/mission-control.md](docs/mission-control.md).

## Room visualization

ASUKA Command includes an embedded Archify architecture view built from the current room, bots, tasks, projects, skills, tools and approval gates. The generated artifact is self-contained HTML rendered by the vendored Archify 3.2.0 engine under `vendor/archify/` (upstream commit `44781293f38728baf04dbad33ce1a0cef8c39cca`, Apache-2.0). The `架构视图` button switches between the live diagram and the room conversation.

## MCP and Computer Use

The Tools view connects local stdio and remote HTTPS MCP servers, discovers tools, resources and prompts, and exposes a JSON argument console with local audit. A GitHub PAT preset targets GitHub's hosted MCP endpoint. Native Agent tasks automatically receive the enabled MCP tool catalog. Read-only tools can run directly; state-changing tools require a task-scoped one-time approval bound to the exact arguments. If Windows-MCP is installed, Computer Use requires an observation before an action and automatically captures a fresh Snapshot after each GUI action. See [docs/computer-use-and-mcp.md](docs/computer-use-and-mcp.md).

## Native settings

Settings is now a dedicated ASUKA console with searchable navigation for general behavior, appearance, permissions, storage, models, connectors, Computer Use, browser policy, personalization, Git and advanced capability status. Preferences persist in `<dataDir>/asuka-settings.json`; only implemented controls are presented as active. See [docs/settings.md](docs/settings.md).
