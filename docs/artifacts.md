# Conversation Artifacts

Updated: 2026-11-20

ASUKA indexes files produced by a task and renders them in the conversation as deliverable cards.

## Discovery

The artifact index examines the latest assistant output, tool results and tool-call arguments for file paths. Every candidate must exist as a regular file and must have been created or modified after the task started. Missing paths and stale files are ignored.

The index is extension-agnostic. Known document, spreadsheet, presentation, PDF, image, archive, text and code types receive presentation metadata, but future file types still appear as generic artifacts.

Requested output types are detected from the objective. For example, a task asking for a Word document prioritizes DOCX and PDF deliverables over helper scripts. If no requested type is found, files explicitly named in the final assistant response are shown.

## Conversation UI

Artifacts appear in a `DELIVERABLES` shelf inside the room conversation and task detail view. Each card includes:

- file name, type, size and modification time;
- the absolute path;
- open-file, reveal-in-folder and copy-path actions.

Electron exposes only the validated `open-path` and `reveal-path` IPC methods. Browser-only hosts fall back to copying the exact path.

## Adding new artifact types

No runtime registration is required. If a future Skill writes a file with any extension and returns or discusses its path, the next task refresh indexes it. Optional presentation categories can be added in `server/native/artifact-index.mjs` without changing the conversation contract.
