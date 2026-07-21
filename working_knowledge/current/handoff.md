# Handoff

## Current State
- Unified Task Context Preview now has an explicit send action; the exact rendered context enriches only the ACP wire prompt, while Task `originalPrompt` and transcript user events retain the user's plain prompt.
- Prompt dispatch has a synchronous in-flight guard, and the dialog stays open on failed dispatch for an explicit retry.
- Task Context Preview now unifies approved project Knowledge Units, transcript-attached Knowledge Cards, and active Task phase artifacts with visible source/reason and a strict character budget.
- The selector validates project, initialization, transcript, and Task ownership; preview responses are discarded after workspace identity changes.
- Plan 18 introduces Task persistence, first-prompt creation, phase knowledge, and staged UI in that order.
- Plan items through 18.3 are complete: project-owned ACP prompts create persistent Tasks with analysis-first phases and an explainable initial quick/standard/complex assessment.
- Initial and effective complexity are persisted separately; every system/user change is retained in append-only history.
- ACP Controls now shows a responsive read-only Task assessment for the live transcript, including profile, phase, reasons, confidence/source, version, and differing initial profile.
- ACP Controls now exposes the active agent's advertised Coding model independently of Summary synthesis selection; changes are validated and scoped to the live ACP session.
- ACP Controls can collapse model, Task assessment, and result details to prioritize Session Output while keeping Prompt, Preview/Send, Drain, and Stop visible.

## Next Step
- Manually smoke-test preview-and-send with a real Task artifact and attached card, then persist an auditable context-selection/send receipt before adding automatic phase execution.
- Apply `.agents/skills/aiadne-modern-frontend/SKILL.md` and run `npm run frontend:audit` for every subsequent frontend slice.

## Commands To Re-Run
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`: validate Rust formatting.
- `cargo test --manifest-path src-tauri/Cargo.toml`: validate storage and backend regressions.
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`: validate Rust quality.
- `git diff --check`: validate patch hygiene.

## Watchouts
- Keep phase transitions atomic with task-knowledge artifact publication and preserve exact source references.
- Use the effective complexity profile to control depth and checkpoints, not to skip validation or provenance.
- Enforce project ownership between a Task and its transcript session.
- Keep canonical phase order deterministic and avoid free-form phase names at this layer.
- Preserve unrelated user changes if the worktree changes during implementation.
- Do not use AIadne's synthesis catalog as the ACP runtime model source; retain and validate the active agent's advertised options.
