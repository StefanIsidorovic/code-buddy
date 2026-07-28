# Status

## Session
- session_id: codex-20260728-aiadne-task-ux
- date_utc: 2026-07-28
- agent_model: codex

## Target Repositories
- AIadne: /home/katarina/projects/AIadne

## Repository State
- branch: new/start
- head: 2c9085e step 31.1: keep completed phase runs locked
- worktree: plan item 31.2 complete pending commit
- relevant files: Summary storage compatibility, approved Summary dialog/tests, active knowledge

## Current Task
- request: remove invalid review controls from approved Summary and evaluate Claude Buddy-style autopilot for Project onboarding and Task execution
- phase: validation
- active plan step: 31.2

## Risks And Constraints
- Durable sent receipts remain the audit source; the feature-local successful-run signal only bridges delayed or empty receipt refresh.
- Failed runs must remain retryable, and the local lock must reset when Task or phase changes.
- Saving evidence still requires both evidence text and same-transcript event provenance; explicit manual evidence needs a separate auditable backend contract.
- App.tsx must remain composition-only and Task features must not invoke Tauri directly.
- Project Autopilot and Task Autopilot require separate explicit authority/state-machine plans; do not hide auto-approval behind the manual review UI.

## Last Verification
- 2026-07-28: frontend audit, typecheck, 269 frontend tests, production build, Rust fmt, 122 Rust tests, clippy with warnings denied, feature Tauri-boundary check, file-size check and git diff hygiene all pass for plan item 31.1.
- 2026-07-28: targeted approved Summary dialog/App tests and legacy approved storage regression pass for plan item 31.2.
