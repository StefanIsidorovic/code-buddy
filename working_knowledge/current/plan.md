# Plan

## Active Plan

### 20. Add enforceable modern frontend skill
- objective: make AIadne's React/TypeScript architecture, state ownership, infrastructure boundaries, tests and validation requirements automatically available and enforceable for future frontend work.
- status: complete
- files: .agents/skills/aiadne-modern-frontend/*; AGENTS.md; package.json; src/features/notifications/NotificationViewport.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: agent skill discovery; frontend architecture guidance; deterministic audit; notification viewport coverage; npm quality gate.
- expected changes: add one project-local implicitly triggered skill, architecture reference, executable audit and permanent AGENTS requirement; close the existing untested notification component gap found by the audit.
- acceptance criteria: skill triggers for all frontend changes/reviews; audit enforces App/feature size, Tauri/xterm boundaries, unsafe TypeScript escapes and colocated component tests; validation commands are explicit and runnable.
- required tests: skill quick validation; audit; typecheck; 138 frontend tests; focused warning-free notification tests; production build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 corrected shell quoting/path allowlists and added missing NotificationViewport behavior/accessibility coverage, and cycle 2 removed React act cleanup noise and found no remaining trigger, architecture, audit, test, validation, or scope issue.
- commit: this commit

### 19.6. Extract PTY terminal lifecycle orchestration
- objective: move xterm construction/disposal, input forwarding, resize observation, dimension state and imperative terminal operations out of App.
- status: complete
- files: src/App.tsx; src/features/runtime/usePtyTerminal.ts; src/features/runtime/usePtyTerminal.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Terminal/FitAddon refs; PTY-mode mount effect; session input; ResizeObserver; fit/reset/focus/write operations; terminal-size state.
- expected changes: add a focused runtime hook backed by current-value refs; preserve one terminal instance per PTY-mode mount; keep PTY process start/stop/drain commands in App.
- acceptance criteria: keyboard input only reaches running sessions; resize only persists changed running dimensions; initial output/empty text, cleanup and imperative operations remain unchanged; no xterm imports remain in App.
- required tests: mount/initial output; keyboard gating/forwarding/error; resize gating/forwarding; imperative operations; cleanup; existing 134 frontend tests; typecheck; build; boundary and diff checks.
- review status: passed after 2 cycles; cycle 1 preserved minimum terminal dimensions and current-value callback/session refs, and cycle 2 found no remaining mount, input-gating, resize, cleanup, imperative-operation, xterm-boundary, process-ownership, regression, or scope issue.
- commit: this commit

### 19.5. Introduce the typed Tauri command gateway
- objective: remove direct Tauri command imports from the application coordinator and establish one auditable frontend/backend invocation boundary.
- status: complete
- files: src/App.tsx; src/lib/tauriGateway.ts; src/lib/tauriGateway.test.ts; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: all project, repository, initialization, knowledge, transcript, Task, PTY, doctor, catalog, ACP registry/session/model/prompt command calls.
- expected changes: define the complete allowed command-name union and a generic typed result gateway; migrate App to the gateway without changing command names or payloads; directly test forwarding and error propagation.
- acceptance criteria: App has no direct `@tauri-apps/api/core` import; every existing command is admitted explicitly; command args/results/errors are forwarded unchanged; backend behavior and mocks remain compatible.
- required tests: gateway no-args/args/result/error forwarding; command inventory boundary checks; existing 131 frontend tests; typecheck; production build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 restored exact one-argument invocation shape and corrected the hoisted gateway mock, and cycle 2 found no remaining command-inventory, argument/result/error-forwarding, direct-import, mock-compatibility, regression, or scope issue.
- commit: this commit

### 19.4.18. Extract PTY runtime controls
- objective: move fallback PTY actions, status, button-lock policy, and terminal-size presentation out of the frontend coordinator.
- status: complete
- files: src/App.tsx; src/features/runtime/PtyRuntimePanel.tsx; src/features/runtime/PtyRuntimePanel.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Use ACP; Start Fake; Start Codex; Drain; Resize; Stop; Kill; PTY status and terminal dimensions.
- expected changes: add a typed state-free and Tauri-free runtime panel; accept runtime capabilities, dimensions and callbacks; keep PTY lifecycle, xterm integration, mode state and backend commands in App.
- acceptance criteria: all button labels/order/locks and dimensions remain unchanged; callbacks preserve fake/codex and graceful/force semantics; panel has an accessible heading and terminal-state definition list.
- required tests: idle/session/busy/codex-unavailable locks; all callback forwarding; terminal dimensions; existing 127 frontend tests; typecheck; production build; Tauri/xterm boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 verified explicit has-session versus usable-session policy and graceful/force callback semantics, and cycle 2 found no remaining lock-policy, action-order, dimensions, accessibility, Tauri/xterm-boundary, lifecycle-ownership, regression, or scope issue.
- commit: this commit

### 19.4.17. Extract the Project Initialization lane
- objective: move the Initialization lane shell, phase rail, Preflight, Facts, Markdown, and Interview evidence presentation out of the frontend coordinator and compose the extracted Summary card.
- status: complete
- files: src/App.tsx; src/features/initialization/ProjectInitializationPanel.tsx; src/features/initialization/ProjectInitializationPanel.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: lane heading/hero/status/start prerequisite; phase progression; Preflight scope; Facts metrics/preview/actions; Markdown preview/actions; Interview guardrail preview/action; Summary card composition.
- expected changes: add a typed state-free and Tauri-free initialization panel; move status/phase presentation derivation into the feature; accept source-backed preview data and callbacks; keep all async commands, modal state, model selection, persistence and errors in App.
- acceptance criteria: workspace/repository prerequisites, phase states/count grammar, preview caps/content, button locks, source metadata and action payloads remain unchanged; Summary card behavior remains independently covered; App loses the dominant Initialization JSX block.
- required tests: no-workspace/no-repository/ready prerequisites; phase/preflight states; Facts populated/empty/actions; Markdown populated/empty/actions; Interview populated/empty/action; Summary composition callbacks; existing 122 frontend tests; typecheck; production build; Tauri boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 replaced an ambiguous duplicate-text test query and removed stale App-owned preview derivation, and cycle 2 found no remaining phase-state, prerequisite, action-lock, source-metadata, accessibility, Tauri-boundary, workflow-ownership, regression, or scope issue.
- commit: this commit

### 19.4.16. Extract Project Initialization Summary phase card
- objective: move synthesis tier/profile selection, capability presentation, Summary generation/review actions, and compact provenance preview out of the frontend coordinator.
- status: complete
- files: src/App.tsx; src/features/initialization/InitializationSummaryCard.tsx; src/features/initialization/InitializationSummaryCard.test.tsx; src/lib/presentation.ts; src/lib/presentation.test.ts; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Phase 5 card; tier group; profile options/unavailability; provider/capability badges; Generate/View locks; summary metrics/status/model provenance and prerequisite state.
- expected changes: add a typed state-free and Tauri-free phase component; move tier/capability formatting to presentation helpers; move tier-profile/provider presentation derivation into the feature; keep selected profile derivation used by generation workflow in App.
- acceptance criteria: all tiers/options/status reasons/capabilities and provenance copy remain unchanged; Generate requires selectable profile and idle state; View requires Summary; callbacks forward exact tier/profile; App retains catalog loading, selection state, provider invocation, Summary persistence and errors.
- required tests: tiers/profile callbacks; empty/unavailable options; capabilities/provider; action locks/callbacks; draft/approved/empty preview; helper mappings; existing 116 frontend tests; typecheck; production build; Tauri boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 removed the stale App ModelProfileInfo import and confirmed workflow-required selected profile remains App-owned, and cycle 2 found no remaining tier/profile, availability, provider/capability, action-lock, provenance, accessibility, runtime-boundary, generation ownership, regression, or scope issue.
- commit: this commit

### 19.4.15. Extract Terminal PTY and Agent Doctor sidebar presentation
- objective: move PTY fallback mode switching and Agent Doctor report rendering out of the frontend coordinator while preserving App-owned discovery, runtime mode, and active-session policy.
- status: complete
- files: src/App.tsx; src/features/agents/TerminalFallbackPanel.tsx; src/features/agents/TerminalFallbackPanel.test.tsx; src/lib/presentation.ts; src/lib/presentation.test.ts; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Terminal PTY details/summary; Doctor refresh/error; PTY/ACP toggle; adapter status/executable/detail/transports; capability/status helpers.
- expected changes: add a typed state-free and Tauri-free agents panel; move pure Doctor/capability formatting to presentation helpers; pass mode, reports, loading/error, session lock and callbacks from App.
- acceptance criteria: default-collapsed DOM, active/fallback summary, toggle copy, session lock, refresh lock, error and all Doctor metadata remain unchanged; App retains discovery invoke, mode state and session policy.
- required tests: collapsed mode summaries/toggle; refresh/toggle callbacks; report installed/missing/error details and transports; loading/session locks and error; helper mappings; existing 111 frontend tests; typecheck; production build; Tauri boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 confirmed Start Codex/Fake PTY runtime actions remain outside the sidebar feature and distinct Doctor/session locks, and cycle 2 found no remaining mode summary, toggle, report status/detail/transport, error, loading, accessibility, runtime-boundary, discovery/policy ownership, regression, or scope issue.
- commit: this commit

### 19.4.14. Extract ACP Registry sidebar presentation
- objective: move ACP candidate discovery results, selection controls, and selected-command summary out of the frontend coordinator while preserving App-owned discovery, selection, session policy, and errors.
- status: complete
- files: src/App.tsx; src/features/agents/AcpRegistryPanel.tsx; src/features/agents/AcpRegistryPanel.test.tsx; src/lib/presentation.ts; src/lib/presentation.test.ts; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: ACP Agents details/summary; refresh/error; candidate status/metadata/command/install hint; selected state/action locks; selected candidate summary; status labels.
- expected changes: add a typed state-free and Tauri-free agents panel; move pure candidate status labeling to presentation helpers; pass candidates, selected ID, loading/error and selection/session-lock callbacks from App.
- acceptance criteria: default-collapsed DOM, candidate metadata, command formatting, all statuses, selected summary, aria selection, and busy/session locks remain unchanged; App retains discovery invoke and state policy.
- required tests: collapsed/empty summary; statuses/metadata; select callback/selected summary; busy/session/loading locks and error; helper mappings; existing 106 frontend tests; typecheck; production build; Tauri boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 confirmed distinct refresh versus selection lock sources and command quoting, and cycle 2 found no remaining status, metadata, selected-summary, aria-selection, loading, session policy, accessibility, runtime-boundary, discovery ownership, regression, or scope issue.
- commit: this commit

### 19.4.13. Extract Session History sidebar presentation
- objective: move transcript filtering, capped history rendering, and controlled rename presentation out of the frontend coordinator while preserving App-owned loading, stale-response guards, persistence, selection, and errors.
- status: complete
- files: src/App.tsx; src/features/transcripts/SessionHistoryPanel.tsx; src/features/transcripts/SessionHistoryPanel.test.tsx; src/lib/presentation.ts; src/lib/presentation.test.ts; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: history details/summary; filter and three-row cap; active label; refresh; selected rename field/action; error/empty/no-match states; transcript row metadata/open callback; timestamp formatting.
- expected changes: add a typed state-free and Tauri-free transcript panel; move pure filter/visible derivation and timestamp formatting to presentation scope; pass sessions, selected/active IDs, controlled values, state, and callbacks from App.
- acceptance criteria: default-collapsed details boundary remains; summary reports filtered/total; only three matching rows render; rename requires a selected session, non-blank changed title, and idle state; row selection/open payloads and metadata remain exact; App retains request guards and all mutations.
- required tests: collapsed summary/filter counts; empty/no-match/error; three-row cap and row metadata; open/filter callbacks; rename validation/callbacks; loading locks; timestamp helper; existing 101 frontend tests; typecheck; production build; Tauri boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 confirmed the filter/three-row derivation and preserved active-vs-opened label semantics, and cycle 2 found no remaining count, empty/no-match, rename validation, row metadata, callback, loading, accessibility, runtime-boundary, stale-response/persistence ownership, regression, or scope issue.
- commit: this commit

### 19.4.12. Extract Knowledge Cards sidebar presentation
- objective: move the manual Knowledge Cards accordion out of the frontend coordinator while preserving App-owned loading, persistence, attachment, transcript linkage, errors, and dialog state.
- status: complete
- files: src/App.tsx; src/features/knowledge/KnowledgeCardsPanel.tsx; src/features/knowledge/KnowledgeCardsPanel.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: sidebar details/summary; attached/available counts; add action; visible error; empty/list states; card metadata/body; attachment checkboxes.
- expected changes: add a typed state-free and Tauri-free knowledge sidebar component; pass items, attached IDs/count, loading/visible error, and add/toggle callbacks from App; preserve the details DOM boundary and default-collapsed behavior.
- acceptance criteria: summary count uses valid attached items; available count/meta/body and empty/error copy remain unchanged; add locks while loading; checkboxes forward the item and exact checked state; App retains refresh, persistence, transcript attachment, dialog/error visibility policy, and state.
- required tests: collapsed summary/count; empty/error/add; populated metadata and selected state; attach/detach callback payloads; loading add lock; existing 97 frontend tests; typecheck; production build; Tauri boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 confirmed the details/default-collapsed DOM and App-owned error visibility boundary, and cycle 2 found no remaining count, metadata, attachment payload, loading, accessibility, runtime-boundary, persistence-ownership, regression, or scope issue.
- commit: this commit

### 19.4.11. Extract New Knowledge Card dialog presentation
- objective: move the controlled manual Knowledge Card creation modal out of the frontend coordinator while preserving App-owned creation, attachment, reset, persistence, and errors.
- status: complete
- files: src/App.tsx; src/features/knowledge/KnowledgeCardDialog.tsx; src/features/knowledge/KnowledgeCardDialog.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: card modal/backdrop; title/kind/body controlled fields; error alert; cancel/close/create actions; loading and trimmed-field validation.
- expected changes: add a typed state-free and Tauri-free knowledge form component; pass controlled values, loading/error state, and callbacks from App; keep create invoke, project/global scope, transcript attachment, list update, reset, and visibility in App.
- acceptance criteria: all five kind options and existing copy remain unchanged; changes forward exact values; Create requires non-blank trimmed title/body and is locked while loading; Close/Cancel lock while loading; backdrop delegates to App's guarded close handler.
- required tests: controlled field callbacks and kind options; trimmed validation; create callback; error rendering; close/cancel/backdrop; loading locks and backdrop delegation; existing 93 frontend tests; typecheck; production build; Tauri boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 removed the now-unused final inline-modal CloseIcon import from App, and cycle 2 found no remaining option, controlled-field, trimmed-validation, loading, backdrop-delegation, accessibility, runtime-boundary, create/attach/reset ownership, regression, or scope issue.
- commit: this commit

### 19.4.10. Extract Task Context Preview presentation
- objective: move the auditable Knowledge Unit selector preview modal out of the frontend coordinator while preserving App-owned selector invocation, prompt, visibility, and async lifecycle.
- status: complete
- files: src/App.tsx; src/features/knowledge/TaskContextPreviewDialog.tsx; src/features/knowledge/TaskContextPreviewDialog.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: preview modal/backdrop; loading/error/no-preview notices; character budget; included/excluded selector entries; exact rendered context; close action.
- expected changes: add a typed state-free and Tauri-free knowledge feature component; pass loading/error/result and close callback from App; keep selector command, task prompt, open/result/error state, and lifecycle in App.
- acceptance criteria: state precedence remains loading, error, result, then empty; budget and counts are exact; included score/reason and excluded reason formatting remain unchanged; exact context stays read-only; Close and backdrop remain blocked while loading.
- required tests: loading and close locks; error and no-preview states; populated budget/included/excluded/context; no-included match notice; close/backdrop callbacks; existing 89 frontend tests; typecheck; production build; Tauri boundary check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 found no source issue and confirmed state precedence plus loading-safe dismissal directly, and cycle 2 found no remaining budget, count, included/excluded formatting, read-only context, accessibility, runtime-boundary, workflow-ownership, regression, or scope issue.
- commit: this commit

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
