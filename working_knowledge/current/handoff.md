# Handoff

## Current State
- Research confirms ACP prompts currently create transcript events but no Task domain object.
- Plan 18 introduces Task persistence, first-prompt creation, phase knowledge, and staged UI in that order.
- Plan items 18.1 and 18.2 are complete: Task persistence exists and the first project-owned ACP prompt creates one analysis-first Task that follow-ups reuse.

## Next Step
- Implement plan item 18.3: persist immutable task knowledge artifacts and ordered phase transitions with source provenance.

## Commands To Re-Run
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`: validate Rust formatting.
- `cargo test --manifest-path src-tauri/Cargo.toml`: validate storage and backend regressions.
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`: validate Rust quality.
- `git diff --check`: validate patch hygiene.

## Watchouts
- Keep phase transitions atomic with task-knowledge artifact publication and preserve exact source references.
- Enforce project ownership between a Task and its transcript session.
- Keep canonical phase order deterministic and avoid free-form phase names at this layer.
- Preserve unrelated user changes if the worktree changes during implementation.
