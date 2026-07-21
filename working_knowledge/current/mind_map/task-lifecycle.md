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
- Tauri exposes create/list Task phase artifacts. Each append-only artifact has per-phase sequence, kind/content, and normalized links to one or more transcript events from that Task's session; listed provenance follows transcript event order.
- `transition_task_phase` enforces explicit start/complete actions in analysis, planning, execution, review order. Only the current in-progress phase accepts artifacts, and completion is blocked without at least one artifact.
- Follow-up prompts reuse the transcript-bound Task; stale project loads and new transcript ids cannot reuse a different session's Task.
- Task/transcript persistence failures block project-owned ACP sending, while project-less ACP remains a compatibility smoke path.

## Adaptive Complexity
- Rust `task.rs` owns the versioned `deterministic_v1` initial classifier; it does not require a network or LLM call.
- Profiles are quick, standard, and complex. Ambiguity defaults to standard instead of claiming false precision.
- Quick is restricted to bounded UI/content signals without backend/data impact; bounded two-layer work is standard; security/payment, migration, three-layer, and explicit vertical signals are complex.
- Tasks persist immutable initial fields and current effective fields; `task_complexity_changes` retains ordered system/user history.
- `update_task_complexity` validates explicit user overrides, requires a reason, clears system confidence for the user decision, and never rewrites the initial assessment.
- Legacy Tasks migrate to standard with `legacy_v0` and an auditable backfilled change.
- The frontend keeps transcript-indexed Task ref/state in sync and renders the live Task assessment inside ACP Controls; the panel is read-only until explicit override controls are planned.

## Deferred
- Agent-driven phase execution, retry semantics, and user-facing gate controls over the persisted state machine.
- Analysis-driven complexity confirmation/reclassification and user-facing profile controls.
- UI progress/context presentation and explicit context assembly across project, manual, and task knowledge.

## Risks
- Never replace the transcript with Task state or infer a new Task from every follow-up prompt.
- Never silently inject accumulated task knowledge into ACP.
- Preserve project/session ownership and original-prompt integrity during frontend wiring.
- Do not treat prompt-only confidence as final truth or silently change historical classifier semantics; introduce new assessment versions when rules materially change.
