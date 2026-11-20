# ASUKA Core decoupling

ASUKA Core is the frontend-facing execution API. The renderer must not call runtime-specific routes such as `/api/bots`, `/api/groups`, or `/api/instances` directly.

## Current adapter

`server/core/openmausbot-adapter.mjs` implements the first `ExecutionAdapter` and translates normalized operations into OpenMausBot REST calls. The adapter is selected in `server/core/router.mjs`; no renderer file references OpenMausBot API routes.

The current Core API covers:

- `GET /__asuka/core/health`
- `GET /__asuka/core/snapshot`
- `POST /__asuka/core/agents`
- `PATCH /__asuka/core/agents/:id`
- `POST /__asuka/core/rooms`
- `PATCH /__asuka/core/rooms/:id`
- `POST /__asuka/core/rooms/:id/messages`
- `GET /__asuka/core/tasks/:threadId`
- `POST /__asuka/core/tasks/:threadId/stop`
- `POST /__asuka/core/tasks/:threadId/messages`
- `POST /__asuka/core/approvals/:threadId/respond`
- Agent skill list, import, view, enable/disable, and removal routes
- Provider test/config, endpoint creation/removal, and model refresh routes

## Next adapter

A native adapter must implement the same normalized operations with local persistence, model-provider calls, MCP tools, approvals, cancellation, and artifact storage. During migration, the UI and Decision Core remain unchanged while adapters can run side by side.

OpenMausBot remains useful as a compatibility runtime and reference implementation. It is no longer the renderer's execution contract.
