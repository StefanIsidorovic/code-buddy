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
- A Workspace project is now a container that can hold multiple local repository folders.
- The first slice stored project name and canonical folder path; multi-repo support keeps that path as the legacy/default repository.
- The second slice stores ACP transcript sessions and ordered transcript events.
- The third slice stores manual Knowledge Cards and explicit transcript-to-knowledge links.
- Selecting a project scopes transcripts/Knowledge Cards, and selecting a repository sets the cwd for PTY and ACP launches.
- Session history now has a normalized minimal question/answer replay view, but not the final chat UI.
- Session history rows can now be filtered and manually renamed.
- Knowledge Cards let distilled session/project knowledge travel into later ACP prompts without copying whole transcripts.

## Backend Shape
- ProjectStore owns a rusqlite Connection behind a Mutex.
- default_database_path uses AIADNE_DB_PATH when set, otherwise the local user data directory.
- Migration creates a projects table with id, name, path, created_at, and updated_at.
- Migration creates a project_repositories table with id, project_id, name, path, is_default, created_at, and updated_at.
- Migration backfills one default repository row from every existing projects.path value.
- Migration also creates transcript_sessions and transcript_events tables.
- Migration also creates knowledge_items and transcript_knowledge_links tables.
- create_project trims the name, rejects an empty name, validates that path is an existing directory, canonicalizes it, and rejects duplicate paths.
- create_project also creates a default project_repositories row from the project path.
- list_projects returns projects ordered by updated_at descending, then name.
- delete_project removes by id and rejects unknown ids.
- create_project_repository validates the parent project, trims name, canonicalizes an existing directory, and rejects duplicate repository paths.
- list_project_repositories returns repositories for one project with default rows first.
- delete_project_repository removes non-project container repository rows by id; deleting a project cascades repository rows.
- create_transcript_session validates runtime/source and optionally links a session to an existing project.
- append_transcript_events writes ordered event batches for a transcript session.
- list_transcript_sessions can filter by selected project and returns event_count.
- list_transcript_events returns canonical ordered events for a stored session.
- rename_transcript_session trims and persists a non-empty title for an existing transcript session.
- create_knowledge_item validates title/body/kind/scope and can link the card to a project and source transcript.
- list_knowledge_items returns global cards plus selected-project cards.
- attach_knowledge_to_transcript_session persists explicit card links and rejects cards from another project.
- list_attached_knowledge returns cards linked to a transcript session.
- Deleting a project keeps transcript_sessions rows and sets project_id to null.
- Tauri manages ProjectStore as application state and exposes project and transcript commands.

## Frontend Shape
- App.tsx loads projects on mount through list_projects.
- App.tsx loads repositories for the selected project through list_project_repositories.
- App.tsx loads transcript sessions for the selected project.
- The Workspace panel lets the user refresh, add, select, and delete projects.
- The Workspace panel lets the user add, select, refresh, and delete repositories inside the selected project.
- The left sidebar Session History panel shows saved ACP transcript sessions with source/runtime/event count.
- Session History can be filtered by title, source, runtime, session id, short id, or project id.
- Clicking a Session History row calls list_transcript_events and opens stored events in the output panel.
- The selected Session History row can be renamed without changing saved transcript events.
- Switching Session History rows clears previous stored events immediately and ignores stale earlier load responses.
- Saved transcript replay coalesces adjacent stored agent/plan chunks so old streamed output reads as one answer.
- The first project is auto-selected after refresh if the current selection is gone.
- The first repository is auto-selected after refresh if the current repository selection is gone.
- Selection controls are disabled while a PTY or ACP session is running.
- Sidebar shows the selected Workspace name.
- Runtime info shows the selected Workspace and Repository names.
- ACP start creates a transcript session when possible.
- ACP prompt send records a user_message event, and ACP drain records backend-normalized events.
- Transcript recording coalesces adjacent agent/plan chunks before append so future saved answers are less fragmented.
- Frontend keeps transcriptSessionRef current and restarts ACP drain polling when transcript id changes, so streamed agent chunks are recorded against the active transcript.
- Starting or sending a live ACP prompt clears the saved transcript view so output returns to live mode.
- Only one history row appears selected at a time; opened transcript wins over the live transcript marker.
- Transcript persistence errors are shown separately and do not block the ACP runtime.
- The Knowledge Cards sidebar panel lets the user create cards, choose kind, and check which cards are attached.
- Checked Knowledge Cards are injected into the ACP prompt sent to the agent.
- Transcript persistence still records the original user prompt, not the injected full prompt.

## Launch Wiring
- start_fake_session and start_codex_session include cwd from the selected repository when one is selected.
- start_fake_acp_session and start_acp_registry_session include cwd from the selected repository when one is selected.
- Without a selected repository, launch requests fall back to the selected project's legacy path.
- Without a selected project, launch requests omit cwd and keep the old behavior.

## Tests
- Rust tests cover create/list/delete, invalid name, missing path, and duplicate path.
- Rust tests cover repository create/list/delete, invalid repository input, duplicate paths, and default repository creation.
- Frontend tests cover Workspace rendering, project creation/selection, PTY launch cwd, and selected ACP launch cwd.
- Frontend tests cover adding/selecting repositories and selected repository cwd for PTY launch.
- Rust tests cover transcript creation, event append/list, invalid transcript input, and project deletion preserving transcript history.
- Frontend tests cover Session History rendering, ACP transcript persistence calls, opening a saved transcript, and switching transcripts without mixed messages.
- Frontend tests cover chunked saved transcript replay as readable Question/Answer rows.
- Backend and frontend tests cover transcript rename validation and Session History filter/rename behavior.
- Frontend tests cover ACP output autoscroll; manual validation should confirm streamed Codex responses are fully recorded in new transcripts.
- Rust tests cover Knowledge Card create/list validation, duplicate attach idempotence, attached-card listing, and cross-project attach rejection.
- Frontend tests cover card creation, active transcript attach, and ACP prompt injection.

## Watchouts
- No native folder picker yet; users type/paste project and repository paths.
- No PTY scrollback persistence yet.
- No final chat/tool-call transcript UI yet; the current view is normalized but minimal.
- No session tags, archive/delete, grouping, or ranked search yet.
- No default agent/model/instructions per project yet.
- Transcripts and Knowledge Cards are still project-scoped, not repository-scoped.
- No automatic knowledge extraction, search, embeddings, conflict resolution, archive/delete, detach UI, or sensitive-content redaction yet.
- SQLite is local-only and not encrypted; do not store secrets here.
- The temporary runtime UI still needs final product redesign.
- Existing transcripts that were already saved with missing chunks cannot be reconstructed if those chunks were never persisted.
