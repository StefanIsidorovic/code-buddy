# Code Buddy

Code Buddy is a Linux-first Tauri desktop app for driving local CLI coding
agents through one control surface. It launches each agent in its own PTY,
streams terminal output, exposes structured events when a CLI can emit JSONL,
and keeps project instructions and secrets separate from transcripts.

## Current Scope

Implemented in this branch:

- Tauri v2 + React/TypeScript/Vite desktop shell.
- Rust backend domain model, SQLite config store, keyring-backed secret store,
  and adapter registry for Codex, Claude Code, and Kimi.
- AGENTS.md nearest-file-wins resolution, scaffold creation, native/injected
  delivery strategies, and UI indicator.
- portable-pty session manager with input, raw writes, resize, stop/kill,
  state events, output events, and shutdown cleanup.
- React control surface with project/session sidebar, agent/model/mode controls,
  xterm terminal host, chat/event pane, doctor panel, activity list, and prompt
  bar.
- Structured JSONL fixture parsers for Codex, Claude Code, and Kimi.

Not complete yet:

- Live E2E runs against authenticated real agents.
- Cross-platform packaging validation beyond Linux.
- Cloud sync, plugin marketplace, and multi-user accounts.

## Prerequisites

- Node.js 24 or newer and npm 11 or newer.
- Rust toolchain available through Cargo.
- Linux native Tauri dependencies:
  - WebKitGTK 4.1
  - JavaScriptCoreGTK 4.1
  - GTK 3
  - libxdo
  - AppIndicator
  - librsvg
- Optional agent CLIs for real sessions:
  - `codex`
  - `claude`
  - `kimi`

On this workspace, Rust is installed under `~/.cargo/bin`; source the Cargo
environment before Rust commands when the shell has not loaded it:

```bash
source ~/.cargo/env
```

## Install

```bash
npm install
```

## Run

Start the Tauri app:

```bash
npm run tauri dev
```

Start only the Vite web preview:

```bash
npm run dev -- --host 127.0.0.1
```

The browser-only preview cannot call Tauri commands, so it shows a backend
unavailable state outside the desktop runtime.

## Test And Validate

Frontend:

```bash
npm run typecheck
npm run test -- --run
npm run build
```

Backend:

```bash
cd src-tauri
source ~/.cargo/env
cargo test
cargo clippy -- -D warnings
```

Packaging readiness:

```bash
npm run tauri build
```

## Architecture

Frontend:

- `src/lib/types.ts` mirrors serialized Rust domain types.
- `src/lib/api.ts` wraps Tauri commands and session events.
- `src/store/appStore.ts` owns runtime UI state with Zustand.
- `src/components/` contains the sidebar, top bar, terminal, chat, command bar,
  doctor panel, AGENTS.md indicator, and detail panel.

Backend:

- `src-tauri/src/domain.rs` defines shared domain objects.
- `src-tauri/src/storage.rs` owns SQLite persistence.
- `src-tauri/src/secrets.rs` owns OS keychain access and redaction helpers.
- `src-tauri/src/adapters/` isolates Codex, Claude Code, and Kimi differences.
- `src-tauri/src/agents_file.rs` resolves and scaffolds AGENTS.md files.
- `src-tauri/src/session.rs` owns PTY process lifecycle.
- `src-tauri/src/events.rs` emits terminal, state, and structured session
  events to the webview.

## Security Notes

- API keys belong in the OS keychain, not SQLite or logs.
- Secrets are injected into child-process environments only at spawn time.
- Agent CLIs can modify files and run commands; Code Buddy surfaces their
  prompts and does not auto-approve permission decisions.
- Telemetry is not implemented.

## Provenance Workflow

This repository uses one commit per completed plan item. Each such commit must
have a JSON git note under `refs/notes/provenance`.

Inspect recent provenance:

```bash
git log --format='%H %s' --notes=provenance
git notes --ref=provenance show HEAD
```
