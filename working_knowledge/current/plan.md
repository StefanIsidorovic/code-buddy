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

## Plan Assumptions
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
