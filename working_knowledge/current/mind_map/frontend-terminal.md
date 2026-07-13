# Frontend Terminal

## Sources
- src/App.tsx
- src/App.css
- src/App.test.tsx
- package.json

## Current Shape
- App.tsx is a temporary runtime smoke-test panel, not the final product UI.
- The temporary panel defaults to ACP controls/output and exposes Terminal PTY only through a collapsed fallback panel.
- xterm.js renders PTY output and captures terminal keyboard input.
- FitAddon fits xterm to the available terminal frame.
- The panel exposes Start Fake, Start Codex, Drain, Resize, Stop, and Kill controls.
- The panel exposes a temporary Workspace section for saving and selecting project folders.
- The Workspace section now exposes `Initialize Project`, which opens a project-level popup for choosing participating repositories.
- The Workspace section exposes `Delete Project` for the selected project and confirms before deletion.
- The Workspace form exposes `Choose Folder`, backed by Tauri dialog plugin, to fill project path and default name.
- Transient Workspace success/error messages render as bottom-right toasts that auto-dismiss and can be closed manually.
- The panel exposes a temporary Session History section in the left sidebar for saved ACP transcript sessions.
- Session History has a local text filter, selected-session rename controls, and a three-visible-row sidebar list.
- The panel exposes a temporary Knowledge Cards section in the left sidebar for manual prompt context; existing cards stay in the dropdown and new cards are created through a `+` popup.
- The old large Runtime Test left panel is now a full-height app sidebar with the app name at the top, primary ACP agent selection, collapsed PTY fallback, Session History, and Knowledge Cards.
- Runtime metadata now lives in the lower-left sidebar footer instead of the Runtime Controls top-right area.
- The right-column controls panel is height-bounded and scrolls internally so Session Output remains visible in the full-width shell.
- The temporary runtime UI uses CSS-only earth-tone design tokens for surfaces, controls, sidebar cards, Knowledge Cards, and ACP transcript rows.
- Current palette is based on the user reference: ebony #4F5743, reseda #6B7460, bone #DCD1C3, beaver #B29784, and taupe #483C32.
- The panel exposes an Agent Doctor list for Codex, Claude Code, and Kimi CLI readiness.
- The panel exposes an ACP Registry list for ACP-compatible adapter candidates.
- ACP agent selection is primary and expanded by default; PTY tooling is grouped in a collapsed fallback accordion.
- The panel exposes a temporary ACP Test area for fake ACP stdio validation.
- ACP events render as structured list items below the xterm terminal.
- The old HTML line input was removed because Codex TUI needs direct terminal keyboard data.

## Data Flow
- Start Fake invokes start_fake_session with current fitted xterm cols/rows.
- Workspace invokes list_projects on mount and Refresh.
- Add Project invokes create_project with name/path and selects the created project.
- Delete Project invokes delete_project and clears the selection if the deleted project was selected.
- Delete Project first opens a confirmation dialog; the backend delete command runs only after confirmation.
- Confirmed Project delete lists and stops running ACP sessions before calling delete_project.
- Confirmed project deletion shows a Workspace toast notification.
- Runtime info displays `Active Folder`, sourced from the running PTY/ACP session cwd.
- Initialize Project opens a modal seeded with all repositories in the selected project.
- Starting Project Initialize invokes create_project_initialization with the selected project id and the user-selected repository ids.
- The displayed Project Initialize status is keyed by selected project id to avoid showing a previous project's run after project switch.
- Session History invokes list_transcript_sessions for the selected project.
- Session History filters saved rows by title, source, runtime, full id, short id, or project id.
- Clicking a Session History row invokes list_transcript_events and switches the ACP output panel to Saved Transcript mode.
- Renaming the selected Session History row invokes rename_transcript_session and updates the active/opened transcript state.
- Opening another Session History row clears old replay events immediately and ignores stale previous responses.
- View Live ACP clears the saved transcript view and returns output to live ACP events.
- Start Fake, Start Codex, Start Fake ACP, and Start Selected ACP include selected project cwd when present.
- Agent Doctor invokes list_agent_doctor_reports on mount and Refresh.
- Agent Doctor displays adapter transport metadata for PTY and ACP stdio support.
- ACP Registry invokes list_acp_registry_candidates on mount and Refresh.
- ACP Registry displays status, command preview, and install guidance without launching anything.
- ACP Registry lets the user select a candidate.
- Start Selected ACP launches the selected launchable candidate through start_acp_registry_session.
- Candidate Select buttons are disabled while an ACP session is running.
- Workspace Select/Delete buttons are disabled while PTY or ACP sessions are running.
- ACP Test status includes the active source, such as fake or Codex, so fake sessions are distinguishable from selected registry launches.
- ACP Events now show normalized backend events; technical Codex ACP session updates are filtered and adjacent message chunks are merged before display.
- The frontend also coalesces adjacent Agent/Plan ACP events for display so token-like chunks read as one message block.
- The ACP event list auto-scrolls to the newest rendered event when live or saved ACP events change.
- ACP Events should receive readable Agent/Plan/etc events from the backend; the frontend should not display raw ACP JSON as a normal notice.
- Start Codex is disabled unless the Codex doctor report status is installed.
- Start Codex invokes start_codex_session with current fitted xterm cols/rows.
- xterm onData forwards keyboard data to write_session_input for the active running session.
- Output is drained on an interval and written into xterm with terminal.write.
- ResizeObserver fits xterm and sends resize_session if cols/rows changed.
- Output state is retained only as an accessibility fallback for tests/screen readers.
- Start Fake ACP invokes start_fake_acp_session.
- Send ACP invokes send_acp_prompt and then drain_acp_events.
- Knowledge Cards invokes list_knowledge_items for the selected project plus global cards.
- The Knowledge Cards `+` button opens a popup form; Create Card invokes create_knowledge_item and auto-attaches the created card locally.
- Checked Knowledge Cards are included in the ACP prompt sent to the agent.
- Attached Knowledge Cards can be persisted to the active transcript through attach_knowledge_to_transcript_session.
- ACP drain polling restarts when the active transcript id changes, and drainAcpEvents reads transcriptSessionRef so background polling does not write to a stale/null transcript.
- ACP events are stored separately from PTY output and are not written to xterm.
- Saved transcript events are also rendered outside xterm; unknown stored event kinds fall back to Notice.
- Saved transcript replay coalesces adjacent stored Agent/Plan chunks so saved answers read like chat replies.
- Saved transcript labels show user_message as Question and agent_message as Answer.
- Send ACP has its own prompt-busy state so Stop ACP and Drain ACP remain available while a prompt request is still waiting.
- Send ACP clears prompt-busy state when `send_acp_prompt` returns a stop reason; post-result event drain/transcript recording should not keep the waiting indicator visible.
- While send_acp_prompt is in flight, the live ACP output shows a waiting card and the controls show a waiting status.

## Layout Rules
- html, body, #root, and app-shell are viewport-bound.
- Page-level scrolling is disabled for the PTY test page.
- App shell fills the available window width; main controls/output expand beside the fixed-width sidebar.
- Sidebar is full-height on desktop and owns app name, navigation sections, and bottom runtime metadata.
- The output row is larger than the controls row so manual testing prioritizes results over configuration.
- Output area is mode-specific: default ACP shows ACP Events, while the PTY fallback shows only PTY Stream after it is opened.
- Structured ACP output can show live ACP events or a saved transcript, with a visible View Live ACP return action.
- Structured ACP output should remain pinned to the newest event while the agent streams.
- The waiting indicator is live-only; saved transcript replay should not show it.
- Long terminal output should scroll inside the xterm viewport.
- Terminal frame is click-focusable so typing goes to xterm.
- Control panel has bounded internal scrolling so the page remains viewport-bound after adding ACP controls.
- Workspace/repository controls must not push Session Output below the desktop viewport.
- Toast notifications are fixed at the bottom-right and must not push controls or output content.
- The left sidebar owns its own scroll area so long agent/history lists cannot overlap the compact status block.
- Session History itself is capped to three visible rows because filtering should be the primary way to find older saved sessions.
- Visual polish must remain CSS-only unless a later design task explicitly approves new icon/font dependencies.

## Tests
- Frontend tests mock Tauri invoke, xterm Terminal, FitAddon, and ResizeObserver.
- Tests cover rendering Start Fake/Start Codex/Start Fake ACP controls, doctor installed/missing/error display, transport metadata display, missing Codex blocking, forwarding xterm keyboard data to write_session_input, and rendering fake ACP events.
- Tests also cover ACP Registry rendering, command preview, missing binary status, candidate selection, selected candidate launch invoke, non-default launchable candidate launch, and locked selection while running.
- Tests also cover Workspace rendering, project creation/selection, native folder picker population, Project delete confirmation and ACP stop-before-delete behavior, Workspace toast auto-dismiss/manual dismiss, Project Initialize repository selection and project-scoped status, PTY fallback activation and cwd launch, selected ACP cwd launch, mode-specific output, coalesced adjacent ACP messages, ACP output autoscroll, opening saved transcript events, chunked saved answer replay, switching saved transcripts without mixed output, Session History filter/rename behavior, Knowledge Card popup creation and prompt injection, ACP waiting state display, and ACP waiting-state release after a prompt result.

## Watchouts
- Output polling interval is currently 400 ms and may feel slow.
- Every keypress can become a separate Tauri invoke; batching may be needed.
- Vite build warns about xterm chunk size over 500 kB; build still succeeds.
- The UI theme should stay balanced across the earth-tone palette and light derived tints rather than drifting into a single flat green or beige treatment.
- ResizeObserver can call fit/resize often; throttle/debounce may be needed later.
- Doctor version checks are backend-owned; frontend should not shell out or infer PATH state.
- ACP JSON-RPC events should be normalized by the backend; frontend should not parse raw ACP protocol messages.
- ACP Registry discovery and selection remain side-effect-free; only Start Selected ACP or Start Fake ACP may cause an ACP backend process launch.
- If ACP Test shows fake as the active source, stop that session before starting the selected registry candidate.
- Real ACP send/start can take time; backend commands run off the UI thread to avoid the app window being marked not responding.
- Knowledge Cards are manual and explicit for now; automatic suggestions, relevance search, conflict checks, and redaction are deferred.
- Session History filter/rename is minimal; richer grouping, tags, archive/delete, and search result ranking are deferred.
- Stop ACP must remain available while a prompt is in flight because Codex tasks can run longer than setup commands.
- Repository path entry is manual for now; native picking currently covers Add Project only.
- Project Initialize currently creates only a preflight run; Facts, Markdown analysis, Interview, and Knowledge summary views are intentionally deferred.
- This is a test panel; final session UI should be redesigned after adapter and persistence tasks.
