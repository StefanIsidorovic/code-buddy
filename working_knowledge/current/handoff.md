# Handoff

## Current State
- Plan items 37.4a–f are committed through `8daafa9`.
- Project Autopilot can approve pending generated claims and publish Project Knowledge in one action; manual review remains available.
- Task phase start, phase-agent run and structured step run require approved, active Knowledge Units from the Task's own project.
- A blocked Task remains saved and shows a direct Initialize Project Knowledge action; legacy in-progress Tasks cannot bypass storage checks.
- Execution shows ordered approved steps, requested tier, expected/touched paths, Git/scope status and explicit Accept or Reject & retry controls.
- Only the next unaccepted step can run; stale Task responses are ignored; ACP workspace must belong to the Task project in both UI and backend.
- The old monolithic execution action is absent for structured plans.
- Execution completion requires every approved plan step to be accepted; legacy Tasks without structured plans retain the previous verification fallback.
- Frontend ownership follows the modern frontend skill: presentation component + feature hook + shared contracts + typed gateway; App remains composition-only.
- Frontend audit, typecheck, 298 frontend tests, production build, Rust fmt, 136 Rust tests, clippy with warnings denied and diff hygiene pass.

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
