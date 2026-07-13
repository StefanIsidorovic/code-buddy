use crate::errors::{AppError, AppResult};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    process::Command,
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
pub struct CreateProjectRepositoryRequest {
    pub project_id: String,
    pub name: String,
    pub path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRepositoryInfo {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub path: PathBuf,
    pub is_default: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInitializationRequest {
    pub project_id: String,
    pub repository_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInitializationInfo {
    pub id: String,
    pub project_id: String,
    pub status: String,
    pub repository_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInitializationFactInfo {
    pub id: String,
    pub initialization_id: String,
    pub repository_id: String,
    pub repository_name: String,
    pub repository_path: PathBuf,
    pub kind: String,
    pub label: String,
    pub value: String,
    pub source: String,
    pub created_at: i64,
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameTranscriptSessionRequest {
    pub session_id: String,
    pub title: String,
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateKnowledgeItemRequest {
    pub project_id: Option<String>,
    pub title: String,
    pub body: String,
    pub kind: String,
    pub scope: String,
    pub source_transcript_session_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeItemInfo {
    pub id: String,
    pub project_id: Option<String>,
    pub title: String,
    pub body: String,
    pub kind: String,
    pub scope: String,
    pub source_transcript_session_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
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

        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        transaction.execute(
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
        insert_project_repository(
            &transaction,
            ProjectRepositoryInfo {
                id: Uuid::new_v4().to_string(),
                project_id: project.id.clone(),
                name: project.name.clone(),
                path: project.path.clone(),
                is_default: true,
                created_at: now,
                updated_at: now,
            },
        )?;
        transaction.commit().map_err(storage_error)?;

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

    pub fn create_project_repository(
        &self,
        request: CreateProjectRepositoryRequest,
    ) -> AppResult<ProjectRepositoryInfo> {
        let project_id = request.project_id.trim();
        if project_id.is_empty() {
            return Err(AppError::InvalidInput(
                "repository project id must not be empty".to_string(),
            ));
        }
        self.require_project(project_id)?;

        let name = request.name.trim();
        if name.is_empty() {
            return Err(AppError::InvalidInput(
                "repository name must not be empty".to_string(),
            ));
        }

        let path = resolve_project_path(&request.path)?;
        let now = unix_timestamp()?;
        let repository = ProjectRepositoryInfo {
            id: Uuid::new_v4().to_string(),
            project_id: project_id.to_string(),
            name: name.to_string(),
            path,
            is_default: false,
            created_at: now,
            updated_at: now,
        };

        let connection = self.connection()?;
        insert_project_repository(&connection, repository.clone())?;
        Ok(repository)
    }

    pub fn list_project_repositories(
        &self,
        project_id: &str,
    ) -> AppResult<Vec<ProjectRepositoryInfo>> {
        self.require_project(project_id)?;

        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id, project_id, name, path, is_default, created_at, updated_at
                 FROM project_repositories
                 WHERE project_id = ?1
                 ORDER BY is_default DESC, updated_at DESC, name ASC",
            )
            .map_err(storage_error)?;
        let repositories = statement
            .query_map(params![project_id], project_repository_from_row)
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;

        Ok(repositories)
    }

    pub fn delete_project_repository(&self, repository_id: &str) -> AppResult<()> {
        let deleted = self
            .connection()?
            .execute(
                "DELETE FROM project_repositories WHERE id = ?1",
                params![repository_id],
            )
            .map_err(storage_error)?;
        if deleted == 0 {
            return Err(AppError::InvalidInput(format!(
                "project repository not found: {repository_id}"
            )));
        }
        Ok(())
    }

    pub fn create_project_initialization(
        &self,
        request: CreateProjectInitializationRequest,
    ) -> AppResult<ProjectInitializationInfo> {
        let project_id = request.project_id.trim();
        if project_id.is_empty() {
            return Err(AppError::InvalidInput(
                "initialization project id must not be empty".to_string(),
            ));
        }
        self.require_project(project_id)?;

        let mut seen_repository_ids = HashSet::new();
        let mut repository_ids = Vec::new();
        for repository_id in request.repository_ids {
            let repository_id = repository_id.trim();
            if repository_id.is_empty() {
                return Err(AppError::InvalidInput(
                    "initialization repository id must not be empty".to_string(),
                ));
            }
            if !seen_repository_ids.insert(repository_id.to_string()) {
                return Err(AppError::InvalidInput(format!(
                    "duplicate initialization repository id: {repository_id}"
                )));
            }
            repository_ids.push(repository_id.to_string());
        }
        if repository_ids.is_empty() {
            return Err(AppError::InvalidInput(
                "initialization must include at least one repository".to_string(),
            ));
        }

        let now = unix_timestamp()?;
        let initialization = ProjectInitializationInfo {
            id: Uuid::new_v4().to_string(),
            project_id: project_id.to_string(),
            status: "preflight".to_string(),
            repository_count: repository_ids.len() as i64,
            created_at: now,
            updated_at: now,
        };

        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        for repository_id in &repository_ids {
            require_project_repository(&transaction, project_id, repository_id)?;
        }
        transaction
            .execute(
                "INSERT INTO project_initialization_runs
                 (id, project_id, status, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    &initialization.id,
                    &initialization.project_id,
                    &initialization.status,
                    initialization.created_at,
                    initialization.updated_at
                ],
            )
            .map_err(storage_error)?;
        for (repository_index, repository_id) in repository_ids.iter().enumerate() {
            transaction
                .execute(
                    "INSERT INTO project_initialization_repositories
                     (initialization_id, repository_id, repository_index, created_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![
                        &initialization.id,
                        repository_id,
                        repository_index as i64,
                        now
                    ],
                )
                .map_err(storage_error)?;
        }
        transaction.commit().map_err(storage_error)?;

        Ok(initialization)
    }

    pub fn list_project_initializations(
        &self,
        project_id: &str,
    ) -> AppResult<Vec<ProjectInitializationInfo>> {
        self.require_project(project_id)?;

        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT r.id, r.project_id, r.status, COUNT(ir.repository_id), r.created_at, r.updated_at
                 FROM project_initialization_runs r
                 LEFT JOIN project_initialization_repositories ir ON ir.initialization_id = r.id
                 WHERE r.project_id = ?1
                 GROUP BY r.id, r.project_id, r.status, r.created_at, r.updated_at
                 ORDER BY r.updated_at DESC, r.created_at DESC",
            )
            .map_err(storage_error)?;
        let initializations = statement
            .query_map(params![project_id], project_initialization_from_row)
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;

        Ok(initializations)
    }

    pub fn collect_project_initialization_facts(
        &self,
        initialization_id: &str,
    ) -> AppResult<Vec<ProjectInitializationFactInfo>> {
        let initialization_id = initialization_id.trim();
        if initialization_id.is_empty() {
            return Err(AppError::InvalidInput(
                "initialization id must not be empty".to_string(),
            ));
        }

        let repositories = {
            let connection = self.connection()?;
            list_initialization_repositories(&connection, initialization_id)?
        };
        let now = unix_timestamp()?;
        let facts = repositories
            .iter()
            .flat_map(|repository| collect_repository_facts(initialization_id, repository, now))
            .collect::<Vec<_>>();

        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        require_project_initialization(&transaction, initialization_id)?;
        transaction
            .execute(
                "DELETE FROM project_initialization_facts WHERE initialization_id = ?1",
                params![initialization_id],
            )
            .map_err(storage_error)?;
        for fact in &facts {
            insert_project_initialization_fact(&transaction, fact)?;
        }
        transaction
            .execute(
                "UPDATE project_initialization_runs SET status = ?1, updated_at = ?2 WHERE id = ?3",
                params!["facts", now, initialization_id],
            )
            .map_err(storage_error)?;
        transaction.commit().map_err(storage_error)?;

        Ok(facts)
    }

    pub fn list_project_initialization_facts(
        &self,
        initialization_id: &str,
    ) -> AppResult<Vec<ProjectInitializationFactInfo>> {
        let initialization_id = initialization_id.trim();
        if initialization_id.is_empty() {
            return Err(AppError::InvalidInput(
                "initialization id must not be empty".to_string(),
            ));
        }

        let connection = self.connection()?;
        require_project_initialization(&connection, initialization_id)?;
        list_project_initialization_facts(&connection, initialization_id)
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

    pub fn rename_transcript_session(
        &self,
        request: RenameTranscriptSessionRequest,
    ) -> AppResult<TranscriptSessionInfo> {
        let title = request.title.trim();
        if title.is_empty() {
            return Err(AppError::InvalidInput(
                "transcript title must not be empty".to_string(),
            ));
        }

        let now = unix_timestamp()?;
        let updated = self
            .connection()?
            .execute(
                "UPDATE transcript_sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
                params![title, now, &request.session_id],
            )
            .map_err(storage_error)?;
        if updated == 0 {
            return Err(AppError::InvalidInput(format!(
                "transcript session not found: {}",
                request.session_id
            )));
        }

        self.transcript_session(&request.session_id)
    }

    pub fn create_knowledge_item(
        &self,
        request: CreateKnowledgeItemRequest,
    ) -> AppResult<KnowledgeItemInfo> {
        let title = request.title.trim();
        if title.is_empty() {
            return Err(AppError::InvalidInput(
                "knowledge title must not be empty".to_string(),
            ));
        }

        let body = request.body.trim();
        if body.is_empty() {
            return Err(AppError::InvalidInput(
                "knowledge body must not be empty".to_string(),
            ));
        }

        let kind = request.kind.trim();
        if kind.is_empty() {
            return Err(AppError::InvalidInput(
                "knowledge kind must not be empty".to_string(),
            ));
        }

        let scope = request.scope.trim();
        if scope.is_empty() {
            return Err(AppError::InvalidInput(
                "knowledge scope must not be empty".to_string(),
            ));
        }

        if let Some(project_id) = request.project_id.as_deref() {
            self.require_project(project_id)?;
        }
        if let Some(session_id) = request.source_transcript_session_id.as_deref() {
            self.require_transcript_session(session_id)?;
        }

        let now = unix_timestamp()?;
        let item = KnowledgeItemInfo {
            id: Uuid::new_v4().to_string(),
            project_id: request.project_id,
            title: title.to_string(),
            body: body.to_string(),
            kind: kind.to_string(),
            scope: scope.to_string(),
            source_transcript_session_id: request.source_transcript_session_id,
            created_at: now,
            updated_at: now,
        };

        self.connection()?.execute(
            "INSERT INTO knowledge_items
             (id, project_id, title, body, kind, scope, source_transcript_session_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &item.id,
                item.project_id.as_deref(),
                &item.title,
                &item.body,
                &item.kind,
                &item.scope,
                item.source_transcript_session_id.as_deref(),
                item.created_at,
                item.updated_at
            ],
        )
        .map_err(storage_error)?;

        Ok(item)
    }

    pub fn list_knowledge_items(
        &self,
        project_id: Option<&str>,
    ) -> AppResult<Vec<KnowledgeItemInfo>> {
        if let Some(project_id) = project_id {
            self.require_project(project_id)?;
        }

        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id, project_id, title, body, kind, scope, source_transcript_session_id, created_at, updated_at
                 FROM knowledge_items
                 WHERE (?1 IS NULL AND project_id IS NULL) OR (?1 IS NOT NULL AND (project_id IS NULL OR project_id = ?1))
                 ORDER BY CASE WHEN project_id IS NULL THEN 1 ELSE 0 END, updated_at DESC, title ASC",
            )
            .map_err(storage_error)?;
        let items = statement
            .query_map(params![project_id], knowledge_item_from_row)
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;

        Ok(items)
    }

    pub fn attach_knowledge_to_transcript_session(
        &self,
        session_id: &str,
        knowledge_item_id: &str,
    ) -> AppResult<Vec<KnowledgeItemInfo>> {
        let connection = self.connection()?;
        require_transcript_session(&connection, session_id)?;
        require_knowledge_item(&connection, knowledge_item_id)?;
        require_knowledge_available_for_session(&connection, session_id, knowledge_item_id)?;

        connection
            .execute(
                "INSERT OR IGNORE INTO transcript_knowledge_links
                 (transcript_session_id, knowledge_item_id, created_at)
                 VALUES (?1, ?2, ?3)",
                params![session_id, knowledge_item_id, unix_timestamp()?],
            )
            .map_err(storage_error)?;

        list_attached_knowledge_items(&connection, session_id)
    }

    pub fn list_attached_knowledge(&self, session_id: &str) -> AppResult<Vec<KnowledgeItemInfo>> {
        let connection = self.connection()?;
        require_transcript_session(&connection, session_id)?;
        list_attached_knowledge_items(&connection, session_id)
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

                CREATE TABLE IF NOT EXISTS project_repositories (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    path TEXT NOT NULL UNIQUE,
                    is_default INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_project_repositories_project_updated
                    ON project_repositories(project_id, is_default DESC, updated_at DESC);

                INSERT OR IGNORE INTO project_repositories
                    (id, project_id, name, path, is_default, created_at, updated_at)
                SELECT 'legacy-' || id, id, name, path, 1, created_at, updated_at
                FROM projects
                WHERE path IS NOT NULL AND path != '';

                CREATE TABLE IF NOT EXISTS project_initialization_runs (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    status TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_project_initialization_runs_project_updated
                    ON project_initialization_runs(project_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS project_initialization_repositories (
                    initialization_id TEXT NOT NULL REFERENCES project_initialization_runs(id) ON DELETE CASCADE,
                    repository_id TEXT NOT NULL REFERENCES project_repositories(id) ON DELETE CASCADE,
                    repository_index INTEGER NOT NULL,
                    created_at INTEGER NOT NULL,
                    PRIMARY KEY (initialization_id, repository_id),
                    UNIQUE(initialization_id, repository_index)
                );

                CREATE INDEX IF NOT EXISTS idx_project_initialization_repositories_repo
                    ON project_initialization_repositories(repository_id);

                CREATE TABLE IF NOT EXISTS project_initialization_facts (
                    id TEXT PRIMARY KEY,
                    initialization_id TEXT NOT NULL REFERENCES project_initialization_runs(id) ON DELETE CASCADE,
                    repository_id TEXT NOT NULL REFERENCES project_repositories(id) ON DELETE CASCADE,
                    kind TEXT NOT NULL,
                    label TEXT NOT NULL,
                    value TEXT NOT NULL,
                    source TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_project_initialization_facts_initialization
                    ON project_initialization_facts(initialization_id, repository_id, kind);

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

                CREATE TABLE IF NOT EXISTS knowledge_items (
                    id TEXT PRIMARY KEY,
                    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
                    title TEXT NOT NULL,
                    body TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    scope TEXT NOT NULL,
                    source_transcript_session_id TEXT REFERENCES transcript_sessions(id) ON DELETE SET NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_knowledge_items_project_updated
                    ON knowledge_items(project_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS transcript_knowledge_links (
                    transcript_session_id TEXT NOT NULL REFERENCES transcript_sessions(id) ON DELETE CASCADE,
                    knowledge_item_id TEXT NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
                    created_at INTEGER NOT NULL,
                    PRIMARY KEY (transcript_session_id, knowledge_item_id)
                );

                CREATE INDEX IF NOT EXISTS idx_transcript_knowledge_links_item
                    ON transcript_knowledge_links(knowledge_item_id);
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

    fn transcript_session(&self, session_id: &str) -> AppResult<TranscriptSessionInfo> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT s.id, s.project_id, s.runtime, s.source, s.title, s.started_at, s.updated_at, COUNT(e.id)
                 FROM transcript_sessions s
                 LEFT JOIN transcript_events e ON e.session_id = s.id
                 WHERE s.id = ?1
                 GROUP BY s.id, s.project_id, s.runtime, s.source, s.title, s.started_at, s.updated_at",
            )
            .map_err(storage_error)?;
        statement
            .query_row(params![session_id], transcript_session_from_row)
            .map_err(|err| {
                if matches!(err, rusqlite::Error::QueryReturnedNoRows) {
                    AppError::InvalidInput(format!("transcript session not found: {session_id}"))
                } else {
                    storage_error(err)
                }
            })
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

fn project_repository_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectRepositoryInfo> {
    let is_default: i64 = row.get(4)?;
    Ok(ProjectRepositoryInfo {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        path: PathBuf::from(row.get::<_, String>(3)?),
        is_default: is_default != 0,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn project_initialization_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<ProjectInitializationInfo> {
    Ok(ProjectInitializationInfo {
        id: row.get(0)?,
        project_id: row.get(1)?,
        status: row.get(2)?,
        repository_count: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

fn project_initialization_fact_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<ProjectInitializationFactInfo> {
    Ok(ProjectInitializationFactInfo {
        id: row.get(0)?,
        initialization_id: row.get(1)?,
        repository_id: row.get(2)?,
        repository_name: row.get(3)?,
        repository_path: PathBuf::from(row.get::<_, String>(4)?),
        kind: row.get(5)?,
        label: row.get(6)?,
        value: row.get(7)?,
        source: row.get(8)?,
        created_at: row.get(9)?,
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

fn knowledge_item_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<KnowledgeItemInfo> {
    Ok(KnowledgeItemInfo {
        id: row.get(0)?,
        project_id: row.get(1)?,
        title: row.get(2)?,
        body: row.get(3)?,
        kind: row.get(4)?,
        scope: row.get(5)?,
        source_transcript_session_id: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
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

fn require_knowledge_item(connection: &Connection, knowledge_item_id: &str) -> AppResult<()> {
    let exists: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM knowledge_items WHERE id = ?1",
            params![knowledge_item_id],
            |row| row.get(0),
        )
        .map_err(storage_error)?;
    if exists == 0 {
        return Err(AppError::InvalidInput(format!(
            "knowledge item not found: {knowledge_item_id}"
        )));
    }
    Ok(())
}

fn require_project_repository(
    connection: &Connection,
    project_id: &str,
    repository_id: &str,
) -> AppResult<()> {
    let exists: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM project_repositories WHERE id = ?1 AND project_id = ?2",
            params![repository_id, project_id],
            |row| row.get(0),
        )
        .map_err(storage_error)?;
    if exists == 0 {
        return Err(AppError::InvalidInput(format!(
            "project repository not found for project: {repository_id}"
        )));
    }
    Ok(())
}

fn require_project_initialization(
    connection: &Connection,
    initialization_id: &str,
) -> AppResult<()> {
    let exists: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM project_initialization_runs WHERE id = ?1",
            params![initialization_id],
            |row| row.get(0),
        )
        .map_err(storage_error)?;
    if exists == 0 {
        return Err(AppError::InvalidInput(format!(
            "project initialization not found: {initialization_id}"
        )));
    }
    Ok(())
}

fn list_initialization_repositories(
    connection: &Connection,
    initialization_id: &str,
) -> AppResult<Vec<ProjectRepositoryInfo>> {
    require_project_initialization(connection, initialization_id)?;
    let mut statement = connection
        .prepare(
            "SELECT pr.id, pr.project_id, pr.name, pr.path, pr.is_default, pr.created_at, pr.updated_at
             FROM project_initialization_repositories ir
             JOIN project_repositories pr ON pr.id = ir.repository_id
             WHERE ir.initialization_id = ?1
             ORDER BY ir.repository_index ASC",
        )
        .map_err(storage_error)?;
    let repositories = statement
        .query_map(params![initialization_id], project_repository_from_row)
        .map_err(storage_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage_error)?;

    Ok(repositories)
}

fn list_project_initialization_facts(
    connection: &Connection,
    initialization_id: &str,
) -> AppResult<Vec<ProjectInitializationFactInfo>> {
    let mut statement = connection
        .prepare(
            "SELECT f.id, f.initialization_id, f.repository_id, pr.name, pr.path,
                    f.kind, f.label, f.value, f.source, f.created_at
             FROM project_initialization_facts f
             JOIN project_repositories pr ON pr.id = f.repository_id
             WHERE f.initialization_id = ?1
             ORDER BY pr.name ASC, f.created_at ASC, f.kind ASC",
        )
        .map_err(storage_error)?;
    let facts = statement
        .query_map(
            params![initialization_id],
            project_initialization_fact_from_row,
        )
        .map_err(storage_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage_error)?;

    Ok(facts)
}

fn insert_project_initialization_fact(
    connection: &Connection,
    fact: &ProjectInitializationFactInfo,
) -> AppResult<()> {
    connection
        .execute(
            "INSERT INTO project_initialization_facts
             (id, initialization_id, repository_id, kind, label, value, source, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                &fact.id,
                &fact.initialization_id,
                &fact.repository_id,
                &fact.kind,
                &fact.label,
                &fact.value,
                &fact.source,
                fact.created_at
            ],
        )
        .map_err(storage_error)?;
    Ok(())
}

fn collect_repository_facts(
    initialization_id: &str,
    repository: &ProjectRepositoryInfo,
    created_at: i64,
) -> Vec<ProjectInitializationFactInfo> {
    let mut facts = vec![build_initialization_fact(
        initialization_id,
        repository,
        "repository_path",
        "Repository path",
        repository.path.to_string_lossy(),
        "project_repositories.path",
        created_at,
    )];

    let git_root = git_output(&repository.path, &["rev-parse", "--show-toplevel"]);
    let is_git_repository = git_root
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty());
    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "git_repository",
        "Git repository",
        if is_git_repository { "yes" } else { "no" },
        "git rev-parse --show-toplevel",
        created_at,
    ));

    if !is_git_repository {
        return facts;
    }

    let branch = git_output(&repository.path, &["branch", "--show-current"])
        .filter(|value| !value.trim().is_empty())
        .or_else(|| git_output(&repository.path, &["rev-parse", "--abbrev-ref", "HEAD"]))
        .unwrap_or_else(|| "unknown".to_string());
    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "git_branch",
        "Git branch",
        branch,
        "git branch --show-current",
        created_at,
    ));

    let head = git_output(&repository.path, &["rev-parse", "--short", "HEAD"])
        .unwrap_or_else(|| "unknown".to_string());
    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "git_head",
        "Git HEAD",
        head,
        "git rev-parse --short HEAD",
        created_at,
    ));

    let tracked_files = git_lines(&repository.path, &["ls-files"]);
    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "tracked_file_count",
        "Tracked files",
        tracked_files.len().to_string(),
        "git ls-files",
        created_at,
    ));

    let markdown_file_count = tracked_files
        .iter()
        .filter(|path| path.to_ascii_lowercase().ends_with(".md"))
        .count();
    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "markdown_file_count",
        "Markdown files",
        markdown_file_count.to_string(),
        "git ls-files",
        created_at,
    ));

    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "detected_manifests",
        "Detected manifests",
        detected_manifests_summary(&tracked_files),
        "git ls-files",
        created_at,
    ));

    let test_file_count = tracked_files
        .iter()
        .filter(|path| is_likely_test_file(path))
        .count();
    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "test_file_count",
        "Test files",
        test_file_count.to_string(),
        "git ls-files",
        created_at,
    ));

    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "likely_entry_points",
        "Likely entry points",
        likely_entry_points_summary(&tracked_files),
        "git ls-files",
        created_at,
    ));

    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "recent_churn",
        "Recent churn",
        recent_churn_summary(&repository.path),
        "git log --name-only --max-count=30",
        created_at,
    ));

    facts
}

fn detected_manifests_summary(tracked_files: &[String]) -> String {
    let manifest_names = [
        "package.json",
        "Cargo.toml",
        "pyproject.toml",
        "requirements.txt",
        "go.mod",
        "pom.xml",
        "build.gradle",
        "Makefile",
    ];
    let manifests = tracked_files
        .iter()
        .filter(|path| manifest_names.iter().any(|name| path.ends_with(name)))
        .take(8)
        .cloned()
        .collect::<Vec<_>>();
    if manifests.is_empty() {
        "none".to_string()
    } else {
        manifests.join(", ")
    }
}

fn is_likely_test_file(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    lower.contains("/test/")
        || lower.contains("/tests/")
        || lower.ends_with("_test.rs")
        || lower.ends_with(".test.ts")
        || lower.ends_with(".test.tsx")
        || lower.ends_with(".spec.ts")
        || lower.ends_with(".spec.tsx")
}

fn likely_entry_points_summary(tracked_files: &[String]) -> String {
    let entry_names = [
        "src/main.rs",
        "src/lib.rs",
        "src/main.ts",
        "src/main.tsx",
        "src/App.tsx",
        "main.py",
        "app.py",
        "index.ts",
        "index.tsx",
    ];
    let entry_points = tracked_files
        .iter()
        .filter(|path| entry_names.iter().any(|name| path.ends_with(name)))
        .take(8)
        .cloned()
        .collect::<Vec<_>>();
    if entry_points.is_empty() {
        "none".to_string()
    } else {
        entry_points.join(", ")
    }
}

fn build_initialization_fact(
    initialization_id: &str,
    repository: &ProjectRepositoryInfo,
    kind: &str,
    label: &str,
    value: impl Into<String>,
    source: &str,
    created_at: i64,
) -> ProjectInitializationFactInfo {
    ProjectInitializationFactInfo {
        id: Uuid::new_v4().to_string(),
        initialization_id: initialization_id.to_string(),
        repository_id: repository.id.clone(),
        repository_name: repository.name.clone(),
        repository_path: repository.path.clone(),
        kind: kind.to_string(),
        label: label.to_string(),
        value: value.into(),
        source: source.to_string(),
        created_at,
    }
}

fn git_output(repository_path: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repository_path)
        .args(args)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn git_lines(repository_path: &Path, args: &[&str]) -> Vec<String> {
    git_output(repository_path, args)
        .map(|output| {
            output
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn recent_churn_summary(repository_path: &Path) -> String {
    let mut counts = HashMap::<String, usize>::new();
    for line in git_lines(
        repository_path,
        &["log", "--name-only", "--pretty=format:", "--max-count=30"],
    ) {
        *counts.entry(line).or_default() += 1;
    }

    let mut entries = counts.into_iter().collect::<Vec<_>>();
    entries.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));

    let summary = entries
        .into_iter()
        .take(5)
        .map(|(path, count)| format!("{path} ({count})"))
        .collect::<Vec<_>>()
        .join(", ");

    if summary.is_empty() {
        "none".to_string()
    } else {
        summary
    }
}

fn require_knowledge_available_for_session(
    connection: &Connection,
    session_id: &str,
    knowledge_item_id: &str,
) -> AppResult<()> {
    let available: i64 = connection
        .query_row(
            "SELECT COUNT(*)
             FROM transcript_sessions s, knowledge_items k
             WHERE s.id = ?1
               AND k.id = ?2
               AND (k.project_id IS NULL OR k.project_id = s.project_id)",
            params![session_id, knowledge_item_id],
            |row| row.get(0),
        )
        .map_err(storage_error)?;
    if available == 0 {
        return Err(AppError::InvalidInput(
            "knowledge item is not available for this transcript session".to_string(),
        ));
    }
    Ok(())
}

fn list_attached_knowledge_items(
    connection: &Connection,
    session_id: &str,
) -> AppResult<Vec<KnowledgeItemInfo>> {
    let mut statement = connection
        .prepare(
            "SELECT k.id, k.project_id, k.title, k.body, k.kind, k.scope,
                    k.source_transcript_session_id, k.created_at, k.updated_at
             FROM transcript_knowledge_links l
             JOIN knowledge_items k ON k.id = l.knowledge_item_id
             WHERE l.transcript_session_id = ?1
             ORDER BY l.created_at ASC, k.title ASC",
        )
        .map_err(storage_error)?;
    let items = statement
        .query_map(params![session_id], knowledge_item_from_row)
        .map_err(storage_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage_error)?;

    Ok(items)
}

fn insert_project_repository(
    connection: &Connection,
    repository: ProjectRepositoryInfo,
) -> AppResult<()> {
    let path_text = repository.path.to_string_lossy().to_string();
    connection
        .execute(
            "INSERT INTO project_repositories
             (id, project_id, name, path, is_default, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                &repository.id,
                &repository.project_id,
                &repository.name,
                path_text,
                if repository.is_default { 1 } else { 0 },
                repository.created_at,
                repository.updated_at
            ],
        )
        .map_err(|err| {
            if is_unique_constraint(&err) {
                AppError::InvalidInput("repository path already exists".to_string())
            } else {
                storage_error(err)
            }
        })?;
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
    fn creates_lists_and_deletes_project_repositories() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project_path = temp_project_path("project-root");
        let extra_path = temp_project_path("project-api");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: project_path.clone(),
            })
            .expect("project created");

        let initial_repositories = store
            .list_project_repositories(&project.id)
            .expect("repositories listed");
        assert_eq!(initial_repositories.len(), 1);
        assert_eq!(initial_repositories[0].project_id, project.id);
        assert_eq!(initial_repositories[0].name, "AIadne");
        assert_eq!(
            initial_repositories[0].path,
            project_path.canonicalize().expect("path canonicalizes")
        );
        assert!(initial_repositories[0].is_default);

        let extra = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: project.id.clone(),
                name: "  API  ".to_string(),
                path: extra_path.clone(),
            })
            .expect("repository created");
        assert_eq!(extra.name, "API");
        assert_eq!(extra.project_id, project.id);
        assert_eq!(
            extra.path,
            extra_path.canonicalize().expect("path canonicalizes")
        );
        assert!(!extra.is_default);

        let repositories = store
            .list_project_repositories(&project.id)
            .expect("repositories listed");
        assert_eq!(repositories.len(), 2);
        assert_eq!(repositories[0].name, "AIadne");
        assert_eq!(repositories[1].name, "API");

        store
            .delete_project_repository(&extra.id)
            .expect("repository deleted");
        let remaining = store
            .list_project_repositories(&project.id)
            .expect("repositories listed");
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].name, "AIadne");

        store.delete_project(&project.id).expect("project deleted");
        let missing_project = store
            .list_project_repositories(&project.id)
            .expect_err("deleted project rejected");
        assert!(matches!(missing_project, AppError::InvalidInput(_)));
    }

    #[test]
    fn rejects_invalid_project_repository_input() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project_path = temp_project_path("repo-project");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: project_path.clone(),
            })
            .expect("project created");

        let missing_project = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: "missing-project".to_string(),
                name: "Repo".to_string(),
                path: temp_project_path("missing-project-repo"),
            })
            .expect_err("missing project rejected");
        assert!(matches!(missing_project, AppError::InvalidInput(_)));

        let empty_name = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: project.id.clone(),
                name: " ".to_string(),
                path: temp_project_path("empty-name-repo"),
            })
            .expect_err("empty name rejected");
        assert!(matches!(empty_name, AppError::InvalidInput(_)));

        let missing_path = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: project.id.clone(),
                name: "Missing path".to_string(),
                path: PathBuf::from("/definitely/not/a/repository"),
            })
            .expect_err("missing path rejected");
        assert!(matches!(missing_path, AppError::InvalidInput(_)));

        let duplicate = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: project.id,
                name: "Duplicate".to_string(),
                path: project_path,
            })
            .expect_err("duplicate path rejected");
        assert!(matches!(duplicate, AppError::InvalidInput(_)));
        assert!(duplicate.to_string().contains("already exists"));
    }

    #[test]
    fn creates_project_initialization_with_selected_repositories() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("init-project"),
            })
            .expect("project created");
        let default_repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .remove(0);
        let api_repository = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: project.id.clone(),
                name: "API".to_string(),
                path: temp_project_path("init-api"),
            })
            .expect("repository created");

        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id.clone(),
                repository_ids: vec![default_repository.id, api_repository.id],
            })
            .expect("initialization created");

        assert_eq!(initialization.project_id, project.id);
        assert_eq!(initialization.status, "preflight");
        assert_eq!(initialization.repository_count, 2);

        let listed = store
            .list_project_initializations(&project.id)
            .expect("initializations listed");
        assert_eq!(listed, vec![initialization]);
    }

    #[test]
    fn collects_non_git_project_initialization_facts() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("facts-non-git"),
            })
            .expect("project created");
        let repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .remove(0);
        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id.clone(),
                repository_ids: vec![repository.id.clone()],
            })
            .expect("initialization created");

        let facts = store
            .collect_project_initialization_facts(&initialization.id)
            .expect("facts collected");

        assert_eq!(facts.len(), 2);
        assert!(facts.iter().all(|fact| fact.repository_id == repository.id));
        assert!(facts.iter().any(|fact| {
            fact.kind == "repository_path" && fact.value == repository.path.to_string_lossy()
        }));
        assert!(facts
            .iter()
            .any(|fact| fact.kind == "git_repository" && fact.value == "no"));
        assert!(!facts.iter().any(|fact| fact.kind == "git_branch"));

        let listed_facts = store
            .list_project_initialization_facts(&initialization.id)
            .expect("facts listed");
        assert_eq!(listed_facts.len(), facts.len());
        let listed_initialization = store
            .list_project_initializations(&project.id)
            .expect("initializations listed")
            .remove(0);
        assert_eq!(listed_initialization.status, "facts");
    }

    #[test]
    fn collects_git_project_initialization_facts_for_selected_repositories() {
        if !git_available_for_tests() {
            return;
        }

        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("facts-project-root"),
            })
            .expect("project created");
        let git_repository_path = temp_project_path("facts-git-repo");
        initialize_git_repository_for_tests(&git_repository_path);
        let selected_repository = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: project.id.clone(),
                name: "Git repo".to_string(),
                path: git_repository_path,
            })
            .expect("git repository created");
        let unselected_repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .into_iter()
            .find(|repository| repository.is_default)
            .expect("default repository exists");
        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id.clone(),
                repository_ids: vec![selected_repository.id.clone()],
            })
            .expect("initialization created");

        let facts = store
            .collect_project_initialization_facts(&initialization.id)
            .expect("facts collected");

        assert!(facts
            .iter()
            .all(|fact| fact.repository_id == selected_repository.id));
        assert!(!facts
            .iter()
            .any(|fact| fact.repository_id == unselected_repository.id));
        assert!(facts
            .iter()
            .any(|fact| fact.kind == "git_repository" && fact.value == "yes"));
        assert!(facts
            .iter()
            .any(|fact| fact.kind == "tracked_file_count" && fact.value == "2"));
        assert!(facts
            .iter()
            .any(|fact| fact.kind == "markdown_file_count" && fact.value == "1"));
        assert!(facts
            .iter()
            .any(|fact| fact.kind == "likely_entry_points" && fact.value.contains("src/lib.rs")));
        assert!(facts
            .iter()
            .any(|fact| fact.kind == "recent_churn" && fact.value.contains("README.md")));
    }

    #[test]
    fn rejects_invalid_project_initialization_input() {
        let store = ProjectStore::in_memory().expect("store opens");
        let first_project = store
            .create_project(CreateProjectRequest {
                name: "One".to_string(),
                path: temp_project_path("init-one"),
            })
            .expect("first project created");
        let second_project = store
            .create_project(CreateProjectRequest {
                name: "Two".to_string(),
                path: temp_project_path("init-two"),
            })
            .expect("second project created");
        let first_repository = store
            .list_project_repositories(&first_project.id)
            .expect("first repositories listed")
            .remove(0);
        let second_repository = store
            .list_project_repositories(&second_project.id)
            .expect("second repositories listed")
            .remove(0);

        let empty = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: first_project.id.clone(),
                repository_ids: vec![],
            })
            .expect_err("empty repository selection rejected");
        assert!(matches!(empty, AppError::InvalidInput(_)));

        let duplicate = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: first_project.id.clone(),
                repository_ids: vec![first_repository.id.clone(), first_repository.id],
            })
            .expect_err("duplicate repository selection rejected");
        assert!(matches!(duplicate, AppError::InvalidInput(_)));

        let wrong_project = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: first_project.id,
                repository_ids: vec![second_repository.id],
            })
            .expect_err("repository from another project rejected");
        assert!(matches!(wrong_project, AppError::InvalidInput(_)));
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

    #[test]
    fn renames_transcript_session_titles() {
        let store = ProjectStore::in_memory().expect("store opens");
        let session = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: None,
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: Some("Codex ACP".to_string()),
            })
            .expect("transcript session created");

        let renamed = store
            .rename_transcript_session(RenameTranscriptSessionRequest {
                session_id: session.id.clone(),
                title: "  Bug bash with Codex  ".to_string(),
            })
            .expect("transcript session renamed");
        assert_eq!(renamed.title, "Bug bash with Codex");
        assert_eq!(renamed.event_count, 0);

        let listed = store.list_transcript_sessions(None).expect("sessions list");
        assert_eq!(listed[0].title, "Bug bash with Codex");

        let empty_title = store
            .rename_transcript_session(RenameTranscriptSessionRequest {
                session_id: session.id,
                title: " ".to_string(),
            })
            .expect_err("empty title rejected");
        assert!(matches!(empty_title, AppError::InvalidInput(_)));
    }

    #[test]
    fn creates_lists_and_attaches_knowledge_items() {
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

        let global_item = store
            .create_knowledge_item(CreateKnowledgeItemRequest {
                project_id: None,
                title: "  UI palette  ".to_string(),
                body: "Use earth tones.".to_string(),
                kind: " decision ".to_string(),
                scope: " global ".to_string(),
                source_transcript_session_id: None,
            })
            .expect("global knowledge created");
        let project_item = store
            .create_knowledge_item(CreateKnowledgeItemRequest {
                project_id: Some(project.id.clone()),
                title: "Project rule".to_string(),
                body: "Prefer ACP for structured sessions.".to_string(),
                kind: "constraint".to_string(),
                scope: "project".to_string(),
                source_transcript_session_id: Some(session.id.clone()),
            })
            .expect("project knowledge created");

        assert_eq!(global_item.title, "UI palette");
        assert_eq!(global_item.kind, "decision");
        assert_eq!(global_item.scope, "global");
        assert_eq!(
            project_item.source_transcript_session_id,
            Some(session.id.clone())
        );

        let items = store
            .list_knowledge_items(Some(&project.id))
            .expect("knowledge list");
        assert_eq!(items.len(), 2);
        assert!(items.iter().any(|item| item.id == global_item.id));
        assert!(items.iter().any(|item| item.id == project_item.id));

        store
            .attach_knowledge_to_transcript_session(&session.id, &global_item.id)
            .expect("global knowledge attached");
        let attached = store
            .attach_knowledge_to_transcript_session(&session.id, &project_item.id)
            .expect("project knowledge attached");
        assert_eq!(attached.len(), 2);

        let attached_again = store
            .attach_knowledge_to_transcript_session(&session.id, &project_item.id)
            .expect("duplicate attach ignored");
        assert_eq!(attached_again.len(), 2);

        let listed = store
            .list_attached_knowledge(&session.id)
            .expect("attached knowledge listed");
        assert_eq!(listed, attached_again);
    }

    #[test]
    fn rejects_invalid_knowledge_input_and_cross_project_attach() {
        let store = ProjectStore::in_memory().expect("store opens");
        let first_path = temp_project_path("first");
        let second_path = temp_project_path("second");
        let first_project = store
            .create_project(CreateProjectRequest {
                name: "One".to_string(),
                path: first_path,
            })
            .expect("first project created");
        let second_project = store
            .create_project(CreateProjectRequest {
                name: "Two".to_string(),
                path: second_path,
            })
            .expect("second project created");
        let first_session = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(first_project.id.clone()),
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect("first transcript session created");

        let empty_title = store
            .create_knowledge_item(CreateKnowledgeItemRequest {
                project_id: None,
                title: " ".to_string(),
                body: "body".to_string(),
                kind: "decision".to_string(),
                scope: "global".to_string(),
                source_transcript_session_id: None,
            })
            .expect_err("empty title rejected");
        assert!(matches!(empty_title, AppError::InvalidInput(_)));

        let missing_project = store
            .create_knowledge_item(CreateKnowledgeItemRequest {
                project_id: Some("missing-project".to_string()),
                title: "Rule".to_string(),
                body: "body".to_string(),
                kind: "decision".to_string(),
                scope: "project".to_string(),
                source_transcript_session_id: None,
            })
            .expect_err("missing project rejected");
        assert!(matches!(missing_project, AppError::InvalidInput(_)));

        let second_project_item = store
            .create_knowledge_item(CreateKnowledgeItemRequest {
                project_id: Some(second_project.id),
                title: "Other project".to_string(),
                body: "Do not leak into another project.".to_string(),
                kind: "constraint".to_string(),
                scope: "project".to_string(),
                source_transcript_session_id: None,
            })
            .expect("second project knowledge created");
        let cross_project = store
            .attach_knowledge_to_transcript_session(&first_session.id, &second_project_item.id)
            .expect_err("cross-project attach rejected");
        assert!(matches!(cross_project, AppError::InvalidInput(_)));
    }

    fn temp_project_path(label: &str) -> PathBuf {
        let path = std::env::temp_dir()
            .join("aiadne-storage-tests")
            .join(format!("{label}-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&path).expect("temp project dir created");
        path
    }

    fn git_available_for_tests() -> bool {
        Command::new("git")
            .arg("--version")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }

    fn initialize_git_repository_for_tests(path: &Path) {
        run_git_for_tests(path, &["init"]);
        std::fs::write(path.join("README.md"), "# Test\n").expect("README written");
        std::fs::create_dir_all(path.join("src")).expect("src dir created");
        std::fs::write(path.join("src").join("lib.rs"), "pub fn demo() {}\n")
            .expect("lib.rs written");
        run_git_for_tests(path, &["add", "."]);
        run_git_for_tests(
            path,
            &[
                "-c",
                "user.email=test@example.com",
                "-c",
                "user.name=AIadne Test",
                "commit",
                "-m",
                "initial",
            ],
        );
        std::fs::write(path.join("README.md"), "# Test\n\nUpdated.\n").expect("README updated");
        run_git_for_tests(path, &["add", "README.md"]);
        run_git_for_tests(
            path,
            &[
                "-c",
                "user.email=test@example.com",
                "-c",
                "user.name=AIadne Test",
                "commit",
                "-m",
                "update readme",
            ],
        );
    }

    fn run_git_for_tests(path: &Path, args: &[&str]) {
        let output = Command::new("git")
            .arg("-C")
            .arg(path)
            .args(args)
            .output()
            .expect("git command runs");
        assert!(
            output.status.success(),
            "git command failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
}
