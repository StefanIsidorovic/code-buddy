# Repository Notes

## Identity
- name: code-buddy (visible product: AIadne)
- path: /home/katarina/projects/AIadne
- branch: new/start

## Architecture
- Unified Task Context preserves the legacy project-only selector while adding an authoritative three-source preview across project knowledge, attached cards, and same-transcript Task artifacts.
- The unified preview is source-aware, strict-budgeted, and stale-safe; it never triggers automatic ACP prompt injection.
- Explicit preview confirmation now enriches only the ACP wire prompt; persisted Task/transcript prompt identity remains plain and unchanged.
- `task_context_dispatch_receipts` records exact context-send intent before ACP dispatch and its later sent/failed outcome; list access is typed for later recovery/history UI.
- Tauri 2 desktop application with a React 19/TypeScript/Vite frontend and Rust backend.
- `src/App.tsx` composes the workspace, initialization, runtime, history, and dialogs; focused ACP view state lives in `src/features/runtime/AcpWorkspaceViews.tsx`, and `src/App.css` owns the visual system.
- Rust modules separate PTY sessions, ACP transport, agent adapters, SQLite storage, model catalog, synthesis providers, Knowledge Unit selection, commands, and errors.
- SQLite persists projects, repositories, initialization artefacts, summaries, Knowledge Units, ACP transcripts, and manual Knowledge Cards.
- Structured ACP is the primary runtime surface; xterm-backed PTY remains the compatibility fallback.

## Entry Points
- `src/main.tsx`: React bootstrap.
- `src/App.tsx`: application UI and frontend orchestration.
- `src-tauri/src/main.rs`: desktop executable.
- `src-tauri/src/lib.rs`: Tauri builder, state, plugins, and command registration.
- `src-tauri/src/commands.rs`: frontend/backend command boundary.

## Tests
- `src/App.test.tsx` contains 38 mocked integration-style frontend tests covering workspace, repositories, initialization, summaries, Knowledge Units, selector preview, transcripts, Knowledge Cards, ACP, Task creation/reuse/failure isolation and assessment rendering, PTY, and responsive product-shell contracts.
- Rust has 97 unit/integration tests across PTY/ACP lifecycle and model configuration, adapters, storage, synthesis, model catalog, deterministic context selection, Task persistence, complexity classification, overrides, audit history, and migration.
- Current validation commands: `npm run typecheck`; `npm run test -- --run`; `npm run build`; `cargo fmt --manifest-path src-tauri/Cargo.toml --check`; `cargo test --manifest-path src-tauri/Cargo.toml`; `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`.

## Current Findings
- Workspace projects own repositories; the selected repository path is passed as PTY/ACP cwd.
- Project Initialize persists selected scope, Facts, Markdown findings, Interview guardrails, provider-routed Summary drafts, approval status, and requested-model provenance.
- OpenAI Responses is the implemented synthesis provider; exact source allowlists and one bounded correction attempt protect citation integrity.
- Summary approval atomically publishes deterministic, source-backed Knowledge Units; valid ATX headings are treated as structure, while uncited claims still block approval.
- `select_project_task_context` deterministically prioritizes mandatory rules, repository/path scope, and lexical matches under an exact character budget; the frontend exposes an auditable preview.
- Generated selector context is not yet sent to ACP. `Send ACP` continues to inject only explicitly attached manual Knowledge Cards and persists the original user prompt.
- The first project-owned ACP prompt now creates one persistent Task before transcript/agent side effects; follow-ups reuse it by transcript id, and new Tasks start in ordered analysis, planning, execution, and review phases.
- Project-less ACP remains a compatibility smoke path without Task persistence; project-owned prompts are blocked if transcript or Task persistence fails.
- New Tasks receive a versioned deterministic quick/standard/complex assessment in Rust: bounded UI/content work can be quick, ambiguous or bounded two-layer work is standard, and security/payment, migration, three-layer, or explicit vertical work is complex.
- Task rows retain immutable initial and effective complexity fields for fast reads; `task_complexity_changes` stores append-only system/user history, and validated overrides preserve the initial assessment.
- ACP Controls renders the live transcript's Task assessment read-only; project switches clear stale render state immediately and saved/other transcript Tasks are not presented as active.
- ACP session creation retains agent-advertised model options; the UI changes the Coding model through `session/set_config_option`, validates choices against that session, and leaves Summary selection and global Codex config unchanged.
- The ACP runtime panel has an accessible local chevron toggle; collapsed mode removes model, Task, and result details from layout/accessibility flow while preserving Prompt/Send and active-session Drain/Stop actions.
- The ACP chevron uses a 42 px invisible hit target with a prominent 24 px heavy arrow; persistent border, background, radius, and shadow chrome are removed.
- ACP transcripts are persisted, coalesced for readable replay, filterable, and renameable; continue-from-transcript is not implemented.
- AIadne is the visible Tauri/window and sidebar identity; internal package/crate names and `com.codebuddy.app` intentionally remain unchanged.
- The active visual system uses the local AIadne SVG mark, Geist Sans, Ariadne Atelier semantic colors, responsive navigation, accessible state notices, consistent overlays, and reduced-motion-safe transitions.
- `src/App.tsx` is a 562-line composition root with no backend commands; frontend orchestration modularization is complete.
- `AcpWorkspaceViews` applies Claude Buddy's single-active-view navigation pattern locally: Agent keeps controls/output together by default, while Task and Activity isolate tall workflow surfaces without global state.
- Pure prompt, transcript, event, command, path, and error presentation logic now lives in `src/lib/presentation.ts` with direct unit coverage; this is the first seam in the staged `App.tsx` decomposition.
- Shared notices/icons live under `src/components/ui`; global notifications now use a bounded, timer-safe Zustand store and dedicated viewport under `src/features/notifications`, while workflow-local drafts remain in App pending feature extraction.
- Frontend Rust/Tauri DTO and domain unions now have one dependency-free source of truth in `src/types/domain.ts`; App consumes them through type-only imports and representative nested contracts have compile-time tests.
- ACP Controls now lives in `src/features/runtime/AcpRuntimePanel.tsx` behind a typed view-model/callback API; it owns presentation only and imports neither Tauri nor transcript/project orchestration.
- Session Output now lives in `src/features/runtime/SessionOutputPanel.tsx`; App retains xterm/event refs, polling, coalescing, scroll effects, transcript selection, and live-view state while the feature owns PTY/ACP output markup.
- Fake ACP is no longer a frontend control or public Tauri command; selected registry candidates are the only product ACP launch path, while manager-level fake subprocesses remain deterministic Rust protocol fixtures.
- Responsive workspace/repository context summary and picker controls now live in `src/features/workspace/WorkspaceContextSelector.tsx`; App still owns selected IDs, persistence, modal state, and all mutations.
- Repository management modal now lives in `src/features/workspace/RepositoryDialog.tsx`; App owns visibility, controlled drafts, selected ID, refresh/create/delete commands, errors, and persistence.
- Workspace management modal now lives in `src/features/workspace/WorkspaceDialog.tsx`; App owns visibility, controlled drafts, native folder picking, refresh/create commands, selected ID persistence, and project deletion confirmation.
- Initial Project Initialize repository-scope modal now lives in `src/features/initialization/ProjectInitializeDialog.tsx`; App owns selected scope, initialization creation/persistence, state reset, errors, and all later phases.
- Interview Guardrails modal now lives in `src/features/initialization/InterviewGuardrailsDialog.tsx`; App owns controlled draft state, validation, reset, persistence, loading, and errors, while shared kind labels/classes live in presentation helpers.
- Initialization Details modal now lives in `src/features/initialization/InitializationDetailsDialog.tsx` with internal Facts, Markdown, Summary, and published-unit views; App owns selected view, Summary approval, Knowledge Unit loading/errors, and all mutations.
- Project Delete confirmation now lives in `src/features/workspace/ProjectDeleteDialog.tsx`; App owns busy-guarded closing, ACP shutdown, deletion persistence, selected-project cleanup, errors, and notifications.
- Task Context Preview now lives in `src/features/knowledge/TaskContextPreviewDialog.tsx`; App owns selector invocation, prompt input, visibility, result/loading/error lifecycle, while the feature renders the auditable budget and inclusion/exclusion decision.
- New Knowledge Card modal now lives in `src/features/knowledge/KnowledgeCardDialog.tsx`; App owns creation scope, Tauri persistence, list insertion, auto-attachment, transcript linkage, reset, visibility, loading, and errors.
- Knowledge Cards sidebar now lives in `src/features/knowledge/KnowledgeCardsPanel.tsx`; App owns refresh, attachment state/persistence, transcript linkage, dialog/error visibility policy, and mutations.
- Session History sidebar now lives in `src/features/transcripts/SessionHistoryPanel.tsx`; it owns pure filtering and the three-row presentation cap, while App owns transcript loading/opening, stale-response guards, rename persistence, selection, and errors.
- ACP Registry sidebar now lives in `src/features/agents/AcpRegistryPanel.tsx`; App owns candidate discovery, selected ID and session policy, while the feature owns status/metadata/command and selected-summary presentation.
- Terminal PTY/Agent Doctor sidebar now lives in `src/features/agents/TerminalFallbackPanel.tsx`; App owns Doctor discovery, runtime mode and active-session policy, while the feature owns report and toggle presentation.
- Project Initialization Summary phase card now lives in `src/features/initialization/InitializationSummaryCard.tsx`; App retains catalog/selection workflow and generation persistence, while the feature derives tier options/provider presentation and renders capabilities/actions/preview.
- The full Project Initialization lane now lives in `src/features/initialization/ProjectInitializationPanel.tsx`; phase/prerequisite/evidence presentation composes the Summary card while App retains async commands, modal state and persistence.
- PTY runtime controls now live in `src/features/runtime/PtyRuntimePanel.tsx`; the feature owns action-lock presentation while App retains xterm integration and process lifecycle.
- `src/lib/tauriGateway.ts` is the sole core Tauri invoke boundary for the frontend; its explicit command union makes backend surface changes auditable while preserving exact call shapes.
- `src/features/runtime/usePtyTerminal.ts` owns xterm/FitAddon construction, keyboard forwarding, resize observation, cleanup and imperative terminal operations; App retains PTY process commands.
- `.agents/skills/aiadne-modern-frontend/` defines the mandatory frontend workflow and architecture reference; `npm run frontend:audit` enforces size, infrastructure-import, unsafe-TypeScript and colocated-test boundaries.
- `src/features/workspace/useProjectCatalog.ts` owns project/repository selection, forms, dialogs and CRUD with stale repository response protection; App retains cross-domain project deletion coordination.
- `src/features/initialization/useInitializationEvidence.ts` owns current initialization/evidence caches, parallel refreshes, status transitions and stale-response protection; workflow actions update it through semantic methods.
- `src/features/initialization/useProjectInitializationWorkflow.ts` owns start/details/interview modal state, Facts/Markdown actions, Interview validation/save and Summary generation/approval while updating evidence through semantic actions.
- `src/features/knowledge/useKnowledgeWorkspace.ts` owns stale-safe Knowledge Card loading, form/create, transcript attachments and approved-Summary task-context preview.
- `src/features/transcripts/useTranscriptWorkspace.ts` owns stale-safe transcript/Task loading, create/replay/rename/live state, event persistence and synchronous semantic session/Task access for ACP.
- `src/features/runtime/useAcpRuntime.ts` owns ACP registry selection, session/model/prompt lifecycle, transcript/Task event coordination, polling and graceful shutdown before project deletion.
- `src/features/runtime/usePtyRuntime.ts` owns PTY process state/start/resize/drain/stop and composes the xterm lifecycle hook; App supplies only mode, cwd and Doctor readiness.
- `src/features/agents/useAgentEnvironment.ts` owns stale-safe Agent Doctor discovery, synthesis catalog validation/fallback, tier/profile selection and Summary provenance restoration; ACP coding-model state remains session-owned.
- `src/features/workspace/useProjectDeletion.ts` owns confirmation/error state and ACP-first deletion coordination through injected catalog/evidence callbacks; App no longer invokes the backend directly.
- `src/features/runtime/usePtyTerminal.ts` dynamically loads xterm/FitAddon/CSS only in PTY mode and guards late async resolution; initial JS is 281.69 kB and the isolated xterm chunk is 329.31 kB.
- `task_phase_artifacts` stores append-only outputs ordered per Task phase; normalized event-source links require real transcript events from the Task's own session and list them in transcript sequence order.
- `task_phase_run_response_events` links a sent controlled run to exact persisted agent response events; storage rejects wrong Task transcripts and non-agent events, while prompt-time polling is paused to preserve attribution.
- `latest_task_phase_run_response_events` selects the latest sent receipt for the Task's current phase and returns its linked events in transcript order; Task orchestration uses it only to prepare an editable completion draft.
- `TaskPhaseGuide` derives a compact optional-helper/authoritative-gate flow from existing draft, artifact, and review props; it owns no persisted or shared state.
- ACP session normalization discards tool_call_update transport noise while retaining meaningful tool_call titles/status; idle polling is one second and Task/Activity panels own desktop scroll containment.
- `transition_task_phase` is the authoritative Task state machine: only the current pending phase can start, only its in-progress state accepts artifacts, completion requires evidence, and review completion terminates the Task.
- `src/features/tasks/` owns the stale-safe artifact/transition workflow and state-free phase panel; live transcript persistence retains backend event IDs solely for valid provenance selection.
- `docs/product-roadmap.md` defines the frontend modularization, evidence-aware Task workflow, multi-agent runtime, execution/review harness, Git delivery intelligence, and measured-learning sequence beyond Conductor.

## Constraints
- Preserve source markers and generated Knowledge Unit content/provenance exactly through selection and future prompt integration.
- Keep Task lifecycle/knowledge separate from transcript events, project Knowledge Units, and manual Knowledge Cards.
- Treat classifier confidence as a prompt-only baseline; analysis confirmation and measured calibration are deferred, and historical assessment versions must remain interpretable.
- Keep manual Knowledge Cards and generated Knowledge Units separate until an explicit migration decision.
- Do not hold the SQLite lock during provider network calls; reject stale synthesis results when evidence changes.
- Keep credentials in the Rust process and out of React/SQLite.
- Real CLI/ACP behavior depends on locally installed tools and PATH; browser-only Vite mode cannot validate Tauri commands.
- The initial Vite JS bundle is below 500 kB; xterm is a separate PTY-only dynamic chunk and the build has no chunk-size warning.
- Linux-first fake CLI/runtime helpers still need platform hardening before cross-platform release.
