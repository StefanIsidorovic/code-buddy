# code-buddy

Fresh foundation for the AIadne multi-agent coding desktop app.

## Current State

This repository is intentionally early-stage. It keeps the desktop app
foundation and now includes the first backend PTY session core, adapter
boundary, agent doctor, ACP transport spike, and minimal project/workspace
persistence with ACP session history.

Kept:

- Tauri v2 desktop shell
- Rust backend entry point
- portable-pty backend session manager
- fake PTY-backed echo CLI for integration tests
- minimal xterm-backed PTY test panel in the Tauri UI
- adapter registry metadata for Codex, Claude Code, and Kimi
- agent doctor readiness checks
- fake ACP stdio runtime and ACP test panel
- ACP registry discovery for compatible adapter candidates
- SQLite-backed project list for choosing a workspace folder
- SQLite-backed ACP transcript session/event history
- React frontend
- TypeScript
- Vite
- Vitest and Testing Library

Still out of scope:

- full real-agent adapter behavior
- PTY scrollback persistence and full transcript replay UI
- keychain secret handling
- AGENTS.md resolver and injector
- final terminal/session frontend UI
- full storage and domain model modules

Planned stack for upcoming milestones:

- xterm.js for terminal rendering
- Zustand for frontend state
- SQLite for local history and settings
- OS keychain via Rust keyring
- Tailwind CSS or a local token system for styling

## Commands

If Node is not on `PATH`, load the project NVM version first or prefix commands
with the local NVM bin path.

```bash
npm run typecheck
npm run test -- --run
npm run build
```

```bash
cd src-tauri
cargo test
cargo clippy -- -D warnings
```

Run the desktop app test panel:

```bash
npm run tauri dev
```

The PTY controls require the Tauri desktop runtime. Opening the Vite URL in a
normal browser shows the frontend, but backend command calls are available in
the Tauri window.

Manual smoke test:

- Use `Structured ACP` for the default structured-agent path, or switch to
  `Terminal PTY` for terminal fallback testing.
- Click `Start Fake` to verify the PTY echo session.
- Click `Start Codex` to launch the installed Codex CLI in the same PTY path.
- Check `Agent Doctor` to see installed, missing, or error states for local CLIs.
- Add/select a `Workspace` project before starting a session if you want the
  agent process to run in that project folder.
- After starting ACP and sending a prompt, check `Session History` for the
  saved session and event count.
- Check `ACP Registry` to see ACP-compatible candidates before launching real ACP adapters.
- Use `Select` in `ACP Registry`, then click `Start Selected ACP` to try a launchable ACP candidate.
- npx-backed ACP candidates may download their package on first launch.
- Click `Start Fake ACP`, send a prompt, and confirm structured ACP events appear.
- Type directly inside the terminal panel; keyboard data is sent through xterm
  to the PTY instead of through a separate HTML input field.
- If Codex does not start, run `codex --version` in the same terminal used for
  `npm run tauri dev` and confirm the CLI is on `PATH`.
- Codex output is rendered through xterm.js so ANSI/TUI control sequences are
  interpreted instead of shown as raw text.

## Restart Backlog

Linear-ready task drafts live in [docs/linear-tasks.md](docs/linear-tasks.md).
