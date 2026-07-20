# Plan

## Active Plan

### 18.1. Add the persistent Task lifecycle foundation
- objective: introduce the Task aggregate and its four-phase lifecycle foundation without yet changing ACP prompt behavior; the canonical order was finalized by 18.2 as analysis, planning, execution, review.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs.
- affected units: ProjectStore migration; TaskInfo and TaskPhaseInfo storage contracts; create_task; list_project_tasks; task lookup and row mapping; Tauri command registration.
- expected changes: persist tasks linked to a project and transcript session; create the four canonical phases atomically; validate project/session ownership, non-empty prompts, supported phases, and one task per transcript; expose create/list commands.
- acceptance criteria: a valid task stores its original prompt and four ordered pending phases; duplicate transcript linkage, missing/cross-project references, and empty prompt fail; listing is project-scoped and stable; existing storage data migrates safely.
- required tests: success creation/listing; canonical phase order; empty prompt; missing project/session; cross-project transcript; duplicate transcript; migration regression through the existing in-memory store setup.
- review status: passed in cycle 1; atomic persistence, ownership, uniqueness, cascade behavior, deterministic ordering, API scope, regressions, complexity, and warning-free compilation were checked with no remaining issue.
- commit: 2cfde08

### 18.2. Activate the Task lifecycle from the first ACP prompt
- objective: correct the knowledge-building order to analysis, planning, execution, review, then make the first prompt in a project-owned ACP transcript create and bind the Task while subsequent prompts reuse it.
- status: complete
- files: src-tauri/src/storage.rs; src/App.tsx; src/App.test.tsx.
- affected units: TASK_PHASES and create_task defaults; frontend Task types and transcript-indexed Task state; project refresh; createTranscriptSession; sendAcpPrompt.
- expected changes: start new Tasks in analysis; load project Tasks; create the Task before recording/sending the first prompt; retain it by transcript id; reuse it for follow-up prompts; keep transcript events storing the unmodified user prompt; preserve the existing project-less ACP smoke path outside the Task workflow.
- acceptance criteria: project-owned first prompt creates exactly one analysis-first Task; later prompts in the same transcript do not create another; a new transcript has no stale Task binding; Task creation failure prevents transcript recording and ACP send; the original prompt remains unchanged in transcript storage while only the ACP payload may contain attached manual knowledge.
- required tests: canonical analysis-first order; first prompt creation; repeated prompt reuse; failure handling; new-session isolation; original prompt versus enriched ACP payload regression.
- review status: passed after 2 cycles; cycle 1 found and fixed stale project Task-load overwrite and project-owned sending without a persisted transcript; cycle 2 found no remaining lifecycle, isolation, prompt-integrity, regression, complexity, security, or performance issue.
- commit: a6181df

### 18.2.1. Commit active Task lifecycle knowledge
- objective: reconcile and commit the post-implementation knowledge state for completed Task lifecycle items 18.1 and 18.2.
- status: complete
- files: LOCAL_PROGRESS.md; working_knowledge/current/status.md; working_knowledge/current/plan.md; working_knowledge/current/open_questions.md; working_knowledge/current/decisions.md; working_knowledge/current/handoff.md; working_knowledge/current/repo-code-buddy.md; working_knowledge/current/mind_map.md; working_knowledge/current/mind_map/task-lifecycle.md; working_knowledge/current/mind_map/frontend-terminal.md.
- affected units: human progress log; session state; active plan; decisions and open questions; repository findings; Task lifecycle mind map.
- expected changes: preserve the completed Task architecture record; correct stale test counts and phase-order wording; record this documentation closure as a separately auditable item.
- acceptance criteria: active knowledge matches source commits 2cfde08 and a6181df; required files retain template structure; mind-map index maps every topic file; no source or generated artifact is included.
- required tests: required header checks; stale frontend-test-count and phase-order searches; mind-map index/file consistency; `git diff --check`; commit and provenance-note readback.
- review status: passed after 2 cycles; cycle 1 found and corrected stale phase-order and frontend-test-count claims, and cycle 2 found no remaining template, source-truth, index, scope, or patch-hygiene issue.
- commit: 2263631

### 18.3. Add adaptive Task complexity assessment
- objective: classify each new Task as quick, standard, or complex with an explainable, versioned backend assessment while preserving user control and the immutable initial result.
- status: complete
- files: src-tauri/src/task.rs; src-tauri/src/lib.rs; src-tauri/src/storage.rs; src-tauri/src/commands.rs.
- affected units: task complexity classifier; TaskInfo and create_task persistence; tasks migration; update_task_complexity override API; Tauri command registration.
- expected changes: score prompt signals deterministically; persist initial/effective profile, structured reasons, confidence, source, and classifier version; default ambiguous work to standard; expose a validated user override without overwriting the initial assessment.
- acceptance criteria: simple bounded UI work classifies quick; ambiguous and bounded two-layer work classifies standard; three-layer, migration, security, payment, or vertical work classifies complex; results and reasons are stable; existing databases migrate safely; only quick/standard/complex overrides are accepted; override preserves initial assessment and appends source=user history.
- required tests: quick, standard, complex, multilingual/case normalization, stable reasons/confidence bounds, existing-task migration defaults, Task creation persistence, valid override, invalid profile/reason, missing Task.
- review status: passed after 3 cycles; cycle 1 added append-only complexity history after finding overwrite-only audit loss; cycle 2 clarified two-layer standard versus three-layer complex behavior; cycle 3 tightened quick classification to exclude backend/data changes and found no remaining correctness, migration, audit, security, performance, or test issue.
- commit: d2e34fe

### 18.3.1. Show the active Task assessment in ACP
- objective: expose the persisted active Task and its effective complexity assessment as a read-only ACP panel before adding phase orchestration controls.
- status: complete
- files: src/App.tsx; src/App.css; src/App.test.tsx.
- affected units: frontend TaskInfo contract; transcript-indexed Task ref/state synchronization; active Task derivation; ACP Controls rendering; Task test fixtures.
- expected changes: render effective profile, current phase, structured reasons, confidence/source, and differing initial profile for the live transcript; restore the panel from list_project_tasks; clear it for a new transcript; keep project-less ACP unchanged.
- acceptance criteria: the panel appears after first project-owned prompt and on restored active Task data; system and user assessments are labeled correctly; null user confidence is not shown as a numeric score; a Task from another transcript is never shown as active; layout remains readable on narrow screens.
- required tests: created Task render; restored Task render; user override render; new-transcript isolation; project-less/no-Task absence; typecheck and production build.
- review status: passed after 2 cycles; cycle 1 cleared stale rendered Task state immediately on project switches, and cycle 2 found no remaining state-isolation, accessibility, responsive-layout, contract, regression, or performance issue.
- commit: 58b9a01

### 18.3.2. Add independent coding-agent model selection
- objective: keep Summary synthesis selection independent while letting the user choose the coding model advertised by the active ACP agent without changing global Codex configuration.
- status: complete
- files: src-tauri/src/acp.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/App.tsx; src/App.css; src/App.test.tsx.
- affected units: ACP session metadata/info; `session/new` response parsing; ACP config-option validation and update request; Tauri command registration; ACP Controls model selector.
- expected changes: retain the agent-advertised model option and current value; expose a validated command that sends `session/set_config_option`; update live session state from the response; render a separate Coding model selector that is disabled while a prompt is in flight.
- acceptance criteria: supported coding models come from the active agent; selecting one updates that ACP session only; unknown/unadvertised values fail before protocol dispatch; agents without model configuration remain usable with a clear read-only state; Summary selection remains unchanged.
- required tests: ACP model-option parsing; successful model change; unknown value rejection; unsupported-agent rejection; frontend independent selector rendering/change request; prompt-in-flight disabled state; existing ACP and Summary regressions; typecheck and production build.
- review status: passed after 2 cycles; cycle 1 found and fixed a race between prompt dispatch and model changes by sharing the session operation permit, and cycle 2 found no remaining capability, validation, isolation, concurrency, responsive UI, security, regression, or performance issue.
- commit: 017041d

### 18.3.2.1. Commit adaptive Task and coding-model knowledge
- objective: reconcile and commit the post-implementation knowledge state for completed plan items 18.3, 18.3.1, and 18.3.2.
- status: complete
- files: LOCAL_PROGRESS.md; working_knowledge/current/status.md; working_knowledge/current/plan.md; working_knowledge/current/open_questions.md; working_knowledge/current/decisions.md; working_knowledge/current/handoff.md; working_knowledge/current/repo-code-buddy.md; working_knowledge/current/mind_map/frontend-terminal.md; working_knowledge/current/mind_map/task-lifecycle.md.
- affected units: human progress log; session status; active plan; decisions and open questions; repository findings; frontend/runtime and Task lifecycle mind maps.
- expected changes: preserve the completed adaptive-complexity, Task assessment UI, and independent coding-model architecture records; correct stale test counts and manual-test numbering; leave the worktree clean.
- acceptance criteria: active knowledge matches source commits d2e34fe, 58b9a01, and 017041d; required files retain template structure; mind-map index maps every topic file; no source code or generated artifact is included.
- required tests: required header checks; stale test-count and duplicate manual-step searches; mind-map index/file consistency; referenced commit/note checks; `git diff --check`; clean-worktree verification after commit.
- review status: passed after 2 cycles; cycle 1 corrected duplicate manual-test numbering and resolved documentation-commit self-reference without amending history, and cycle 2 found no remaining template, source-truth, mind-map coverage, stale-count, scope, provenance, or patch-hygiene issue.
- commit: this commit

### 18.4. Persist phase outputs as task knowledge
- objective: add source-backed task knowledge artifacts produced during analysis, planning, execution, and review and advance phase state safely, with depth informed by the effective complexity profile.
- status: pending
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; relevant Rust tests.
- affected units: task phase transition API; task knowledge schema/API; phase validation and provenance linkage; analysis-driven complexity confirmation.
- expected changes: store immutable knowledge artifacts with task id, producing phase, kind, content, source transcript event references, and timestamps; enforce ordered phase transitions; let analysis propose a justified profile upgrade/downgrade without discarding the initial assessment.
- acceptance criteria: artifacts remain task-scoped, phase provenance is explicit, invalid transitions/references fail, phase completion is atomic with artifact writes, and complexity changes remain auditable.
- required tests: success/failure/edge cases for artifacts, provenance, ordering, retries, task isolation, and analysis-driven reclassification.
- review status: not_started
- commit: none

### 18.5. Add the staged Task workflow to the ACP UI
- objective: expose the active Task, phase progress, and accumulated task context while preserving explicit user control over what reaches the agent.
- status: pending
- files: src/App.tsx; src/App.css; src/App.test.tsx.
- affected units: ACP prompt panel; session output; Task status/context presentation; phase actions.
- expected changes: show task identity and four phases, render phase knowledge, and provide explicit phase execution/review actions with accessible loading/error states.
- acceptance criteria: users can understand current phase and acquired knowledge; no task context is silently injected; reload restores persisted state; responsive and accessibility contracts remain intact.
- required tests: task lifecycle rendering; phase actions; restored state; error/loading states; explicit context boundary; responsive shell regression.
- review status: not_started
- commit: none

## Plan Assumptions
- One Task maps to one project-owned ACP transcript session, and the first user prompt is its immutable original prompt; project-less ACP remains a compatibility smoke path without Task persistence.
- The four canonical phases are ordered analysis, planning, execution, and review; Task creation itself provides intake/framing, and review owns final learning capture.
- Task knowledge is a separate layer from project Knowledge Units and manual Knowledge Cards, though later context assembly may select from all three explicitly.
- Phase orchestration details will be refined after first-prompt Task activation is stable.
- Initial complexity uses a deterministic versioned classifier; analysis may later confirm or propose a change, and the user retains final control through an explicit override.
- Summary model profiles are selected from the synthesis catalog; coding-agent models are discovered and changed through the active ACP session's advertised configuration.
