# code-buddy

Fresh foundation for the AIadne multi-agent coding desktop app.

## Current State

This repository is intentionally early-stage. It keeps the desktop app
foundation and now includes the first backend PTY session core, adapter
boundary, agent doctor, ACP transport spike, minimal project/workspace
persistence with ACP session history, and a project-level Initialize workflow.

Kept:

- Tauri v2 desktop shell
- Rust backend entry point
- portable-pty backend session manager
- fake PTY-backed echo CLI for integration tests
- xterm-backed PTY fallback panel in the Tauri UI
- adapter registry metadata for Codex, Claude Code, and Kimi
- agent doctor readiness checks
- fake ACP stdio runtime and ACP test panel
- ACP registry discovery for compatible adapter candidates
- SQLite-backed project list with multiple repository folders per project
- project-level Initialize runs with user-selected repository participation
- Project Initialize facts, markdown analysis, interview guardrails, and
  OpenAI-backed structured summary approval
- SQLite-backed ACP transcript session/event history with minimal replay
- React frontend
- TypeScript
- Vite
- Vitest and Testing Library

Still out of scope:

- full real-agent adapter behavior
- PTY scrollback persistence and rich transcript replay UI
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

OpenAI-backed Project Initialize Summary requires the key in the Tauri process
environment. The key stays in the Rust backend and is not sent through the
frontend or stored in SQLite:

```bash
OPENAI_API_KEY=your_key npm run tauri dev
```

The PTY controls require the Tauri desktop runtime. Opening the Vite URL in a
normal browser shows the frontend, but backend command calls are available in
the Tauri window.

Manual smoke test:

- Use ACP as the default structured-agent path from the main runtime controls.
- Open `Terminal PTY` in the left sidebar only when you need the terminal
  fallback path.
- Use the left runtime sidebar to choose the current ACP agent candidate.
  Agent lists are collapsible so the sidebar stays compact.
- Click `Start Fake` to verify the PTY echo session.
- Click `Start Codex` to launch the installed Codex CLI in the same PTY path.
- Check `Agent Doctor` to see installed, missing, or error states for local CLIs.
- Add/select a `Workspace` project before starting a session if you want the
  agent process to run in a saved workspace.
- Use `Choose Folder` in Workspace to fill the project path from the native
  system folder picker; the project name is filled from the folder name when it
  is empty.
- Use `Delete Project` in Workspace to remove a saved project. The app asks for
  confirmation first, stops running ACP sessions, then shows a deleted
  confirmation; saved transcripts are kept without the project link.
- Workspace success/error confirmations appear as bottom-right notifications
  and dismiss automatically after a few seconds.
- Add/select a repository inside the selected `Workspace`; PTY and ACP launches
  use the selected repository folder as the process `cwd`.
- The sidebar `Active Folder` shows the actual cwd for the running PTY/ACP
  process. If a project is deleted while an agent is already running, that
  process still keeps the cwd it was launched with until it is stopped.
- Use `Initialize Project` to start the project-level initialization preflight.
  The popup defaults to all repositories in the project and lets you uncheck
  any repositories that should not participate.
- After preflight, click `Collect Facts` to gather local repository facts for
  the selected repositories. The app records Git presence, branch/head, tracked
  file counts, markdown counts, detected manifests, test-file count, likely
  entry points, and recent churn.
- Click `Analyze Markdown` to extract source-backed setup, command,
  convention, warning, architecture, decision, and process findings from
  selected repository markdown files.
- Click `Open Interview` to record fragile areas, do-not-touch paths, review
  requirements, and agent working rules for the project or selected
  repositories.
- Start the app with `OPENAI_API_KEY`, choose an available OpenAI synthesis
  profile, and click `Generate Summary` to create a structured project profile
  from Facts, Markdown, and Interview data. The review modal must show
  `openai_responses_v1` as Generator. Anthropic and Moonshot profiles stay
  visible but disabled until their synthesis adapters exist. Click `Approve
  Summary` only after checking the draft.
- After starting ACP and sending a prompt, check `Session History` in the left
  sidebar for the saved session and event count.
- Use the `Session History` filter when there are many saved sessions. Click a
  saved session to select it, edit `Selected name`, and click `Rename` to give
  it a human name.
- Use `Knowledge Cards` in the left sidebar to attach existing reusable context
  notes. Click `+` to create a new card in a popup. Checked cards are injected
  into ACP prompts while the saved transcript keeps your original question clean.
- Click a `Session History` row to open saved user/agent events in the output
  panel, then use `View Live ACP` to return to the active stream.
- Saved transcripts show user prompts as questions and agent messages as
  answers, with adjacent streamed agent chunks joined into readable replies.
- The ACP output list scrolls to the newest event as live agent responses arrive.
- The temporary runtime UI uses a full-width shell with a durable left sidebar,
  current earth-tone product palette, and compact transcript/event cards.
- The control area scrolls internally so the Session Output panel stays visible
  while Workspace, repositories, and ACP controls grow.
- Only one history row should appear selected; switching rows should clear the
  previous transcript output before the new one renders.
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
