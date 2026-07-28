# Handoff

## Current State
- Plan item 31.1 is committed as 2c9085e.
- A successful controlled phase run now locks Run & prepare immediately for the current Task/phase even when receipt refresh is delayed or empty.
- Failed runs remain retryable; Task/phase changes clear the local lock.
- Task shows a visible Next step card with evidence-text and provenance requirements.
- Transcript provenance opens automatically after a successful run or first selection.
- Save phase evidence explains why it is disabled and enables only when evidence text and provenance are both ready.
- Plan item 31.2 is committed as e4783f7: approved Summary snapshots are read-only, legacy approved claims derive final accepted/deferred states, and invalid review/regenerate controls are absent.
- Plan item 32.1 is committed as 85abec3: Project Autopilot atomically prepares pending Summary decisions, preserves explicit decisions, validates sources, and leaves publication behind one Approve Summary click.
- Plan item 33.1 is committed as 8c4afd5: Task progress shows four real steps, evidence creation exposes agent-assisted and manual paths, and latest-run restoration appears only after a run.
- Plan item 33.2 is committed as ce985e2: desktop Task guidance is sticky, mobile keeps normal flow, and every canonical phase states its distinct expected outcome.
- Plan item 33.3 is committed as 1dfde7a: the sticky tracker owns precise Next guidance and readiness indicators; the separate space-heavy Next step card and its CSS are removed.
- Plan item 34.1 is committed as f311ff9: Task steps 1–4 are framed, helper explanations share one visual language, and tracker requirements use emphasized status chips.
- Plan item 34.2 was committed as 1406827, then found invalid because absent ACP metadata hid usable models such as GPT-5.5.
- Plan item 34.3 is committed as 2fc0466: every option advertised by the active ACP agent is visible/selectable again, while unadvertised IDs remain rejected.
- Plan item 35.1 is committed as b315d4f: completed phases expose immutable evidence history.
- Plan item 35.2 is complete pending commit: execution persists exact ACP workspace and pre/post Git verification, restores it after refresh, and blocks completion after unchanged/unavailable agent runs.
- Plan item 35.3 is complete pending commit: unchanged/unavailable execution can rerun after workspace repair, while verified and non-execution runs remain locked.
- Plan item 35.4 is complete pending commit: footer shows selected repository path and Task blocks phase runs when active ACP cwd differs, with explicit restart guidance.
- Plan item 35.5 is complete pending commit: project switching clears hidden transcript/Task identity and prevents late old-project creation from restoring it.
- Plan item 35.6 is complete pending commit: unchanged verification with a non-empty Git change set is accurately labeled and can complete; clean/unavailable runs remain blocked.

## Next Step
- Commit 35.2 with provenance, then test the execution flow in a real complete Git checkout.

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
