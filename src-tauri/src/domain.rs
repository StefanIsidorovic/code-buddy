use crate::errors::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fmt::{Display, Formatter},
    path::PathBuf,
    str::FromStr,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentId {
    Codex,
    Kimi,
    ClaudeCode,
    Fake,
}

impl AgentId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Codex => "codex",
            Self::Kimi => "kimi",
            Self::ClaudeCode => "claude-code",
            Self::Fake => "fake",
        }
    }
}

impl Display for AgentId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for AgentId {
    type Err = AppError;

    fn from_str(value: &str) -> AppResult<Self> {
        match value {
            "codex" => Ok(Self::Codex),
            "kimi" => Ok(Self::Kimi),
            "claude-code" | "claude" => Ok(Self::ClaudeCode),
            "fake" => Ok(Self::Fake),
            other => Err(AppError::InvalidAgent(other.to_string())),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunMode {
    Interactive,
    Headless,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionState {
    Idle,
    Starting,
    Running,
    WaitingForInput,
    Busy,
    Exited { code: Option<i32> },
    Killed,
    Errored { message: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Detection {
    pub installed: bool,
    pub binary_path: Option<PathBuf>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Capabilities {
    pub interactive: bool,
    pub headless: bool,
    pub structured_events: bool,
    pub resume_session: bool,
    pub selectable_model: bool,
    pub streaming: bool,
    pub reads_agents_md_natively: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CommandSpec {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub cwd: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SessionConfig {
    pub project_id: Option<String>,
    pub cwd: PathBuf,
    pub binary_path: Option<PathBuf>,
    pub model: Option<String>,
    pub prompt: Option<String>,
    pub extra_args: Vec<String>,
    pub extra_env: HashMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum InputDelivery {
    PtyBytes(Vec<u8>),
    StdinText(String),
    HeadlessPromptArg(String),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentEvent {
    SessionStarted {
        agent_session_id: Option<String>,
    },
    UserMessage {
        text: String,
    },
    AssistantDelta {
        text: String,
    },
    AssistantMessage {
        text: String,
    },
    ToolCall {
        name: String,
        input: serde_json::Value,
    },
    ToolResult {
        name: String,
        output: String,
        is_error: bool,
    },
    Notice {
        level: NoticeLevel,
        text: String,
    },
    Completed {
        exit_code: Option<i32>,
    },
    RawOutput {
        bytes: Vec<u8>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NoticeLevel {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: AgentId,
    pub display_name: String,
    pub detection: Detection,
    pub capabilities: Capabilities,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub default_agent: Option<AgentId>,
    pub settings_json: String,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewProject {
    pub name: String,
    pub path: PathBuf,
    pub default_agent: Option<AgentId>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentConfig {
    pub agent_id: AgentId,
    pub binary_path: Option<PathBuf>,
    pub default_model: Option<String>,
    pub extra_args_json: String,
    pub extra_env_json: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub session_id: String,
    pub role: MessageRole,
    pub kind: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageRole {
    User,
    Assistant,
    Tool,
    System,
}

impl Display for MessageRole {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let value = match self {
            Self::User => "user",
            Self::Assistant => "assistant",
            Self::Tool => "tool",
            Self::System => "system",
        };
        f.write_str(value)
    }
}

impl FromStr for MessageRole {
    type Err = AppError;

    fn from_str(value: &str) -> AppResult<Self> {
        match value {
            "user" => Ok(Self::User),
            "assistant" => Ok(Self::Assistant),
            "tool" => Ok(Self::Tool),
            "system" => Ok(Self::System),
            other => Err(AppError::InvalidInput(format!(
                "unknown message role: {other}"
            ))),
        }
    }
}
