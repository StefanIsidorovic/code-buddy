# Plan

## Active Plan

### 1. Implement AIA-002 PTY session core with fake CLI
- objective: add the backend process orchestration foundation with one PTY per fake session.
- status: complete
- files: README.md; src-tauri/Cargo.toml; src-tauri/Cargo.lock; src-tauri/src/lib.rs; src-tauri/src/errors.rs; src-tauri/src/session.rs; src-tauri/src/commands.rs; working_knowledge/current/*
- affected units: AppError/AppResult; SessionManager; PtySession; fake CLI command builder; Tauri command handlers; app state wiring; backend tests.
- expected changes: add portable-pty; create sessions with native_pty_system/openpty; spawn a fake echo CLI; read PTY output on a background thread into a bounded buffer; write input; resize PTY; graceful stop via interrupt with force-kill fallback; kill all sessions on manager drop; expose minimal Tauri commands for test/frontend wiring; update README current state.
- acceptance criteria: backend can start a PTY-backed fake session; input produces streamed output available to a test harness; resize reaches the PTY; stop gracefully exits or force-kills after timeout; dropping the manager leaves no child processes; at least 8 fake sessions run independently.
- required tests: cargo test for start/output, input echo, resize, graceful stop, force stop, manager drop cleanup, concurrent 8-session isolation, missing session errors; cargo clippy -- -D warnings; npm run typecheck/test/build to ensure frontend remains stable.
- review status: passed
- commit: user will commit

### 2. Add minimal frontend PTY test panel
- objective: let the user manually test AIA-002 from the Tauri desktop UI.
- status: complete
- files: README.md; src/App.tsx; src/App.css; src/App.test.tsx; working_knowledge/current/*
- affected units: React App component; Tauri invoke calls; PTY controls; output display; frontend render test.
- expected changes: replace the static skeleton screen with a small PTY test panel that starts a fake session, drains output, sends input, resizes the PTY, stops gracefully, and force-kills.
- acceptance criteria: user can run npm run tauri dev, click Start, see fake-ready, send input, see fake echo output, resize, stop, and kill from the UI.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings.
- review status: passed
- commit: user will commit

### 3. Add temporary Codex PTY launch path
- objective: let the user manually verify that a real Codex CLI can start through the app's PTY path before the adapter framework exists.
- status: complete
- files: README.md; src-tauri/src/session.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/App.tsx; src/App.test.tsx; working_knowledge/current/*
- affected units: SessionManager::start_codex_session; PtySession::spawn_codex; codex_command; Tauri command registry; React start controls; frontend render test.
- expected changes: use installed codex CLI with --no-alt-screen and --cd <cwd>; expose start_codex_session; add Start Codex button next to Start Fake.
- acceptance criteria: user can run npm run tauri dev and click Start Codex to launch the installed Codex CLI in the same output panel; existing fake PTY flow continues to work.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings.
- review status: passed
- commit: user will commit

### 4. Render PTY output through xterm
- objective: make Codex ANSI/TUI output readable in the minimal frontend panel.
- status: complete
- files: package.json; package-lock.json; README.md; src/App.tsx; src/App.css; src/App.test.tsx; working_knowledge/current/*
- affected units: React terminal lifecycle; xterm Terminal; FitAddon; PTY output drain path; frontend test mocks.
- expected changes: install @xterm/xterm and @xterm/addon-fit; replace raw preformatted output with an xterm terminal frame; write drained PTY chunks into xterm; keep an accessibility fallback for tests/screen readers.
- acceptance criteria: Codex escape sequences are interpreted by xterm instead of shown as raw text; existing fake/Codex controls remain available.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings.
- review status: passed
- commit: user will commit

### 5. Constrain xterm panel scrolling
- objective: prevent the minimal PTY UI from creating page-level infinite scroll.
- status: complete
- files: src/App.css; working_knowledge/current/*
- affected units: app shell grid layout; output panel flex layout; terminal frame overflow behavior.
- expected changes: constrain html/body/root/app shell to viewport height; keep output panel min-height at zero; move scroll into xterm viewport.
- acceptance criteria: terminal output scrolls inside the terminal area instead of growing the whole page.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings.
- review status: passed
- commit: user will commit

### 6. Route keyboard input through xterm
- objective: make the temporary Codex smoke-test panel behave like an interactive terminal instead of a line-send form.
- status: complete
- files: README.md; src/App.tsx; src/App.css; src/App.test.tsx; working_knowledge/current/*
- affected units: xterm lifecycle; Terminal.onData handler; session start sizing; Resize control; PTY panel layout; frontend tests.
- expected changes: remove the separate HTML input form; send xterm keyboard data directly to write_session_input; start sessions with the fitted xterm cols/rows; keep backend PTY size synchronized with xterm fit; make the terminal panel visually larger and click-focusable.
- acceptance criteria: Codex receives direct terminal input including Enter/control sequences; Start Fake still starts; terminal output is rendered in xterm; Resize syncs actual terminal size instead of manual numeric inputs.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings.
- review status: passed
- commit: user will commit

### 7. Add active mind map knowledge
- objective: create the active mind map requested by the user so cross-cutting PTY/xterm/agent-launch knowledge has a stable home.
- status: complete
- files: working_knowledge/current/mind_map.md; working_knowledge/current/mind_map/pty-runtime.md; working_knowledge/current/mind_map/frontend-terminal.md; working_knowledge/current/mind_map/agent-launch-flow.md; working_knowledge/current/*
- affected units: working knowledge index; PTY runtime topic map; frontend terminal topic map; agent launch topic map; handoff/status/decisions/repo notes.
- expected changes: add a mind_map.md index; add concise source-backed topic files; record that future changes to these areas must update the relevant topic file.
- acceptance criteria: mind_map.md maps every file under working_knowledge/current/mind_map/; topic files describe current data flow, constraints, tests, and watchouts; existing knowledge files point to the active map.
- required tests: rg --files working_knowledge/current; rg for mind_map references; git diff --check.
- review status: passed
- commit: user will commit

### 8. Implement AIA-003 adapter interface and registry
- objective: create the backend adapter boundary for Codex, Claude Code, and Kimi before adding full real-agent adapters.
- status: complete
- files: src-tauri/src/adapters.rs; src-tauri/src/errors.rs; src-tauri/src/lib.rs; src-tauri/src/session.rs; src/App.tsx; working_knowledge/current/*
- affected units: AgentAdapter trait; AgentRegistry; BinaryResolver; AgentCapabilities; AgentsMdDelivery; AgentCommand; AgentInput; StructuredParseResult; AppError; Codex smoke-test command construction; xterm active session ref handling; adapter and frontend tests.
- expected changes: add adapter trait coverage for detection, capabilities, command construction, input encoding, structured parsing hook, and AGENTS.md delivery strategy; add built-in registry for codex, claude_code, and kimi; add test-only fake adapter; route current Codex launch command construction through CodexAdapter; fix immediate xterm input race after session start.
- acceptance criteria: registry can list and resolve compiled-in adapters; missing adapter returns AdapterNotFound; fake adapter exists in tests; unit tests cover success, missing adapter, detection success/missing, command construction, input encoding, and capability edge cases; existing PTY smoke path still works.
- required tests: cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build.
- review status: passed
- commit: user will commit

### 9. Implement AIA-004 first-run doctor and CLI detection
- objective: expose installed, missing, and error states for agent CLIs so users know which agents are ready.
- status: complete
- files: src-tauri/src/adapters.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/App.tsx; src/App.css; src/App.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md
- affected units: AgentDoctorReport; AgentDoctorStatus; VersionRunner; SystemVersionRunner; AgentAdapter::doctor_report; AgentRegistry::doctor_reports; list_agent_doctor_reports Tauri command; Agent Doctor panel; Start Codex disabled state; frontend tests.
- expected changes: backend resolves binary path and version for each built-in adapter; version failures become error reports; missing binaries become missing reports with install hints; UI shows installed/missing/error states; missing Codex blocks Start Codex; detection command failure displays an error instead of crashing.
- acceptance criteria: backend detection resolves binary path and version; UI shows installed, missing, and error states; missing CLI state blocks session start and shows install guidance placeholders; detection errors do not crash the app.
- required tests: cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build.
- review status: passed
- commit: user will commit

### 10. Add ACP transport spike to backlog and knowledge
- objective: capture Agent Client Protocol as the next structured transport investigation without replacing PTY.
- status: complete
- files: docs/linear-tasks.md; LOCAL_PROGRESS.md; working_knowledge/current/mind_map.md; working_knowledge/current/mind_map/acp-transport.md; working_knowledge/current/decisions.md; working_knowledge/current/open_questions.md; working_knowledge/current/handoff.md; working_knowledge/current/repo-code-buddy.md; working_knowledge/current/status.md.
- affected units: Linear task drafts; active mind map index; ACP transport topic note; session decisions; open questions; local progress diary.
- expected changes: add AIA-017 ACP spike with acceptance criteria; record ACP as a structured JSON-RPC transport beside PTY; document first-slice scope and risks.
- acceptance criteria: backlog includes ACP spike; mind map explains ACP vs PTY and first implementation slice; knowledge files point future work toward ACP without treating it as a replacement for PTY.
- required tests: git diff --check; rg for AIA-017 and acp-transport references.
- review status: passed
- commit: user will commit

### 11. Implement AIA-017 ACP stdio spike
- objective: add a minimal ACP stdio runtime beside PTY so AIadne can prove structured agent-client communication with a fake agent.
- status: complete
- files: src-tauri/src/acp.rs; src-tauri/src/adapters.rs; src-tauri/src/commands.rs; src-tauri/src/errors.rs; src-tauri/src/lib.rs; src/App.tsx; src/App.css; src/App.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: AcpSessionManager; AcpSession; fake ACP stdio fixture; JSON-RPC request/response handling; ACP event buffer; Tauri ACP commands; AgentTransportCapabilities; Agent Doctor transport display; ACP Test frontend panel; frontend/Rust tests.
- expected changes: launch fake ACP subprocess over stdio; perform initialize and session/new; send session/prompt; collect session/update as structured events; handle malformed JSON without crashing; clean up child processes; expose minimal UI for manual fake ACP testing; keep PTY unchanged.
- acceptance criteria: backend starts fake ACP stdio session; backend completes initialize/session/new; backend sends a prompt and receives streamed update events; malformed ACP output becomes an error event; missing session and empty prompt are rejected; adapter descriptors report PTY/ACP transport status; frontend displays ACP events outside xterm; existing PTY tests still pass.
- required tests: cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check.
- review status: passed
- commit: user will commit

### 12. Add ACP registry discovery
- objective: show which ACP-compatible adapters are ready, installable, or missing before attempting a real agent launch.
- status: complete
- files: README.md; src-tauri/src/acp.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: AcpRegistryCandidate; AcpRegistrySpec; AcpCommandResolver; list_acp_registry_candidates Tauri command; ACP Registry frontend panel; frontend/Rust tests; ACP mind map.
- expected changes: add curated ACP registry candidates based on the official registry; classify npx packages as installable when npx exists; classify binary adapters as ready or missing; expose command previews and install hints without downloading or launching adapters; render the candidate list in the temporary frontend panel; allow selecting a candidate as the future launch target.
- acceptance criteria: backend exposes registry candidates; candidate status distinguishes ready, installable, missing runner, and missing binary; frontend shows status, command preview, install guidance, and selected candidate state; discovery performs no package download or agent launch; tests cover npx and binary status mapping plus candidate selection.
- required tests: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check.
- review status: passed
- commit: user will commit

### 13. Start selected ACP registry candidate
- objective: connect selected ACP registry candidates to the existing ACP stdio runtime so a real ACP-compatible adapter can be smoke-tested from the app.
- status: complete
- files: README.md; src-tauri/src/acp.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/App.tsx; src/App.test.tsx; docs/linear-tasks.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: StartAcpRegistrySessionRequest; AcpRegistryLaunchCommand; acp_registry_launch_command; AcpSessionManager::start_registry_session; AcpSession::spawn_registry_candidate; start_acp_registry_session Tauri command; ACP event normalization; Start Selected ACP frontend control; backend/frontend tests.
- expected changes: build launch commands for selected registry candidates; reject unknown or missing-runner candidates before spawn; reuse ACP initialize/session/new flow; allow the frontend to start the selected launchable ACP candidate; keep fake ACP as deterministic fallback; merge agent message chunks; hide technical session updates; run blocking ACP operations off the UI thread.
- acceptance criteria: backend can start a selected registry candidate by id; backend rejects unknown candidates and missing runner/binary cases; frontend exposes Start Selected ACP for launchable selected candidates; missing candidates keep launch disabled; agent message chunks render as readable messages; technical session updates do not spam the event list; long ACP calls do not freeze the app window; tests cover command construction, rejection, event normalization, frontend invoke, and fake ACP regression.
- required tests: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check.
- review status: passed
- commit: user will commit

### 14. Harden generic selected ACP launch flow
- objective: keep Start Selected ACP as the single generic registry-backed launch action for Codex, Claude, Kimi, Gemini, and future ACP candidates.
- status: complete
- files: src-tauri/src/acp.rs; src/App.tsx; src/App.test.tsx; docs/linear-tasks.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: ACP Registry selection controls; Start Selected ACP frontend control; active ACP status display; ACP event normalization; frontend/Rust tests; ACP launch mind map.
- expected changes: remove the Codex-specific direct launch direction from local work; keep registry launch generic; prove a non-default launchable candidate can start through start_acp_registry_session; disable candidate selection while an ACP session is running; render Codex ACP text-array and thought chunks as readable events instead of raw JSON.
- acceptance criteria: no adapter-specific direct ACP launch button is added; frontend invokes start_acp_registry_session for any launchable selected candidate; active session source remains the launched candidate; candidate selection is locked while an ACP session is active; Codex thought/text-block updates do not render raw JSON notices; fake ACP remains available.
- required tests: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check.
- review status: passed
- commit: user will commit

### 15. Harden Codex ACP runtime behavior
- objective: make the validated Codex ACP path safer for real tasks before UI polish.
- status: complete
- files: src-tauri/src/acp.rs; src/App.tsx; src/App.test.tsx; docs/linear-tasks.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: ACP request timeout constants; AcpSession::send_request; AcpSession::wait_for_response; prompt in-flight guard; ACP Test prompt controls; Rust/frontend tests.
- expected changes: keep control request timeout short; give session/prompt a longer timeout; detect ACP child process exit while waiting for responses; reject concurrent prompts on the same ACP session; keep Stop ACP and Drain ACP enabled while prompt sending is in flight.
- acceptance criteria: long Codex prompts are not limited by the short control timeout; killed/exited ACP child processes release pending response waits promptly; duplicate prompts are rejected; frontend can still stop/drain during an active prompt request.
- required tests: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check.
- review status: passed
- commit: user will commit

### 16. Add project workspace persistence
- objective: add the first real app project/workspace model so agent sessions can start in a user-selected repository folder.
- status: complete
- files: README.md; docs/linear-tasks.md; src-tauri/src/storage.rs; src-tauri/src/errors.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/App.tsx; src/App.css; src/App.test.tsx; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: ProjectStore; CreateProjectRequest; ProjectInfo; project storage Tauri commands; Tauri managed state; Workspace frontend panel; PTY/ACP launch request cwd wiring; frontend/Rust tests.
- expected changes: add SQLite-backed project create/list/delete storage; validate and canonicalize project directories; reject duplicate paths; expose create_project/list_projects/delete_project; render a minimal Workspace panel; keep selected workspace state in the frontend; pass selected project path as cwd when starting PTY and ACP sessions; document AIA-022.
- acceptance criteria: backend stores projects in SQLite; backend can create/list/delete projects; invalid names, missing paths, and duplicate paths are rejected; frontend can add/select/delete a project; PTY and ACP launch requests include selected cwd; old runtime paths still work without a selected project.
- required tests: cargo fmt --check; cargo test; cargo clippy -- -D warnings; tsc --noEmit; vitest run; vite build; git diff --check.
- review status: passed
- commit: user will commit

### 17. Polish runtime test UI layout
- objective: make the temporary runtime UI easier to use before adding more product behavior.
- status: complete
- files: src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: runtime mode state; PTY controls; ACP controls; agent selection panels; output layout; ACP event display; frontend tests.
- expected changes: add a PTY/ACP segmented mode switch; keep ACP as the default structured runtime mode; move PTY and ACP agent selection into accordion sections; enlarge output by giving it a larger grid row; show only PTY stream in Terminal PTY mode and only ACP events in Structured ACP mode; coalesce adjacent agent/plan events for frontend display.
- acceptance criteria: PTY and ACP controls are visually separated; agent choice is compact; output has more space; each runtime mode shows only its relevant output; ACP event rows do not chop continuous agent text into narrow fragments; existing launch flows still work.
- required tests: tsc --noEmit; vitest run; vite build; git diff --check.
- review status: passed
- commit: user will commit

### 18. Persist ACP session transcripts
- objective: save the first structured ACP session history so Codex/fake ACP conversations are not only in frontend memory.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: ProjectStore transcript schema and methods; transcript Tauri commands; ACP start/send/drain frontend flow; Session History panel; backend/frontend tests.
- expected changes: create transcript_sessions and transcript_events tables; expose create/list/append/read commands; create a transcript on ACP start; record user prompt and drained ACP events; show saved sessions for the selected workspace; keep persistence errors non-blocking for the active runtime.
- acceptance criteria: backend stores ordered transcript events; invalid transcript input is rejected; deleting a project keeps history with a cleared project link; frontend records ACP events and shows a minimal history list; existing PTY/ACP runtime tests still pass.
- required tests: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check.
- review status: passed
- commit: user will commit

### 19. Open saved ACP transcripts from history
- objective: make Session History useful by letting the user open a saved ACP transcript in the output panel.
- status: complete
- files: src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Session History list item controls; list_transcript_events frontend invoke; ACP output panel live-vs-saved mode; stored event kind mapping; frontend tests.
- expected changes: make history rows clickable; fetch stored transcript events; render saved transcript events in the ACP output panel; provide a View Live ACP action; clear saved transcript view when starting/sending a live ACP session; update docs and knowledge.
- acceptance criteria: user can open a saved transcript; stored user/agent events render in output; output distinguishes saved transcript from live ACP; unknown event kinds render as Notice; user can return to live ACP; frontend tests cover the open flow.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings; git diff --check.
- review status: passed
- commit: user will commit

### 20. Refine transcript selection and runtime sidebar
- objective: fix confusing saved transcript selection and use the old Runtime Test sidebar for useful runtime/agent controls.
- status: complete
- files: src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Session History selection state; saved transcript open request lifecycle; ACP output display coalescing; runtime sidebar layout; agent selection placement; frontend tests.
- expected changes: allow only one selected history row; clear old transcript events immediately when opening another session; ignore stale transcript-open responses; render saved transcript events separately; move runtime mode, collapsible agent selection, Session History, and compact status into the left sidebar; remove the large Runtime Test hero block.
- acceptance criteria: only one history row is selected; switching transcripts cannot mix old/new messages; saved transcript replay is visually separated; sidebar hosts PTY/ACP, agent selection, Session History, and status without overlap; frontend tests cover switching saved transcripts.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings; git diff --check.
- review status: passed
- commit: user will commit

### 21. Normalize saved ACP chat transcripts
- objective: make saved ACP transcript history read as question/answer chat entries instead of chopped stream chunks.
- status: complete
- files: src/App.tsx; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: transcript event recording; saved transcript replay display; ACP event coalescing helpers; saved transcript labels; frontend tests.
- expected changes: coalesce adjacent agent/plan chunks before transcript persistence; coalesce older adjacent saved chunks on replay; label saved user entries as Question and saved agent entries as Answer; keep user prompts as separate entries.
- acceptance criteria: saved transcript answers are not split across visible rows; question/answer roles are clear; future transcript writes store cleaner agent/plan rows; existing live ACP display still coalesces readable chunks; frontend tests cover chunked saved replay and persistence call shape.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings; git diff --check.
- review status: passed
- commit: user will commit

### 22. Auto-scroll ACP output and stabilize transcript drain
- objective: keep live ACP output pinned to the newest event and ensure background ACP draining records agent output into the active transcript.
- status: complete
- files: src/App.tsx; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: ACP events list ref; ACP output scroll effect; transcript session ref; ACP drain interval dependencies; send_acp_prompt transcript id selection; frontend tests.
- expected changes: scroll ACP output to the newest event when live or saved events render; keep a ref to the current transcript session; restart ACP drain polling when transcript id changes; use the active transcript id when recording prompt questions and drained agent responses.
- acceptance criteria: ACP output auto-scrolls as the agent returns events; background drain polling writes to the active transcript instead of a stale/null id; prompt question and response chunks are recorded under the same transcript; existing saved transcript and live ACP behavior keep passing.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings; git diff --check.
- review status: passed
- commit: user will commit

### 23. Apply pastel runtime UI polish
- objective: make the current runtime workspace feel more polished and pleasant without changing runtime behavior.
- status: complete
- files: src/App.css; docs/linear-tasks.md; README.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: CSS design tokens; app shell; panels; buttons; inputs; runtime switch; sidebar accordions; history/project/registry/doctor cards; ACP event cards; focus/hover states.
- expected changes: introduce a balanced pastel palette; improve typography hierarchy; add softer panel shadows and surfaces; style controls and transcript/event rows with clearer states; keep the existing layout and behavior.
- acceptance criteria: UI reads as warmer and more stylish; pastel colors are balanced across mint, sky, lavender, and warm accents; no text overlap is introduced; frontend tests continue to pass.
- required tests: npm run typecheck; npm run test -- --run; npm run build; git diff --check.
- review status: passed
- commit: user will commit

### 24. Apply reference earth palette and typography system
- objective: apply the user-provided earth-tone palette and polished font system across the whole temporary app UI.
- status: complete
- files: src/App.css; docs/linear-tasks.md; README.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: CSS design tokens; app background; sidebar; runtime controls; forms; accordions; history/project/registry/doctor cards; PTY terminal frame; ACP transcript/event cards; heading/body/mono font stacks.
- expected changes: replace the earlier generic pastel palette with earth-tone product tokens based on ebony #4F5743, reseda #6B7460, bone #DCD1C3, beaver #B29784, and taupe #483C32; apply those tokens consistently across the app; improve font stacks and visual hierarchy without changing runtime behavior.
- acceptance criteria: whole app uses the reference palette; typography feels more polished across headings, labels, controls, and transcript rows; no UI overlap or runtime behavior change is introduced; frontend checks pass.
- required tests: npm run typecheck; npm run test -- --run; npm run build; git diff --check.
- review status: passed
- commit: user will commit

### 25. Add manual Knowledge Cards for ACP prompt context
- objective: add the first minimal flow for carrying distilled knowledge from one session into later ACP prompts.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: ProjectStore migration and methods; KnowledgeItemInfo/CreateKnowledgeItemRequest; transcript_knowledge_links; Tauri knowledge commands; sidebar Knowledge Cards panel; ACP prompt construction; frontend/Rust tests.
- expected changes: store manual Knowledge Cards with title/body/kind/scope/project/source transcript metadata; list global plus selected-project cards; attach cards to transcript sessions; inject checked card text into ACP prompts while saving the original user prompt unchanged in transcript history.
- acceptance criteria: users can manually create cards; checked cards are included as explicit ACP prompt context; transcript history keeps the clean user question; cross-project knowledge cannot be attached to another project's session; tests cover storage validation, attach behavior, and frontend prompt injection.
- required tests: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check.
- review status: passed
- commit: user will commit

### 26. Show ACP waiting indicator while agent responds
- objective: make the UI clearly show that a live ACP prompt is waiting for the agent response.
- status: complete
- files: src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: acpPromptBusy UI state; ACP Controls status text; ACP Events live output list; waiting indicator CSS; frontend prompt-in-flight test.
- expected changes: render a live-only waiting card while send_acp_prompt is in flight; keep saved transcript replay unchanged; keep Stop ACP and Drain ACP available; clear the indicator after prompt completion.
- acceptance criteria: user sees a visible waiting state after Send ACP; the state appears in output and controls; it disappears when the prompt resolves; frontend tests cover it.
- required tests: npm run typecheck; npm run test -- --run; npm run build; git diff --check.
- review status: passed
- commit: user will commit

### 27. Filter and rename Session History
- objective: make saved ACP transcript history manageable when many sessions exist.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: ProjectStore transcript session lookup/update; transcript Tauri commands; Session History filter state; selected-session rename controls; frontend/Rust tests.
- expected changes: add a backend rename_transcript_session command that trims and persists transcript titles; add a Session History filter by title/source/runtime/id; render only the first three matching sidebar history rows; expose a rename input for the selected history row; keep saved transcript replay behavior unchanged.
- acceptance criteria: large Session History lists can be narrowed; only three history rows are visible in the sidebar at once; selected sessions can be named by the user; renamed titles persist in storage and update the current UI state; tests cover backend rename validation and frontend filter/rename flow.
- required tests: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check.
- review status: passed
- commit: user will commit

### 28. Demote Terminal PTY to fallback UI
- objective: keep ACP as the primary runtime path while preserving PTY as a hidden fallback.
- status: complete
- files: src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: runtime sidebar; ACP agent panel; PTY fallback accordion; PTY controls/output mode; frontend tests.
- expected changes: remove the primary Terminal PTY vs Structured ACP segmented switch; show ACP Agents as the default primary panel; move PTY agent doctor and mode activation into a collapsed Terminal PTY fallback panel; keep PTY controls/xterm available only after opening the fallback; add a way back to ACP; compact runtime metadata into one small Runtime Controls info card.
- acceptance criteria: default UI shows ACP controls/output; Terminal PTY does not compete as a primary mode; PTY remains available through fallback; runtime status/session/pid/workspace appears as a small top-right Runtime Controls card; existing PTY tests activate the fallback explicitly; frontend checks pass.
- required tests: npm run typecheck; npm run test -- --run; npm run build; git diff --check.
- review status: passed; 2026-07-13 adversarial re-review found no code changes required.
- commit: user will commit

### 29. Add multi-repository projects
- objective: let one AIadne project contain multiple local repository folders and use the selected repository as the agent launch cwd.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*.
- affected units: ProjectStore migration and repository CRUD; project/repository Tauri commands; Workspace panel project/repo state; selected launch cwd helper; PTY/ACP start requests; frontend/Rust tests; workspace persistence mind map.
- expected changes: add project_repositories storage; backfill each existing project path as a default repository; expose create/list/delete repository commands; render repository add/select/delete controls inside the selected project; use selected repository cwd for PTY and ACP launches while falling back to project.path.
- acceptance criteria: users can add multiple repositories under one project; repository paths are existing canonical directories and cannot duplicate; selecting a repository changes PTY/ACP launch cwd; deleting a project removes child repositories; existing project path remains usable for existing data.
- required tests: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check.
- review status: passed; one race issue around stale selected repository state after project switch was fixed and revalidated.
- commit: user will commit

### 30. Expand app shell and move runtime info to sidebar
- objective: make the temporary runtime UI use the full desktop width and move runtime metadata to the lower-left sidebar.
- status: complete
- files: src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*.
- affected units: app-shell grid; intro-panel/sidebar structure; runtime-info-card placement; control/output panel sizing; responsive CSS; frontend render test; frontend-terminal mind map.
- expected changes: remove centered max-width shell; make sidebar full-height; add app name/mark at sidebar top; move status/session/pid/workspace/repository metadata out of Runtime Controls and into sidebar footer; keep ACP Agents, Session History, Knowledge Cards, and Terminal PTY in sidebar; keep main controls/output viewport-bound.
- acceptance criteria: app fills available window width/height; sidebar contains app name and existing sidebar sections; runtime info appears at lower-left; Runtime Controls no longer owns top-right metadata; no text overlap is introduced; frontend checks pass.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings; git diff --check.
- review status: passed; 2026-07-13 adversarial review found no required fixes.
- commit: user will commit

### 31. Keep output visible and clear ACP waiting state
- objective: fix the AIA-036 regression where the controls panel can push output below the viewport and ACP Send can remain visually waiting after stopReason is returned.
- status: complete
- files: src/App.css; src/App.tsx; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*.
- affected units: app-shell grid row sizing; control-panel scroll behavior; sendAcpPrompt busy-state timing; ACP waiting UI; frontend regression tests; frontend-terminal mind map.
- expected changes: bound the right-column control/output grid rows so output remains visible; let controls scroll internally; clear acpPromptBusy immediately after send_acp_prompt returns a result before drain/transcript work continues; add a regression test for this state transition.
- acceptance criteria: Session Output is visible in the full-width layout; controls do not push output below the fold; Send ACP re-enables after stopReason even if event drain is still pending; waiting indicators disappear after prompt result; frontend checks pass.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings; git diff --check.
- review status: passed; 2026-07-13 review found no remaining issues after fixing docs task ordering.
- commit: user will commit

### 32. Move Knowledge Card creation into a popup
- objective: keep the Knowledge Cards sidebar compact by moving new-card creation into a popup opened from a `+` action.
- status: complete
- files: src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Knowledge Cards accordion; knowledge creation state; createKnowledgeItem flow; modal/dialog styles; Knowledge Card frontend test; frontend-terminal and workspace-persistence mind map notes.
- expected changes: remove inline Knowledge Card create form from the sidebar; add a `+` button in the Knowledge Cards dropdown; render the create form in a popup dialog; close/reset the popup on successful create or cancel; keep existing card checklist and prompt injection behavior unchanged.
- acceptance criteria: sidebar dropdown lists existing Knowledge Cards; `+` opens a popup with title/kind/text/create/cancel controls; creating a card closes the popup, auto-attaches it, and preserves ACP prompt injection; frontend checks pass.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings; git diff --check.
- review status: passed; 2026-07-13 review found and fixed popup-local error display before final validation.
- commit: user will commit

### 33. Add Project Initialize preflight and repository selection
- objective: create the first Project Initialize slice at project level, with the user choosing which repositories participate before later analysis phases run.
- status: complete
- files: src-tauri/src/storage.rs; src-tauri/src/commands.rs; src-tauri/src/lib.rs; src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: ProjectStore initialization schema and methods; project initialization Tauri commands; Workspace Project Initialize popup; repository checkbox selection state; frontend/Rust tests; workspace-persistence and frontend-terminal mind maps.
- expected changes: add project initialization run storage; persist selected repository ids in run order; reject missing project, empty selection, duplicate repository ids, blank repository ids, and repository ids outside the project; add an Initialize Project action and popup that defaults to all project repositories but lets the user exclude any of them; show the created run status/count.
- acceptance criteria: initialization is project-scoped, not repo-scoped; user explicitly chooses participating repositories; selected repositories are persisted and validated against the project; later Facts/Markdown/Interview/Summary phases are only documented and not implemented in this slice; frontend and backend tests cover the preflight.
- required tests: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check.
- review status: passed; 2026-07-13 review found and fixed a stale project initialization status leak when switching projects.
- commit: user will commit

### 34. Add explicit Project delete confirmation
- objective: make project deletion visible and safe by adding a selected-project delete action and confirmation dialog before calling delete_project.
- status: complete
- files: src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Workspace header actions; project row delete action; delete confirmation modal; project deletion state cleanup; frontend confirmation test; frontend-terminal and workspace-persistence mind maps.
- expected changes: add visible `Delete Project` action for the selected project; make row-level Delete open the same confirmation popup; show the project name and deletion consequences; call backend `delete_project` only after confirmation; keep delete disabled while PTY/ACP sessions are running.
- acceptance criteria: user can intentionally delete a saved project through a confirmation popup; backend delete is not invoked on first click; after confirmation the project disappears from local state; frontend tests cover the flow.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo fmt --check; cargo test; cargo clippy -- -D warnings; git diff --check.
- review status: passed; 2026-07-13 review found no remaining issues after full validation.
- commit: user will commit

### 35. Add native project folder picker and active cwd display
- objective: make project creation easier with a native folder picker and make the active runtime cwd explicit even when no project is selected.
- status: complete
- files: package.json; package-lock.json; src-tauri/Cargo.toml; src-tauri/Cargo.lock; src-tauri/capabilities/default.json; src-tauri/src/lib.rs; src-tauri/src/session.rs; src-tauri/src/acp.rs; src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Tauri dialog plugin setup; PTY SessionInfo; ACP AcpSessionInfo; Workspace Add Project form; runtime info sidebar; Project delete success notice; frontend tests; workspace/launch mind map notes.
- expected changes: add official Tauri dialog dependencies and permissions; expose `Choose Folder` in the Workspace form; fill project path and default name from the selected directory; show project deletion success messages; return resolved cwd from PTY and ACP session info; show `Active Folder` in runtime info.
- acceptance criteria: users can choose a project folder from the system picker; manual path entry still works; deleting a project shows a visible success message; running sessions show their actual active cwd even after the selected project is gone; frontend/Rust checks pass.
- required tests: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check.
- review status: passed; 2026-07-13 review found no remaining issues after full validation.
- commit: user will commit

### 36. Stop running ACP sessions when deleting a project
- objective: prevent deleted projects from leaving live ACP agents running in the old project folder.
- status: complete
- files: src/App.tsx; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Project delete confirmation flow; ACP session listing/stopping; active ACP frontend state; delete success messaging; frontend regression test; workspace/launch mind map notes.
- expected changes: before `delete_project`, call `list_acp_sessions`, stop every running ACP session with `stop_acp_session`, abort delete if stopping fails, clear active ACP UI state after stopping, and report stopped session count in the success message.
- acceptance criteria: project delete confirmation stops all running ACP sessions before deleting; backend delete is not called if ACP stop fails; the modal warns the user that ACP sessions will be stopped; frontend tests cover stop-before-delete behavior.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo fmt --check; cargo test; cargo clippy -- -D warnings; git diff --check.
- review status: passed; 2026-07-13 review found no remaining issues after full validation.
- commit: user will commit

### 37. Show transient Workspace messages as toasts
- objective: move short Workspace success/error messages into bottom-right popup notifications that auto-dismiss and can be manually closed.
- status: complete
- files: src/App.tsx; src/App.css; src/App.test.tsx; docs/linear-tasks.md; README.md; working_knowledge/current/*; LOCAL_PROGRESS.md.
- affected units: Workspace project/repository action messaging; toast state/timer lifecycle; bottom-right toast stack styling; frontend toast regression tests; frontend/workspace mind map notes.
- expected changes: remove inline Workspace project success/error notices; route transient Workspace messages through a small toast stack; keep modal-local errors inside their modal; auto-dismiss toasts after 4 seconds; expose a dismiss button for each toast.
- acceptance criteria: Workspace success/error notifications appear bottom-right without pushing layout; notifications disappear after a few seconds; notifications can be manually dismissed; modal form/delete errors remain local; frontend tests cover auto-dismiss and manual dismiss.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo fmt --check; cargo test; cargo clippy -- -D warnings; git diff --check.
- review status: passed; 2026-07-13 review added manual-dismiss test coverage and found no remaining issues after validation.
- commit: user will commit

## Plan Assumptions
- AIA-047 covers transient Workspace notifications only; modal-local errors intentionally remain inline inside the active modal.
- AIA-046 intentionally stops ACP sessions on every confirmed project delete, not only sessions that the frontend can prove are tied to that project, because current ACP session metadata does not persist project_id.
- AIA-045 adds Tauri's official dialog plugin; it does not replace manual path entry.
- AIA-045 makes active runtime cwd visible but does not automatically stop or move an already-running PTY/ACP process when its saved project is deleted.
- AIA-044 changes frontend delete UX only; it reuses the existing backend `delete_project` command and does not change storage deletion semantics.
- AIA-039 implements only project-level initialize preflight and repository selection. Facts, markdown analysis, interview guardrails, and summary review are tracked as AIA-040 through AIA-043.
- User must choose the repositories for Project Initialize; the UI defaults to all repositories only as a convenience, not as a hidden automatic decision.
- AIA-038 is a frontend UX refactor only; it should not change Knowledge Card storage schema, attach semantics, prompt injection format, or transcript persistence.
- AIA-037 is a frontend bugfix only and should not change backend ACP protocol behavior, storage schema, transcript model, PTY runtime, or Knowledge Card semantics.
- AIA-036 is CSS/markup-only and should not change runtime, storage, ACP, PTY, transcript, or Knowledge Card behavior.
- AIA-035 keeps `projects.path` as a backward-compatible default repository path instead of removing or migrating it away in this slice.
- AIA-035 does not add transcript repository_id yet; transcript and Knowledge Cards remain project-scoped while launch cwd becomes repository-scoped.
- 2026-07-13 continuation is validation/review only unless the user asks for a new feature or asks this agent to commit.
- User still wants to review and commit manually, so this session will not create commits or provenance notes.
- The fake CLI is Unix shell based for local Linux validation; Windows placeholder exists but should be hardened when cross-platform validation begins.
- A bounded in-memory output buffer is sufficient for AIA-002; frontend event streaming can be deepened in the later UI/IPC tasks.
- Existing unused planned dependencies may stay in Cargo.toml for now unless clippy/build requires cleanup.
- The PTY test panel requires the Tauri desktop runtime; plain browser Vite mode cannot call backend commands.
- The Start Codex path is a temporary manual smoke-test path; the proper adapter abstraction remains a later task.
- xterm increases the production JS chunk size; Vite warns about >500 kB but build succeeds.
- The page itself should not scroll in the desktop test panel; long terminal output belongs inside xterm's viewport.
- Codex TUI input requires xterm keyboard data; a separate HTML line input is insufficient for interactive agent CLIs.
- Mind map files should now be kept current when PTY runtime, frontend terminal, or agent launch flow changes.
- AIA-003 intentionally keeps real Claude/Codex/Kimi behavior conservative; later adapter tasks validate CLI flags and structured modes before hardcoding them.
- AIA-004 uses `--version` for readiness checks with a timeout; later adapter tasks can refine per-CLI version/help probing.
- ACP should be introduced as a separate transport path first; PTY stays available for terminal-only CLIs.
- AIA-017 uses a shell-based fake ACP fixture on Linux first; real CLI ACP support remains Unknown until adapter-specific validation.
- ACP registry discovery is curated from the official registry for now; it reports what could be launched later but does not install, download, or start real ACP adapters.
- Starting npx-backed ACP registry candidates is an explicit user action and may download the adapter package on first launch.
- Project storage now persists project folders, ACP transcript history, and manual Knowledge Cards; automatic suggestions, embeddings, conflict review, detach/delete UI, richer workspace metadata, and PTY scrollback are deferred.
- The runtime screen remains a temporary test surface; the PTY/ACP switch, sidebar history, and accordion layout are pragmatic polish, not the final product shell.
