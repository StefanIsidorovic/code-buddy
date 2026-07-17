# Linear Task Drafts

Use these as issue drafts for the AIadne Linear team. Suggested labels are
optional and can be adapted to the team's workflow.

## AIA-001: Verify reset skeleton baseline

Description:
Keep the repository at a clean, buildable baseline before product work resumes.
Confirm that only the Tauri, Rust, React, TypeScript, Vite, and test skeleton
remains.

Acceptance criteria:

- App opens to a non-functional skeleton screen.
- Backend exposes only the minimal `app_status` command.
- No agent adapter, storage, secret, AGENTS.md, session, or terminal runtime code remains.
- `npm run typecheck`, `npm run test -- --run`, `npm run build`, `cargo test`, and `cargo clippy -- -D warnings` pass.

Suggested labels: `foundation`, `desktop`, `frontend`, `backend`

Depends on: none

## AIA-002: Add PTY session core with fake CLI

Description:
Implement the backend process orchestration foundation with a pseudo-terminal
per session. Use a fake or echo CLI first so the runtime can be tested without
real agent dependencies.

Acceptance criteria:

- Backend can start a PTY-backed fake session.
- Frontend or test harness can write input and receive streamed output.
- Resize requests reach the PTY layer.
- Stop first attempts graceful termination, then force-kills after timeout.
- Quitting the app leaves no orphaned child processes.
- At least 8 fake sessions can run without cross-interference.

Suggested labels: `backend`, `pty`, `desktop`

Depends on: AIA-001

## AIA-003: Define agent adapter interface and registry

Description:
Create the adapter boundary that isolates Codex, Kimi, and Claude Code CLI
differences behind one interface.

Acceptance criteria:

- Adapter trait covers detection, capabilities, command construction, input encoding, structured parsing hook, and AGENTS.md delivery strategy.
- Registry can list and resolve compiled-in adapters.
- Fake adapter exists for tests.
- Unit tests cover success, missing adapter, and capability edge cases.

Suggested labels: `backend`, `architecture`, `agents`

Depends on: AIA-002

## AIA-004: Build first-run doctor and CLI detection

Description:
Expose installed CLI status and versions so users know which agents are ready.

Acceptance criteria:

- Backend detection resolves binary path and version for each adapter.
- UI shows installed, missing, and error states.
- Missing CLI state blocks session start and shows install guidance placeholders.
- Detection errors do not crash the app.

Suggested labels: `backend`, `frontend`, `agents`

Depends on: AIA-003

## AIA-005: Implement Claude Code adapter

Description:
Add Claude Code as the first real adapter, starting with interactive PTY mode
and then structured output when available.

Acceptance criteria:

- Current local `claude --help` output is checked before flags are hardcoded.
- Interactive mode starts in the selected project directory.
- Model flag and extra args are supported.
- Structured mode emits normalized assistant, tool, and completion events when available.
- Fixtures cover parser success and malformed output fallback.

Suggested labels: `backend`, `agents`, `claude`

Depends on: AIA-003, AIA-004

## AIA-006: Implement Codex adapter

Description:
Add Codex CLI support after validating the installed command surface.

Acceptance criteria:

- Current local `codex --help` output is checked before flags are hardcoded.
- Interactive mode runs through PTY.
- Headless or exec mode is supported where structured output is available.
- Model and approval/sandbox args can be configured.
- Fixture tests cover normalized events and raw fallback.

Suggested labels: `backend`, `agents`, `codex`

Depends on: AIA-003, AIA-004

## AIA-007: Implement Kimi adapter

Description:
Add Kimi CLI support with a terminal-first fallback if structured mode is not
available.

Acceptance criteria:

- Current local `kimi --help` output is checked before flags are hardcoded.
- Interactive PTY mode works end to end.
- Capabilities accurately report whether headless or structured output exists.
- Non-native AGENTS.md delivery can prepend instructions once per session.
- Tests cover command construction and fallback behavior.

Suggested labels: `backend`, `agents`, `kimi`

Depends on: AIA-003, AIA-004

## AIA-008: Add projects, settings, SQLite persistence, and transcripts

Description:
Persist local projects, sessions, messages, agent config, and app settings.

Acceptance criteria:

- SQLite schema includes projects, sessions, messages, agent_config, and app_settings.
- Project CRUD works from backend commands.
- Session transcripts can be reconstructed from stored messages.
- Interactive terminal scrollback is stored only as capped raw text.
- Storage tests cover migration, CRUD, empty results, and invalid input.

Suggested labels: `backend`, `storage`

Depends on: AIA-002

## AIA-009: Add OS keychain secret storage

Description:
Store API keys in the operating system keychain and inject them only at process
spawn time.

Acceptance criteria:

- Secrets are never stored in SQLite or logs.
- Backend can set, check, read for spawn, and delete secrets.
- Error messages redact configured secret values.
- Tests cover empty secret rejection and redaction.

Suggested labels: `backend`, `security`

Depends on: AIA-008

## AIA-010: Implement AGENTS.md resolution and delivery

Description:
Resolve project instructions using nearest-file-wins semantics and apply them
consistently across native and non-native adapters.

Acceptance criteria:

- Resolver walks from session cwd up to project root and orders parent context before child context.
- Native readers are not double-injected.
- Non-native agents receive instructions through adapter-selected delivery.
- UI exposes active, not found, and injected states.
- File change during a session prompts for reload instead of silent reinjection.

Suggested labels: `backend`, `frontend`, `agents`

Depends on: AIA-003, AIA-008

## AIA-011: Build main desktop workspace UI

Description:
Create the production UI shell for projects, sessions, tabs, controls, config,
and empty/error states.

Acceptance criteria:

- Left sidebar lists projects and session state.
- Main header shows session tabs, agent badge, model selector, and run/stop controls.
- Right panel shows session config and live activity placeholders.
- Empty, starting, running, waiting, errored, exited, and CLI-missing states are represented.
- Layout has no text overlap across desktop and narrow widths.

Suggested labels: `frontend`, `desktop`

Depends on: AIA-004, AIA-008

## AIA-012: Add xterm.js terminal view

Description:
Render live PTY output with full ANSI/TUI behavior.

Acceptance criteria:

- xterm.js renders PTY byte streams.
- Fit addon reports cols/rows to backend on resize.
- Raw input passthrough can send keystrokes to the active session.
- High-volume output is throttled or coalesced to keep the UI responsive.
- Component tests cover mount, resize, cleanup, and output append behavior.

Suggested labels: `frontend`, `terminal`, `pty`

Depends on: AIA-002, AIA-011

## AIA-013: Add structured chat and tool-call view

Description:
Render normalized agent events as a chat transcript with collapsible tool calls
and results.

Acceptance criteria:

- Chat view is available only when adapter capabilities report structured events.
- User, assistant, tool call, tool result, notice, error, and completion events render distinctly.
- Terminal and chat views can switch without restarting a session.
- Malformed structured chunks do not break the transcript.

Suggested labels: `frontend`, `agents`, `chat`

Depends on: AIA-005, AIA-006, AIA-011

## AIA-014: Wire start, prompt, stop, resize, and session events end to end

Description:
Connect the UI controls to backend Tauri commands and streaming events.

Acceptance criteria:

- User can create or select a project and start a session.
- Prompt submission uses adapter input encoding.
- Terminal output and structured events stream to the active UI.
- Stop and force-stop update state correctly.
- Session state is consistent after success, non-zero exit, kill, and crash.

Suggested labels: `frontend`, `backend`, `ipc`

Depends on: AIA-002, AIA-011, AIA-012

## AIA-015: Add automated integration and fixture tests

Description:
Harden the app with tests for PTY lifecycle, adapter parsing, persistence, and
frontend state.

Acceptance criteria:

- Fake CLI integration tests cover start, stream, input, resize, stop, kill, and no orphan process.
- Adapter parser fixtures cover Claude Code, Codex, and Kimi where available.
- Frontend store and component tests cover key states.
- Full validation commands are documented and pass locally.

Suggested labels: `testing`, `backend`, `frontend`

Depends on: AIA-005, AIA-006, AIA-007, AIA-014

## AIA-016: Prepare packaging and release hardening

Description:
Make the v1 app ready for local distribution and later signing.

Acceptance criteria:

- Tauri config contains production app metadata.
- Build works on the primary target OS.
- App shutdown reliably kills all child processes.
- Telemetry remains off by default.
- README documents setup, run, test, and troubleshooting commands.

Suggested labels: `release`, `desktop`, `security`

Depends on: AIA-015

## AIA-017: Spike ACP transport support

Description:
Investigate and add the first minimal Agent Client Protocol transport path
beside the existing PTY fallback. ACP should be treated as the structured
agent-client path for compatible agents, while PTY remains the universal
terminal fallback for CLIs that do not support ACP.

Acceptance criteria:

- Backend records whether each adapter supports `pty`, `acp_stdio`, or both.
- Doctor can show ACP support as available, unavailable, or unknown per adapter.
- A minimal ACP stdio client can launch one compatible agent or fixture process.
- Backend can complete ACP initialization and create a test session.
- Backend can send one prompt and receive streamed session updates from a fake ACP agent fixture.
- Existing PTY fake and Codex smoke paths continue to work unchanged.
- Tests cover ACP initialization success, malformed JSON-RPC, unsupported adapter, process exit, and PTY fallback behavior.

Suggested labels: `backend`, `architecture`, `agents`, `acp`

Depends on: AIA-003, AIA-004

Recommended before: AIA-005, AIA-006, AIA-007, AIA-013, AIA-014

## AIA-018: Add ACP registry discovery

Description:
Expose a local ACP registry candidate list so the app can show which
ACP-compatible adapters are ready, installable, or missing before launching a
real agent. Discovery must not download packages or start agents.

Acceptance criteria:

- Backend exposes curated candidates from the official ACP registry.
- Candidate status distinguishes ready binary, installable npx package,
  missing runner, and missing binary states.
- Frontend shows candidate status, command preview, and install guidance.
- Frontend lets the user select a candidate without launching it.
- Discovery never downloads packages or launches candidate adapters.
- Tests cover npx and binary candidate status mapping.

Suggested labels: `backend`, `frontend`, `agents`, `acp`

Depends on: AIA-017

Recommended before: real ACP adapter launch tasks

## AIA-019: Start selected ACP registry candidate

Description:
Connect the selected ACP registry candidate to the existing ACP stdio runtime
so a user can try a real ACP-compatible adapter from the test panel. Keep fake
ACP available as the deterministic test path.

Acceptance criteria:

- Backend can start a selected registry candidate by id.
- Backend rejects unknown candidates and candidates whose runner/binary is missing.
- Backend reuses the existing ACP initialize and session/new flow.
- Frontend exposes Start Selected ACP for the selected launchable candidate.
- Missing candidates keep Start Selected ACP disabled.
- Agent message chunks are merged into readable messages and technical session updates are hidden from the event list.
- Long ACP start/send operations do not freeze the app window.
- Tests cover command construction, missing runner/binary rejection, event normalization, frontend invoke, and fake ACP regression.

Suggested labels: `backend`, `frontend`, `agents`, `acp`

Depends on: AIA-018

Recommended before: adapter-specific ACP validation

## AIA-020: Harden generic selected ACP launch flow

Description:
Keep `Start Selected ACP` as the single generic registry-backed launch action
so the same UI path works for Codex, Claude, Kimi, Gemini, and future ACP
candidates. Harden the temporary runtime UI against confusing selection changes
while a session is already running.

Acceptance criteria:

- Frontend keeps `Start Selected ACP` as the registry-backed real-agent ACP launch action.
- No adapter-specific direct ACP launch button is added for Codex or any other candidate.
- Any launchable selected candidate can be started through `start_acp_registry_session`.
- Candidate selection is disabled while an ACP session is running.
- Active ACP status continues to show the candidate that was actually launched.
- ACP thought/text-block updates render as readable events instead of raw JSON notices.
- Fake ACP continues to work as the deterministic test path.
- Tests cover a non-default launchable candidate, locked selection during an active ACP session, selected launch invoke, ACP event normalization, and fake ACP regression.

Suggested labels: `backend`, `frontend`, `agents`, `acp`

Depends on: AIA-019

Recommended before: workspace/session UI and adapter-specific ACP hardening

## AIA-021: Harden Codex ACP runtime behavior

Description:
Make the current Codex ACP path safer for real tasks before investing in UI
polish. Keep generic registry launch, but tune runtime behavior for the
validated Codex ACP path: long-running prompts, process exits, duplicate
submissions, and stop/drain controls while a prompt is in flight.

Acceptance criteria:

- ACP control requests keep a short timeout.
- ACP `session/prompt` uses a longer timeout suitable for real Codex tasks.
- Waiting for a response detects child process exit without waiting for the full prompt timeout.
- Backend rejects a second prompt while one is already in flight for the same ACP session.
- Frontend keeps `Stop ACP` and `Drain ACP` available while a prompt request is in flight.
- Tests cover timeout selection, child-exit response waiting, duplicate prompt rejection, and stop availability during an in-flight prompt.

Suggested labels: `backend`, `frontend`, `agents`, `acp`, `codex`

Depends on: AIA-020

Recommended before: workspace/session UI and Codex-specific adapter hardening

## AIA-022: Add project workspace persistence

Description:
Add the first real app workspace model so users can save local project folders
and launch PTY/ACP sessions in the selected project directory. Keep this slice
small: project list persistence only, not transcript or session history.

Acceptance criteria:

- Backend stores projects in a local SQLite database.
- Backend can create, list, and delete projects.
- Project paths are validated as existing directories and canonicalized before storage.
- Duplicate project paths are rejected.
- Frontend shows a minimal Workspace panel with add, select, refresh, and delete controls.
- Starting PTY and ACP sessions passes the selected project path as `cwd`.
- Existing fake PTY, Codex PTY, fake ACP, and selected ACP launch paths still work without a selected project.
- Tests cover storage success, invalid input, duplicate paths, project creation UI, and launch `cwd` wiring.

Suggested labels: `backend`, `frontend`, `storage`, `desktop`

Depends on: AIA-021

Recommended before: final workspace/session UI and session history persistence

## AIA-023: Polish runtime test UI layout

Description:
Improve the temporary runtime panel before adding more product behavior. Make
PTY vs ACP selection clearer, keep agent selection compact, and give output
more room so manual testing is easier.

Acceptance criteria:

- Runtime controls use a clear PTY/ACP mode switch.
- ACP remains the default structured-agent mode, with PTY available as fallback.
- Agent selection is grouped in collapsible accordion sections.
- Output panel gets more vertical space than the controls panel.
- Output area shows PTY stream only in Terminal PTY mode.
- Output area shows ACP events only in Structured ACP mode.
- ACP events render as readable message blocks instead of narrow chopped rows.
- Adjacent agent/plan chunks are coalesced for display without changing backend events.
- Existing PTY and ACP launch/test flows still pass frontend tests.

Suggested labels: `frontend`, `ux`, `desktop`

Depends on: AIA-022

Recommended before: final workspace/session UI

## AIA-024: Persist ACP session transcripts

Description:
Save the first structured ACP session history in SQLite so agent conversations
survive a frontend refresh or app restart. Keep this slice focused on ACP
transcripts for Codex/fake ACP; PTY scrollback and rich chat replay can come
later.

Acceptance criteria:

- Backend schema stores transcript sessions and ordered transcript events.
- Backend can create a transcript session, append event batches, list sessions
  by selected project, and list events for a session.
- Transcript sessions optionally link to a saved workspace project.
- Deleting a project keeps transcript history but clears the project link.
- Frontend creates a transcript when an ACP session starts.
- Frontend records user prompt events and drained ACP events.
- Frontend shows a minimal Session History list with source/runtime/event count.
- Transcript persistence failure is surfaced without blocking the active ACP runtime.
- Tests cover backend storage success/failure, project deletion behavior,
  frontend history rendering, and ACP event persistence calls.

Suggested labels: `backend`, `frontend`, `storage`, `acp`

Depends on: AIA-022, AIA-023

Recommended before: final workspace/session UI and chat transcript replay

## AIA-025: Open saved ACP transcripts from history

Description:
Make Session History useful to a person by allowing saved ACP transcript rows
to be opened in the output panel. This is still a minimal replay view, not the
final chat UI.

Acceptance criteria:

- Frontend can open a saved transcript session from Session History.
- Frontend calls `list_transcript_events` for the selected transcript.
- Output panel clearly distinguishes live ACP events from a saved transcript.
- Unknown stored event kinds render safely instead of breaking the UI.
- User can return from a saved transcript view to the live ACP event stream.
- Starting or sending a new ACP prompt returns the output panel to live mode.
- Tests cover opening a saved transcript and rendering stored user/agent events.

Suggested labels: `frontend`, `storage`, `acp`, `ux`

Depends on: AIA-024

Recommended before: final workspace/session UI and chat transcript replay

## AIA-026: Refine transcript selection and runtime sidebar

Description:
Fix confusing transcript selection behavior and reclaim the old `Runtime Test`
sidebar as useful runtime configuration space.

Acceptance criteria:

- Only one Session History row appears selected at a time.
- Opening a different saved transcript clears the previous transcript events
  before new events render.
- Late responses from older transcript-open requests cannot overwrite the
  currently opened transcript.
- Saved transcript replay renders stored events separately instead of merging
  them into larger live-stream-style chunks.
- The left sidebar no longer shows the large `Runtime Test` hero block.
- The left sidebar contains runtime mode selection, collapsible agent selection,
  Session History, and compact runtime status without overlap.
- Main content has more room for workspace, runtime controls, prompt, and output.
- Tests cover switching between saved transcripts without mixed messages.

Suggested labels: `frontend`, `ux`, `acp`

Depends on: AIA-025

Recommended before: final workspace/session UI

## AIA-027: Normalize saved ACP chat transcripts

Description:
Make saved ACP history read like a chat transcript instead of a raw stream log.
User prompts should remain separate questions, while streamed agent chunks are
stored and replayed as readable answers.

Acceptance criteria:

- Transcript recording coalesces adjacent agent/plan chunks before saving.
- Opening a saved transcript coalesces older adjacent agent/plan chunks for
  backward-compatible replay.
- Saved transcript labels distinguish questions from answers.
- User prompts remain separate entries even when multiple prompts exist in one
  session.
- Existing live ACP output still coalesces readable agent/plan chunks.
- Tests cover chunked saved transcript replay and transcript persistence calls.

Suggested labels: `frontend`, `storage`, `acp`, `ux`

Depends on: AIA-024, AIA-025

Recommended before: final chat transcript and tool-call UI

## AIA-028: Auto-scroll ACP output and stabilize transcript drain

Description:
Keep the live ACP output focused on the newest agent response and make sure
background ACP drain polling records events against the active transcript
session, not a stale or missing transcript id.

Acceptance criteria:

- ACP Events scroll to the newest visible event as live agent output arrives.
- Saved transcript replay can also scroll to the newest opened event.
- ACP drain polling uses the current transcript session id after a session is
  created.
- Sending a prompt records the user question and later drained agent response
  against the same active transcript id.
- Existing saved transcript display and live ACP output behavior keep passing.
- Tests cover ACP output autoscroll and transcript persistence regression flow.

Suggested labels: `frontend`, `acp`, `storage`, `ux`

Depends on: AIA-024, AIA-027

Recommended before: final chat transcript and streaming UI

## AIA-029: Apply pastel runtime UI polish

Description:
Make the current runtime workspace feel more polished and pleasant to use while
keeping the same temporary product structure. This is a visual pass only, not a
new runtime feature.

Acceptance criteria:

- App uses a balanced pastel palette across sidebar, panels, controls, and
  transcript/event cards.
- Typography feels cleaner with stronger hierarchy for headings, labels, and
  event roles.
- Buttons, inputs, textareas, and segmented controls have clearer hover/focus
  states.
- History, project, registry, doctor, and ACP event cards remain readable and
  do not overlap.
- Existing runtime, workspace, ACP, and saved transcript flows keep passing
  frontend tests.

Suggested labels: `frontend`, `ux`, `design`

Depends on: AIA-026, AIA-028

Recommended before: final workspace/session UI

## AIA-030: Apply reference earth palette and typography system

Description:
Apply the user-approved earth-tone palette across the whole temporary app UI,
not only transcript rows. Use the provided colors as the first product palette:
ebony `#4F5743`, reseda green `#6B7460`, bone `#DCD1C3`, beaver `#B29784`,
and taupe `#483C32`.

Acceptance criteria:

- Global CSS tokens are based on the provided palette and light derived tints.
- Sidebar, panels, controls, forms, accordions, history, registry, doctor, and
  output cards use the same coherent visual system.
- Font stacks and heading/body weights are polished across the whole app.
- No runtime, ACP, PTY, storage, or transcript behavior changes are introduced.
- Frontend checks pass and the UI remains readable without overlap.

Suggested labels: `frontend`, `ux`, `design`

Depends on: AIA-029

Recommended before: final workspace/session UI

## AIA-031: Add manual Knowledge Cards for ACP prompt context

Description:
Add the first minimal cross-session knowledge flow. Users can manually create
small Knowledge Cards, attach selected cards to an ACP session, and have the
attached card text injected into the ACP prompt sent to the agent.

Acceptance criteria:

- Backend stores Knowledge Cards in SQLite with title, body, kind, scope,
  optional project, and optional source transcript session.
- Backend can list cards for the selected project plus global cards.
- Backend can persist links between transcript sessions and attached cards.
- Frontend shows a minimal Knowledge Cards panel with create and attach controls.
- Sending an ACP prompt includes attached cards as explicit context while the
  saved transcript keeps the user's original prompt clean.
- Cross-project cards cannot be attached to another project's transcript.
- Tests cover storage validation, attach behavior, and frontend prompt injection.

Suggested labels: `frontend`, `backend`, `storage`, `acp`, `knowledge`

Depends on: AIA-024, AIA-028

Recommended before: automatic context suggestions, embeddings, or knowledge review UI

## AIA-032: Show ACP waiting indicator while agent responds

Description:
Make the live ACP output clearly show that the app is waiting for the agent
after the user sends a prompt. This avoids the blank-output feeling during
longer real Codex responses.

Acceptance criteria:

- Sending an ACP prompt shows a visible live waiting state.
- Waiting state appears in the ACP output list and control area.
- Waiting state is not shown while viewing a saved transcript.
- Waiting state clears when the prompt request finishes.
- Stop ACP and Drain ACP remain available while waiting.
- Tests cover the waiting state during an in-flight prompt.

Suggested labels: `frontend`, `ux`, `acp`

Depends on: AIA-031

Recommended before: richer streaming/progress UI

## AIA-033: Filter and rename Session History

Description:
Make saved ACP transcript history manageable once there are many sessions.
Users should be able to search the history list and give saved sessions human
names instead of relying on repeated default titles.

Acceptance criteria:

- Session History can be filtered by title, source, runtime, or session id.
- Filtered count is visible so the user understands how many sessions match.
- Sidebar history renders only the first three matching sessions by default.
- Only the selected history session can be renamed.
- Renaming a transcript persists through the backend storage layer.
- Opening a renamed transcript keeps the saved transcript output behavior.
- Tests cover filtering and renaming from the Session History UI.

Suggested labels: `frontend`, `backend`, `storage`, `ux`

Depends on: AIA-024, AIA-026

Recommended before: final session library/sidebar design

## AIA-034: Demote Terminal PTY to fallback UI

Description:
ACP is now the primary runtime path. Keep Terminal PTY available as a backup
for agent/runtime failures, but remove it from the main runtime choice so it
does not distract from the normal ACP workflow.

Acceptance criteria:

- The main runtime UI defaults to ACP controls and ACP output.
- Terminal PTY is no longer shown as a primary segmented runtime choice.
- Terminal PTY remains available through a collapsed fallback panel.
- Opening the fallback still exposes PTY controls and xterm output.
- Users can return from PTY fallback to ACP.
- Runtime status/session/pid/workspace metadata is shown as a small info card
  in the top-right of Runtime Controls.
- Frontend tests cover the primary ACP UI and the hidden PTY fallback path.

Suggested labels: `frontend`, `ux`, `desktop`, `pty`, `acp`

Depends on: AIA-023, AIA-030

Recommended before: final workspace/session shell

## AIA-035: Add multiple repositories per project

Description:
Treat an AIadne project as a workspace container that can include more than one
local repository folder. Users should be able to add repositories under the
selected project and choose which repository is used as the agent launch
directory.

Acceptance criteria:

- Backend stores child repository records for each project.
- Existing project paths are preserved as the default repository for old and
  newly created projects.
- Repository paths are canonicalized existing directories and duplicates are
  rejected.
- UI lets users add, list, select, and delete non-default repositories inside
  the selected project.
- PTY and ACP launches use the selected repository path as `cwd`.
- If no repository is selected, launches fall back to the legacy project path.
- Tests cover repository storage validation and launch cwd selection.

Suggested labels: `frontend`, `backend`, `storage`, `workspace`

Depends on: AIA-022, AIA-034

Recommended before: final workspace/session shell

## AIA-036: Expand app shell and move runtime info to sidebar

Description:
Make the temporary runtime app use the full desktop window width instead of a
centered card layout. The left sidebar should feel like the durable app
navigation surface, with the app name at the top and runtime/session metadata
anchored at the lower left.

Acceptance criteria:

- App shell fills the available window width and height.
- Left sidebar is a full-height app sidebar, not a floating centered card.
- Sidebar keeps ACP Agents, Session History, Knowledge Cards, and Terminal PTY.
- App name appears at the top of the sidebar.
- Runtime status/session/pid/workspace/repository info moves from the
  top-right Runtime Controls area to the bottom of the sidebar.
- Main controls and output expand into the remaining width.
- Layout remains viewport-bound with no incoherent overlap at narrow widths.
- Frontend tests cover the sidebar app name and runtime info presence.

Suggested labels: `frontend`, `ux`, `desktop`

Depends on: AIA-034, AIA-035

Recommended before: final workspace/session shell

## AIA-037: Keep output visible and clear ACP waiting state

Description:
Fix the first full-width shell regression where Workspace and ACP controls can
push Session Output below the visible desktop area, and where ACP Send can keep
showing a waiting state after the agent already returned a stop reason.

Acceptance criteria:

- Session Output remains visible in the desktop viewport after the full-width
  sidebar shell change.
- Workspace/repository/ACP controls scroll inside the controls panel instead of
  forcing output below the fold.
- `Send ACP` is re-enabled when `send_acp_prompt` returns a prompt result, even
  if event drain/transcript recording continues afterward.
- Waiting indicators disappear after the prompt result is available.
- Frontend regression tests cover the ACP waiting-state release.

Suggested labels: `frontend`, `ux`, `bug`

Depends on: AIA-036

Recommended before: final workspace/session shell

## AIA-038: Move Knowledge Card creation into a popup

Description:
Keep the Knowledge Cards sidebar section compact by moving the new-card form
into a popup. The sidebar dropdown should show the existing Knowledge Cards and
use a small `+` action for creating a new one.

Acceptance criteria:

- Knowledge Cards sidebar no longer shows the full create form inline.
- Knowledge Cards sidebar shows a `+` action that opens a popup for creating a
  new card.
- The popup includes title, kind, body, cancel, and create controls.
- Creating a card closes the popup, resets the form, and keeps the new card
  attached as before.
- The Knowledge Cards dropdown lists all existing cards and keeps checkbox
  attach behavior.
- Frontend tests cover creating a card through the popup and prompt injection
  with the attached card.

Suggested labels: `frontend`, `ux`, `knowledge`

Depends on: AIA-031, AIA-036

Recommended before: final knowledge review UI

## AIA-039: Add Project Initialize preflight and repository selection

Description:
Add the first Project Initialize slice at the project level. A project can have
multiple repositories, and the user must choose which repositories participate
in an initialization run before any facts, markdown analysis, interview, or
summary phases run.

Acceptance criteria:

- Backend persists project initialization runs linked to one project.
- Backend persists the user-selected repositories for each initialization run.
- Backend rejects empty selections, duplicate repository ids, missing projects,
  and repositories that do not belong to the selected project.
- Frontend exposes an `Initialize Project` action for the selected project.
- Frontend opens a Project Initialize popup with repository checkboxes.
- Repository selection defaults to all repositories in the selected project, and
  the user can exclude repositories before starting.
- Frontend shows the created initialization run status and selected repository
  count.
- Tests cover backend validation and frontend user-selected repository start.

Suggested labels: `frontend`, `backend`, `storage`, `knowledge`, `workspace`

Depends on: AIA-035

Recommended before: AIA-040

## AIA-040: Add Project Initialize facts collection

Description:
Collect source-backed facts for the repositories selected in a Project
Initialize run. Facts should start with safe local metadata before invoking any
agent summarization.

Acceptance criteria:

- Facts run only for repositories selected by the user in the initialization
  run.
- Facts include git presence, branch/head, recent churn, tracked-file counts,
  detected package/build/test surfaces, and likely entry points where possible.
- Facts exclude `.git`, dependency folders, generated outputs, and other ignored
  directories.
- Facts keep per-repository source attribution.
- Backend stores facts separately from user-authored guardrails.
- Tests cover git/non-git repository behavior and ignore rules.

Suggested labels: `backend`, `storage`, `knowledge`, `git`

Depends on: AIA-039

Recommended before: AIA-041

## AIA-041: Add Project Initialize markdown analysis

Description:
Analyze tracked markdown files from the repositories selected for a Project
Initialize run. This should extract project/repo setup, commands, conventions,
warnings, and architecture notes with source attribution.

Acceptance criteria:

- Markdown analysis only scans repositories selected by the user.
- Discovery prioritizes `AGENTS.md`, `README.md`, `CONTRIBUTING.md`,
  `ARCHITECTURE.md`, and `docs/**/*.md`.
- Analysis records the source repository and file path for every extracted
  finding.
- Large/vendor/generated markdown files are skipped by policy.
- Findings remain draft knowledge until the user reviews the final summary.
- Tests cover markdown discovery and source attribution.

Suggested labels: `backend`, `storage`, `knowledge`, `docs`

Depends on: AIA-039

Recommended before: AIA-042

## AIA-042: Add Project Initialize interview guardrails

Description:
Add the user interview phase for Project Initialize. The interview captures
project-wide and repository-specific fragile areas, do-not-touch paths, required
human review areas, preferred commands, and domain rules.

Acceptance criteria:

- Interview is project-level and can include per-repository path/glob rules.
- User can mark fragile paths and do-not-touch paths for selected repositories.
- User can capture project-wide agent rules and required human review areas.
- Interview answers are stored as guardrails, separate from generated facts.
- Guardrails have higher priority than generated facts when building agent
  context.
- Tests cover storing project-wide and repository-specific guardrails.

Suggested labels: `frontend`, `backend`, `storage`, `knowledge`, `guardrails`

Depends on: AIA-039

Recommended before: AIA-043

## AIA-043: Add Project Initialize knowledge summary review

Description:
Summarize Project Initialize output into a reviewable project profile. The
summary should combine selected-repository facts, markdown-derived findings, and
user interview guardrails without flattening repository-specific details.

Acceptance criteria:

- Summary includes project purpose, repository map, repo roles, build/test
  matrix, fragile areas, do-not-touch rules, agent working rules, and open
  questions.
- Summary keeps per-repository sections for repo-specific facts and guardrails.
- User must approve the summary before it becomes active agent context.
- Approved summary can be represented as project-scoped Knowledge Cards or a
  dedicated project profile record.
- Tests cover draft vs approved summary behavior.

Suggested labels: `frontend`, `backend`, `storage`, `knowledge`, `review`

Depends on: AIA-040, AIA-041, AIA-042

Recommended before: automatic context injection from project profiles

## AIA-044: Add explicit Project delete confirmation

Description:
Make project deletion safer and easier to find. The Workspace should expose a
clear delete action for the selected project and require confirmation before
calling the backend delete command.

Acceptance criteria:

- Workspace exposes a visible `Delete Project` action for the selected project.
- Existing row-level delete actions open the same confirmation flow.
- Delete confirmation names the project being deleted.
- Delete confirmation explains that saved transcripts are kept without the
  project link, while project repositories and initialization runs are removed.
- Confirmed deletion shows a visible success message.
- Backend `delete_project` is only called after the user confirms.
- Delete actions are disabled while PTY or ACP sessions are running.
- Frontend tests cover the confirmation flow.

Suggested labels: `frontend`, `ux`, `workspace`

Depends on: AIA-022, AIA-035

Recommended before: broader workspace settings UI

## AIA-045: Add native project folder picker and active cwd display

Description:
Make Workspace setup easier by letting users choose a project folder from the
system folder picker instead of manually typing a path. Also make active runtime
working directory explicit so a running session does not look like it is tied to
a deleted or unselected project.

Acceptance criteria:

- Add Project form exposes a `Choose Folder` action.
- `Choose Folder` opens the native system directory picker.
- Selecting a folder fills the project path input.
- Selecting a folder fills the project name from the folder basename when the
  name input is empty.
- Tauri dialog plugin is registered and permitted for the main window.
- PTY and ACP session info includes the resolved runtime `cwd`.
- Sidebar runtime info displays the active session folder separately from the
  selected Workspace/Repository.
- Frontend tests cover folder picker path/name population.
- Existing launch cwd tests continue to pass.

Suggested labels: `frontend`, `desktop`, `workspace`, `ux`

Depends on: AIA-022, AIA-035, AIA-044

Recommended before: broader workspace settings UI

## AIA-046: Stop running ACP sessions when deleting a project

Description:
Prevent deleted Workspace projects from leaving live ACP agents running in the
old project folder. Project deletion should first stop running ACP sessions, then
delete the project record.

Acceptance criteria:

- Confirmed project deletion lists running ACP sessions before deleting.
- Confirmed project deletion stops every running ACP session before calling
  `delete_project`.
- If stopping ACP sessions fails, project deletion does not continue.
- The confirmation text tells the user running ACP sessions will be stopped.
- After deletion, active ACP UI state is cleared so the app does not look like a
  deleted project still owns a live agent.
- The success message includes how many ACP sessions were stopped.
- Frontend tests cover stop-before-delete behavior.

Suggested labels: `frontend`, `workspace`, `runtime`, `safety`

Depends on: AIA-044, AIA-045

Recommended before: broader workspace settings UI

## AIA-047: Show transient Workspace messages as toasts

Description:
Move short Workspace success/error messages out of the panel body and into a
bottom-right notification stack. Notifications should be visible without
pushing layout content and should disappear automatically after a short delay.

Acceptance criteria:

- Workspace success and error messages appear as bottom-right popup
  notifications.
- Notifications do not resize or push the Workspace controls or Session Output.
- Notifications auto-dismiss after a few seconds.
- Notifications can be dismissed manually before the timeout.
- Modal-local errors, such as delete or knowledge-card form failures, stay in
  their modal.
- Frontend tests cover toast display and auto-dismiss behavior.

Suggested labels: `frontend`, `ux`, `workspace`

Depends on: AIA-044, AIA-045, AIA-046

Recommended before: broader workspace settings UI

## AIA-048: Add synthesis model catalog and Summary provenance

Description:
Add a provider-neutral model catalog for Project Initialize knowledge synthesis.
The first slice lets users select a model tier/profile and records that requested
profile on the deterministic Summary draft; external model execution follows in
a separate task.

Acceptance criteria:

- Model providers are separate from runtime surfaces such as CLI and ACP.
- Model tiers use the app-level `fast`, `mid`, `high`, and `max` vocabulary.
- The catalog contains only model ids verified against current provider docs.
- Project Initialize Summary exposes tier and model selection controls.
- Summary generation persists the requested provider, model, tier, parameters,
  catalog schema version, and knowledge schema version.
- Stored Summary provenance explicitly identifies the current generator as
  `deterministic_v1` until a provider API is connected.
- Existing SQLite databases migrate without losing Summary data.
- No unvalidated CLI or ACP model flags are introduced.
- Rust and frontend tests cover catalog validation, persistence, migration, and
  selection behavior.

Suggested labels: `backend`, `frontend`, `storage`, `models`, `knowledge`

Depends on: AIA-043

Recommended before: OpenAI Responses structured knowledge synthesis

## AIA-049: Execute OpenAI Responses project knowledge synthesis

Description:
Replace the deterministic Project Initialize Summary formatter with a real
OpenAI Responses structured synthesis provider while preserving the
provider-neutral evidence and persisted Summary schema.

Acceptance criteria:

- Summary generation prepares an owned evidence pack from selected repository
  Facts, Markdown findings, and Interview guardrails before network I/O.
- The OpenAI adapter uses `POST /v1/responses`, `store: false`, profile-specific
  reasoning effort, and strict `text.format` JSON Schema output.
- `OPENAI_API_KEY` remains in the Rust process environment and is never passed
  through the frontend or written to SQLite.
- Missing credentials, unavailable providers, refusals, incomplete responses,
  malformed output, and stale evidence return explicit errors without a
  deterministic fallback.
- A valid response atomically replaces the previous Summary and records
  `generation_engine=openai_responses_v1`.
- Anthropic and Moonshot profiles remain visible but disabled until provider
  synthesis adapters are implemented.
- Rust tests cover request construction, response parsing, credentials/provider
  rejection, output validation, atomic replacement, and stale evidence.
- Frontend tests cover unavailable model messaging, selected model payload, and
  OpenAI generator provenance.

Suggested labels: `backend`, `frontend`, `openai`, `knowledge`, `security`

Depends on: AIA-048

Recommended before: validator/source-reference pass and approved-profile agent injection

## AIA-052: Select minimal task context from Knowledge Units

Description:
Build the first deterministic task-context selector on top of approved,
source-backed Knowledge Units. The selector chooses and orders immutable units
for a concrete task without rewriting their content or provenance.

Acceptance criteria:

- Selector input includes task text, selected project/repository, optional paths,
  active Knowledge Units, and a strict context budget.
- Mandatory agent rules and do-not-touch constraints have explicit precedence.
- Repository/path matches outrank unrelated architecture, commands, and facts.
- Selection and tie-breaking are deterministic for identical input.
- Every included and excluded unit has a machine-readable reason.
- Preview shows the exact ordered context, used/remaining budget, and omissions
  before anything is sent to an agent.
- `needs_confirmation` units are never presented as confirmed facts.
- Selector does not mutate Knowledge Unit content, sources, status, or confidence.
- Embeddings/vector retrieval are not required for this baseline.
- Tests cover mandatory-rule priority, repository/path relevance, budget edges,
  deterministic ties, uncertainty handling, and empty/no-match tasks.

Suggested labels: `backend`, `frontend`, `knowledge`, `context`, `safety`

Depends on: AIA-049, Summary source validation, Knowledge Unit publication

Recommended before: automatic Knowledge Unit prompt injection and embeddings
