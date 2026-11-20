# ASUKA Task Fabric

Task Fabric is ASUKA's bounded integration of the useful task-control patterns found in `deepseek-ai/dsh-superagent-prototype`. It does not embed DSH, Cordis or the source project.

## REA evidence

Static analysis was performed with REA JavaScript Application Analyzer 6.5.0:

- Evidence ID: `ev_283d12976911332bf1bfc2cba0c73c860f9ac7b654709bbaaa5b73df9d1ee773`
- Source commit: `8c32a9dc5d72c033816c6a8110b37f40cf94fba4`
- Analyzed files: `src/core/stage.ts`, `src/app/effects.ts`, `src/app/outbox.ts`, `src/executor/dsh.ts`, `src/core/engine.ts`, `src/policy.ts`
- Artifact digest: `7965a954cfd18503d044762fdbf8d9657579e4171745e9726471eac0ae8007fc`

REA inventoried 175 additional files outside the selected semantic scope. This integration therefore borrows the observed contracts only; it is not a complete reconstruction or dependency replacement.

REA limitations include static syntax rather than runtime execution, unresolved dynamic relationships, and partial graph coverage. The source repository's own README also labels it a research prototype, not production-ready software.

## Adopted contracts

### Mandate

Every ASUKA task records:

- owning ASUKA adapter;
- source (`asuka-desktop`);
- task scope;
- autonomy and approval mode;
- policy version and issue time.

The mandate is immutable for the life of a task. Follow-ups and retries run under the existing mandate.

### Report

Executors report one of:

- `progress`
- `waiting`
- `ready`
- `blocked`
- `failed`
- `dropped`

Reports are stored separately from task status so the raw execution claim remains auditable.

### Ticket stage

The stage is derive-only and deterministic:

- `person/delivery`
- `person/answer`
- `person/review`
- `person/blocked`
- `person/failed`
- `person/recovery`
- `working/queued`
- `working`
- `idle`
- `ended`

Native, Codex, Claude and DSH adapters share this mapping. OpenMausBot tasks use a partial mapping from its normalized snapshot until a native ticket record is available.

## API and UI

`GET /__asuka/core/fabric` returns adapter-scoped tasks, lane counts and their mandate/report/stage facts.

The ASUKA Fabric view groups tasks into:

- Human Attention
- Working
- Queued
- Idle
- Ended

It allows retry and stop actions without exposing DSH-specific terminology.

## Deliberate boundaries

- No DSH/Cordis runtime dependency.
- No GitHub or Feishu Source plugin in this slice.
- No automatic paid retry after restart.
- No arbitrary model-generated policy changes.
- No claim that ASUKA reproduces the source repository's complete behavior.

The next possible increment is a durable effect queue for outbound notifications and source replies, with per-kind retry, ordering and pause semantics.
