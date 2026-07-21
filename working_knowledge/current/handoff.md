# Handoff

## Current State
- Phase Run History now exposes ordered exact instructions/outcomes and can conservatively resolve stale pending runs only after their ACP session stops.
- Controlled phase runs now persist an ordered `pending` receipt before ACP and finalize it once as `sent` or `failed`, retaining exact instruction, phase, session and outcome.
- An in-progress Task phase now exposes its exact canonical agent instruction and can send one controlled ACP prompt after exact Task/transcript ownership validation.
- Phase execution never creates evidence, completes the phase, or starts the next one; those remain explicit backend-enforced gates.
- Task Dispatch History now shows ordered receipts with exact stored prompt/context, source count, ACP outcome, stop reason and error.
- A genuinely stale `pending` receipt can be manually resolved only to `failed`, with a mandatory bounded reason and only after its associated ACP session is no longer running; finalized outcomes remain immutable.
- Explicit context sends now create an ordered Task receipt before ACP dispatch and finalize it as `sent` or `failed`; interrupted attempts remain `pending` for later recovery.
- Receipts retain exact user/context/wire strings, included source snapshots, ACP session, stop reason/error, and Task/transcript ownership.
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
- Add explicit evidence capture from selected persisted ACP output into the current phase artifact, without automatic completion.
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
- Show the user the stable approximate `AIadne -> beyond Conductor` progress tracker in every substantive work update; the percentage is directional rather than a delivery estimate.
