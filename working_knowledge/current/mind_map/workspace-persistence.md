# Workspace Persistence

## Sources
- src-tauri/src/storage.rs
- src-tauri/src/commands.rs
- src-tauri/src/lib.rs
- src/App.tsx
- src/App.test.tsx
- docs/linear-tasks.md

## Plain Meaning
- A Workspace project is a saved local folder that the user wants agents to work in.
- The first slice stores project name and canonical folder path.
- The second slice stores ACP transcript sessions and ordered transcript events.
- Selecting a project sets the cwd for PTY and ACP launches.
- This is the first session history slice, but not a full transcript replay UI yet.

## Backend Shape
- ProjectStore owns a rusqlite Connection behind a Mutex.
- default_database_path uses AIADNE_DB_PATH when set, otherwise the local user data directory.
- Migration creates a projects table with id, name, path, created_at, and updated_at.
- Migration also creates transcript_sessions and transcript_events tables.
- create_project trims the name, rejects an empty name, validates that path is an existing directory, canonicalizes it, and rejects duplicate paths.
- list_projects returns projects ordered by updated_at descending, then name.
- delete_project removes by id and rejects unknown ids.
- create_transcript_session validates runtime/source and optionally links a session to an existing project.
- append_transcript_events writes ordered event batches for a transcript session.
- list_transcript_sessions can filter by selected project and returns event_count.
- list_transcript_events returns canonical ordered events for a stored session.
- Deleting a project keeps transcript_sessions rows and sets project_id to null.
- Tauri manages ProjectStore as application state and exposes project and transcript commands.

## Frontend Shape
- App.tsx loads projects on mount through list_projects.
- App.tsx loads transcript sessions for the selected project.
- The Workspace panel lets the user refresh, add, select, and delete projects.
- The Session History panel shows saved ACP transcript sessions with source/runtime/event count.
- The first project is auto-selected after refresh if the current selection is gone.
- Selection controls are disabled while a PTY or ACP session is running.
- Sidebar shows the selected Workspace name.
- ACP start creates a transcript session when possible.
- ACP prompt send records a user_message event, and ACP drain records backend-normalized events.
- Transcript persistence errors are shown separately and do not block the ACP runtime.

## Launch Wiring
- start_fake_session and start_codex_session include cwd when a project is selected.
- start_fake_acp_session and start_acp_registry_session include cwd when a project is selected.
- Without a selected project, launch requests omit cwd and keep the old behavior.

## Tests
- Rust tests cover create/list/delete, invalid name, missing path, and duplicate path.
- Frontend tests cover Workspace rendering, project creation/selection, PTY launch cwd, and selected ACP launch cwd.
- Rust tests cover transcript creation, event append/list, invalid transcript input, and project deletion preserving transcript history.
- Frontend tests cover Session History rendering and ACP transcript persistence calls.

## Watchouts
- No native folder picker yet; users type/paste the path.
- No PTY scrollback persistence yet.
- No full transcript open/replay UI yet.
- No default agent/model/instructions per project yet.
- SQLite is local-only and not encrypted; do not store secrets here.
- The temporary runtime UI still needs final product redesign.
