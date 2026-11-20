# ASUKA Multi-Bot Workflow

Updated: 2026-11-20

## Decision

ASUKA must turn a user goal into a usable result before it exposes internal team complexity. A bot team is useful only when each step has an owner, an input contract, a concrete output, evidence, a failure path and a final assembler.

The minimum production loop is:

```text
goal
  -> normalize the user or external event
  -> NOVA classifies task and risk deterministically
  -> append the route and select the smallest capable team
  -> produce bounded Worker Contracts
  -> let one primary Worker act with tools and synthesize the result
  -> give the reviewer the output, team contributions and tool evidence
  -> repair rejected work
  -> deliver the result, or return a precise human blocker
```

## NOVA Orchestration

NOVA is the ASUKA orchestration layer, not a Worker. It owns event intake, deterministic routing, assignment, approval boundaries and acceptance coordination. A task has one primary Worker, while specialist Bots return bounded contracts instead of generating competing final answers.

The Task Fabric view is a projection over append-only events. Routing, Worker Contracts, tool requests/results, approval decisions, output continuation and final acceptance remain inspectable after a restart.

## Observed Failure

Primary evidence from the local ASUKA task database on 2026-11-19:

- `7c2a55fd-25b2-b455-bb67-ba6edd9b6ca3` asked ASUKA to test `browser-skill` and open the browser. Decision Core classified the goal as `unknown`, selected only Planner and Reviewer, and the Planner then repeated Windows-MCP `ControlStatus`, `Screenshot`, `Snapshot` and `Wait` until the run ended with `Native task exceeded the MCP tool round limit`.
- `5769c880-a1db-4a22-8581-450b3b7b60b5` produced an execution plan but no browser-skill execution evidence. The reviewer correctly rejected it, but the runtime had no repair stage and ended the task.
- `5859394a-fc33-4168-a5cf-0425857af34c` lost the executor result because the reviewer returned prose instead of strict JSON. A review-format failure was treated as a task failure.

The common causes were architectural, not model-specific:

1. Action goals could fall into `unknown` and receive no tool-capable builder.
2. Team members were model calls, not workers with independently scoped tools and handoff artifacts.
3. Reviewer input contained only the final executor text, not team contributions or tool evidence.
4. A rejected result had no repair loop.
5. A malformed review or unavailable desktop control replaced the user deliverable with an infrastructure error.

## Reference Patterns

These are vendor or project primary sources and are used as design evidence, not as proof that ASUKA should copy their implementation.

| Source | Relevant pattern | What ASUKA adopts |
| --- | --- | --- |
| Anthropic, [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system), 2025-06-13 | Lead agent decomposes work; parallel subagents use separate context windows; the lead compresses findings | Keep a single accountable lead and give it compressed specialist contributions |
| xAI, [Multi Agent](https://docs.x.ai/developers/model-capabilities/text/multi-agent.md), accessed 2026-11-20 (beta) | Specialized agents gather and synthesize; a leader returns the final answer | Make the execution lead the only user-facing assembler |
| xAI, [How Grok Bot Works](https://docs.x.ai/grok-bot/how-grok-bot-works.md), accessed 2026-11-20 | A primary Bot coordinates smaller one-job Bots; actions are checked and risky steps pause | Keep NOVA as the interface while domain/capability Bots own concrete work |
| Meta, [How We Designed Muse](https://muse.ai/blog/how-we-designed-muse), 2026-09-08 | Multiple background tasks, multiple agents, goals, activity log and deterministic approvals | Persist task state, expose tool activity and reserve human approval for consequential actions |
| Meta, [How We Built Safety Into Muse](https://muse.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse), 2026-09-08 | Independent permission authority and task-scoped capabilities | Tool approvals remain outside the model's control |
| OpenAI, [Meet dots](https://learn.chatgpt.com/docs/dots) and [Tasks and memory](https://learn.chatgpt.com/docs/dots/tasks-and-memory), accessed 2026-11-20 | Background agents run in parallel, report to the primary agent, and completed runs still require output review | Reviewer sees evidence and acceptance is separate from process completion |
| OpenAI Agents SDK, [Handoffs](https://openai.github.io/openai-agents-python/handoffs/) | Delegate to specialized agents through explicit handoffs | Each team assignment must have a bounded deliverable and return path |
| LangGraph, [repository](https://github.com/langchain-ai/langgraph) | Durable execution, checkpoints, human-in-the-loop and resumability | Preserve the task and model/tool transcript at every failure boundary |
| CrewAI, [Flows](https://docs.crewai.com/en/concepts/flows) | Deterministic event-driven workflow around autonomous crews | Use deterministic routing and review around model calls |
| MetaGPT, [repository](https://github.com/FoundationAgents/MetaGPT) | `Code = SOP(Team)` and role-specific handoffs | Encode workflow rules instead of relying on persona prose |

No source above establishes a universal statistical rule for bot division. The safe conclusion is that these are high-performance product and framework samples with convergent design choices.

## ASUKA Invariants

1. A bot assignment is not complete until it returns a concrete artifact or a precise failure reason.
2. Only the execution lead generates the final user-facing deliverable.
3. The reviewer receives team contributions and tool evidence, not just the polished final text.
4. A review rejection creates a repair turn with explicit defects.
5. A malformed reviewer verdict cannot erase the executor result; ASUKA retries the JSON contract and then labels the result as degraded.
6. `USER_CONTROL` is a human handoff state, not an infinite wait loop.
7. A task ends in one of three useful states: deliverable accepted, deliverable preserved with a review caveat, or exact human action required.
8. Tool capability follows the selected skill. If `browser-skill` is explicitly requested, the selected Worker uses the built-in, scoped BrowserSkill tools rather than an unrestricted terminal.
9. A BrowserSkill evidence budget counts only successfully synced, non-error pages. The default requires three distinct pages across at least two official hosts, then removes tool access so the Worker must synthesize the result.
10. Hard 404, soft 404, login and error pages never count as evidence. Escaped JSON payloads from the BrowserSkill CLI are inspected as data, not trusted as page truth.
11. A provider `length` finish is continued from the exact stopping point and the fragments are merged before review. A bounded continuation cap prevents endless generation.
12. Reviewer verdicts use JSON response mode over a non-stream request. If two verdicts remain malformed, the Worker result is preserved and marked degraded rather than discarded.

## Acceptance Check

The workflow is observable through the local task transcript:

- The Decision Record names the correct task type and tool-capable role.
- Team contributions appear before the lead output.
- Reviewer input contains `Team contributions` and `Tool evidence`.
- NOVA appears in the route and members list but never in the assignment list as a Worker.
- Browser evidence records successful page count, independent host count and rejected error pages.
- A truncated provider response produces `executor.output_truncated` and the final merged report ends with a complete conclusion or action list.
- A rejected first result produces a repaired second result.
- Invalid reviewer JSON produces a `DEGRADED` digest while preserving the executor result.
- Repeated Windows `USER_CONTROL` produces a `needs-input` task with a concrete next action, not an MCP round-limit failure.
