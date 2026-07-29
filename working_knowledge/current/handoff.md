# Handoff

## Current State
- Plan steps persist validated `dependsOn` links; generated and manual drafts can declare only earlier `STEP-N` keys.
- Execution derives deterministic waves from satisfied dependencies and conservative non-overlapping path scopes.
- The execution panel exposes wave membership and rationale, while explicitly retaining serial runs until isolation/integration is implemented.
- Backend now has a tested internal primitive for clean-HEAD AIadne branch/worktree creation, rollback and guarded cleanup; it is not yet exposed as a command or connected to ACP dispatch.
- Step-run receipts now persist one optional write-once isolation descriptor and reject repository verification from any other workspace.
- Backend command `send_isolated_task_plan_step_prompt` now starts a dedicated ACP candidate in that worktree, records ownership before prompt send, and verifies the exact isolated cwd.
- Backend integration primitive now creates provenance-backed AIadne commits and serially cherry-picks them; conflicts restore the original clean source HEAD and retain isolation.
- Accepted isolated runs now persist pending/integrated/conflicted integration state; the guarded command stores successful SHAs before stopping the ACP session and cleaning the worktree, and returns cleanup warnings without erasing integrated truth.
- Execution now exposes integration only for accepted isolated receipts, keeps the next step locked until durable integration, and shows integrated commit, retained-conflict recovery path and cleanup warning states.
- User-facing Run step now always dispatches through `send_isolated_task_plan_step_prompt` with the selected ACP candidate and registered repository; the shared-checkout step command is backend-only legacy compatibility.
- Dirty source repositories remain blocked before isolation, but the error now lists up to five blocking paths and gives explicit commit, stash or discard guidance.
- Backend derives immutable dependency/scope-safe execution waves inside atomic run reservation; independent same-wave runs may coexist while later waves and duplicate open attempts remain blocked.
- Execution now starts every dispatchable current-wave step from one action with concurrency three, exposes queued/running state per step, preserves partial successes, and keeps later waves locked until isolated acceptance is integrated.
- Accepted within-scope `unchanged` verification is a completed no-change result; the integration action now cleans its isolation without creating a commit and recovers previously recorded empty-diff conflicts.
- Backend command `run_task_wave_evaluation` starts a snapshot-isolated reviewer only for the current settled execution wave and binds its prompt to exact persisted run evidence, approved plan identity and a repository owned by the Task project.
- Planning evidence now reconstructs same-kind streamed chunks exactly, and the strict plan parser can recover already-saved fenced JSON with drain-inserted line breaks; the observed Formily artifact auto-fills after UI reload.
- Plan items 37.4a–g are committed through `c5e8e9c`.
- New planning runs end with a strict JSON plan block; once that response is saved as planning evidence, a pristine structured-plan editor fills automatically.
- Malformed or legacy prose evidence keeps the manual editor available with rerun guidance; user edits are never replaced without explicit Restore.
- Project Autopilot can approve pending generated claims and publish Project Knowledge in one action; manual review remains available.
- Task phase start, phase-agent run and structured step run require approved, active Knowledge Units from the Task's own project.
- A blocked Task remains saved and shows a direct Initialize Project Knowledge action; legacy in-progress Tasks cannot bypass storage checks.
- Execution shows ordered approved steps, requested tier, expected/touched paths, Git/scope status and explicit Accept or Reject & retry controls.
- Only the next unaccepted step can run; stale Task responses are ignored; ACP workspace must belong to the Task project in both UI and backend.
- The old monolithic execution action is absent for structured plans.
- Execution completion requires every approved plan step to be accepted; legacy Tasks without structured plans retain the previous verification fallback.
- Frontend ownership follows the modern frontend skill: presentation component + feature hook + shared contracts + typed gateway; App remains composition-only.
- Frontend audit, typecheck, 308 frontend tests, production build and diff hygiene pass; the unchanged backend remains at 136 passing Rust tests and clean clippy.

## Next Step
- Continue 37.5e.1: automatically trigger the evidence-bound evaluator after a wave settles, then surface its pass/needs-attention state without automatic mutation or integration.

## Commands To Re-Run
- `npm run frontend:audit`: enforce frontend boundaries and App ceiling.
- `npm run typecheck && npm run test -- --run && npm run build`: verify frontend behavior and bundle.
- `cargo test --manifest-path src-tauri/Cargo.toml`: verify backend gates.
- `git diff --check`: validate patch hygiene.

## Watchouts
- Do not run parallel steps in the shared worktree.
- Wave preview is derived information, not durable execution authority; backend dispatch remains intentionally serial.
- Tier labels are requirements, not concrete ACP model IDs, until adapters expose a mapping.
- Preserve the explicit Accept/Reject gate when adding autopilot; automation needs separately visible authority.
- The evaluator endpoint exists, but no frontend code triggers or renders it yet; do not count automatic wave evaluation complete until both behaviors and stale/missing-evaluator recovery are tested.
