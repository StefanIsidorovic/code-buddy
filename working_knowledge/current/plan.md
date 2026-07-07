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
