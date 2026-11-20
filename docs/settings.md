# Native Settings

ASUKA `0.8.2` replaces the single-page connection form with a native settings console inspired by the information architecture shared by Codex and OpenMausBot.

## Information architecture

```text
Personal
  General
  Appearance
  Permissions
  Storage
Integrations
  Models and adapters
  Connectors and plugins
  Computer Use
  Browser
Coding
  Personalization
  Git
  Keyboard shortcuts
  Advanced
```

The left navigation is searchable. Settings that are not implemented are shown as unavailable rather than pretending to work.

## Persistence

Core stores preferences in `<dataDir>/asuka-settings.json` and exposes:

```text
GET   /__asuka/core/settings
PATCH /__asuka/core/settings
```

The snapshot includes sanitized settings, the data directory, settings file path, local SQLite sizes and workspace availability. Secrets continue to live in their dedicated encrypted stores.

## Applied settings

- `general.workspace` updates the working directory used by Codex, Claude Code and DSH on their next run.
- The workspace path can be edited inline or selected through the desktop folder picker exposed by the Electron preload bridge.
- Desktop builds default the workspace to `Documents\ASUKA`; `ASUKA_WORKSPACE` overrides it and `ASUKA_DATA_DIR` can isolate packaged data for testing.
- `permissions.fullAccess=true` enables unattended local execution, forces workspace writes on, closes Git read-only and selects Codex `danger-full-access`. Native tasks receive the audited `local_command` tool and all tool approvals are bypassed.
- `permissions.fullAccess=false` returns to per-call tool approvals. `permissions.workspaceWrite` plus `git.readOnly=false` selects Codex `workspace-write`; otherwise Codex remains `read-only`.
- `personalization.instructions` is appended to Native and local Coding Adapter execution constraints.
- `computerUse.enabled` removes Windows-MCP tools and rejects manual Computer Use calls while disabled.
- `computerUse.requireObservation` controls whether a Snapshot or Screenshot is mandatory before state-changing GUI actions.
- `computerUse.autoRefresh` controls the automatic Snapshot after a GUI action.
- `appearance.accent` and `appearance.density` apply immediately and persist.
- `general.closeConfirm` installs the renderer close confirmation guard.

## Deliberately limited

- Hooks and remote Environments are not implemented.
- Git worktree orchestration is not exposed by the Native task engine.
- Language selection is fixed to Simplified Chinese in this release.
