# Plan

## Active Plan

### 25.3. Finalize Task guidance and execution/review UX slice
- objective: validate documentation, frontend guidance, knowledge state, provenance, and handoff before continuing to the next roadmap family.
- status: pending
- files: LOCAL_PROGRESS.md; working_knowledge/current/*; src/features/tasks/*; src/App.css.
- affected units: Task user mental model, Task panel guidance, current knowledge, frontend gates, provenance records.
- expected changes: run required checks, perform adversarial review, update working knowledge, and commit the completed slice with provenance notes.
- acceptance criteria: docs and UI describe the same Task workflow; `App.tsx` remains composition-only; provenance exists for completed items; worktree is clean.
- required tests: `rg` docs/guidance checks; `npm run frontend:audit`; `npm run typecheck`; `npm run test -- --run`; `npm run build`; `git diff --check`.
- review status: pending.
- commit: pending.

### 25.2. Add in-app Task operating model guidance
- objective: reduce Task UI confusion by showing a compact user-facing operating model directly in the Task phase panel.
- status: pending
- files: src/features/tasks/TaskPhasePanel.tsx; src/features/tasks/TaskPhasePanel.test.tsx; src/App.css; working_knowledge/current/*.
- affected units: Task phase presentation, accessibility semantics, phase helper copy, frontend architecture guardrails.
- expected changes: add a small disclosure or guidance panel explaining that Run/Prepare are helpers, Evidence proves work, Review gates completion, and Activity audits attempts/reports.
- acceptance criteria: guidance is visible and accessible, does not add backend calls or state machine changes, keeps App out of feature logic, and preserves existing phase actions.
- required tests: TaskPhasePanel behavior test for guidance copy and existing controls; frontend audit/typecheck/test/build; `git diff --check`.
- review status: pending.
- commit: pending.

### 25.1. Document the real-user Task workflow
- objective: make the Task concept understandable from a real user's perspective before adding more execution/review features.
- status: complete
- files: LOCAL_PROGRESS.md; working_knowledge/current/status.md; working_knowledge/current/plan.md; working_knowledge/current/handoff.md; working_knowledge/current/repo-code-buddy.md; working_knowledge/current/mind_map/task-lifecycle.md.
- affected units: local progress docs, current working knowledge, Task lifecycle mental model, stale 24.6 handoff/status text.
- expected changes: add a concise Task story covering Agent/Task/Activity, analysis/planning/execution/review phases, explicit evidence gates, and read-only advisor/reviewer reports; repair current knowledge to acknowledge committed 24.6.
- acceptance criteria: docs explain what the user does, what the agent may do, what remains manual, and why Task is not every chat message; current knowledge no longer says 24.6 is pending.
- required tests: `rg -n "Kako Task treba da radi za realnog usera|agentov odgovor nije automatski|Plan item 24.6 is committed" LOCAL_PROGRESS.md working_knowledge/current/handoff.md`; `git diff --check`.
- review status: passed after 1 cycle; docs were checked against the current Task state machine and deliberately avoid implying automatic evidence creation, phase completion, Task mutation, or advisor/reviewer write authority.
- commit: this commit.

### 24.6. Harden the secondary-agent flow end to end
- objective: validate the completed secondary-agent workflow across frontend, Rust, recovery boundaries, provenance, and working knowledge before moving to the next roadmap family.
- status: complete
- files: src-tauri/src/*; src/features/tasks/*; src/features/runtime/*; src/types/domain.ts; src/lib/tauriGateway.ts; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: secondary-agent workspace creation, ACP orchestration, report persistence, Activity UI, runtime cleanup, test gates.
- expected changes: run the full frontend/Rust quality gates; perform explicit adversarial review; update tracker and active knowledge; create one commit with a verified provenance note for the final hardening slice if additional fixes are required.
- acceptance criteria: all implemented secondary-agent pieces compile, tests pass, working knowledge matches HEAD, each completed step has one provenance note, and no executor Task mutation path is introduced.
- required tests: `npm run frontend:audit`; `npm run typecheck`; `npm run test -- --run`; `npm run build`; `cargo fmt --manifest-path src-tauri/Cargo.toml --check`; `cargo test --manifest-path src-tauri/Cargo.toml`; `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`; `git diff --check`.
- review status: passed after 1 cycle; full frontend/Rust gates passed, App/feature boundaries remained within audit ceilings, provenance notes were verified for 24.3, 24.4 and 24.5, and no additional code fix was required.
- commit: this commit.

### 24.5. Add Activity controls for secondary advisor/reviewer runs
- objective: expose deliberate user-started advisor/reviewer runs from the Activity view without turning secondary agents into Task executors.
- status: complete
- files: src/App.tsx; src/types/domain.ts; src/lib/tauriGateway.ts; src/features/tasks/useTaskAgentReports.ts; src/features/tasks/TaskAgentReportsPanel.tsx; related tests and current knowledge.
- affected units: read-only report panel actions; stale-safe feature orchestration; typed Tauri command boundary; Activity tab report refresh and loading/error states.
- expected changes: add role actions for the current in-progress Task phase; disable them without an active Task, active ACP candidate, selected repository, or while a run is in flight; refresh reports after success and surface actionable errors.
- acceptance criteria: the UI clearly separates secondary reports from phase evidence; stale Task changes cannot attach a late report to the visible Task; no direct Tauri import or backend workflow enters presentation.
- required tests: action disabled states; exact command payload; loading/error display; stale Task guard; successful refresh; full frontend/Rust gates.
- review status: passed after 2 cycles; cycle 1 verified stale-safe hook orchestration, disabled/running/error states, exact gateway payload and report refresh, and cycle 2 reran full frontend/Rust gates plus direct boundary checks for App composition and no Tauri imports in the feature.
- commit: this commit.

### 24.4. Orchestrate secondary advisor/reviewer reports
- objective: run one isolated secondary ACP role against the current Task phase, persist its transcript output, and convert exact agent output into an immutable report.
- status: complete
- files: src-tauri/src/acp.rs; src-tauri/src/commands.rs; src-tauri/src/storage.rs; src-tauri/src/lib.rs; src/types/domain.ts; src/lib/tauriGateway.ts; related tests and current knowledge.
- affected units: Task/phase validation; secondary ACP start/send/drain/stop; secondary transcript creation; exact event provenance; immutable `task_agent_reports`.
- expected changes: add a typed command that validates the current in-progress Task, creates an isolated secondary ACP session, creates a separate ACP transcript, sends a role-scoped prompt, persists user and agent events, creates a report from agent output, then stops and cleans up the secondary session/workspace.
- acceptance criteria: only advisor/reviewer roles are accepted; only the current in-progress phase is targetable; a report requires persisted agent output; executor transcript and Task phase artifacts are untouched; failures do not create partial reports.
- required tests: fake ACP happy path; invalid role/phase/task rejection; no-agent-output failure; cleanup/stop on failure; exact transcript provenance; full frontend/Rust gates.
- review status: passed after 2 cycles; cycle 1 moved Task/phase/role validation before external ACP startup, and cycle 2 verified atomic storage, fake ACP orchestration, cleanup, gateway typing, and unchanged Task mutation boundaries.
- commit: this commit.

### 24.3. Add isolated secondary ACP workspace foundation
- objective: create a backend launch boundary that gives secondary agents a writable repository snapshot while keeping the executor repository outside their visible filesystem.
- status: complete
- files: src-tauri/src/acp.rs; related Rust tests; working_knowledge/current/*.
- affected units: ACP registry session start request; process command construction; repository snapshot creation; sandbox capability detection; cleanup lifecycle.
- expected changes: extend ACP start internals with an explicit isolated workspace mode; copy a bounded snapshot that excludes `.git` and common generated directories; wrap registry adapter processes with `bwrap` when isolation is requested; report the snapshot cwd as the session cwd.
- acceptance criteria: ordinary ACP startup remains unchanged; isolated startup refuses to run without `bwrap`; `session/new.cwd` points at the snapshot, not the original repository; `.git`, `node_modules`, `target`, and `dist` are not copied; the snapshot is removed when the ACP session drops.
- required tests: snapshot filtering; sandbox command construction; isolated fake/registry launch uses snapshot cwd; no-isolation path remains unchanged; full Rust/frontend gates before commit.
- review status: passed after 2 cycles; cycle 1 added direct missing-`bwrap` coverage and cycle 2 moved snapshot/sandbox logic out of `acp.rs` into `acp_workspace.rs`, then fixed the cleanup test to be parallel-safe.
- commit: this commit.

### 22.14. Repair transcript provenance picker UX
- objective: fix the screenshot-confirmed oversized/misaligned checkbox layout and keep long transcript provenance inspectable without dominating the Task workflow.
- status: complete
- files: src/App.css; src/features/tasks/TaskPhasePanel.tsx; related test and current knowledge.
- affected units: global checkbox normalization; native provenance disclosure; event metadata/content preview; selected-state presentation.
- expected changes: reset checkbox dimensions excluded from generic text-input sizing; collapse provenance by default; show selected/event counts; render compact labeled rows with kind, sequence and two-line preview.
- acceptance criteria: checkboxes remain keyboard-accessible and label-bound; long instructions wrap/clamp; all persisted event kinds remain selectable; selected items are visually distinct; picker does not consume space until opened.
- required tests: collapsed/open behavior; selected count; exact event metadata; existing selection callback; full frontend/Rust gates; audit/typecheck/build; fmt/clippy; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 traced the regression to global input sizing plus grid-stretched labels and introduced the compact disclosure, and cycle 2 verified persisted-event access, selection semantics, compatibility target, accessibility and global checkbox scope.
- commit: this commit

### 22.13. Repair the runtime workflow layout and compact activity UI
- objective: fix the screenshot-confirmed Task Phase collapse/overlay and reduce empty receipt-history space without hiding access to audit data.
- status: complete
- files: src/App.css; src/App.tsx; src/features/tasks/TaskWorkflowRegion.tsx; related test and current knowledge.
- affected units: dynamic ACP/PTY runtime layout; Task workflow hierarchy; native activity disclosure; narrow-window ACP toolbar.
- expected changes: replace the stale two-row runtime grid with a resilient vertical flex layout; keep Task Phase visible; group histories under collapsed Task activity; wrap long session IDs/actions at 760px.
- acceptance criteria: Task actions cannot collapse into a zero-height row; PTY and ACP child counts both work; Output consumes remaining space; histories remain keyboard-accessible; narrow toolbars do not force horizontal clipping.
- required tests: semantic workflow region/disclosure/counts; App/Task regressions; full frontend/Rust gates; audit/typecheck/build; fmt/clippy; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 identified the obsolete two-row grid as the root cause and grouped Task activity, and cycle 2 replaced a mode-fragile three-row fix with dynamic flex layout and raised the ACP responsive breakpoint to match the reported viewport.
- commit: this commit

### 22.12. Add a phase-aware evidence review checkpoint
- objective: prevent accidental UI completion immediately after artifact creation by requiring explicit review against transparent phase-specific criteria.
- status: complete
- files: src/features/tasks/taskPhaseReview.ts; src/features/tasks/useTaskPhaseWorkflow.ts; src/features/tasks/TaskPhasePanel.tsx; src/App.tsx; related tests and current knowledge.
- affected units: deterministic review guidance; transient acknowledgment state; completion UI gate; Task composition.
- expected changes: show three criteria for the current canonical phase; require acknowledgment after persisted artifacts exist; reset acknowledgment on Task change, artifact creation, or transition.
- acceptance criteria: no automatic quality claim; backend artifact requirement remains authoritative; acknowledgment cannot survive evidence/phase changes; semantic checkbox and disabled state are testable.
- required tests: criteria display; locked/unlocked completion; callback payload; hook completion guard and reset; full frontend/Rust gates; audit/typecheck/build; fmt/clippy; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 established explicit reset semantics rather than deriving review from artifact existence, and cycle 2 verified accessibility, stale behavior, size/dependency boundaries, and the documented transient-versus-persisted distinction.
- commit: this commit

### 22.11. Draft phase evidence from persisted ACP output
- objective: reduce manual evidence copying while preserving explicit review, provenance, persistence, and completion gates.
- status: complete
- files: src/features/tasks/useTaskPhaseWorkflow.ts; src/features/tasks/TaskPhasePanel.tsx; src/App.tsx; related tests and current knowledge.
- affected units: persisted transcript provenance selection; editable artifact draft; Task panel presentation; App composition.
- expected changes: explicitly draft evidence content from the highest-sequence persisted agent message/thought and select only that event ID as provenance.
- acceptance criteria: user/notice events are excluded; unordered input still selects the greatest sequence; draft remains editable and unpersisted; Add evidence and Complete remain separate explicit backend gates.
- required tests: latest persisted selection and draft content; visible/forwarded action; unavailable-response lock; full frontend/Rust gates; audit/typecheck/build; fmt/clippy; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 replaced array-order selection with canonical event sequence and upgraded the action from provenance-only to an editable evidence draft, and cycle 2 verified event-kind filtering and unchanged persistence/completion gates.
- commit: this commit

### 22.10. Present phase-run history and recover stale pending runs
- objective: make controlled phase-run attempts inspectable and provide a conservative recovery path for genuinely stale pending runs.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/lib/tauriGateway.ts; src/features/tasks/useTaskPhaseRunHistory.ts; src/features/tasks/TaskPhaseRunHistoryPanel.tsx; src/App.tsx; related tests and current knowledge.
- affected units: active-session recovery guard; ordered Task history; stale-safe feature state; state-free presentation; App composition.
- expected changes: show exact instruction, phase, time and outcome; refresh after every completed run attempt; allow only pending-to-failed recovery with a bounded reason after ACP stops.
- acceptance criteria: finalized outcomes are immutable; recovery cannot claim delivery; Task changes invalidate old loads; exact stored instruction is visible; no Zustand or direct Tauri coupling enters presentation.
- required tests: exact resolution payload; stale load; exact instruction/status display; mandatory reason; finalized lock; backend pending/finalized policy; full frontend/Rust gates; audit/typecheck/build; fmt/clippy; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 extended storage coverage for manual recovery and finalized immutability, and cycle 2 refreshed history after both successful and failed ACP attempts so failure evidence is immediately visible.
- commit: this commit

### 22.9. Persist auditable phase-run receipts
- objective: persist the exact current-phase execution intent before ACP dispatch and its conservative outcome afterward.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/types/domain.ts; src/lib/tauriGateway.ts; src/features/runtime/useAcpRuntime.ts; related tests and current knowledge.
- affected units: SQLite migration; phase/state/Task ownership validation; ACP dispatch orchestration; typed runtime boundary.
- expected changes: atomically create an ordered pending receipt; finalize sent/failed once; retain exact instruction, phase, ACP session, stop reason/error; expose ordered list API.
- acceptance criteria: only the exact current in-progress phase can create an intent; old databases migrate idempotently; uncertain interrupted work remains pending; finalized outcomes are immutable; frontend uses only the auditable command.
- required tests: pending-phase rejection; begin/order/list; sent/failed finalization; double-finalize; exact frontend payload; full frontend/Rust gates; audit/typecheck/build; fmt/clippy; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 fixed a SQLite read-back mutex deadlock and made begin atomic, and cycle 2 verified migration, single-finalization, failed dispatch, typed routing, and conservative pending semantics.
- commit: this commit

### 22.8. Run one Task phase under explicit gates
- objective: let the user invoke exactly one current Task phase without automatic evidence creation, completion, or phase advancement.
- status: complete
- files: src/features/tasks/taskPhaseExecution.ts; src/features/tasks/TaskPhasePanel.tsx; src/features/runtime/useAcpRuntime.ts; src/App.tsx; src/App.css; related tests and current knowledge.
- affected units: canonical phase instruction policy; Task presentation; ACP prompt concurrency; transcript persistence; Task/session ownership.
- expected changes: show the exact phase-scoped instruction; enable Run only for an in-progress phase and usable ACP session; persist the instruction as a transcript event and send one ACP prompt.
- acceptance criteria: each phase has a bounded responsibility; original Task prompt is included but unchanged; rapid duplicate prompts remain locked; Task mismatch blocks dispatch; no artifact, completion, or transition is manufactured.
- required tests: all four phase instructions; exact visible instruction/callback; unavailable ACP lock; exact ACP payload/transcript event; Task ownership rejection; full frontend/Rust gates; audit/typecheck/build; fmt/clippy; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 added exact Task identity validation at the runtime boundary, and cycle 2 confirmed phase/evidence gates, accessibility, concurrency, file sizes, dependency direction, and explicit remaining receipt debt.
- commit: this commit

### 22.7. Present receipt history and resolve stale pending dispatches safely
- objective: make every reviewed-context dispatch inspectable and provide an explicit, conservative recovery path for genuinely stale `pending` receipts.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/lib/tauriGateway.ts; src/features/tasks/TaskDispatchHistoryPanel.tsx; src/features/tasks/useTaskDispatchHistory.ts; src/App.tsx; src/App.css; related tests and current knowledge.
- affected units: ordered Task receipt history; stale-safe frontend loading; manual recovery boundary; active ACP session race protection; App feature composition.
- expected changes: display exact prompt/context, sources and outcome for each receipt; allow only `pending` to become `failed` with a bounded mandatory reason; never infer or manually assert successful delivery.
- acceptance criteria: finalized receipts are immutable; receipts cannot cross Task ownership; an associated running ACP session blocks resolution; exact stored context remains inspectable; stale Task loads cannot overwrite the current workspace.
- required tests: ordered display and exact context; mandatory reason; exact resolve payload; finalized-receipt lock; stale load; active-session/backend storage guards; full frontend/Rust gates; audit/typecheck/build; fmt/clippy; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 added the active ACP-session guard to close a dispatch/resolution race, and cycle 2 bounded manual reasons and preserved responsive presentation.
- commit: this commit

### 22.6. Persist auditable context dispatch receipts
- objective: retain a durable, ordered record of the exact reviewed context intent and ACP dispatch outcome before any automatic phase execution.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/types/domain.ts; src/lib/tauriGateway.ts; src/features/runtime/useAcpRuntime.ts; related tests and current knowledge.
- affected units: SQLite Task audit schema; pending/sent/failed lifecycle; ACP dispatch orchestration; exact prompt/context/source snapshot; typed frontend boundary.
- expected changes: persist intent before ACP side effects; finalize the same receipt with stop reason or error; expose ordered list API; route explicit context send through the new command while preserving legacy sends.
- acceptance criteria: Task/transcript ownership is authoritative; exact whitespace and wire prompt are retained; known unique sources are snapshotted; per-Task order is stable; failed and interrupted attempts remain auditable; original Task/transcript prompt is unchanged.
- required tests: begin/finalize/list/order; double-finalize; cross-transcript/incomplete inputs; exact whitespace/wire prompt; runtime typed payload and original transcript event; full frontend/Rust gates; audit/typecheck/build; fmt/clippy; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 preserved byte-exact prompt/context values and restricted source snapshots to known unique source classes, and cycle 2 verified conservative pending recovery semantics across external ACP and SQLite failure boundaries.
- commit: this commit

### 22.5. Send frozen Task context explicitly
- objective: let the user send the exact context they reviewed while preserving the original Task prompt and transcript message unchanged.
- status: complete
- files: src/features/knowledge/TaskContextPreviewDialog.tsx; src/features/runtime/useAcpRuntime.ts; src/lib/presentation.ts; src/App.tsx; colocated/integration tests; current knowledge.
- affected units: preview confirmation UI; ACP wire-prompt formatting; original-prompt persistence; prompt concurrency guard; App feature composition.
- expected changes: add an explicit send action to the preview; enrich only the ACP wire payload; retain ordinary Send ACP compatibility; close preview only after successful dispatch.
- acceptance criteria: no automatic context injection; unavailable/empty/busy states cannot send; original transcript/Task prompt remains unchanged; selected context is not duplicated with attached cards; rapid double-submit produces one ACP request; failure remains retryable.
- required tests: formatter boundary; dialog send/lock/empty states; runtime wire versus transcript payload; double-submit; full frontend/Rust gates; audit; typecheck/build; fmt/clippy; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 added a synchronous in-flight guard and verified unified context does not duplicate legacy attached-card formatting, and cycle 2 made the persistence/send boundary explicit in dialog copy.
- commit: this commit

### 22.4. Preview unified Task context
- objective: make the exact bounded context assembled from project Knowledge Units, attached Knowledge Cards, and Task phase artifacts visible before any opt-in agent injection.
- status: complete
- files: src-tauri/src/knowledge.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/types/domain.ts; src/lib/tauriGateway.ts; src/features/knowledge/*; src/App.tsx; related tests and current knowledge.
- affected units: deterministic context ranking/rendering; project/transcript/Task ownership validation; typed Tauri contract; stale-safe preview orchestration; source-aware preview presentation.
- expected changes: preserve the legacy project-only selector; add a unified selector with explicit source type/reason and one strict character budget; show exact rendered context without sending it to ACP.
- acceptance criteria: explicit cards precede canonical Task artifacts and relevant project knowledge; uncertain/unrelated units remain excluded; every result exposes source and reason; cross-project/cross-transcript IDs fail; stale responses cannot cross workspace boundaries.
- required tests: three-source ordering/budget; ownership boundaries; exact gateway payload; source-aware dialog; stale response; frontend/Rust suites; typecheck/build; fmt/clippy; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 bound Task artifacts to the selected transcript and preserved canonical artifact order, and cycle 2 added preview request identity to prevent cross-workspace stale results.
- commit: this commit

### 22.3. Add the user-facing Task phase workflow
- objective: make persisted artifacts and explicit phase gates inspectable and manually operable in the ACP workspace before agent automation.
- status: complete
- files: src/App.tsx; src/App.css; src/features/tasks/*; src/features/transcripts/useTranscriptWorkspace.ts; related tests; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: persisted live-event identity; artifact load/form/source selection; start/create/complete actions; phase/artifact presentation; runtime composition.
- expected changes: retain backend-returned live transcript events; add stale-safe Task phase hook and state-free panel; compose it beside ACP controls without moving workflow into App.
- acceptance criteria: user sees all four statuses; pending phase can start; only persisted event IDs can be selected; evidence draft sends exact payload; completion remains locked without persisted artifact; backend errors surface; stale Task responses are ignored.
- required tests: panel form/status/locks/errors; hook load/create/transition payloads; stale transition; transcript live IDs; existing frontend/Rust tests; audit; typecheck; build; fmt/clippy; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 fixed an undefined theme token and added Task-identity guards to async actions, and cycle 2 normalized empty mocked list responses and found no remaining ownership, stale, provenance, payload, gate, accessibility, responsive, regression, or scope issue.
- commit: this commit

### 22.2. Enforce explicit Task phase transitions and evidence gates
- objective: make Rust/SQLite authoritative for canonical Task phase progression before adding UI or automatic execution.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/types/domain.ts; src/lib/tauriGateway.ts; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Task/phase statuses and timestamps; artifact mutation boundary; transition validation; Tauri/frontend command contract.
- expected changes: add transactional `start`/`complete` actions; restrict artifacts to the current in-progress phase; require evidence before completion; advance only to the next canonical phase and complete Task after review.
- acceptance criteria: pending phases require explicit start; duplicate/invalid/missing/completed transitions fail; future phases cannot receive artifacts; completion without artifacts fails; analysis→planning→execution→review order is unskippable.
- required tests: invalid/missing transition; pending artifact rejection; duplicate start; missing-evidence gate; full canonical lifecycle; cross-transcript source rejection; completed terminal state; all Rust/frontend tests; fmt; clippy; audit; typecheck; build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 tightened artifact creation to the current in-progress phase and added full lifecycle coverage, and cycle 2 added invalid/missing/duplicate edges and found no remaining state-machine, transaction, gate, timestamp, ownership, command, regression, or scope issue.
- commit: this commit

### 22.1. Persist immutable Task phase artifacts
- objective: establish the evidence-backed persistence contract required for phase gates, execution/review evidence and later learning.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/types/domain.ts; src/lib/tauriGateway.ts; docs/product-roadmap.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: SQLite task schema migration; artifact create/list storage API; transcript-event provenance ownership; Tauri commands; frontend DTO/gateway contracts.
- expected changes: add append-only per-phase artifacts and a normalized source link table; validate Task/phase and same-transcript event ownership; return sources in transcript sequence order.
- acceptance criteria: artifact content/order are immutable; sequences are scoped per Task phase; every artifact has real same-Task transcript provenance; old databases migrate idempotently; create/list commands are typed and registered.
- required tests: create/list/order/normalization/deduplication; cross-transcript rejection; all Rust/frontend tests; fmt; clippy with warnings denied; audit; typecheck; build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 replaced UUID source ordering with canonical transcript-event sequence and strengthened the fixture with reversed/duplicate input, and cycle 2 found no remaining immutability, transaction, ownership, FK, migration, ordering, command, contract, regression, or scope issue.
- commit: this commit

### 21.10. Code-split the PTY terminal runtime
- objective: remove xterm from the initial application bundle while preserving the complete PTY lifecycle and making async loading teardown-safe.
- status: complete
- files: src/features/runtime/usePtyTerminal.ts; src/features/runtime/usePtyTerminal.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: xterm/FitAddon/CSS loading; PTY mount; input/resize; output initialization; unmount cleanup; production chunks.
- expected changes: replace static runtime imports with dynamic imports inside the PTY-only effect and guard late resolution after mode change/unmount.
- acceptance criteria: ACP startup does not load xterm; PTY behavior is unchanged; a disposed lifecycle cannot mount late; initial JS is below 500 kB and Vite emits no chunk-size warning.
- required tests: existing terminal lifecycle behavior; disposed-during-load race; existing 170 frontend tests; audit; typecheck; build output/chunk check; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 added a late-import disposal regression test after confirming the bundle split, and cycle 2 found no remaining async lifecycle, cleanup, input, resize, CSS, error, bundle, regression, or scope issue.
- commit: this commit

### 21.9. Extract project deletion coordination
- objective: remove the final backend workflow from App by isolating cross-domain project deletion behind semantic callbacks.
- status: complete
- files: src/App.tsx; src/features/workspace/useProjectDeletion.ts; src/features/workspace/useProjectDeletion.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: confirmation candidate/error; global busy lock; ACP shutdown; backend deletion; catalog/evidence cleanup; success notification.
- expected changes: add a workspace deletion hook that coordinates injected ACP/catalog/evidence boundaries and owns dialog workflow state; remove App's last gateway command.
- acceptance criteria: ACP sessions stop before deletion; local cleanup happens only after backend success; errors retain the candidate; close respects busy; singular/plural toast copy remains unchanged.
- required tests: successful ordered cleanup/count message; shutdown failure atomicity; busy close guard; existing 167 frontend tests; audit; typecheck; build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 replaced an unstable rejected-gateway harness case with a deterministic pre-delete shutdown failure that proves atomicity, and cycle 2 verified ordering, locks, cleanup policy, error retention, notification copy, regression and scope.
- commit: this commit

### 21.8. Extract Agent Doctor and synthesis catalog orchestration
- objective: move agent readiness discovery and synthesis model catalog/selection state out of App while keeping ACP coding models separate.
- status: complete
- files: src/App.tsx; src/features/agents/useAgentEnvironment.ts; src/features/agents/useAgentEnvironment.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Doctor load/error/refresh; Codex readiness; catalog validation/fallback; tier/profile selection; Summary model provenance restoration.
- expected changes: add a stale-safe gateway-backed environment hook; App composes its values into the agent sidebar, PTY runtime and Initialization Summary workflow.
- acceptance criteria: exact commands, Doctor error surface, selectable-profile fallback order, tier behavior and Summary synchronization remain unchanged; ACP model selection is untouched.
- required tests: Doctor/catalog load; Doctor error recovery; invalid catalog notification; tier selection and Summary restoration; existing 163 frontend tests; audit; typecheck; build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 strengthened the Summary test to prove a real profile/tier transition, and cycle 2 verified request identity, Summary/catalog race ordering, fallback policy, ACP separation, regression and scope.
- commit: this commit

### 21.7. Extract PTY process orchestration
- objective: move PTY session/output/start/resize/drain/stop and terminal coordination out of App while composing the existing xterm lifecycle hook.
- status: complete
- files: src/App.tsx; src/features/runtime/usePtyRuntime.ts; src/features/runtime/usePtyRuntime.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: fake/Codex start; cwd and fitted dimensions; output polling; resize; graceful/forced stop; terminal reset/focus/write; Codex readiness guard.
- expected changes: add a gateway-backed PTY runtime hook that owns process state and composes `usePtyTerminal`; App only passes runtime mode, cwd and Agent Doctor readiness.
- acceptance criteria: exact command payloads, terminal operations, 400 ms polling, output accumulation, status labels and Codex guard remain unchanged.
- required tests: start/output/terminal effects; unavailable Codex guard; resize/stop payloads; existing 160 frontend tests; audit; typecheck; build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 verified polling closures, terminal callback ownership, process payloads and state transitions, and cycle 2 found no remaining lifecycle, error, resize, output, gateway, regression, or scope issue.
- commit: this commit

### 21.6. Extract ACP runtime orchestration
- objective: move ACP registry, session, model, prompt, polling and project-delete cleanup out of App behind a semantic runtime hook.
- status: complete
- files: src/App.tsx; src/features/runtime/useAcpRuntime.ts; src/features/runtime/useAcpRuntime.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: registry discovery/selection; ACP start/stop/drain; coding model changes; prompt/Task/transcript coordination; active-session polling; deletion cleanup.
- expected changes: add a gateway-backed ACP runtime hook and leave App responsible only for composing runtime, transcript, Knowledge and project boundaries.
- acceptance criteria: exact command names/payloads, transcript creation/attachment, original Task prompt, enriched agent prompt, event persistence, polling and graceful deletion shutdown remain unchanged.
- required tests: registry/start/transcript; model/prompt/event recording; project-delete shutdown; existing 157 frontend tests; audit; typecheck; build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 expanded overly compressed implementation formatting and rechecked the 250-line hard limit, and cycle 2 found no remaining ownership, payload, transcript, Task, polling, model, shutdown, gateway, regression, or scope issue.
- commit: this commit

### 21.5. Extract transcript and Task-index orchestration
- objective: move transcript session/list/replay/rename/event persistence and project Task indexing out of App while exposing a semantic ACP integration API.
- status: complete
- files: src/App.tsx; src/features/transcripts/useTranscriptWorkspace.ts; src/features/transcripts/useTranscriptWorkspace.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: transcript and task loading; current/saved session refs/state; replay request identity; create/rename/live mode; event append/coalescing/metadata; get/upsert Task.
- expected changes: add a gateway-backed transcript hook with synchronous active-session identity and stale load/open guards; replace App-owned refs/setters with create/record/getTask/upsertTask actions.
- acceptance criteria: exact create/list/event/rename payloads, replay ordering, current-session identity, event counts/timestamps and Task reuse remain unchanged; stale project or saved-session responses cannot overwrite current state.
- required tests: project session/Task load; synchronous create identity; stale saved replay; event persistence/metadata; existing 153 frontend tests; audit; typecheck; build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 retained synchronous refs behind semantic accessors and verified stored-vs-ACP event kind conversion, and cycle 2 found no remaining identity, stale-response, replay, persistence, metadata, Task-index, gateway, regression, or scope issue.
- commit: this commit

### 21.4. Extract Knowledge workspace orchestration
- objective: move Knowledge Card loading/form/creation, transcript attachments and task-context preview out of App.
- status: complete
- files: src/App.tsx; src/features/knowledge/useKnowledgeWorkspace.ts; src/features/knowledge/useKnowledgeWorkspace.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: project-scoped card refresh; attached IDs/items; New Card form; create/attach/toggle; attach-selected-on-transcript-create; approved-Summary context preview.
- expected changes: add a gateway-backed knowledge hook with stale project-load identity and semantic actions; preserve active transcript/source scope and selector payload; remove knowledge/preview state and functions from App.
- acceptance criteria: card scope/source, attachment behavior, form reset/locks, errors and exact preview budget/payload remain unchanged; stale project loads cannot overwrite current cards; App retains only composition calls.
- required tests: load/attach; create/reset/source transcript; preview prerequisite; exact preview payload/result; existing 149 frontend tests; audit; typecheck; build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 verified active transcript precedence and stale project-load identity, and cycle 2 found no remaining ownership, form, attachment, scope, preview, loading, error, gateway, regression, or scope issue.
- commit: this commit

### 21.3. Extract Project Initialization workflow orchestration
- objective: move initialization start scope, Facts/Markdown actions, Interview draft/validation/save, Summary generation/approval and modal state out of App.
- status: complete
- files: src/App.tsx; src/features/initialization/useProjectInitializationWorkflow.ts; src/features/initialization/useProjectInitializationWorkflow.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: initialize/details/interview modal state; repository scope; Facts/Markdown commands; Interview guardrail form and validation; synthesis generation/approval; evidence semantic updates.
- expected changes: add a focused gateway-backed workflow hook composed with the evidence hook; expose semantic actions and controlled form values; remove initialization form state/functions from App.
- acceptance criteria: all validation copy, payloads, status transitions, notifications, modal locks and model selection behavior remain unchanged; Summary approval refreshes Knowledge Units; App only composes workflow values/actions.
- required tests: start scope/payload; interview validation/draft; Facts update/status; Summary model payload/approval refresh; existing 145 frontend tests; audit; typecheck; build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 corrected a same-batch test interaction to model real rendered events and verified Summary refresh ordering, and cycle 2 found no remaining form ownership, validation, payload, status, notification, loading, evidence-boundary, regression, or scope issue.
- commit: this commit

### 21.2. Extract initialization evidence orchestration
- objective: move project initialization identity and persisted Facts/Markdown/Guardrails/Summary/Knowledge Unit caches and refreshes out of App.
- status: complete
- files: src/App.tsx; src/features/initialization/useInitializationEvidence.ts; src/features/initialization/useInitializationEvidence.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: latest project initialization loading; five evidence reads; active evidence derivation; status transitions; evidence/summary updates; Knowledge Unit refresh; project deletion cleanup.
- expected changes: add a gateway-backed evidence hook with project/evidence request identity; expose semantic update actions to the still-App-owned workflow; remove cache maps and refresh functions from App.
- acceptance criteria: active project/initialization evidence and all command payloads remain unchanged; partial evidence failures stay isolated; stale project/evidence responses cannot overwrite current state; Summary approval refresh remains Knowledge Unit-specific.
- required tests: initial/evidence load; stale project response; semantic evidence/status updates; existing 142 frontend tests; audit; typecheck; build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 separated Knowledge Unit-only refresh from full evidence refresh and added request identity, and cycle 2 found no remaining cache ownership, stale-response, partial-failure, status, payload, deletion, gateway, regression, or scope issue.
- commit: this commit

### 21.1. Extract project catalog orchestration
- objective: move project/repository selection, dialogs, forms, CRUD, folder picking and stale-safe repository loading out of App while retaining cross-domain project deletion coordination in the root temporarily.
- status: complete
- files: src/App.tsx; src/features/workspace/useProjectCatalog.ts; src/features/workspace/useProjectCatalog.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: project/repository state and derivation; initial/selection refresh; create/delete repository; create project; folder picker; dialog/form actions; selected-project removal.
- expected changes: add a focused gateway-backed hook with semantic actions and request identity; App composes returned values/actions and retains ACP-aware delete workflow.
- acceptance criteria: existing command payloads, default selections, forms, dialogs, notifications and locks remain unchanged; stale repository responses cannot overwrite a newer selection; no raw Tauri import or Zustand store is introduced.
- required tests: initial project/repository selection; create/form/busy lifecycle; native picker; stale response; existing 138 frontend tests; audit; typecheck; build; `git diff --check`.
- review status: passed after 2 cycles; cycle 1 separated cross-domain deletion and added repository request identity, and cycle 2 found no remaining ownership, stale-response, CRUD payload, selection, form, dialog, notification, gateway, regression, or scope issue.
- commit: this commit

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

### 22.15. Add focused ACP workspace views
- objective: keep ACP controls and live output immediately usable while moving the tall Task workflow and receipt histories into dedicated views inspired by Claude Buddy's single-active-view navigation.
- status: complete
- files: src/App.tsx; src/App.css; src/features/runtime/AcpWorkspaceViews.tsx; src/features/runtime/AcpWorkspaceViews.test.tsx; src/features/tasks/TaskWorkflowRegion.tsx; src/features/tasks/TaskWorkflowRegion.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: ACP runtime composition; local workspace-view state; accessible view navigation; Task phase/activity placement; PTY output placement; responsive runtime layout.
- expected changes: add Agent, Task, and Activity tabs; default to Agent with ACP Controls and Session Output together; show phase editing only in Task; show receipt histories only in Activity; reset safely to Agent when the active Task disappears; retain PTY output behavior.
- acceptance criteria: ACP Controls and Session Output are in the default viewport flow; only one major workspace context renders at a time; tabs expose correct accessible state and disabled semantics; no Task means Task and Activity are unavailable; PTY behavior and backend contracts are unchanged; mobile layout remains readable.
- required tests: default Agent view; Task and Activity switching; count labels; disabled no-Task state; reset after Task removal; existing ACP/PTY/App regression suite; frontend audit, typecheck, production build, Rust tests/fmt/clippy, and diff hygiene.
- review status: passed after 2 cycles; cycle 1 added complete ARIA tab keyboard navigation and restored the App.tsx size ceiling, while cycle 2 found no remaining view-state, task-removal, PTY, accessibility, responsive-layout, architecture, regression, performance, security, or patch-hygiene issue.
- commit: this commit

### 22.16. Bind phase-run receipts to persisted response events
- objective: establish an authoritative provenance link between each controlled phase run and the exact persisted agent transcript events produced by that run.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/types/domain.ts; src/lib/tauriGateway.ts; src/features/runtime/useAcpRuntime.ts; src/features/runtime/useAcpRuntime.test.tsx; src/features/transcripts/useTranscriptWorkspace.ts; related tests; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: phase-run receipt schema/DTO; response-event ownership validation; ACP drain/persist ordering; transcript record return contract; receipt refresh.
- expected changes: persist normalized receipt/event links; accept only agent message/thought events from the receipt's Task transcript; pause background drain during prompt operations; persist and link the controlled response before returning success.
- acceptance criteria: later prompts cannot be mistaken for phase evidence; cross-transcript/user/duplicate links fail or deduplicate safely; ordinary prompts retain behavior; uncertain linkage never manufactures provenance.
- required tests: valid and invalid storage links; duplicate handling; prompt polling race; exact link command payload; frontend audit/typecheck/tests/build; Rust tests/fmt/clippy; diff hygiene.
- review status: passed after 2 cycles; cycle 1 verified transactional ownership/kind/duplicate boundaries and documented the conservative no-link outcome, while cycle 2 restored the runtime hook hard ceiling and found no remaining polling race, provenance integrity, stale state, regression, security, or patch-hygiene issue.
- commit: this commit

### 22.17. Prepare phase completion from authoritative run output
- objective: prepare an editable phase evidence draft only from the latest sent run receipt's exact persisted response events.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/lib/tauriGateway.ts; src/features/tasks/useTaskPhaseWorkflow.ts; src/features/tasks/useTaskPhaseWorkflow.test.tsx; src/features/tasks/TaskPhasePanel.tsx; src/features/tasks/TaskPhasePanel.test.tsx; src/App.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: latest phase-run response query; completion draft action/state; Task phase presentation; stale Task guard.
- expected changes: expose canonical linked events for the latest sent receipt in the current phase; replace latest-message guessing with async Prepare completion; join linked content and select exact provenance IDs without persistence or transition side effects.
- acceptance criteria: no linked response yields an actionable error; old Task results are ignored; draft remains editable; Add evidence, review, Complete, and next-phase Start remain explicit separate gates.
- required tests: canonical linked response; no/mismatched receipt; successful draft; empty response; stale Task result; panel lock/label; full frontend/Rust gates.
- review status: passed after 2 cycles; cycle 1 added stale-Task response coverage after validating canonical/empty boundaries, and cycle 2 found no remaining receipt selection, provenance, async identity, explicit-gate, accessibility, architecture, regression, security, or patch-hygiene issue.
- commit: this commit

### 22.18. Add a guided phase completion flow
- objective: make the current Task phase understandable as a compact five-step flow while preserving every explicit backend gate.
- status: complete
- files: src/features/tasks/TaskPhaseGuide.tsx; src/features/tasks/TaskPhaseGuide.test.tsx; src/features/tasks/TaskPhasePanel.tsx; src/features/tasks/TaskPhasePanel.test.tsx; src/App.css; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: derived phase-workflow presentation; action grouping; completion CTA copy; responsive Task layout.
- expected changes: render Run, Prepare, Save, Review, Complete progress; identify the next required action; group existing controls by purpose; label completion with the next pending phase or final Task outcome.
- acceptance criteria: no new persisted/client state; displayed stage follows draft/artifact/review props; completion remains disabled behind existing gates; next phase is shown but never auto-started; mobile remains readable.
- required tests: empty/draft/artifact/reviewed guide states; intermediate/final completion labels; existing Task panel callbacks; frontend/Rust gates and diff hygiene.
- review status: passed after 2 cycles; cycle 1 corrected false Run/Prepare completion claims by marking them optional helpers and preserving manual evidence, while cycle 2 added the final-review CTA boundary and found no remaining derived-stage, transition-copy, accessibility, responsive-layout, architecture, regression, or patch-hygiene issue.
- commit: this commit

### 22.19. Repair Task scrolling, modal dismissal, and ACP noise
- objective: resolve screenshot-confirmed Task clipping, blocked context-preview dismissal, redundant ACP tool updates, and unnecessary idle polling overhead.
- status: complete
- files: src/App.css; src/features/knowledge/TaskContextPreviewDialog.tsx; src/features/knowledge/TaskContextPreviewDialog.test.tsx; src/features/runtime/useAcpRuntime.ts; src-tauri/src/acp.rs; related tests; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: ACP workspace scroll containment; context-preview visibility lifecycle; ACP session-update normalization; idle drain cadence.
- expected changes: make Task/Activity tabpanels independently scrollable; allow dismissal while context send continues; discard all tool_call_update events before persistence; retain meaningful initial tool calls; poll idle ACP at one-second cadence.
- acceptance criteria: full Task content is reachable; sending cannot be duplicated but modal exits remain available; literal tool_call_update never reaches output/transcript; meaningful tool_call remains; model/network latency is not misrepresented as fixed.
- required tests: sending close/cancel/backdrop; tool update filtering and meaningful tool call; frontend/Rust suites, audit/typecheck/build/fmt/clippy, diff hygiene.
- review status: passed after 2 cycles; cycle 1 verified modal single-flight/exit and backend noise filtering, then identified missing parent height containment; cycle 2 added viewport-bounded desktop scroll and found no remaining clipping, modal race, event semantics, polling, accessibility, responsive-layout, regression, security, or patch-hygiene issue.
- commit: this commit

### 22.20. Handle ACP permission requests without deadlock
- objective: let tool-using ACP prompts continue by routing agent-to-client permission requests to an explicit user decision instead of misclassifying them as responses.
- status: complete
- files: src-tauri/src/acp.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/types/domain.ts; src/lib/tauriGateway.ts; src/features/runtime/useAcpRuntime.ts; src/features/runtime/AcpRuntimePanel.tsx; related tests; src/App.tsx; src/App.css; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: JSON-RPC reader routing; pending permission queue; permission response validation/write; prompt polling; ACP Controls presentation; cancellation.
- expected changes: distinguish requests from responses; expose opaque pending permissions and offered choices; require explicit selection; cancel pending requests on Stop; keep prompt single-flight while permissions are answered.
- acceptance criteria: tool prompts cannot deadlock on unhandled permission; no automatic allow; only agent-offered options are accepted; request RPC IDs never collide with response IDs; restart/new session recovery is documented.
- required tests: request routing; option validation; selected/cancelled response wire shape; panel choice callback; runtime polling; full frontend/Rust gates.
- review status: passed after 2 cycles; cycle 1 corrected request/response routing and added explicit user choice without auto-allow, and cycle 2 preserved retryability until a response write succeeds and proved the full prompt-permission-response wire flow.
- commit: this commit

### 22.21. Surface actionable ACP startup failures
- objective: replace the opaque initialize exit error with the bounded stderr reason emitted by the selected ACP process and render structured Tauri errors readably.
- status: complete
- files: src-tauri/src/acp.rs; src/lib/presentation.ts; src/lib/presentation.test.ts; related Rust tests; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: child stderr capture; response-wait exit reporting; Tauri error presentation.
- expected changes: retain only a bounded stderr tail; append it when the child exits during a request; extract serialized AppError messages without exposing raw JSON.
- acceptance criteria: startup stderr survives the reader thread race; memory remains bounded; successful ACP behavior is unchanged; structured errors display their message; unknown error fallback remains safe.
- required tests: stderr-on-initialize-exit; tail bound; structured frontend error; full frontend/Rust gates and diff hygiene.
- review status: passed after 2 cycles; cycle 1 proved the real adapter accepts AIadne initialize and captured the previously discarded stderr, and cycle 2 bounded memory, waited for pipe closure, preserved unknown-error fallback, and reran the one unrelated async frontend flake to a clean full pass.
- commit: this commit

### 22.22. Isolate npx ACP launch from project package metadata
- objective: prevent selected-project `package.json` and npm configuration from terminating npx before the ACP adapter starts.
- status: complete
- files: src-tauri/src/acp.rs; related Rust tests; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: registry launch descriptor; ACP child process cwd; session/new repository cwd.
- expected changes: launch npx distributions from the OS neutral temporary directory; retain project cwd for binary distributions and for the ACP session payload.
- acceptance criteria: broken project npm metadata cannot affect npx bootstrap; agents still receive the selected repository path; binary candidate behavior remains unchanged; no project files are modified.
- required tests: npx/binary launch-cwd policy; launch descriptor regression; full frontend/Rust gates and diff hygiene.
- review status: passed after 2 cycles; cycle 1 traced npm's `devEngines.node` failure to project-cwd bootstrap and separated adapter process cwd from ACP session cwd, and cycle 2 proved real initialize/session-new against the affected repository plus unchanged binary policy and full regressions.
- commit: this commit

### 23.1. Run a phase and prepare its evidence in one guarded action
- objective: remove the idle manual gap between a successful controlled phase run and preparation of its linked editable evidence draft.
- status: complete
- files: src/features/tasks/useTaskPhaseWorkflow.ts; src/features/tasks/TaskPhasePanel.tsx; src/App.tsx; related tests; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Task-phase feature orchestration; phase action presentation; App dependency wiring; receipt refresh.
- expected changes: execute the exact current-phase prompt, refresh run history, then prepare only its backend-linked response events; retain standalone Prepare for retry.
- acceptance criteria: failed/false runs never prepare a draft; stale Task results cannot write state; evidence is not saved, reviewed, completed, or advanced automatically; App remains composition-only.
- required tests: successful ordered run/refresh/prepare; failed run lock; panel callback payload/labels; full frontend/Rust gates and diff hygiene.
- review status: passed after 2 cycles; cycle 1 kept orchestration in the feature hook and proved run-refresh-prepare ordering plus failed-run isolation, and cycle 2 bound receipt refresh to the originating Task id and found no remaining stale-task, double-submit, gate, accessibility, architecture, or regression issue.
- commit: this commit

### 23.2. Stream ACP output without losing phase provenance
- objective: show and persist agent output during long prompts while retaining exact controlled-run event linkage.
- status: complete
- files: src/features/runtime/useAcpEventDrain.ts; src/features/runtime/useAcpRuntime.ts; related tests; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: serialized event draining; prompt transcript affinity; phase-run event capture; final flush/link.
- expected changes: allow polling during prompts; serialize drain requests; pin each prompt to its starting transcript; collect persisted agent IDs across live and final drains.
- acceptance criteria: live output appears before prompt completion; no overlapping drain persistence; view/Task changes cannot redirect output; phase receipt links every exact agent message/thought once; ordinary prompt behavior remains compatible.
- required tests: pending-prompt live drain; final exact link set; transcript affinity; duplicate/overlap protection; full frontend/Rust gates and diff hygiene.
- review status: passed after 2 cycles; cycle 1 extracted serialized prompt-affine draining and proved overlap/duplicate boundaries, and cycle 2 added a pending-prompt integration test proving live visibility plus complete deduplicated phase linkage with no stale-transcript or gate regression.
- commit: this commit

### 23.3. Persist ACP recovery identity with transcripts
- objective: retain the stable adapter and external agent session identifiers required for truthful post-restart resume.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/lib/tauriGateway.ts; src/types/domain.ts; src/features/transcripts/useTranscriptWorkspace.ts; src/features/runtime/useAcpRuntime.ts; related tests; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: dedicated transcript-to-ACP recovery identity; atomic ACP transcript creation; ACP runtime-to-transcript boundary.
- expected changes: add a separate one-to-one recovery table and create ACP transcripts with their candidate/session identity in one storage transaction; expose explicit identity lookup without polluting generic transcript DTOs.
- acceptance criteria: existing databases gain the recovery table without rewriting transcript rows; identifiers must be non-empty; only ACP transcript creation can persist ACP identity; current starts persist exact IDs atomically; legacy transcripts have no inferred recovery identity.
- required tests: migration; validation; create/list round trip; exact frontend create payload; full frontend/Rust gates and diff hygiene.
- review status: passed after 2 cycles; cycle 1 separated ACP recovery identity from generic transcript DTOs and proved atomic persistence/migration, while cycle 2 verified exact runtime identifiers, rejected incomplete identity, updated App integration mocks, and found no remaining schema, stale-state, runtime-boundary, or architecture regression.
- commit: this commit

### 23.4. Load persisted ACP sessions through the adapter
- objective: re-establish a local ACP process around a persisted external agent session without creating a replacement conversation.
- status: complete
- files: src-tauri/src/acp.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/lib/tauriGateway.ts; related Rust/frontend gateway tests; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: ACP initialize capability negotiation; registry process launch mode; session/load request; Tauri command surface.
- expected changes: add a validated load request carrying candidate, cwd, and external session id; initialize the selected adapter, require `agentCapabilities.loadSession`, call `session/load`, retain the exact existing id and returned model configuration, then publish the local session only after success.
- acceptance criteria: load never calls session/new; unsupported adapters fail clearly and are not inserted into the manager; blank recovery ids are rejected before spawn; failed loads do not leak a managed session; successful loads preserve candidate cwd/session identity and can receive prompts.
- required tests: exact initialize/load wire request and no session/new; unsupported capability; blank id validation; manager publication/prompt after load; command registration/gateway union; full frontend/Rust gates and diff hygiene.
- review status: passed after 2 cycles; cycle 1 verified capability negotiation, exact load payload, no session/new, replay/model restoration and prompt reuse, while cycle 2 verified blank-id rejection before spawn, unsupported/failed-load child cleanup, manager publication only after success, async command registration and gateway fidelity.
- commit: this commit

### 23.5. Resume a saved ACP transcript from Session History
- objective: let the user explicitly turn a recoverable saved transcript back into the one live ACP/Task workspace.
- status: complete
- files: src/features/runtime/useAcpRuntime.ts; src/features/transcripts/useTranscriptWorkspace.ts; src/features/transcripts/SessionHistoryPanel.tsx; src/App.tsx; src/App.css; related tests; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: transcript activation; recovery identity lookup; ACP load orchestration; replay-only drain; Session History action policy.
- expected changes: show Resume for ACP history rows; lock it during another live/action state; fetch the row's recovery identity, load its adapter with current repository cwd, activate the existing transcript/Task, consume load replay into live UI without re-persisting it, and switch to Agent view.
- acceptance criteria: resume creates no transcript or Task; legacy rows report no recovery identity; replay does not call append_transcript_events; exact candidate/session/cwd reach backend; failed/stale actions do not replace the active transcript; active sessions lock all Resume actions.
- required tests: panel action/lock/accessibility; exact successful orchestration and replay non-persistence; missing identity; active-session lock; transcript activation; App wiring; full frontend/Rust gates and diff hygiene.
- review status: passed after 2 cycles; cycle 1 separated recovery orchestration from presentation and proved exact identity/load/replay behavior without transcript or Task creation, while cycle 2 added workspace-version cleanup, replay-failure tolerance, Start-vs-Resume locking, Agent-view reset, accessible row actions, and found no remaining stale-state, duplicate-persistence, concurrency, or composition regression.
- commit: this commit

### 23.6. Guide conservative reconciliation after restart
- objective: distinguish interrupted/unknown receipts from live in-flight work and guide the user to the existing safe resolution gate after Resume.
- status: complete
- files: src/features/tasks/TaskRecoveryNotice.tsx; src/App.tsx; src/App.css; related tests; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Activity-view receipt derivation; recovery guidance presentation; existing manual resolution entry points.
- expected changes: derive pending context/phase receipts whose recorded local ACP session differs from the current running session; summarize them as unconfirmed interrupted work; explain that Resume proves neither delivery nor completion; provide non-mutating shortcuts that open the exact existing resolution form.
- acceptance criteria: current-session pending work is never labeled interrupted; no receipt is retried or finalized automatically; each shortcut targets the exact receipt; no notice appears without interrupted pending work; current resolve backend constraints remain unchanged.
- required tests: pure interrupted derivation; no-current/current-matching/mixed receipts; shortcut payloads and accessible notice; App wiring; full frontend/Rust gates and diff hygiene.
- review status: passed after 2 cycles; cycle 1 established the conservative boundary between current-session in-flight work and older unconfirmed receipts, while cycle 2 verified exact receipt routing, accessible non-mutating guidance, empty-state behavior, App composition, and found no automatic retry/finalization or backend-policy regression.
- commit: this commit

### 23.7. Prove ACP continuation across a local process restart
- objective: validate the recovery contract across destruction of the original local ACP manager/process rather than only loading a saved id in isolation.
- status: complete
- files: src-tauri/src/acp.rs; related Rust tests; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: fake ACP process lifecycle; external session identity handoff; session/load replay and continued prompt path.
- expected changes: start a first fake ACP session, retain its advertised external session id, destroy its entire manager, create a fresh manager, load that exact external id, consume restored history, and send a follow-up prompt.
- acceptance criteria: the first local process is stopped before recovery; the recovered session retains the exact external id; load replay is available once; a follow-up prompt succeeds through the replacement local process; no production-only recovery shortcut is introduced.
- required tests: end-to-end manager restart/load/replay/prompt test; existing load/cleanup tests; full frontend/Rust gates and diff hygiene.
- review status: passed after 2 cycles; cycle 1 made the load fake validate and replay an arbitrary exact external session id, while cycle 2 proved original PID termination, fresh-manager recovery, one-shot replay, follow-up prompting, and found no production shortcut, process leak, identity substitution, or regression.
- commit: this commit

### 24.1. Establish immutable advisor/reviewer reports
- objective: introduce the first deliberate multi-agent persistence boundary without granting a secondary agent execution authority.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/types/domain.ts; src/lib/tauriGateway.ts; related Rust/frontend gateway tests; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Task schema migration; secondary ACP transcript ownership; advisor/reviewer provenance validation; typed command surface.
- expected changes: persist immutable reports for advisor/reviewer roles against the current Task phase, sourced only from agent message/thought events in a separate same-project ACP transcript; expose typed create/list commands.
- acceptance criteria: executor/unknown roles are rejected; the Task's own executor transcript is rejected; wrong-project/non-ACP transcripts and cross-transcript/user events are rejected transactionally; reports are ordered and immutable; creation cannot change Task, phase, artifact, receipt, ACP, or Git state.
- required tests: migration; valid advisor and reviewer reports; role/transcript/project/runtime/phase/provenance rejection; stable ordering/listing; command registration and frontend gateway/type coverage; full frontend/Rust gates and diff hygiene.
- review status: passed after 2 cycles; cycle 1 separated immutable secondary-agent reports from executor artifacts and verified exact same-project ACP provenance, while cycle 2 required an active phase, rejected transcripts already executing any Task, proved legacy migration/transactional failures, and found no Task, phase, artifact, receipt, ACP, Git, type-boundary, or regression escape.
- commit: this commit

### 24.2. Surface secondary-agent reports as read-only Task activity
- objective: make advisor/reviewer findings inspectable before enabling any secondary-agent launch action.
- status: complete
- files: src/features/tasks/useTaskAgentReports.ts; src/features/tasks/TaskAgentReportsPanel.tsx; src/App.tsx; src/App.css; related tests; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: stale-safe Task report loading; state-free Activity presentation; App composition.
- expected changes: load reports by active Task with stale-response protection; show role, phase, order, content, transcript/provenance counts, loading/empty/error states, and explicit refresh; expose no mutation controls.
- acceptance criteria: Task changes clear old reports and late results cannot leak across Tasks; the panel is accessible and read-only; report content/provenance identity is visible; App adds composition only and remains below its audit ceiling.
- required tests: hook load/Task switch/stale/error; panel populated/empty/loading/error/refresh/accessibility; App wiring; full frontend/Rust gates and diff hygiene.
- review status: passed after 2 cycles; cycle 1 isolated stale-safe backend state in a feature hook and immutable presentation in a state-free panel, while cycle 2 added report discoverability to the Activity tab, verified Task-switch/error/loading/empty/accessibility behavior, and found no mutation control, global-state leak, stale response, App workflow, or regression.
- commit: this commit

## Plan Assumptions
- One Task maps to one project-owned ACP transcript session, and the first user prompt is its immutable original prompt; project-less ACP remains a compatibility smoke path without Task persistence.
- The four canonical phases are ordered analysis, planning, execution, and review; Task creation itself provides intake/framing, and review owns final learning capture.
- Task knowledge is a separate layer from project Knowledge Units and manual Knowledge Cards, though later context assembly may select from all three explicitly.
- Phase orchestration details will be refined after first-prompt Task activation is stable.
- Initial complexity uses a deterministic versioned classifier; analysis may later confirm or propose a change, and the user retains final control through an explicit override.
- Summary model profiles are selected from the synthesis catalog; coding-agent models are discovered and changed through the active ACP session's advertised configuration.
