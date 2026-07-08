use serde::Serialize;
use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "code", content = "message", rename_all = "snake_case")]
pub enum AppError {
    #[error("acp error: {0}")]
    Acp(String),
    #[error("adapter not found: {0}")]
    AdapterNotFound(String),
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("io error: {0}")]
    Io(String),
    #[error("pty error: {0}")]
    Pty(String),
    #[error("session not found: {0}")]
    SessionNotFound(String),
    #[error("session error: {0}")]
    Session(String),
}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value.to_string())
    }
}
