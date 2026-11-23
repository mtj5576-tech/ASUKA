# Node Agent Kernel

Updated: 2026-11-20

ASUKA's Native adapter includes an internal Node Agent Kernel. It does not launch the Codex CLI, Codex SDK, Codex app-server or `codex-rs`. The kernel implements the observable agent loop inside ASUKA:

```text
model request
  -> tool calls
  -> policy check
  -> tool execution
  -> observation returned to the same Bot thread
  -> next model request
```

## Bot thread

Every participating Bot receives a durable thread keyed by task, Bot ID and purpose. A thread stores:

- its role policy and tool mode;
- model messages, tool calls and tool observations;
- turn state and tool statistics;
- append-only kernel events;
- compaction events and the last failure reason.

Thread records use the existing SQLite entity store. A process restart marks unfinished kernel threads as `interrupted`; task-level retry remains the recovery entry point.

## Policy

All Bot profiles expose the same kernel contract, but execution authority differs by assignment:

- specialist contributors receive read-only tools and cannot execute state-changing actions;
- specialist contributors are advisory-only: tools are disabled, output is capped at 4,000 characters, and the contract runs for one model turn;
- browser sessions are reserved for the single primary Worker; contributor threads receive no browser tools;
- read-only research should use `browser_skill_open`, which reuses one task-scoped background Agent Window and carries the latest context and observation IDs;
- a task reuses its first live browser session and rejects duplicate `browser_skill_session start` calls instead of creating another approval;
- any Bot selected as the primary Worker uses ASUKA's full executor path with approvals and computer-use policy;
- NOVA remains the orchestrator and does not become a task Worker.

Primary execution persists its conversation in the task model-message stream; specialist execution persists in an isolated Bot thread. Both expose the same capability contract: planning, tool observation, bounded continuation, approval-aware authority, context compaction and recovery.

This keeps context and tool work close to each Bot without allowing every Bot to write the same workspace concurrently.

## Events

Kernel activity is written both to the Bot thread and the task event ledger:

- `agent.kernel.started`;
- `agent.kernel.tool.requested`;
- `agent.kernel.tool.completed`;
- `agent.kernel.tool.failed`;
- `agent.kernel.completed`;
- `agent.kernel.failed`.

Task details expose `job.agentKernel.threads`, while bot snapshots expose each Bot's kernel mode and capabilities. Full thread records are available at `GET /__asuka/core/agents/:botId/kernel?taskId=:taskId&purpose=contributor`.

## Boundaries

- Maximum model and tool rounds are bounded by the Bot policy.
- Tool failures are returned to the model as observations rather than aborting the whole team.
- Contributor Bots may recommend a confirming action but must return it to the primary Worker through `nextAction`.
- Context is compacted by preserving the initial objective and recent messages while truncating old low-value output.
- The kernel does not claim OS-level sandbox parity by itself. Local command execution remains behind ASUKA's existing Full Access and sandbox boundary.
