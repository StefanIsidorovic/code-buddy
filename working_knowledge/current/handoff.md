# Handoff

## Current State
- Plan items 37.1–37.3 are committed through `9621050`.
- Plan item 37.4a is complete pending commit: `task_plan_step_runs` durably binds each attempt to one Task, approved plan version and exact ordered step.
- A run snapshots model tier rationale and expected write paths; only the next unaccepted step may run, sent attempts remain review-gated, and failed attempts are retryable.
- Accepting a step advances only the step ledger and cannot complete the execution phase.
- Rust fmt, all 132 backend tests, clippy with warnings denied and diff hygiene pass.

## Next Step
- Implement 37.4b: expose step-run commands and bounded per-step ACP dispatch without falling back to monolithic execution.

## Commands To Re-Run
- `cargo test --manifest-path src-tauri/Cargo.toml`: run backend regressions.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: enforce lint cleanliness.
- `git diff --check`: validate patch hygiene.

## Watchouts
- Keep `sent` separate from `accepted`; model output is not approval.
- Repository-derived changed files and checks belong in a later verification receipt, not agent-authored step claims.
- Do not let a completed step mutate Task phase state; global execution completion needs a separate all-steps gate.
