# Decision Core v1

Decision Core is deterministic. The same normalized `TaskEnvelope` and capability inventory produce the same `DecisionRecord`, `TeamPlan`, role order, and hashes.

## Frozen contracts

Schemas live in `shared/decision/contracts.mjs`:

- `TaskEnvelope`
- `DecisionRecord`
- `RoleManifest`
- `TeamPlan`
- `EvaluationGate`
- `ApprovalRequest`
- `StopCondition`

The fixed role registry lives in `shared/decision/roles.mjs`. No model can invent a new role identifier at runtime.

## Decision pipeline

1. Normalize and validate the task.
2. Classify the task type from explicit hints or deterministic keyword scores.
3. Score impact, data sensitivity, integration complexity, autonomy, duration, and stakeholder complexity.
4. Map the score to S/M/L/XL and apply non-overridable risk uplift rules.
5. Select required roles first, then only enough optional roles to fit the scale limit.
6. Mark unavailable roles as capability gaps rather than pretending they are covered.
7. Build ordered workflow steps and blocking evaluation gates.
8. Add approvals and stop conditions for high-risk or irreversible work.
9. Hash the normalized input, plan, and decision record.

## Scale defaults

| Scale | Maximum independent roles | Typical use |
|---|---:|---|
| S | 3 | one-off scripts, focused research, simple content |
| M | 6 | production feature, business automation, small data workflow |
| L | 8 | multi-system integration, regulated or high-impact work |
| XL | 9 | high-risk multi-team delivery |

Mandatory roles can exceed the nominal limit only when risk rules require it.

## Core routes

- `GET /__asuka/core/roles`
- `POST /__asuka/core/decide`

The decide route accepts a `TaskEnvelope` and returns a validated `DecisionRecord`. It does not call a model or OpenMausBot.

## Stability rules

- No random IDs.
- No timestamps in plans or decisions.
- Object keys and role collections are canonically sorted before hashing.
- Explicit task-type hints override keyword classification.
- Risk uplift rules override the numeric scale when irreversible actions, sensitive data, regulation, finance, or security are present.
