# code-buddy

Fresh foundation for the AIadne multi-agent coding desktop app.

## Current State

This repository is intentionally early-stage. It keeps the desktop app
foundation and now includes the first backend PTY session core with a fake CLI.

Kept:

- Tauri v2 desktop shell
- Rust backend entry point
- portable-pty backend session manager
- fake PTY-backed echo CLI for integration tests
- minimal xterm-backed PTY test panel in the Tauri UI
- React frontend
- TypeScript
- Vite
- Vitest and Testing Library

Still out of scope:

- agent adapters
- project/session persistence
- keychain secret handling
- AGENTS.md resolver and injector
- terminal/session frontend UI
- storage and domain model modules

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

- Click `Start Fake` to verify the PTY echo session.
- Click `Start Codex` to launch the installed Codex CLI in the same PTY path.
- Type directly inside the terminal panel; keyboard data is sent through xterm
  to the PTY instead of through a separate HTML input field.
- If Codex does not start, run `codex --version` in the same terminal used for
  `npm run tauri dev` and confirm the CLI is on `PATH`.
- Codex output is rendered through xterm.js so ANSI/TUI control sequences are
  interpreted instead of shown as raw text.

## Restart Backlog

Linear-ready task drafts live in [docs/linear-tasks.md](docs/linear-tasks.md).
