# ASUKA Skill Runtime

Updated: 2026-11-20

## Codex-compatible model

ASUKA follows the same progressive-disclosure shape documented for Codex Skills: the model first sees each Skill's name, description and package path; only a selected Skill's full instructions and referenced files are loaded.

Reference: [OpenAI, Build skills](https://developers.openai.com/codex/skills), accessed 2026-11-20.

## Package contract

Every Skill is a directory under `skills/` with:

```text
<skill-name>/
  SKILL.md                 required metadata and instructions
  scripts/                 optional executable entrypoints
  references/              optional documentation loaded on demand
  assets/                  optional templates and resources
  agents/openai.yaml       optional presentation and dependency metadata
```

`SKILL.md` must start with YAML frontmatter containing `name` and `description`. A new directory with these fields is discovered automatically; no runtime registration table is required.

## Discovery and loading

- `skills/` is scanned on each catalog read, so newly installed or removed Skills appear without changing application code.
- The initial catalog includes `name`, `description`, package path and enabled state.
- Explicit names such as `$documents`, `@documents` or `documents` and common artifact triggers select the full `SKILL.md` body.
- `references/`, `assets/` and `scripts/` remain unloaded until the model requests the specific path.
- Global enabled state and per-agent overrides are held in ASUKA's local SQLite store.

## Runtime tools

Native tasks receive three built-in tools when the Skill library is attached:

- `skill_list` is read-only and returns the current catalog, paths, resource folders and enabled state.
- `skill_read` reads a path confined to the selected Skill package, defaulting to `SKILL.md`.
- `skill_run` executes a packaged script entrypoint with an argv array and an explicit runtime. It supports Python, Node, PowerShell and command scripts.

`skill_run` is approval-gated by default. When Full Access is enabled it runs without a one-time prompt and every call is written to the local tool audit log.

## Adding future Skills

1. Create `skills/<skill-name>/SKILL.md` with valid frontmatter.
2. Add optional scripts and references using relative paths.
3. Refresh the Skills page or restart ASUKA if the host catalog was already cached.
4. The existing `skill_list`, `skill_read` and `skill_run` surface is reused automatically.

Skills should keep `SKILL.md` focused on routing and the default workflow. Put large or conditional guidance in `references/` so it loads only when needed.
