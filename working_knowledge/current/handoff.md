# Handoff

## Current State
- Plan item 31.1 is complete pending commit.
- A successful controlled phase run now locks Run & prepare immediately for the current Task/phase even when receipt refresh is delayed or empty.
- Failed runs remain retryable; Task/phase changes clear the local lock.
- Task shows a visible Next step card with evidence-text and provenance requirements.
- Transcript provenance opens automatically after a successful run or first selection.
- Save phase evidence explains why it is disabled and enables only when evidence text and provenance are both ready.

## Next Step
- Commit 31.1 with a provenance note, then manually verify the screenshot flow in Tauri.
- Plan explicit manual evidence provenance separately if agent-free phase completion remains desired.

## Commands To Re-Run
- `npm run frontend:audit`: check frontend architecture.
- `npm run typecheck`: check TypeScript contracts.
- `npm run test -- --run`: run frontend regressions.
- `npm run build`: validate the production bundle.
- `cargo test --manifest-path src-tauri/Cargo.toml`: run backend regressions.
- `git diff --check`: validate patch hygiene.

## Watchouts
- Do not weaken transcript provenance implicitly; model manual evidence explicitly.
- Keep durable receipt history authoritative across restarts.
- Preserve the known non-failing React act warning in the unrelated App toast test unless that test is directly addressed.
