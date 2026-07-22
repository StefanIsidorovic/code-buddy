# Handoff

## Current State
- Session History now exposes an explicit per-row Resume action for ACP transcripts; it is locked during another live/resuming session and legacy rows fail with an actionable recovery message.
- Successful Resume activates the existing transcript/Task, resets the workspace to Agent, consumes replay without duplicating SQLite history, and preserves future live persistence; workspace changes invalidate and stop late loads.
- The backend can now restart a persisted registry adapter and issue ACP `session/load` with its exact stored external session id and repository cwd; successful replay events/model config reuse the normal runtime buffers.
- Unsupported adapters, blank recovery identifiers, and failed loads never become managed sessions; failed child processes are killed by the session Drop boundary.
- ACP output now appears and persists during long ordinary and controlled prompts instead of waiting for prompt completion.
- `useAcpEventDrain` serializes overlapping polls, pins output to the prompt's starting transcript, and captures live plus final persisted agent IDs for exact phase receipt linkage.
- The current phase now offers `Run & prepare <phase>`: it sends one audited controlled prompt, refreshes the originating Task's run receipts, and fills the editable draft from exact linked events only after success.
- Failed or stale runs never prepare evidence; standalone Prepare, Add evidence, Review, Complete, and next-phase Start remain separate explicit gates.
- npx ACP adapters now bootstrap from the neutral OS temporary directory, preventing a selected project's invalid `devEngines`/npm metadata from exiting before initialize; `session/new` still targets the selected repository.
- A real Codex ACP smoke test completed initialize and session creation for `/home/katarina/projects/super`; binary ACP launch cwd behavior is unchanged.
- ACP child startup failures now include a bounded stderr reason and structured Tauri errors render as readable messages instead of raw `{code,message}` JSON.
- Direct `codex-acp@1.1.0` initialize succeeds with AIadne's payload; the screenshot's exact child failure cannot be classified further because the old build discarded its stderr, so the next Start attempt is the authoritative diagnostic.
- ACP tool-using prompts no longer deadlock when Codex requests permission: pending requests stay visible in Agent view (even with controls collapsed), and only an explicit offered choice resumes the prompt.
- Permission polling is independent from the blocked prompt call; graceful Stop returns cancelled outcomes, and failed response writes remain retryable.
- Task and Activity views now scroll independently inside the desktop viewport, so long evidence/artifact content remains reachable; mobile keeps normal page scrolling.
- Task Context Preview can close via X, Close, or backdrop while a context send continues single-flight; successful completion still refreshes dispatch history.
- ACP `tool_call_update` events are dropped before output/transcript persistence, meaningful initial tool calls remain, and idle drain cadence is 1000 ms instead of 400 ms.
- Task Phase shows a compact five-step guide; Run/Prepare are accurately optional, while Save evidence, Review, and Complete expose the authoritative gates and next required action.
- Completion CTA names the next pending phase or final Task completion; the backend-returned phase renders immediately but still requires its own explicit Start.
- Task Phase now offers `Prepare completion`, which loads only the latest current-phase sent receipt's linked response events into an editable draft with exact provenance IDs.
- Missing links produce an actionable error; stale responses after Task changes are ignored, and Add evidence/review/Complete/next Start remain separate explicit gates.
- Controlled phase runs now persist normalized links from their sent receipt to the exact agent transcript events drained after that run; cross-transcript and user-event links are rejected transactionally.
- Background ACP drain pauses while a prompt is in flight, preventing polling from consuming a controlled response before it can be persisted and linked.
- ACP now opens in a focused Agent view containing both ACP Controls and Session Output; Task and Activity are separate accessible tab views instead of one stacked page.
- View tabs support click and Arrow/Home/End keyboard navigation, disable Task-owned views without an active Task, and return safely to Agent when the Task disappears.
- Transcript provenance is now collapsed by default with selected/event counts, normalized 16px checkboxes, compact event metadata, two-line previews and a bounded scroll area.
- The screenshot-confirmed runtime overlap is fixed: dynamic controls/workflow/errors size naturally, Output grows, and phase/context histories are grouped under collapsed Task activity.
- ACP session status/actions switch to a narrow layout at 760px and long session IDs wrap instead of clipping actions.
- Phase completion UI now shows deterministic phase-specific review criteria and requires an explicit acknowledgment that resets when Task/evidence/phase state changes.
- The current phase can draft editable evidence from the latest persisted agent response with exact transcript-event provenance; saving and completion remain explicit.
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
- Add restart reconciliation guidance for pending context/phase receipts around a resumed Task, without inferring that interrupted external effects succeeded.
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
