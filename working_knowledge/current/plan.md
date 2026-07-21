# Plan

## Active Plan

### 19.4.9. Extract Project Delete confirmation presentation
- objective: move the destructive project-deletion confirmation modal out of the frontend coordinator while preserving App-owned ACP shutdown, persistence, cleanup, and errors.
- status: complete
- files: src/App.tsx; src/features/workspace/ProjectDeleteDialog.tsx; src/features/workspace/ProjectDeleteDialog.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: delete modal/backdrop; project consequence copy; error alert; close/cancel/confirm actions; busy locks.
- expected changes: add a typed state-free and Tauri-free workspace confirmation component; pass candidate, busy/error state, and close/confirm callbacks from App; keep all destructive orchestration in existing App functions.
- acceptance criteria: exact deletion consequences remain visible; project name and error render correctly; busy disables Close/Cancel/Confirm; backdrop delegates to the guarded App close handler; no ACP stop, invoke, selection, initialization, transcript, or toast logic moves into the component.
- required tests: project/copy rendering; error alert; confirm callback; close/cancel/backdrop callbacks; busy locks; existing 85 frontend tests; typecheck; production build; Tauri boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 made the busy-backdrop delegation to App's guarded close handler explicit in tests, and cycle 2 found no remaining consequence-copy, error, action-lock, destructive-boundary, accessibility, runtime-boundary, regression, or scope issue.
- commit: this commit

### 19.4.8. Extract Initialization Details dialog presentation
- objective: move Facts, Markdown, and Summary/Knowledge Unit detail rendering out of the frontend coordinator while preserving App-owned view and async workflow state.
- status: complete
- files: src/App.tsx; src/features/initialization/InitializationDetailsDialog.tsx; src/features/initialization/InitializationDetailsDialog.test.tsx; src/lib/presentation.ts; src/lib/presentation.test.ts; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: details modal/backdrop/title; Facts groups; Markdown findings; Summary metrics/provenance/sections; published Knowledge Unit states/list; Summary approval and close actions; markdown category helpers.
- expected changes: add a typed state-free and Tauri-free initialization details component; move pure markdown category label/class formatting to presentation helpers; pass the selected view, derived data, loading/error state, and close/approve callbacks from App.
- acceptance criteria: all three titles and detail layouts remain unchanged; prerequisite, approval-required, loading, error, empty, and populated states retain their order and copy; approval stays disabled while loading or already approved; App retains view selection, approval mutation, Knowledge Unit loading, and errors.
- required tests: Facts populated/empty; Markdown populated/empty; Summary missing/draft and approval callback; approved Knowledge Unit loading/error/empty/populated states and source fallback; close/backdrop behavior; markdown helper mapping; existing 79 frontend tests; typecheck; production build; Tauri boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 added an explicit in-flight draft approval lock assertion, and cycle 2 found no remaining view, prerequisite, provenance, approval, Knowledge Unit state-ordering, source-fallback, accessibility, runtime-boundary, workflow-ownership, regression, or scope issue.
- commit: this commit

### 19.4.7. Extract Interview Guardrails dialog presentation
- objective: move the controlled Interview Guardrails modal out of the frontend coordinator while preserving App-owned draft validation, mutation, persistence, and reset rules.
- status: complete
- files: src/App.tsx; src/features/initialization/InterviewGuardrailsDialog.tsx; src/features/initialization/InterviewGuardrailsDialog.test.tsx; src/lib/presentation.ts; src/lib/presentation.test.ts; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: interview modal/backdrop; scope/repository/kind/path/content fields; draft guardrail list; kind label/style helpers; add/remove/save/cancel/close callbacks.
- expected changes: add a typed state-free and Tauri-free initialization feature component; move pure guardrail label/class formatting to shared presentation helpers; keep draft construction/validation, initialization checks, persistence, reset, loading, and errors in App.
- acceptance criteria: project/repository scope branches, repository fallback label, kind/path/content rendering, empty draft state, and all callback payloads remain unchanged; loading locks Close/Cancel/Save only as before; Save requires a draft; App retains all workflow state and mutations.
- required tests: controlled field callbacks and project scope; repository selector and draft rendering/removal; empty/save/loading rules; error, close, and backdrop behavior; guardrail helper mappings/fallback; existing 74 frontend tests; typecheck; production build; Tauri boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 corrected an ambiguous test query caused by identical option and draft-label text, and cycle 2 found no remaining controlled-field, scope, fallback-label, draft-action, loading, validation-ownership, accessibility, runtime-boundary, regression, or scope issue.
- commit: this commit

### 19.4.6. Extract Project Initialize scope dialog presentation
- objective: move the initial repository-scope and phase-preview modal out of the frontend coordinator while preserving App-owned initialization orchestration.
- status: complete
- files: src/App.tsx; src/features/initialization/ProjectInitializeDialog.tsx; src/features/initialization/ProjectInitializeDialog.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Project Initialize modal/backdrop; repository scope checkboxes; phase preview; error state; start/cancel/close actions.
- expected changes: add a typed state-free and Tauri-free initialization feature component; pass repositories, selected IDs, loading/error state, and callbacks from App; keep initialization creation, state reset, errors, persistence, and downstream phase loading in App.
- acceptance criteria: dialog semantics and copy remain unchanged; checkbox toggles preserve repository ID and checked value; loading locks Close/Cancel/Start but does not change existing checkbox/backdrop behavior; Start requires at least one selected repository; App retains all async workflow ownership.
- required tests: repository/phase rendering and toggle forwarding; selected scope and Start callback; empty-scope and loading locks; error, close, and backdrop behavior; existing 70 frontend tests; typecheck; production build; Tauri boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 added the missing selected-repository removal edge case, and cycle 2 found no remaining modal, scope-toggle, loading, validation, error, accessibility, runtime-boundary, workflow-ownership, regression, or scope issue.
- commit: this commit

### 19.4.5. Extract workspace management dialog presentation
- objective: move the Choose Workspace modal out of the frontend coordinator while preserving App-owned project persistence, folder selection, deletion confirmation, and session policy.
- status: complete
- files: src/App.tsx; src/features/workspace/WorkspaceDialog.tsx; src/features/workspace/WorkspaceDialog.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: workspace modal shell; project list and selected state; controlled project form; folder picker, refresh, select, delete, add, close, and backdrop callbacks.
- expected changes: add a typed state-free and Tauri-free workspace feature component; keep async commands and dialog visibility in App; replace the inline JSX with explicit props and callbacks.
- acceptance criteria: empty and selected states remain unchanged; Refresh is locked only while projects load; Select/Delete remain locked by busy or an active session; folder picking and trimmed-field validation preserve their current rules; App keeps deletion confirmation and closes after selection/deletion.
- required tests: empty/refresh rendering; selected state and session locks; select/delete callback forwarding; controlled inputs, folder/add validation, close, and backdrop dismissal; typecheck; frontend suite; production build; Tauri boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 added explicit regression coverage for the distinct loading and folder-picking locks, and cycle 2 found no remaining modal, selection, deletion-handoff, validation, session-safety, accessibility, runtime-boundary, regression, or scope issue.
- commit: this commit

### 19.4.4. Extract repository management dialog presentation
- objective: move repository listing, selection/deletion controls, and add-repository form out of `App.tsx` behind a typed workspace feature boundary.
- status: complete
- files: src/App.tsx; src/features/workspace/RepositoryDialog.tsx; src/features/workspace/RepositoryDialog.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: repository modal/backdrop; heading/close/refresh; repository list and default badge; selection/delete locks; controlled name/path fields; add action.
- expected changes: accept project/repository data, loading/busy/session-lock state, controlled form values, and callbacks; keep dialog visibility, selected ID mutation, async refresh/create/delete, persistence, and errors in App.
- acceptance criteria: dialog semantics, backdrop/close behavior, empty state, selected/default presentation, session safety locks, controlled fields, and add validation remain unchanged; feature imports no Tauri API and owns no state; App loses at least 100 lines.
- required tests: empty dialog/refresh; selected/default row locks; unlocked select/delete callbacks; controlled form/add validation; backdrop/close callbacks; existing 62 frontend tests; typecheck; production build; boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 found and corrected an accidental session lock on Add Repository while preserving select/delete locks, and cycle 2 found no remaining modal, validation, default protection, state-ownership, accessibility, runtime-boundary, regression, or scope issue.
- commit: this commit

### 19.4.3. Extract workspace context selection presentation
- objective: move the responsive current workspace/repository summary and picker controls out of `App.tsx` behind a minimal typed feature boundary.
- status: complete
- files: src/App.tsx; src/features/workspace/WorkspaceContextSelector.tsx; src/features/workspace/WorkspaceContextSelector.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: mobile context summary; current workspace picker; current repository picker; dialog-open callbacks.
- expected changes: accept selected Project/Repository contracts and two open callbacks; preserve empty/default labels and repository disabled state; keep selection, persistence, dialogs, native folder picker, forms, and deletion in App.
- acceptance criteria: accessible dialog semantics, responsive summary, empty labels, selected names/paths, Switch/Manage affordances, and repository prerequisite remain unchanged; feature imports no Tauri API and owns no state; App loses at least 25 lines.
- required tests: empty context/disabled repository; selected project with no repository; selected repository and both callbacks; existing 59 frontend tests; typecheck; production build; boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 preserved the responsive summary outside collapsible sidebar content by separating summary and picker exports, and cycle 2 made the intentional duplicate empty label explicit in tests; no remaining state-ownership, accessibility, responsive-DOM, runtime-boundary, regression, or scope issue.
- commit: this commit

### 19.4.2. Remove Fake ACP from the product surface
- objective: remove the test-only Fake ACP launch path from the user-facing frontend and public Tauri command surface while retaining deterministic internal Rust ACP fixtures.
- status: complete
- files: src/App.tsx; src/App.test.tsx; src/features/runtime/AcpRuntimePanel.tsx; src/features/runtime/AcpRuntimePanel.test.tsx; src-tauri/src/commands.rs; src-tauri/src/lib.rs; README.md; LOCAL_PROGRESS.md; working_knowledge/current/*.
- affected units: ACP start actions; AcpRuntimePanel props; fake frontend launch/transcript workflow; Tauri command registration; selected-registry ACP integration tests; active runtime documentation.
- expected changes: expose only Start Selected ACP in the product; route frontend ACP tests through the selected Codex registry candidate; remove the unused public fake command; keep manager-level fake subprocess helpers and Rust protocol tests internal.
- acceptance criteria: no Fake ACP control or public Tauri command remains; selected ACP launch, prompt, Task, transcript, knowledge, model, collapse, and output tests retain coverage; internal deterministic Rust ACP tests still pass; Fake PTY remains unchanged.
- required tests: direct runtime panel inactive state; full frontend suite; Rust ACP/unit suite; typecheck; production build; Rust formatting/clippy; forbidden UI/command string checks; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 moved frontend coverage to the selected-registry path and fixed readiness/React act synchronization, and cycle 2 found no remaining product exposure, public-command reachability, test-coverage, PTY regression, protocol-fixture, documentation, or scope issue.
- commit: this commit

### 19.4.1. Extract session output and transcript presentation
- objective: move PTY output and live/saved ACP event rendering out of `App.tsx` behind a typed presentation boundary while App retains refs and event ownership.
- status: complete
- files: src/App.tsx; src/features/runtime/SessionOutputPanel.tsx; src/features/runtime/SessionOutputPanel.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Session Output shell; PTY terminal mount/focus surface; ACP event list; empty and pending states; saved transcript heading/metadata; View Live callback.
- expected changes: accept runtime mode, derived events, saved transcript metadata, waiting state, terminal/output refs, focus callback, and live-view callback as props; keep event coalescing, polling, scroll effects, xterm lifecycle, and transcript state in App.
- acceptance criteria: PTY mount/focus behavior, screen-reader fallback, event labels/content, saved transcript metadata, empty notices, waiting row, and View Live action remain unchanged; feature imports no Tauri/xterm runtime; App loses at least 70 lines.
- required tests: direct PTY render/focus test; empty live ACP state; saved transcript labels/metadata/View Live callback; pending row; existing 55 frontend tests; typecheck; production build; boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 corrected the initial JSX insertion target and calibrated the net-line threshold, and cycle 2 found no remaining ref ownership, xterm lifecycle, event labeling, empty/pending state, accessibility, runtime-boundary, regression, or scope issue.
- commit: this commit

### 19.4. Extract the ACP runtime controls feature
- objective: move ACP session controls, prompt composer, coding-model selector, and active Task assessment out of `App.tsx` behind one typed presentation boundary.
- status: complete
- files: src/App.tsx; src/features/runtime/AcpRuntimePanel.tsx; src/features/runtime/AcpRuntimePanel.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: ACP Controls markup; compact/expanded state callback; session start/safety actions; prompt/context/send callbacks; session-advertised model selector; active Task assessment; waiting/result status.
- expected changes: introduce an explicit `AcpRuntimePanelProps` view-model/callback API; preserve App as orchestration owner; pass a derived `canPreviewContext` instead of initialization internals; keep the feature free of Tauri calls, transcript persistence, and duplicated state.
- acceptance criteria: accessible labels, compact-mode behavior, prompt retention, model capability states, Task assessment, Drain/Stop safety actions, and waiting/result presentation remain unchanged; runtime feature imports no Tauri API; App loses at least 170 lines.
- required tests: direct panel tests for inactive/active sessions, collapse callback, prompt/model callbacks, Task assessment, and waiting state; existing 51 frontend tests; typecheck; production build; Tauri-import boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 calibrated the net-line threshold and added direct Preview/Drain/Stop callback assertions, and cycle 2 found no remaining behavior, ownership, capability, safety-action, accessibility, Tauri-boundary, regression, or scope issue.
- commit: this commit

### 19.3. Extract frontend domain contracts
- objective: remove all Rust/Tauri DTO and frontend domain contract declarations from `App.tsx` into one dependency-free typed boundary.
- status: complete
- files: src/App.tsx; src/types/domain.ts; src/types/domain.test.ts; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: session, adapter/doctor, ACP, model catalog, project initialization, knowledge, transcript, Task, and runtime TypeScript contracts; App type imports.
- expected changes: export the existing contracts unchanged from `src/types/domain.ts`; use type-only imports in App; add compile-time/runtime-free contract fixtures for representative nested types; leave constants, state, commands, and rendering unchanged.
- acceptance criteria: no DTO/domain declaration remains in App; domain module imports no React/Tauri/runtime dependency; serialized field names and unions remain unchanged; `App.tsx` loses at least 300 lines; UI and backend invocation behavior remain identical.
- required tests: representative contract fixture assertions for ACP model, project initialization summary, and Task phase nesting; existing 48 frontend tests; typecheck; production build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 corrected the net-line acceptance threshold and removed a duplicate ACP event union from presentation helpers, and cycle 2 found no remaining contract drift, runtime dependency, type-safety, serialization, regression, or scope issue.
- commit: this commit

### 19.2. Extract shared UI primitives and global notifications
- objective: remove the first cross-feature state and reusable UI primitives from `App.tsx` through a narrowly owned Zustand store and component boundary.
- status: complete
- files: package.json; package-lock.json; src/App.tsx; src/App.test.tsx; src/components/ui/StateNotice.tsx; src/components/ui/icons.tsx; src/features/notifications/notificationStore.ts; src/features/notifications/notificationStore.test.ts; src/features/notifications/NotificationViewport.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: StateNotice; CloseIcon and ChevronIcon; bounded notification queue; dismissal timers; notification viewport; App workflow notification calls.
- expected changes: preserve StateNotice exports for compatibility; move cross-feature notifications to a small Zustand store with deterministic IDs and timer cleanup; keep notifications capped at three; render them through a feature component; remove timer refs and notification JSX from App.
- acceptance criteria: success/error roles and accessible dismissal labels remain unchanged; only the three newest notifications render; manual and automatic dismissal work; unmount/reset clears timers and state; App no longer owns notification state or reusable primitive implementations.
- required tests: store add/bounds/manual-dismiss/reset and fake-timer auto-dismiss tests; existing StateNotice/toast integration tests; full frontend suite; typecheck; production build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 found and removed an evicted-message timer retention window, and cycle 2 found no remaining queue, timer, reset, accessibility, state-isolation, dependency, regression, or scope issue.
- commit: this commit

### 19.1. Establish the first modular frontend seam
- objective: create a stable, directly tested presentation boundary and record the architecture/product roadmap before decomposing stateful features.
- status: complete
- files: docs/product-roadmap.md; src/App.tsx; src/lib/presentation.ts; src/lib/presentation.test.ts; LOCAL_PROGRESS.md; working_knowledge/current/status.md; working_knowledge/current/plan.md; working_knowledge/current/handoff.md; working_knowledge/current/repo-code-buddy.md; working_knowledge/current/mind_map/frontend-terminal.md.
- affected units: event/prompt/session/path/error presentation helpers; App imports; frontend architecture roadmap; active project knowledge.
- expected changes: move pure prompt enrichment, filtering, coalescing, event normalization/labels, command/path/error formatting, and ID helpers into a tested presentation module; preserve current behavior and use actual feature ownership to guide later DTO/component/Zustand slices.
- acceptance criteria: runtime behavior and accessible UI remain unchanged; extracted utilities have direct success/edge-case tests; `App.tsx` loses at least 150 lines; roadmap records the path beyond Conductor; no state or persistence semantics change.
- required tests: direct utility tests for prompt enrichment, transcript filtering/coalescing, path/error formatting, and toast bounds; existing 38 frontend integration tests; typecheck; production build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 narrowed an over-broad first slice and corrected its acceptance boundary, and cycle 2 found no remaining behavior, mutation, type-safety, edge-case, test, scope, or architecture issue.
- commit: this commit

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

### 18.3.3. Add a collapsible ACP workspace
- objective: let the user hide non-essential ACP working controls during Task execution so the output area gets substantially more vertical space while safety actions remain available.
- status: complete
- files: src/App.tsx; src/App.css; src/App.test.tsx.
- affected units: ACP Controls header; local expanded state; coding-model/prompt/Task/stop-reason content boundary; responsive runtime-panel styling.
- expected changes: add an accessible chevron toggle; keep session status, Drain, and Stop visible; collapse Coding model, Prompt, Task assessment, and stop reason; preserve the user's typed prompt in React state while hidden.
- acceptance criteria: ACP controls start expanded; the toggle accurately exposes `aria-expanded`; collapse hides non-essential controls but not session safety actions; expand restores the unchanged prompt and Task content; desktop/mobile layouts remain readable.
- required tests: initial expanded state; collapse and expand behavior; retained prompt value; Stop/Drain visibility while collapsed; accessibility attributes; typecheck and production build.
- review status: passed after 2 cycles; cycle 1 added coverage for the real Task assessment card, and cycle 2 corrected the hidden accessibility-tree assertion and found no remaining state-retention, safety-action, accessibility, responsive-layout, visual-consistency, regression, or performance issue.
- commit: 083a4b9

### 18.3.3.1. Keep the prompt visible in compact ACP mode
- objective: keep Task interaction available while ACP details are collapsed by leaving Prompt, Preview Context, and Send ACP visible.
- status: complete
- files: src/App.tsx; src/App.test.tsx.
- affected units: ACP collapsible content boundary; compact-mode regression assertions.
- expected changes: move the prompt composer outside the hidden details region; continue hiding Coding model, Task assessment, stop reason, and waiting detail; preserve the same prompt state and command behavior.
- acceptance criteria: collapsing ACP leaves the prompt composer and session safety actions visible; model and Task details leave layout/accessibility flow; prompt content can be edited and sent without expanding; expansion restores all details.
- required tests: prompt visibility/value while collapsed; Task detail absence/restoration; Drain/Stop visibility; existing ACP send behavior; typecheck and production build.
- review status: passed in cycle 1; prompt editing/sending, session safety actions, hidden detail boundaries, accessibility flow, state restoration, responsive layout, regressions, and complexity were checked with no remaining issue.
- commit: 4cb2826

### 18.3.3.2. Refine the ACP collapse affordance
- objective: render the ACP collapse action as a larger, heavier standalone chevron without a persistent circular container.
- status: complete
- files: src/App.css; src/App.test.tsx.
- affected units: ACP collapse-toggle visual states; chevron SVG sizing; existing accessibility regression contract.
- expected changes: reset inherited button border/background/shadow; retain a generous invisible hit target; increase chevron size and stroke weight; use color/scale feedback on hover and preserve keyboard-only focus indication.
- acceptance criteria: no circle or ellipse is visible at rest/hover; the arrow is more prominent; click target and `aria-expanded` behavior are unchanged; keyboard focus remains visible.
- required tests: existing collapse/expand accessibility regression; frontend suite; typecheck; production build; CSS patch review.
- review status: passed in cycle 1; inherited button chrome, resting/hover visuals, hit-target size, keyboard focus, responsive header fit, accessibility behavior, and regressions were checked with no remaining issue.
- commit: a8856ae

### 18.3.3.3. Commit collapsible ACP workspace knowledge
- objective: reconcile and commit the post-implementation knowledge state for completed plan items 18.3.3, 18.3.3.1, and 18.3.3.2.
- status: complete
- files: LOCAL_PROGRESS.md; working_knowledge/current/status.md; working_knowledge/current/plan.md; working_knowledge/current/handoff.md; working_knowledge/current/repo-code-buddy.md; working_knowledge/current/mind_map/frontend-terminal.md.
- affected units: human progress log; session status; active plan; repository findings; frontend/runtime mind map.
- expected changes: preserve the completed collapsible ACP workspace architecture and validation record as a separately auditable knowledge closure.
- acceptance criteria: active knowledge matches source commits 083a4b9, 4cb2826, and a8856ae; required files retain template structure; no source or generated artifact is included.
- required tests: frontend suite; typecheck; production build; `git diff --check`; commit and provenance-note readback.
- review status: passed in cycle 1; source alignment, template structure, scope, stale claims, patch hygiene, and the transient frontend timing failure were reviewed with no remaining deterministic issue.
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
