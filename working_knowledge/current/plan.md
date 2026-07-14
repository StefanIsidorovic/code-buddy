# Plan

## Active Plan

### 7. Record Knowledge Unit selector as the next product step
- objective: align all active project knowledge around the completed Summary atomization and the deterministic task-context selector that follows it.
- status: complete
- files: README.md; LOCAL_PROGRESS.md; docs/linear-tasks.md; working_knowledge/current/status.md; working_knowledge/current/plan.md; working_knowledge/current/open_questions.md; working_knowledge/current/decisions.md; working_knowledge/current/handoff.md; working_knowledge/current/repo-code-buddy.md; working_knowledge/current/mind_map.md; working_knowledge/current/mind_map/knowledge-synthesis.md.
- affected units: active workspace status; product roadmap; knowledge-synthesis flow; repository findings; Linear-ready selector task; human-readable local diary.
- expected changes: state that approved Summary content is split into source-backed Knowledge Units; define the next selector as a non-mutating deterministic filter/ranker/packer with repository/path relevance, mandatory-rule priority, strict budget, inclusion/exclusion reasons, and preview; keep embeddings deferred.
- acceptance criteria: every relevant current knowledge surface describes the same completed state and next step without claiming that the selector rewrites Knowledge Units or already injects them into prompts.
- required tests: terminology search; stale-claim search; `git diff --check`; adversarial cross-file consistency review.
- review status: passed after 2 cycles; cycle 1 added the missing README workflow update, cycle 2 aligned an older LOCAL_PROGRESS prompt-injection statement; no stale or contradictory selector boundary remains.
- commit: none

### 6.1 Publish source-backed Knowledge Units from approved summaries
- objective: add the canonical generated Knowledge Unit persistence model and atomically derive independently inspectable units when a Summary is approved.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; working_knowledge/current/status.md; working_knowledge/current/plan.md; working_knowledge/current/decisions.md; working_knowledge/current/handoff.md; working_knowledge/current/repo-code-buddy.md; working_knowledge/current/mind_map/knowledge-synthesis.md.
- affected units: ProjectStore::migrate; ProjectStore::approve_project_initialization_summary; new KnowledgeUnitInfo/KnowledgeUnitSourceInfo models; deterministic Summary section atomizer; list_project_initialization_knowledge_units command; storage migration and approval tests.
- expected changes: create normalized knowledge_units and knowledge_unit_sources tables; split non-empty Summary lines into section-typed units; retain validated source markers as source rows; mark explicit uncertainty as needs_confirmation; atomically replace units for the approved Summary; expose ordered listing by initialization id.
- acceptance criteria: approval produces small source-backed units in the same transaction; repeated approval is idempotent; invalid/missing summaries do not publish units; manual Knowledge Cards remain unchanged; listing returns stable typed provenance.
- required tests: migration/schema test; successful sourced and needs-confirmation atomization; repeated approval; missing summary failure; full Rust suite; fmt; clippy with warnings denied; diff check.
- review status: passed after 2 cycles; cycle 1 corrected a fixture capitalization regression, cycle 2 found no remaining transaction, identity, migration, compatibility, or test issue.
- commit: 87f506e

### 6.2 Preview approved Knowledge Units in Project Initialize
- objective: make the published units and their provenance visible from the Summary review UI without changing runtime prompt injection.
- status: complete
- files: src/App.tsx; src/App.test.tsx; src/App.css; working_knowledge/current/status.md; working_knowledge/current/plan.md; working_knowledge/current/handoff.md; working_knowledge/current/repo-code-buddy.md; working_knowledge/current/mind_map/knowledge-synthesis.md.
- affected units: frontend KnowledgeUnit types/state; Summary refresh and approval flows; Summary Review dialog; Tauri invoke mocks and initialization workflow test.
- expected changes: load units for the active initialization; show unit count, kind/topic/status/content, scope, confidence, and exact sources after approval; show explicit empty/error states; preserve existing Summary and Knowledge Card workflows.
- acceptance criteria: approved Summary review explains exactly which units were published and where each came from; draft Summary does not imply units are active; existing workflows remain unchanged.
- required tests: approval/list invoke coverage; sourced unit render; needs-confirmation render; empty state; typecheck; frontend suite; production build; diff check.
- review status: passed after 2 cycles; cycle 1 replaced undefined CSS design tokens, cycle 2 found no remaining state, accessibility, overflow, styling, or regression issue.
- commit: a65c187

## Plan Assumptions
- A line-oriented deterministic atomizer is the safest first slice because provider output already requires section-level source markers and no claim-level structured schema exists yet.
- Source markers identify evidence keys; repository_id/path scope remains unset unless it can be derived without ambiguity from persisted evidence.
- Generated Knowledge Units are a separate canonical model; legacy manual knowledge_items remain unchanged until a later migration decision.
- Prompt selection, token budgeting, stale/supersession policy across different summaries, and embeddings are separate later plan items.
