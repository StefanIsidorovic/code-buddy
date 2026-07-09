use crate::errors::{AppError, AppResult};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
    time::{SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub name: String,
    pub path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTranscriptSessionRequest {
    pub project_id: Option<String>,
    pub runtime: String,
    pub source: String,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptEventInput {
    pub kind: String,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptSessionInfo {
    pub id: String,
    pub project_id: Option<String>,
    pub runtime: String,
    pub source: String,
    pub title: String,
    pub started_at: i64,
    pub updated_at: i64,
    pub event_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptEventInfo {
    pub id: String,
    pub session_id: String,
    pub sequence: i64,
    pub kind: String,
    pub content: String,
    pub created_at: i64,
}

pub struct ProjectStore {
    connection: Mutex<Connection>,
}

impl ProjectStore {
    pub fn open(path: impl AsRef<Path>) -> AppResult<Self> {
        if let Some(parent) = path.as_ref().parent() {
            std::fs::create_dir_all(parent)?;
        }
        let connection = Connection::open(path).map_err(storage_error)?;
        let store = Self {
            connection: Mutex::new(connection),
        };
        store.migrate()?;
        Ok(store)
    }

    #[cfg(test)]
    fn in_memory() -> AppResult<Self> {
        let store = Self {
            connection: Mutex::new(Connection::open_in_memory().map_err(storage_error)?),
        };
        store.migrate()?;
        Ok(store)
    }

    pub fn create_project(&self, request: CreateProjectRequest) -> AppResult<ProjectInfo> {
        let name = request.name.trim();
        if name.is_empty() {
            return Err(AppError::InvalidInput(
                "project name must not be empty".to_string(),
            ));
        }

        let path = resolve_project_path(&request.path)?;
        let now = unix_timestamp()?;
        let project = ProjectInfo {
            id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            path,
            created_at: now,
            updated_at: now,
        };
        let path_text = project.path.to_string_lossy().to_string();

        self.connection()?.execute(
            "INSERT INTO projects (id, name, path, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                &project.id,
                &project.name,
                path_text,
                project.created_at,
                project.updated_at
            ],
        )
        .map_err(|err| {
            if is_unique_constraint(&err) {
                AppError::InvalidInput("project path already exists".to_string())
            } else {
                storage_error(err)
            }
        })?;

        Ok(project)
    }

    pub fn list_projects(&self) -> AppResult<Vec<ProjectInfo>> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id, name, path, created_at, updated_at FROM projects ORDER BY updated_at DESC, name ASC",
            )
            .map_err(storage_error)?;
        let projects = statement
            .query_map([], project_from_row)
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;

        Ok(projects)
    }

    pub fn delete_project(&self, project_id: &str) -> AppResult<()> {
        let deleted = self
            .connection()?
            .execute("DELETE FROM projects WHERE id = ?1", params![project_id])
            .map_err(storage_error)?;
        if deleted == 0 {
            return Err(AppError::InvalidInput(format!(
                "project not found: {project_id}"
            )));
        }
        Ok(())
    }

    pub fn create_transcript_session(
        &self,
        request: CreateTranscriptSessionRequest,
    ) -> AppResult<TranscriptSessionInfo> {
        let runtime = request.runtime.trim();
        if runtime.is_empty() {
            return Err(AppError::InvalidInput(
                "transcript runtime must not be empty".to_string(),
            ));
        }
        let source = request.source.trim();
        if source.is_empty() {
            return Err(AppError::InvalidInput(
                "transcript source must not be empty".to_string(),
            ));
        }

        if let Some(project_id) = request.project_id.as_deref() {
            self.require_project(project_id)?;
        }

        let now = unix_timestamp()?;
        let title = request
            .title
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(source)
            .to_string();
        let session = TranscriptSessionInfo {
            id: Uuid::new_v4().to_string(),
            project_id: request.project_id,
            runtime: runtime.to_string(),
            source: source.to_string(),
            title,
            started_at: now,
            updated_at: now,
            event_count: 0,
        };

        self.connection()?.execute(
            "INSERT INTO transcript_sessions (id, project_id, runtime, source, title, started_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                &session.id,
                session.project_id.as_deref(),
                &session.runtime,
                &session.source,
                &session.title,
                session.started_at,
                session.updated_at
            ],
        )
        .map_err(storage_error)?;

        Ok(session)
    }

    pub fn append_transcript_events(
        &self,
        session_id: &str,
        events: Vec<TranscriptEventInput>,
    ) -> AppResult<Vec<TranscriptEventInfo>> {
        if events.is_empty() {
            return Err(AppError::InvalidInput(
                "transcript event batch must not be empty".to_string(),
            ));
        }

        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        require_transcript_session(&transaction, session_id)?;

        let next_sequence: i64 = transaction
            .query_row(
                "SELECT COALESCE(MAX(sequence), -1) + 1 FROM transcript_events WHERE session_id = ?1",
                params![session_id],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        let now = unix_timestamp()?;
        let mut inserted = Vec::with_capacity(events.len());

        for (offset, event) in events.into_iter().enumerate() {
            let kind = event.kind.trim();
            if kind.is_empty() {
                return Err(AppError::InvalidInput(
                    "transcript event kind must not be empty".to_string(),
                ));
            }
            if event.content.trim().is_empty() {
                return Err(AppError::InvalidInput(
                    "transcript event content must not be empty".to_string(),
                ));
            }

            let info = TranscriptEventInfo {
                id: Uuid::new_v4().to_string(),
                session_id: session_id.to_string(),
                sequence: next_sequence + offset as i64,
                kind: kind.to_string(),
                content: event.content,
                created_at: now,
            };

            transaction
                .execute(
                    "INSERT INTO transcript_events (id, session_id, sequence, kind, content, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        &info.id,
                        &info.session_id,
                        info.sequence,
                        &info.kind,
                        &info.content,
                        info.created_at
                    ],
                )
                .map_err(storage_error)?;
            inserted.push(info);
        }

        transaction
            .execute(
                "UPDATE transcript_sessions SET updated_at = ?1 WHERE id = ?2",
                params![now, session_id],
            )
            .map_err(storage_error)?;
        transaction.commit().map_err(storage_error)?;

        Ok(inserted)
    }

    pub fn list_transcript_sessions(
        &self,
        project_id: Option<&str>,
    ) -> AppResult<Vec<TranscriptSessionInfo>> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT s.id, s.project_id, s.runtime, s.source, s.title, s.started_at, s.updated_at, COUNT(e.id)
                 FROM transcript_sessions s
                 LEFT JOIN transcript_events e ON e.session_id = s.id
                 WHERE (?1 IS NULL OR s.project_id = ?1)
                 GROUP BY s.id, s.project_id, s.runtime, s.source, s.title, s.started_at, s.updated_at
                 ORDER BY s.updated_at DESC, s.started_at DESC",
            )
            .map_err(storage_error)?;
        let sessions = statement
            .query_map(params![project_id], transcript_session_from_row)
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;

        Ok(sessions)
    }

    pub fn list_transcript_events(&self, session_id: &str) -> AppResult<Vec<TranscriptEventInfo>> {
        self.require_transcript_session(session_id)?;

        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id, session_id, sequence, kind, content, created_at
                 FROM transcript_events
                 WHERE session_id = ?1
                 ORDER BY sequence ASC",
            )
            .map_err(storage_error)?;
        let events = statement
            .query_map(params![session_id], transcript_event_from_row)
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;

        Ok(events)
    }

    fn migrate(&self) -> AppResult<()> {
        self.connection()?
            .execute_batch(
                r#"
                PRAGMA foreign_keys = ON;

                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    path TEXT NOT NULL UNIQUE,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS transcript_sessions (
                    id TEXT PRIMARY KEY,
                    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
                    runtime TEXT NOT NULL,
                    source TEXT NOT NULL,
                    title TEXT NOT NULL,
                    started_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_transcript_sessions_project_updated
                    ON transcript_sessions(project_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS transcript_events (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL REFERENCES transcript_sessions(id) ON DELETE CASCADE,
                    sequence INTEGER NOT NULL,
                    kind TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    UNIQUE(session_id, sequence)
                );

                CREATE INDEX IF NOT EXISTS idx_transcript_events_session_sequence
                    ON transcript_events(session_id, sequence);
                "#,
            )
            .map_err(storage_error)
    }

    fn connection(&self) -> AppResult<MutexGuard<'_, Connection>> {
        self.connection
            .lock()
            .map_err(|_| AppError::Storage("project store lock poisoned".to_string()))
    }

    fn require_project(&self, project_id: &str) -> AppResult<()> {
        let exists: i64 = self
            .connection()?
            .query_row(
                "SELECT COUNT(*) FROM projects WHERE id = ?1",
                params![project_id],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        if exists == 0 {
            return Err(AppError::InvalidInput(format!(
                "project not found: {project_id}"
            )));
        }
        Ok(())
    }

    fn require_transcript_session(&self, session_id: &str) -> AppResult<()> {
        let connection = self.connection()?;
        require_transcript_session(&connection, session_id)
    }
}

pub fn default_database_path() -> AppResult<PathBuf> {
    if let Some(path) = std::env::var_os("AIADNE_DB_PATH") {
        return Ok(PathBuf::from(path));
    }

    let data_home = if let Some(path) = std::env::var_os("XDG_DATA_HOME") {
        PathBuf::from(path)
    } else if let Some(home) = std::env::var_os("HOME") {
        PathBuf::from(home).join(".local").join("share")
    } else {
        std::env::current_dir()?
    };

    Ok(data_home.join("aiadne").join("aiadne.sqlite3"))
}

fn project_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectInfo> {
    Ok(ProjectInfo {
        id: row.get(0)?,
        name: row.get(1)?,
        path: PathBuf::from(row.get::<_, String>(2)?),
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

fn transcript_session_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TranscriptSessionInfo> {
    Ok(TranscriptSessionInfo {
        id: row.get(0)?,
        project_id: row.get(1)?,
        runtime: row.get(2)?,
        source: row.get(3)?,
        title: row.get(4)?,
        started_at: row.get(5)?,
        updated_at: row.get(6)?,
        event_count: row.get(7)?,
    })
}

fn transcript_event_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TranscriptEventInfo> {
    Ok(TranscriptEventInfo {
        id: row.get(0)?,
        session_id: row.get(1)?,
        sequence: row.get(2)?,
        kind: row.get(3)?,
        content: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn require_transcript_session(connection: &Connection, session_id: &str) -> AppResult<()> {
    let exists: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM transcript_sessions WHERE id = ?1",
            params![session_id],
            |row| row.get(0),
        )
        .map_err(storage_error)?;
    if exists == 0 {
        return Err(AppError::InvalidInput(format!(
            "transcript session not found: {session_id}"
        )));
    }
    Ok(())
}

fn resolve_project_path(path: &Path) -> AppResult<PathBuf> {
    if !path.is_dir() {
        return Err(AppError::InvalidInput(format!(
            "project path is not a directory: {}",
            path.display()
        )));
    }
    Ok(path.canonicalize()?)
}

fn unix_timestamp() -> AppResult<i64> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| AppError::Storage(err.to_string()))?;
    Ok(duration.as_secs() as i64)
}

fn is_unique_constraint(err: &rusqlite::Error) -> bool {
    matches!(
        err,
        rusqlite::Error::SqliteFailure(error, _)
            if error.code == rusqlite::ErrorCode::ConstraintViolation
    )
}

fn storage_error(err: rusqlite::Error) -> AppError {
    AppError::Storage(err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_lists_and_deletes_projects() {
        let store = ProjectStore::in_memory().expect("store opens");
        let path = std::env::current_dir().expect("current dir exists");

        let project = store
            .create_project(CreateProjectRequest {
                name: "  AIadne  ".to_string(),
                path: path.clone(),
            })
            .expect("project created");
        let projects = store.list_projects().expect("projects list");

        assert_eq!(projects, vec![project.clone()]);
        assert_eq!(project.name, "AIadne");
        assert_eq!(
            project.path,
            path.canonicalize().expect("path canonicalizes")
        );

        store.delete_project(&project.id).expect("project deleted");
        assert!(store.list_projects().expect("projects list").is_empty());
    }

    #[test]
    fn rejects_invalid_project_input() {
        let store = ProjectStore::in_memory().expect("store opens");

        let empty_name = store
            .create_project(CreateProjectRequest {
                name: " ".to_string(),
                path: std::env::current_dir().expect("current dir exists"),
            })
            .expect_err("empty name rejected");
        assert!(matches!(empty_name, AppError::InvalidInput(_)));

        let missing_path = store
            .create_project(CreateProjectRequest {
                name: "Missing".to_string(),
                path: PathBuf::from("/definitely/not/a/project"),
            })
            .expect_err("missing path rejected");
        assert!(matches!(missing_path, AppError::InvalidInput(_)));
    }

    #[test]
    fn rejects_duplicate_project_paths() {
        let store = ProjectStore::in_memory().expect("store opens");
        let path = std::env::current_dir().expect("current dir exists");

        store
            .create_project(CreateProjectRequest {
                name: "One".to_string(),
                path: path.clone(),
            })
            .expect("project created");
        let duplicate = store
            .create_project(CreateProjectRequest {
                name: "Two".to_string(),
                path,
            })
            .expect_err("duplicate rejected");

        assert!(matches!(duplicate, AppError::InvalidInput(_)));
        assert!(duplicate.to_string().contains("already exists"));
    }

    #[test]
    fn creates_lists_and_records_transcript_events() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: std::env::current_dir().expect("current dir exists"),
            })
            .expect("project created");

        let session = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(project.id.clone()),
                runtime: " acp ".to_string(),
                source: " Codex ".to_string(),
                title: Some(" Morning run ".to_string()),
            })
            .expect("transcript session created");

        assert_eq!(session.project_id.as_deref(), Some(project.id.as_str()));
        assert_eq!(session.runtime, "acp");
        assert_eq!(session.source, "Codex");
        assert_eq!(session.title, "Morning run");
        assert_eq!(session.event_count, 0);

        let inserted = store
            .append_transcript_events(
                &session.id,
                vec![
                    TranscriptEventInput {
                        kind: " user_message ".to_string(),
                        content: "hello".to_string(),
                    },
                    TranscriptEventInput {
                        kind: "agent_message".to_string(),
                        content: "Hi there".to_string(),
                    },
                ],
            )
            .expect("events appended");

        assert_eq!(inserted.len(), 2);
        assert_eq!(inserted[0].sequence, 0);
        assert_eq!(inserted[0].kind, "user_message");
        assert_eq!(inserted[0].content, "hello");
        assert_eq!(inserted[1].sequence, 1);

        let sessions = store
            .list_transcript_sessions(Some(&project.id))
            .expect("sessions list");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, session.id);
        assert_eq!(sessions[0].event_count, 2);

        let events = store
            .list_transcript_events(&session.id)
            .expect("events list");
        assert_eq!(events, inserted);
    }

    #[test]
    fn rejects_invalid_transcript_input() {
        let store = ProjectStore::in_memory().expect("store opens");

        let missing_runtime = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: None,
                runtime: " ".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect_err("missing runtime rejected");
        assert!(matches!(missing_runtime, AppError::InvalidInput(_)));

        let missing_project = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some("missing-project".to_string()),
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect_err("missing project rejected");
        assert!(matches!(missing_project, AppError::InvalidInput(_)));

        let session = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: None,
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect("transcript session created");

        let empty_batch = store
            .append_transcript_events(&session.id, Vec::new())
            .expect_err("empty event batch rejected");
        assert!(matches!(empty_batch, AppError::InvalidInput(_)));

        let empty_kind = store
            .append_transcript_events(
                &session.id,
                vec![TranscriptEventInput {
                    kind: " ".to_string(),
                    content: "content".to_string(),
                }],
            )
            .expect_err("empty kind rejected");
        assert!(matches!(empty_kind, AppError::InvalidInput(_)));

        let empty_content = store
            .append_transcript_events(
                &session.id,
                vec![TranscriptEventInput {
                    kind: "agent_message".to_string(),
                    content: " ".to_string(),
                }],
            )
            .expect_err("empty content rejected");
        assert!(matches!(empty_content, AppError::InvalidInput(_)));
    }

    #[test]
    fn keeps_transcript_history_when_project_is_deleted() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: std::env::current_dir().expect("current dir exists"),
            })
            .expect("project created");
        let session = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(project.id.clone()),
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect("transcript session created");

        store.delete_project(&project.id).expect("project deleted");

        let sessions = store
            .list_transcript_sessions(None)
            .expect("transcript sessions listed");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, session.id);
        assert_eq!(sessions[0].project_id, None);
    }
}
