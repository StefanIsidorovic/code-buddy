use crate::{
    domain::{
        AgentEvent, AgentId, AgentInfo, AgentsFileDelivery, Capabilities, CommandSpec, Detection,
        InputDelivery, RunMode, SessionConfig,
    },
    errors::{AppError, AppResult},
};
use std::{path::PathBuf, process::Command, sync::Arc};

mod claude;
mod codex;
#[cfg(test)]
mod fake;
mod kimi;
mod structured;

#[cfg(test)]
pub use fake::FakeAdapter;

pub trait AgentAdapter: Send + Sync {
    fn id(&self) -> AgentId;
    fn display_name(&self) -> &'static str;
    fn detect(&self) -> Detection;
    fn capabilities(&self) -> Capabilities;
    fn build_command(&self, cfg: &SessionConfig, mode: RunMode) -> AppResult<CommandSpec>;
    fn encode_input(&self, text: &str, mode: RunMode) -> InputDelivery;
    fn agents_file_delivery(&self) -> AgentsFileDelivery;
    fn create_parser(&self) -> Box<dyn AgentOutputParser> {
        Box::new(RawOutputParser)
    }

    fn parse_chunk(&self, chunk: &[u8]) -> Vec<AgentEvent> {
        let mut parser = self.create_parser();
        parser.parse_chunk(chunk)
    }
}

pub trait AgentOutputParser: Send {
    fn parse_chunk(&mut self, chunk: &[u8]) -> Vec<AgentEvent>;

    fn flush(&mut self) -> Vec<AgentEvent> {
        Vec::new()
    }
}

struct RawOutputParser;

impl AgentOutputParser for RawOutputParser {
    fn parse_chunk(&mut self, chunk: &[u8]) -> Vec<AgentEvent> {
        vec![AgentEvent::RawOutput {
            bytes: chunk.to_vec(),
        }]
    }
}

#[derive(Clone)]
pub struct AdapterRegistry {
    adapters: Arc<Vec<Arc<dyn AgentAdapter>>>,
}

impl AdapterRegistry {
    pub fn production() -> Self {
        Self {
            adapters: Arc::new(vec![
                Arc::new(codex::CodexAdapter),
                Arc::new(claude::ClaudeAdapter),
                Arc::new(kimi::KimiAdapter),
            ]),
        }
    }

    #[cfg(test)]
    pub fn with_fake() -> Self {
        Self {
            adapters: Arc::new(vec![Arc::new(FakeAdapter)]),
        }
    }

    pub fn list(&self) -> Vec<AgentInfo> {
        self.adapters
            .iter()
            .map(|adapter| AgentInfo {
                id: adapter.id(),
                display_name: adapter.display_name().to_string(),
                detection: adapter.detect(),
                capabilities: adapter.capabilities(),
            })
            .collect()
    }

    pub fn get(&self, agent_id: AgentId) -> AppResult<Arc<dyn AgentAdapter>> {
        self.adapters
            .iter()
            .find(|adapter| adapter.id() == agent_id)
            .cloned()
            .ok_or_else(|| AppError::AdapterNotFound(agent_id.to_string()))
    }
}

fn detect_binary(binary: &str, version_args: &[&str]) -> Detection {
    let binary_path = which::which(binary).ok();
    let version = binary_path
        .as_ref()
        .and_then(|path| command_version(path, version_args));

    Detection {
        installed: binary_path.is_some(),
        binary_path,
        version,
    }
}

fn command_version(program: &PathBuf, args: &[&str]) -> Option<String> {
    let output = Command::new(program).args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn resolve_program(binary: &str, override_path: Option<&PathBuf>) -> AppResult<PathBuf> {
    if let Some(path) = override_path {
        return Ok(path.clone());
    }

    which::which(binary).map_err(|_| AppError::InvalidInput(format!("{binary} CLI not found")))
}

fn base_command(program: PathBuf, cfg: &SessionConfig) -> CommandSpec {
    CommandSpec {
        program,
        args: Vec::new(),
        env: cfg.extra_env.clone(),
        cwd: cfg.cwd.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::AgentsFileDelivery;

    #[test]
    fn registry_returns_fake_adapter() {
        let registry = AdapterRegistry::with_fake();
        let adapter = registry.get(AgentId::Fake).expect("fake adapter exists");
        assert_eq!(adapter.display_name(), "Fake Agent");
    }

    #[test]
    fn registry_errors_for_missing_adapter() {
        let registry = AdapterRegistry::with_fake();
        let result = registry.get(AgentId::Codex);
        assert!(matches!(result, Err(AppError::AdapterNotFound(_))));
    }

    #[test]
    fn production_adapters_expose_agents_file_delivery_strategy() {
        let registry = AdapterRegistry::production();

        assert_eq!(
            registry
                .get(AgentId::Codex)
                .expect("codex adapter")
                .agents_file_delivery(),
            AgentsFileDelivery::Native
        );
        assert_eq!(
            registry
                .get(AgentId::ClaudeCode)
                .expect("claude adapter")
                .agents_file_delivery(),
            AgentsFileDelivery::Native
        );
        assert_eq!(
            registry
                .get(AgentId::Kimi)
                .expect("kimi adapter")
                .agents_file_delivery(),
            AgentsFileDelivery::PrependToPrompt
        );
    }
}
