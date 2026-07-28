# Handoff

## Current State
- Plan items 37.4a–c are committed through `f893d0b`.
- Plan item 37.4d is complete pending commit; 37.4 one-step-at-a-time execution is now end-to-end.
- Execution shows ordered approved steps, requested tier, expected/touched paths, Git/scope status and explicit Accept or Reject & retry controls.
- Only the next unaccepted step can run; stale Task responses are ignored; ACP workspace must belong to the Task project in both UI and backend.
- The old monolithic execution action is absent for structured plans.
- Execution completion requires every approved plan step to be accepted; legacy Tasks without structured plans retain the previous verification fallback.
- Frontend ownership follows the modern frontend skill: presentation component + feature hook + shared contracts + typed gateway; App remains composition-only.
- Frontend audit, typecheck, 297 frontend tests, production build, Rust fmt, 134 Rust tests, clippy with warnings denied and diff hygiene pass.

## Next Step
- Begin 37.5a: model explicit step dependencies and derive deterministic serial/parallel execution waves before creating isolated worktrees.

## Commands To Re-Run
- `npm run frontend:audit`: enforce frontend boundaries and App ceiling.
- `npm run typecheck && npm run test -- --run && npm run build`: verify frontend behavior and bundle.
- `cargo test --manifest-path src-tauri/Cargo.toml`: verify backend gates.
- `git diff --check`: validate patch hygiene.

## Watchouts
- Do not run parallel steps in the shared worktree.
- Tier labels are requirements, not concrete ACP model IDs, until adapters expose a mapping.
- Preserve the explicit Accept/Reject gate when adding autopilot; automation needs separately visible authority.
