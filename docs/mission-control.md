# Mission Control

ASUKA `0.8.3` turns the command room into a task mission-control surface.

## Interaction flow

```text
user brief
  -> deterministic Decision Bot analysis
  -> role and bot-group assignment from TeamPlan
  -> decision / execution / review / delivery workflow
  -> stage reports in the conversation
  -> optional user guidance during execution
  -> reviewer gate and final delivery
```

## Workflow visualization

The four visible groups are derived from the frozen Decision Core `TeamPlan.workflow`:

- Decision and architecture: `scope`, `discover`, `design`.
- Group execution: `build`.
- Review and security: `evaluate`, `secure`.
- Delivery and report: `deliver`.

Each group exposes its assigned roles, deliverables and gates. Clicking a group opens its execution view with the relevant planner, executor, reviewer, approval and tool events. This interaction model is inspired by Archify's traceable node-and-path presentation, but ASUKA does not depend on Archify at runtime.

## Stage reports

The conversation keeps the existing planner, executor and reviewer messages. The mission map adds a live decision brief and current group state. The group states are explicitly derived from task state and persisted messages, not invented runtime telemetry.

## User guidance

While a Native task is running, the composer switches from task dispatch to guidance mode. Guidance is:

1. written to the task conversation immediately;
2. queued in the active run;
3. incorporated by the Decision Bot at the next model/tool stage;
4. reported in the conversation before execution continues.

If the user sends nothing, execution continues along the planned route. Guidance does not bypass approvals or reviewer gates.

## API

```text
POST /__asuka/core/tasks/:threadId/guidance
```

The endpoint is available on the Native Adapter while a task is running.
