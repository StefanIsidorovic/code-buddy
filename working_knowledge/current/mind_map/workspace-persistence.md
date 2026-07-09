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
- The first slice stores only project name and canonical folder path.
- Selecting a project sets the cwd for PTY and ACP launches.
- This is not session history yet.

## Backend Shape
- ProjectStore owns a rusqlite Connection behind a Mutex.
- default_database_path uses AIADNE_DB_PATH when set, otherwise the local user data directory.
- Migration creates a projects table with id, name, path, created_at, and updated_at.
- create_project trims the name, rejects an empty name, validates that path is an existing directory, canonicalizes it, and rejects duplicate paths.
- list_projects returns projects ordered by updated_at descending, then name.
- delete_project removes by id and rejects unknown ids.
- Tauri manages ProjectStore as application state and exposes create_project, list_projects, and delete_project.

## Frontend Shape
- App.tsx loads projects on mount through list_projects.
- The Workspace panel lets the user refresh, add, select, and delete projects.
- The first project is auto-selected after refresh if the current selection is gone.
- Selection controls are disabled while a PTY or ACP session is running.
- Sidebar shows the selected Workspace name.

## Launch Wiring
- start_fake_session and start_codex_session include cwd when a project is selected.
- start_fake_acp_session and start_acp_registry_session include cwd when a project is selected.
- Without a selected project, launch requests omit cwd and keep the old behavior.

## Tests
- Rust tests cover create/list/delete, invalid name, missing path, and duplicate path.
- Frontend tests cover Workspace rendering, project creation/selection, PTY launch cwd, and selected ACP launch cwd.

## Watchouts
- No native folder picker yet; users type/paste the path.
- No transcript or session persistence yet.
- No default agent/model/instructions per project yet.
- SQLite is local-only and not encrypted; do not store secrets here.
- The temporary runtime UI still needs final product redesign.
