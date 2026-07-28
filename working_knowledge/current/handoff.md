# Handoff

## Current State
- Plan item 37.4a is committed as `af29e92`; 37.4b as `beeb727`.
- Plan item 37.4c is complete pending commit.
- Each step dispatch now persists write-once repository-derived verification, exact touched paths and deterministic `within_scope` / `out_of_scope` / `unavailable` status.
- Per-file fingerprints distinguish prior dirty files from current-run touches; reverts remain attributable and ambiguous large-file changes fail conservatively.
- Explicit review is required: accept needs available within-scope verification and a note; reject records the note, marks the attempt failed and permits retry.
- Accepting one step still cannot complete execution globally.
- Rust fmt, all 134 backend tests, clippy with warnings denied and diff hygiene pass.

## Next Step
- Implement 37.4d: frontend step runner/review UX and the all-approved-steps execution completion gate.

## Commands To Re-Run
- `cargo test --manifest-path src-tauri/Cargo.toml`: run backend regressions.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: enforce lint cleanliness.
- `git diff --check`: validate patch hygiene.

## Watchouts
- Show worktree dirty files separately from files touched by the selected step.
- Never label `sent` as completed or accepted.
- Out-of-scope and unavailable runs require reject/retry; they cannot be overridden through the accept command.
