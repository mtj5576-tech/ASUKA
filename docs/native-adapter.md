# Native Adapter v1

Native Adapter is the first execution path that does not require OpenMausBot. It supports text tasks and a bounded MCP tool loop for local integrations and Computer Use.

It is the default member of the five-adapter registry. Codex, Claude and DSH reuse the same local task engine through CLI clients. See [adapter-registry.md](adapter-registry.md).

## Execution flow

```text
user task
  -> frozen Decision Core
  -> SQLite task and plan record
  -> NOVA deterministic route and one primary worker
  -> bounded Worker Contracts from the smallest capable team
  -> approval gate when required
  -> one provider-backed primary worker
  -> safe MCP calls, then loop with tool results
  -> one-time approval for state-changing MCP or GUI actions
  -> one independent reviewer
  -> persisted result and acceptance verdict
```

The Decision Core remains unchanged. Native Adapter consumes its `DecisionRecord` and `TeamPlan`; NOVA cannot become a Worker, and the model cannot override risk gates or introduce a second final assembler.

## Providers

- OpenAI-compatible: `POST {baseUrl}/chat/completions`; task generation streams SSE, while JSON Reviewer requests use non-stream JSON mode for a stable verdict contract.
- Anthropic: `POST {baseUrl}/v1/messages` with the required `anthropic-version` header and SSE text deltas.

Protocol references: [OpenAI streaming API responses](https://developers.openai.com/api/docs/guides/streaming-responses) and [Anthropic messages streaming](https://docs.anthropic.com/en/api/messages-streaming).

Provider keys are never returned by the Core API. The Electron desktop client encrypts keys with `safeStorage` and stores the ciphertext in SQLite. Standalone server runs use AES-256-GCM with a local key file under the ASUKA data directory.

## Persistence

The default database is `<dataDir>/asuka-native.sqlite`. On desktop, `dataDir` is Electron's per-user `userData` directory. Standalone runs default to `~/.asuka` and can override it with `ASUKA_DATA_DIR`.

Stored records include:

- Tasks, original request, attempts, status and DecisionRecord.
- Messages and incremental streaming text.
- Evaluation verdicts and failure reasons.
- Native approval requests and responses.
- Executor model messages, including assistant tool calls and tool results.
- MCP tool approvals linked to the originating task and tool call.
- Append-only task events for routing, Worker Contracts, tools, approvals, truncation continuation and completion.
- Provider configuration with encrypted credentials.

A process restart changes unfinished `running` tasks to `interrupted`, preserves partial output, and exposes Retry. Native Adapter does not silently repeat a paid model call after a crash.

## APIs

```text
GET    /__asuka/core/native/provider
PUT    /__asuka/core/native/provider
DELETE /__asuka/core/native/provider
POST   /__asuka/core/native/provider/test
POST   /__asuka/core/native/provider/models

POST   /__asuka/core/rooms/asuka-native-room/messages
GET    /__asuka/core/tasks/:threadId
GET    /__asuka/core/tasks/:threadId/events
POST   /__asuka/core/tasks/:threadId/stop
POST   /__asuka/core/tasks/:threadId/retry
POST   /__asuka/core/approvals/:threadId/respond
```

Adapter selection uses `x-asuka-adapter: native` or the `adapter=native` query parameter. The desktop UI stores the selection locally and keeps OpenMausBot available as a separate adapter.

## Approval and stop semantics

- Every Decision Core approval request becomes a native approval card before execution starts.
- All pending approvals must be allowed before the executor is called.
- An MCP operation marked destructive or state-changing creates a second approval bound to the server, tool, exact arguments, expiry and one successful consumption.
- Computer Use requires a prior `Snapshot` or `Screenshot`. A state-changing GUI action pauses for approval, executes once, and automatically captures a new `Snapshot` before the model can act again.
- Denying any card cancels the run.
- An approved MCP call writes its result back to the original `tool_call_id` before the conversation resumes.
- Stop aborts the active provider request, preserves partial text and marks the task `cancelled`.
- Retry starts a new attempt from the original request and records the attempt count.

## Reliability boundaries

- One primary Worker and one Reviewer at any execution stage; other Bots return bounded contributions and cannot become parallel final assemblers.
- Browser-skill evidence requires distinct valid pages and at least two official hosts by default. Explicit 404, soft 404, login and error pages are excluded from the evidence budget.
- When the BrowserSkill evidence budget is reached, tool access is removed for the next generation step so the worker must synthesize the deliverable instead of browsing indefinitely.
- A provider `length` finish creates a continuation request and merges the fragments into one report before review. The continuation cap is bounded.
- Reviewer requests use JSON response mode with a non-stream transport. Two malformed verdicts degrade the task while preserving the worker result.
- With Full Access enabled, Native exposes an audited `local_command` tool rooted at the configured workspace. This is the execution path for loaded Skills that require Python, Node, document rendering or other local scripts.
- `skill_list`, `skill_read` and `skill_run` provide a package-level Skill interface for current and future `skills/<name>/SKILL.md` directories. See [skill-runtime.md](skill-runtime.md).
- Remote MCP is limited to HTTPS Streamable HTTP with static encrypted headers; interactive OAuth is not included yet.
- MCP tool rounds are capped and one state-changing Computer Use action is allowed per model turn.
- Terminal, password-manager, security-settings, ASUKA and ChatGPT desktop automation are blocked.
- No provider fallback or automatic paid retry.
- Artifact preview, cost dashboard and recovery of an in-flight stream are not included.

## Verification

`tests/native-adapter.test.mjs` covers HTTP provider streaming, SQLite persistence, approval gating, stop, retry, restart recovery, API-key redaction, NOVA routing and task contracts. `tests/browser-evidence.test.mjs` covers evidence-budget completion, duplicate pages, hard and soft 404 rejection, escaped BrowserSkill payloads and independent-host requirements. `tests/native-tools.test.mjs` covers safe MCP calls, task-bound tool approval, denial, Computer Use refresh and audit. `tests/provider-clients.test.mjs` verifies provider streaming, JSON response mode, tool calls and tool-result serialization.
