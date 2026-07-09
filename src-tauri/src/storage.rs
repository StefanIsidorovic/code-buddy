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
                "#,
            )
            .map_err(storage_error)
    }

    fn connection(&self) -> AppResult<MutexGuard<'_, Connection>> {
        self.connection
            .lock()
            .map_err(|_| AppError::Storage("project store lock poisoned".to_string()))
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
}
