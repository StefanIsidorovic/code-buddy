# Status

## Session
- session_id: codex-20260720-runtime-model-selection
- date_utc: 2026-07-20
- agent_model: codex

## Target Repositories
- code-buddy: /home/katarina/projects/AIadne

## Repository State
- branch: new/start
- head: current plan item 18.3.2.1 documentation closure commit
- worktree: expected clean after the current documentation closure commit.
- relevant files: src-tauri/src/acp.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src-tauri/src/models.rs; src/App.tsx; src/App.css; src/App.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.

## Current Task
- request: commit all remaining adaptive Task and coding-model knowledge state before continuing.
- phase: complete
- active plan step: 18.3.2.1 complete

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
