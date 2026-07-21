# Status

## Session
- session_id: codex-20260721-aiadne-beyond-conductor
- date_utc: 2026-07-21
- agent_model: codex

## Target Repositories
- code-buddy: /home/katarina/projects/AIadne

## Repository State
- branch: new/start
- head: 3f3360e step 18.3.3.3: record collapsible ACP workspace
- worktree: plan item 19.4.9 implementation and knowledge updates ready for commit.
- relevant files: src/App.tsx; src/features/workspace/ProjectDeleteDialog.tsx; src/features/workspace/ProjectDeleteDialog.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.

## Current Task
- request: commit the current work, define a roadmap beyond Conductor, begin implementation, and decompose the oversized frontend coordinator.
- phase: complete
- active plan step: 19.4.9 complete

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
