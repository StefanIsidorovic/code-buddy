use crate::{
    domain::{AgentConfig, AgentId, Message, MessageRole, NewProject, Project},
    errors::{AppError, AppResult},
};
use rusqlite::{params, types::Type, Connection};
use std::{
    path::{Path, PathBuf},
    str::FromStr,
    sync::Mutex,
};
use uuid::Uuid;

pub struct ConfigStore {
    conn: Mutex<Connection>,
}

impl ConfigStore {
    pub fn open(path: impl AsRef<Path>) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        let store = Self {
            conn: Mutex::new(conn),
        };
        store.migrate()?;
        Ok(store)
    }

    #[cfg(test)]
    pub fn in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        let store = Self {
            conn: Mutex::new(conn),
        };
        store.migrate()?;
        Ok(store)
    }

    fn migrate(&self) -> AppResult<()> {
        let conn = self.lock()?;
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                default_agent TEXT,
                settings_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                agent_id TEXT NOT NULL,
                title TEXT NOT NULL,
                state TEXT NOT NULL,
                started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                ended_at TEXT,
                exit_code INTEGER
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                kind TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );

            CREATE TABLE IF NOT EXISTS agent_config (
                agent_id TEXT PRIMARY KEY,
                binary_path TEXT,
                default_model TEXT,
                extra_args_json TEXT NOT NULL DEFAULT '[]',
                extra_env_json TEXT NOT NULL DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            "#,
        )?;
        Ok(())
    }

    pub fn create_project(&self, new_project: NewProject) -> AppResult<Project> {
        if !new_project.path.is_dir() {
            return Err(AppError::InvalidInput(format!(
                "project path is not a directory: {}",
                new_project.path.display()
            )));
        }

        let id = Uuid::new_v4().to_string();
        let default_agent = new_project.default_agent.map(|agent| agent.to_string());
        let path = new_project.path.display().to_string();
        let conn = self.lock()?;

        conn.execute(
            "INSERT INTO projects (id, name, path, default_agent, settings_json) VALUES (?1, ?2, ?3, ?4, '{}')",
            params![id, new_project.name, path, default_agent],
        )?;

        drop(conn);
        self.get_project(&id)?
            .ok_or_else(|| AppError::Storage("created project could not be loaded".to_string()))
    }

    pub fn list_projects(&self) -> AppResult<Vec<Project>> {
        let conn = self.lock()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, path, default_agent, settings_json, created_at FROM projects ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map([], project_from_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn get_project(&self, id: &str) -> AppResult<Option<Project>> {
        let conn = self.lock()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, path, default_agent, settings_json, created_at FROM projects WHERE id = ?1",
        )?;
        let mut rows = stmt.query(params![id])?;
        rows.next()?
            .map(project_from_row)
            .transpose()
            .map_err(AppError::from)
    }

    pub fn set_agent_config(&self, config: AgentConfig) -> AppResult<()> {
        let conn = self.lock()?;
        conn.execute(
            r#"
            INSERT INTO agent_config (agent_id, binary_path, default_model, extra_args_json, extra_env_json)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(agent_id) DO UPDATE SET
                binary_path = excluded.binary_path,
                default_model = excluded.default_model,
                extra_args_json = excluded.extra_args_json,
                extra_env_json = excluded.extra_env_json
            "#,
            params![
                config.agent_id.to_string(),
                config.binary_path.map(|path| path.display().to_string()),
                config.default_model,
                config.extra_args_json,
                config.extra_env_json
            ],
        )?;
        Ok(())
    }

    pub fn get_agent_config(&self, agent_id: AgentId) -> AppResult<Option<AgentConfig>> {
        let conn = self.lock()?;
        let mut stmt = conn.prepare(
            "SELECT agent_id, binary_path, default_model, extra_args_json, extra_env_json FROM agent_config WHERE agent_id = ?1",
        )?;
        let mut rows = stmt.query(params![agent_id.to_string()])?;
        rows.next()?
            .map(agent_config_from_row)
            .transpose()
            .map_err(AppError::from)
    }

    pub fn append_message(
        &self,
        session_id: &str,
        role: MessageRole,
        kind: &str,
        content: &str,
    ) -> AppResult<Message> {
        let id = Uuid::new_v4().to_string();
        let conn = self.lock()?;
        conn.execute(
            "INSERT INTO messages (id, session_id, role, kind, content) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, session_id, role.to_string(), kind, content],
        )?;
        drop(conn);
        self.get_message(&id)?
            .ok_or_else(|| AppError::Storage("created message could not be loaded".to_string()))
    }

    pub fn list_messages(&self, session_id: &str) -> AppResult<Vec<Message>> {
        let conn = self.lock()?;
        let mut stmt = conn.prepare(
            "SELECT id, session_id, role, kind, content, created_at FROM messages WHERE session_id = ?1 ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map(params![session_id], message_from_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    fn get_message(&self, id: &str) -> AppResult<Option<Message>> {
        let conn = self.lock()?;
        let mut stmt = conn.prepare(
            "SELECT id, session_id, role, kind, content, created_at FROM messages WHERE id = ?1",
        )?;
        let mut rows = stmt.query(params![id])?;
        rows.next()?
            .map(message_from_row)
            .transpose()
            .map_err(AppError::from)
    }

    fn lock(&self) -> AppResult<std::sync::MutexGuard<'_, Connection>> {
        self.conn
            .lock()
            .map_err(|_| AppError::Storage("database lock poisoned".to_string()))
    }
}

fn project_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Project> {
    let default_agent: Option<String> = row.get(3)?;
    Ok(Project {
        id: row.get(0)?,
        name: row.get(1)?,
        path: PathBuf::from(row.get::<_, String>(2)?),
        default_agent: default_agent
            .as_deref()
            .map(AgentId::from_str)
            .transpose()
            .map_err(|err| {
                rusqlite::Error::FromSqlConversionFailure(3, Type::Text, Box::new(err))
            })?,
        settings_json: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn agent_config_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<AgentConfig> {
    let agent_id = AgentId::from_str(&row.get::<_, String>(0)?)
        .map_err(|err| rusqlite::Error::FromSqlConversionFailure(0, Type::Text, Box::new(err)))?;
    let binary_path: Option<String> = row.get(1)?;

    Ok(AgentConfig {
        agent_id,
        binary_path: binary_path.map(PathBuf::from),
        default_model: row.get(2)?,
        extra_args_json: row.get(3)?,
        extra_env_json: row.get(4)?,
    })
}

fn message_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Message> {
    let role = MessageRole::from_str(&row.get::<_, String>(2)?)
        .map_err(|err| rusqlite::Error::FromSqlConversionFailure(2, Type::Text, Box::new(err)))?;

    Ok(Message {
        id: row.get(0)?,
        session_id: row.get(1)?,
        role,
        kind: row.get(3)?,
        content: row.get(4)?,
        created_at: row.get(5)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_and_lists_project() {
        let store = ConfigStore::in_memory().expect("store");
        let project = store
            .create_project(NewProject {
                name: "Code Buddy".to_string(),
                path: std::env::current_dir().expect("cwd"),
                default_agent: Some(AgentId::Codex),
            })
            .expect("project created");

        let projects = store.list_projects().expect("projects");

        assert_eq!(projects, vec![project]);
        assert_eq!(projects[0].default_agent, Some(AgentId::Codex));
    }

    #[test]
    fn rejects_missing_project_directory() {
        let store = ConfigStore::in_memory().expect("store");
        let err = store
            .create_project(NewProject {
                name: "Missing".to_string(),
                path: PathBuf::from("/definitely/missing/code-buddy"),
                default_agent: None,
            })
            .expect_err("missing path rejected");

        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn upserts_agent_config_without_secrets() {
        let store = ConfigStore::in_memory().expect("store");
        store
            .set_agent_config(AgentConfig {
                agent_id: AgentId::Kimi,
                binary_path: Some(PathBuf::from("/usr/bin/kimi")),
                default_model: Some("kimi-k2".to_string()),
                extra_args_json: "[\"--plan\"]".to_string(),
                extra_env_json: "{\"SAFE\":\"true\"}".to_string(),
            })
            .expect("set config");

        let config = store
            .get_agent_config(AgentId::Kimi)
            .expect("load config")
            .expect("config exists");

        assert_eq!(config.binary_path, Some(PathBuf::from("/usr/bin/kimi")));
        assert!(!config.extra_env_json.contains("secret"));
    }

    #[test]
    fn appends_and_lists_messages() {
        let store = ConfigStore::in_memory().expect("store");
        let message = store
            .append_message("session-1", MessageRole::User, "prompt", "hello")
            .expect("message");

        let messages = store.list_messages("session-1").expect("messages");

        assert_eq!(messages, vec![message]);
        assert!(store.list_messages("other").expect("empty").is_empty());
    }
}
