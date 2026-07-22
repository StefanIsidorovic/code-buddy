# Status

## Session
- session_id: codex-20260722-aiadne-receipts
- date_utc: 2026-07-22
- agent_model: codex

## Target Repositories
- code-buddy: /home/katarina/projects/AIadne

## Repository State
- branch: new/start
- head: 2ea88ab step 22.17: prepare phase completion evidence
- worktree: plan item 22.18 guided phase completion UI verified and ready for commit.
- relevant files: src/App.tsx; src/App.css; src/features/runtime/*; src/features/tasks/*; working_knowledge/current/*; LOCAL_PROGRESS.md.

## Current Task
- request: commit the current work, define a roadmap beyond Conductor, begin implementation, and decompose the oversized frontend coordinator.
- phase: complete
- active plan step: 22.18 complete

## Risks And Constraints
- Keep task-specific knowledge separate from project Knowledge Units and manual Knowledge Cards.
- Preserve the original user prompt separately from any context-enriched ACP payload.
- A single ACP/transcript session represents one Task; later prompts continue it instead of creating duplicates.
- Canonical knowledge-building order is analysis, planning, execution, review; intake is Task creation and learning is a review output.
- `src/App.tsx` is already large, so backend domain foundations precede frontend orchestration.
- Complexity classification must be explainable, versioned, auditable, and user-overridable; prompt-only ambiguity defaults to standard rather than false precision.
- Summary model selection and coding-agent model selection are separate concerns; coding choices must not mutate global Codex configuration.
- ACP coding model options should be discovered from the active agent rather than duplicated in AIadne's synthesis catalog.

## Last Verification
- 2026-07-22: 215 frontend tests, 97 Rust tests, frontend audit, typecheck, production build, Rust formatting/clippy, optional/manual evidence and final-review CTA coverage, `git diff --check`, and two adversarial review cycles pass for plan item 22.18.
- 2026-07-22: 211 frontend tests, 97 Rust tests, frontend audit, typecheck, production build, Rust formatting/clippy, stale Task/empty linked-response coverage, `git diff --check`, and two adversarial review cycles pass for plan item 22.17.
- 2026-07-22: 209 frontend tests, 97 Rust tests, frontend audit, typecheck, production build, Rust formatting/clippy, exact phase-response link coverage, `git diff --check`, and two adversarial review cycles pass for plan item 22.16.
- 2026-07-22: 209 frontend tests, 97 Rust tests, frontend audit, typecheck, production build, Rust formatting/clippy, keyboard tab behavior, `git diff --check`, and two adversarial review cycles pass for plan item 22.15; `App.tsx` is 562 lines.
- 2026-07-19: repository, active knowledge, ACP prompt/transcript flow, SQLite schema, storage tests, and task-context selector inspected; no Task aggregate currently exists.
- 2026-07-19: 82 Rust tests, Rust formatting, clippy with warnings denied, adversarial review cycle 1, and `git diff --check` pass for plan item 18.1.
- 2026-07-19: commit 2cfde08 has a verified provenance note under `refs/notes/provenance` for plan item 18.1.
- 2026-07-19: 37 frontend tests, 82 Rust tests, typecheck, Rust formatting, clippy with warnings denied, `git diff --check`, and adversarial review cycle 2 pass for plan item 18.2.
- 2026-07-19: commit a6181df has a verified provenance note under `refs/notes/provenance` for plan item 18.2.
- 2026-07-19: 88 Rust tests, formatting, clippy with warnings denied, `git diff --check`, migration coverage, and three adversarial review cycles pass for plan item 18.3.
- 2026-07-19: commits 2263631 and d2e34fe have verified provenance notes under `refs/notes/provenance` for plan items 18.2.1 and 18.3.
- 2026-07-19: 38 frontend tests, 88 Rust tests, typecheck, production build, clippy, token checks, `git diff --check`, and two review cycles pass for plan item 18.3.1.
- 2026-07-19: commit 58b9a01 has a verified provenance note under `refs/notes/provenance` for plan item 18.3.1.
- 2026-07-20: repository state, active knowledge, AIadne ACP client, and installed `codex-acp@1.1.0` inspected; the adapter exposes runtime models in `session/new` and accepts `session/set_config_option` with `configId=model`.
- 2026-07-20: 92 Rust tests, 38 frontend tests, formatting, clippy with warnings denied, typecheck, production build, `git diff --check`, and two adversarial review cycles pass for plan item 18.3.2.
- 2026-07-20: commit 017041d has a verified provenance note under `refs/notes/provenance` for plan item 18.3.2.
- 2026-07-20: 38 frontend tests, typecheck, production build, `git diff --check`, and two adversarial review cycles pass for plan item 18.3.3; the existing Vite chunk-size warning remains non-fatal.
- 2026-07-20: commit 083a4b9 has a verified provenance note under `refs/notes/provenance` for plan item 18.3.3.
- 2026-07-20: 38 frontend tests, typecheck, production build, `git diff --check`, and adversarial review cycle 1 pass for plan item 18.3.3.1.
- 2026-07-20: commit 4cb2826 has a verified provenance note under `refs/notes/provenance` for plan item 18.3.3.1.
- 2026-07-20: 38 frontend tests, typecheck, production build, `git diff --check`, and adversarial review cycle 1 pass for plan item 18.3.3.2.
- 2026-07-20: commit a8856ae has a verified provenance note under `refs/notes/provenance` for plan item 18.3.3.2.
- 2026-07-21: the first full frontend verification exposed one transient Markdown findings timing failure; the isolated test and immediate full rerun passed.
- 2026-07-21: 38 frontend tests, typecheck, production build, `git diff --check`, and adversarial documentation review pass for plan item 18.3.3.3; the existing Vite chunk-size warning remains non-fatal.
- 2026-07-21: 44 frontend tests, typecheck, production build, `git diff --check`, and two adversarial review cycles pass for plan item 19.1; `App.tsx` is 188 lines smaller and the existing Vite chunk-size warning remains non-fatal.
- 2026-07-21: 48 frontend tests, typecheck, production build, `git diff --check`, and two adversarial review cycles pass for plan item 19.2; shared UI primitives and the global notification lifecycle are outside `App.tsx`.
- 2026-07-21: 51 frontend tests, typecheck, production build, domain dependency checks, `git diff --check`, and two adversarial review cycles pass for plan item 19.3; `App.tsx` is 306 lines smaller with one domain contract source of truth.
- 2026-07-21: 55 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4; ACP Controls is a state-free typed feature component and `App.tsx` is 175 lines smaller.
- 2026-07-21: 59 frontend tests, typecheck, production build, Tauri/xterm-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.1; Session Output is a typed feature component and `App.tsx` is 74 lines smaller.
- 2026-07-21: 59 frontend tests, 92 Rust tests, typecheck, production build, Rust formatting/clippy, forbidden product-string checks, and two adversarial review cycles pass for plan item 19.4.2; Fake ACP is internal test infrastructure only.
- 2026-07-21: 62 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.3; workspace context summary/pickers are state-free feature presentation and `App.tsx` is 42 lines smaller.
- 2026-07-21: 66 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.4; repository management dialog is state-free feature presentation and `App.tsx` is 108 lines smaller.
- 2026-07-21: 70 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.5; workspace management dialog is state-free feature presentation and `App.tsx` is 100 lines smaller.
- 2026-07-21: 74 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.6; Project Initialize scope dialog is state-free feature presentation and `App.tsx` is 78 lines smaller.
- 2026-07-21: 79 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.7; Interview Guardrails dialog is state-free feature presentation, shared kind formatting is directly tested, and `App.tsx` is 136 lines smaller.
- 2026-07-21: 85 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.8; Initialization Details is state-free feature presentation across Facts, Markdown, Summary, and Knowledge Units, and `App.tsx` is 263 lines smaller.
- 2026-07-21: 89 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.9; Project Delete confirmation is state-free presentation and `App.tsx` is 55 lines smaller.
- 2026-07-21: 93 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.10; Task Context Preview is state-free knowledge presentation and `App.tsx` is 95 lines smaller.
- 2026-07-21: 97 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.11; New Knowledge Card is state-free knowledge presentation and `App.tsx` is 79 lines smaller.
- 2026-07-21: 101 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.12; Knowledge Cards sidebar is state-free presentation and `App.tsx` is 55 lines smaller.
- 2026-07-21: 106 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.13; Session History sidebar is state-free transcript presentation and `App.tsx` is 104 lines smaller.
- 2026-07-21: 111 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.14; ACP Registry sidebar is state-free agent presentation and `App.tsx` is 84 lines smaller.
- 2026-07-21: 116 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.15; Terminal PTY/Agent Doctor sidebar is state-free agent presentation and `App.tsx` is 88 lines smaller.
- 2026-07-21: 122 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.16; Initialization Summary phase card is state-free presentation and `App.tsx` is 172 lines smaller.
- 2026-07-21: 127 frontend tests, typecheck, production build, Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.17; the complete Project Initialization lane is state-free presentation and `App.tsx` is 318 lines smaller at 2,204 lines.
- 2026-07-21: 131 frontend tests, typecheck, production build, Tauri/xterm-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.4.18; PTY controls are state-free runtime presentation and `App.tsx` is 43 lines smaller at 2,161 lines.
- 2026-07-21: 134 frontend tests, typecheck, production build, direct-Tauri-import boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.5; all App backend commands now cross the explicit typed gateway.
- 2026-07-21: 136 frontend tests, typecheck, production build, xterm lifecycle boundary check, `git diff --check`, and two adversarial review cycles pass for plan item 19.6; terminal lifecycle/input/resize operations are isolated and `App.tsx` is 99 lines smaller at 2,062 lines.
- 2026-07-21: project-local frontend skill validation, deterministic frontend audit, 138 frontend tests, typecheck, production build, `git diff --check`, and two adversarial review cycles pass for plan item 20; future frontend changes are governed by permanent architecture and quality gates.
- 2026-07-21: frontend audit, 142 frontend tests, typecheck, production build, `git diff --check`, and two adversarial review cycles pass for plan item 21.1; project catalog orchestration is isolated with stale-response protection and `App.tsx` is 180 lines smaller at 1,882 lines.
- 2026-07-21: frontend audit, 145 frontend tests, typecheck, production build, `git diff --check`, and two adversarial review cycles pass for plan item 21.2; initialization evidence/cache orchestration is isolated with stale-response protection and `App.tsx` is 246 lines smaller at 1,636 lines.
- 2026-07-21: frontend audit, 149 frontend tests, typecheck, production build, `git diff --check`, and two adversarial review cycles pass for plan item 21.3; Project Initialization forms/actions are isolated and `App.tsx` is 275 lines smaller at 1,361 lines.
- 2026-07-21: frontend audit, 153 frontend tests, typecheck, production build, `git diff --check`, and two adversarial review cycles pass for plan item 21.4; Knowledge Cards/attachments/context preview are isolated and `App.tsx` is 143 lines smaller at 1,218 lines.
- 2026-07-21: frontend audit, 157 frontend tests, typecheck, production build, `git diff --check`, and two adversarial review cycles pass for plan item 21.5; transcript/Task-index orchestration is isolated and `App.tsx` is 255 lines smaller at 963 lines.
- 2026-07-21: frontend audit, 160 frontend tests, typecheck, production build, `git diff --check`, and two adversarial review cycles pass for plan item 21.6; ACP runtime orchestration is isolated and `App.tsx` is 194 lines smaller at 769 lines.
- 2026-07-21: frontend audit, 163 frontend tests, typecheck, production build, `git diff --check`, and two adversarial review cycles pass for plan item 21.7; PTY process/terminal orchestration is isolated and `App.tsx` is 113 lines smaller at 656 lines.
- 2026-07-21: frontend audit, 167 frontend tests, typecheck, production build, `git diff --check`, and two adversarial review cycles pass for plan item 21.8; Agent Doctor/synthesis catalog orchestration is isolated and `App.tsx` is 98 lines smaller at 558 lines.
- 2026-07-21: frontend audit, 170 frontend tests, typecheck, production build, `git diff --check`, and two adversarial review cycles pass for plan item 21.9; project deletion coordination is isolated, App has no backend workflow, and `App.tsx` is 39 lines smaller at 519 lines.
- 2026-07-21: frontend audit, 171 frontend tests, typecheck, production build without chunk warnings, `git diff --check`, and two adversarial review cycles pass for plan item 21.10; initial JS is 281.69 kB and PTY-only xterm is a separate 329.31 kB chunk.
- 2026-07-21: 93 Rust tests, 171 frontend tests, Rust fmt/clippy with warnings denied, frontend audit/typecheck/build, `git diff --check`, and two adversarial review cycles pass for plan item 22.1; immutable Task phase artifacts now retain same-transcript event provenance in canonical event order.
- 2026-07-21: 93 Rust tests, 171 frontend tests, Rust fmt/clippy with warnings denied, frontend audit/typecheck/build, `git diff --check`, and two adversarial review cycles pass for plan item 22.2; explicit start/complete transitions enforce canonical evidence-gated Task progression.
- 2026-07-21: 93 Rust tests, 177 frontend tests, Rust fmt/clippy with warnings denied, frontend audit/typecheck/build, `git diff --check`, and two adversarial review cycles pass for plan item 22.3; Task phases/artifacts are manually operable with persisted event provenance and stale-safe frontend orchestration.
- 2026-07-21: 94 Rust tests, 178 frontend tests, Rust fmt/clippy with warnings denied, typecheck/build, `git diff --check`, and two adversarial review cycles pass for plan item 22.4; the preview unifies three source classes under one strict budget without ACP injection.
- 2026-07-21: 94 Rust tests, 183 frontend tests, frontend audit/typecheck/build, Rust fmt/clippy, `git diff --check`, and two adversarial review cycles pass for plan item 22.5; frozen preview context reaches only the ACP wire payload after explicit confirmation.
- 2026-07-22: 96 Rust tests, 182 frontend tests, frontend audit/typecheck/build, Rust fmt/clippy, `git diff --check`, and two adversarial review cycles pass for plan item 22.6; exact context dispatch intents/outcomes are durable and ordered before ACP automation.
- 2026-07-22: 96 Rust tests, 187 frontend tests, frontend audit/typecheck/build, Rust fmt/clippy, `git diff --check`, and two adversarial review cycles pass for plan item 22.7; receipt history is inspectable and stale pending attempts can only be resolved as failed after their ACP session stops.
- 2026-07-22: 96 Rust tests, 195 frontend tests, frontend audit/typecheck/build, Rust fmt/clippy, `git diff --check`, and two adversarial review cycles pass for plan item 22.8; one visible phase-scoped instruction can run against the exact active Task without advancing its evidence gates.
- 2026-07-22: 97 Rust tests, 195 frontend tests, frontend audit/typecheck/build, Rust fmt/clippy, `git diff --check`, and two adversarial review cycles pass for plan item 22.9; every controlled phase run now has a durable ordered intent/outcome receipt.
- 2026-07-22: 97 Rust tests, 199 frontend tests, frontend audit/typecheck/build, Rust fmt/clippy, `git diff --check`, and two adversarial review cycles pass for plan item 22.10; phase-run history and active-session-guarded pending recovery are user-visible.
- 2026-07-22: 97 Rust tests, 201 frontend tests, frontend audit/typecheck/build, Rust fmt/clippy, `git diff --check`, and two adversarial review cycles pass for plan item 22.11; the latest persisted ACP response can become an editable evidence draft with exact event provenance.
- 2026-07-22: 97 Rust tests, 203 frontend tests, frontend audit/typecheck/build, Rust fmt/clippy, `git diff --check`, and two adversarial review cycles pass for plan item 22.12; phase completion now requires an explicit transient review acknowledgment against visible phase-specific criteria.
- 2026-07-22: 97 Rust tests, 204 frontend tests, frontend audit/typecheck/build, Rust fmt/clippy, `git diff --check`, and two adversarial review cycles pass for plan item 22.13; the screenshot-confirmed Task Phase collapse is fixed with a mode-safe flex layout and compact activity disclosure.
- 2026-07-22: 97 Rust tests, 205 frontend tests, frontend audit/typecheck/build, Rust fmt/clippy, `git diff --check`, and two adversarial review cycles pass for plan item 22.14; the screenshot-confirmed oversized provenance checkbox/list regression is fixed with normalized controls and a compact native disclosure.
