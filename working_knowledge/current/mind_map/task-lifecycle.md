# Task Lifecycle

## Sources
- Local: src-tauri/src/storage.rs
- Local: src-tauri/src/commands.rs
- Local: src-tauri/src/lib.rs
- Local: src/App.tsx

## Boundary
- A Task is the persistent user assignment; a transcript is its ordered conversation history and ACP is its runtime transport.
- One project-owned transcript session may own at most one Task.
- The immutable original prompt is stored on the Task separately from any future context-enriched ACP payload.

## Persistent Lifecycle
- Task creation atomically inserts the Task and four ordered pending phases: analysis, planning, execution, and review.
- `create_task` validates non-empty identifiers/prompt, project existence, transcript existence, project ownership, and transcript uniqueness.
- `list_project_tasks` returns project-scoped Task records with ordered phase state.
- Tauri exposes `create_task` and `list_project_tasks`; the frontend loads Tasks by transcript id and creates one before the first project-owned ACP prompt.
- Follow-up prompts reuse the transcript-bound Task; stale project loads and new transcript ids cannot reuse a different session's Task.
- Task/transcript persistence failures block project-owned ACP sending, while project-less ACP remains a compatibility smoke path.

## Deferred
- Ordered phase transitions, phase execution, and immutable task-knowledge artifacts with source provenance.
- UI progress/context presentation and explicit context assembly across project, manual, and task knowledge.

## Risks
- Never replace the transcript with Task state or infer a new Task from every follow-up prompt.
- Never silently inject accumulated task knowledge into ACP.
- Preserve project/session ownership and original-prompt integrity during frontend wiring.
