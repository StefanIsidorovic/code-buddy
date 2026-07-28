# Status

## Session
- session_id: codex-20260728-aiadne-task-ux
- date_utc: 2026-07-28
- agent_model: codex

## Target Repositories
- AIadne: /home/katarina/projects/AIadne

## Repository State
- branch: new/start
- head: faa0eaf step 35.3: allow execution verification retry
- worktree: plan item 35.4 complete pending commit
- relevant files: repository identity footer and ACP/selected-workspace Task gate

## Current Task
- request: make completed phases inspectable and verify execution changes in the real ACP workspace
- phase: implementation
- active plan step: 35.4

## Risks And Constraints
- Durable sent receipts remain the audit source; the feature-local successful-run signal only bridges delayed or empty receipt refresh.
- Failed runs must remain retryable, and the local lock must reset when Task or phase changes.
- Saving evidence still requires both evidence text and same-transcript event provenance; explicit manual evidence needs a separate auditable backend contract.
- App.tsx must remain composition-only and Task features must not invoke Tauri directly.
- Project Autopilot and Task Autopilot require separate explicit authority/state-machine plans; do not hide auto-approval behind the manual review UI.
- Summary Autopilot preparation changes only pending decisions, validates the would-be publication payload, and never publishes Knowledge Units.

## Last Verification
- 2026-07-28: frontend audit, typecheck, 269 frontend tests, production build, Rust fmt, 122 Rust tests, clippy with warnings denied, feature Tauri-boundary check, file-size check and git diff hygiene all pass for plan item 31.1.
- 2026-07-28: targeted approved Summary dialog/App tests and legacy approved storage regression pass for plan item 31.2.
- 2026-07-28: frontend audit, typecheck, 271 frontend tests, production build, Rust fmt, 122 Rust tests, clippy with warnings denied and diff hygiene pass for plan item 32.1; two known App async timing tests required a clean rerun and then passed.
- 2026-07-28: frontend audit, typecheck, 271 frontend tests, production build and diff hygiene pass for the presentation-only plan item 33.1.
- 2026-07-28: frontend audit, typecheck, 272 frontend tests, production build and diff hygiene pass for the presentation-only plan item 33.2.
- 2026-07-28: frontend audit, typecheck, 273 frontend tests, production build and diff hygiene pass for the presentation-only plan item 33.3.
- 2026-07-28: frontend audit, typecheck, 273 frontend tests, production build and diff hygiene pass for the presentation-only plan item 34.1.
- 2026-07-28: frontend audit, typecheck, 274 frontend tests, production build, Rust fmt, 124 Rust tests, clippy with warnings denied and diff hygiene pass for plan item 34.2.
- 2026-07-28: plan item 34.3 restores all ACP-advertised coding models; frontend audit, typecheck, 274 frontend tests, production build, Rust fmt, 122 Rust tests, clippy with warnings denied and diff hygiene pass.
- 2026-07-28: plan item 35.1 adds read-only completed-phase history; frontend audit, typecheck, 275 frontend tests, production build and diff hygiene pass.
- 2026-07-28: plan item 35.2 adds durable ACP-workspace execution verification; frontend audit, typecheck, 277 frontend tests, production build, Rust fmt, 123 Rust tests, clippy with warnings denied and diff hygiene pass.
- 2026-07-28: plan item 35.3 enables narrow execution retry after unchanged/unavailable verification; frontend audit, typecheck, 278 frontend tests, production build and diff hygiene pass.
- 2026-07-28: plan item 35.4 exposes repository paths and blocks stale ACP cwd mismatches; frontend audit, typecheck, 279 frontend tests, production build and diff hygiene pass.
