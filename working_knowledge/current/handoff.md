# Handoff

## Current State
- Plan item 37.4a is committed as `af29e92`.
- Plan item 37.4b is complete pending commit: `send_task_plan_step_prompt` dispatches exactly one server-derived approved step through the selected active ACP session.
- The prompt includes only the bounded original task, mapped requirements, one step, acceptance criteria, expected paths, requested tier and explicit phase/commit/scope boundaries.
- Successful dispatch persists `sent`; ACP send failure persists `failed`; both remain attributable to the exact plan step and attempt.
- The command returns repository pre/post verification, but acceptance does not trust or persist it yet.
- Rust fmt, all 134 backend tests, clippy with warnings denied and diff hygiene pass.

## Next Step
- Implement 37.4c: persist repository-derived step verification, compare changed files with expected scope, and allow acceptance only after an explicit passing review gate.

## Commands To Re-Run
- `cargo test --manifest-path src-tauri/Cargo.toml`: run backend regressions.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: enforce lint cleanliness.
- `git diff --check`: validate patch hygiene.

## Watchouts
- Do not infer a concrete ACP model ID from `small/mid/high` until adapters expose a durable tier mapping.
- `sent` is model output, not acceptance.
- Verification and scope checks must come from the repository snapshot, never from agent-authored claims.
