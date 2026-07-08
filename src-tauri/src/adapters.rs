use crate::errors::{AppError, AppResult};
use portable_pty::CommandBuilder;
use serde::Serialize;
use std::path::{Path, PathBuf};

pub const CODEX_ADAPTER_ID: &str = "codex";
pub const CLAUDE_CODE_ADAPTER_ID: &str = "claude_code";
pub const KIMI_ADAPTER_ID: &str = "kimi";

static CODEX_ADAPTER: CodexAdapter = CodexAdapter;
static CLAUDE_CODE_ADAPTER: ClaudeCodeAdapter = ClaudeCodeAdapter;
static KIMI_ADAPTER: KimiAdapter = KimiAdapter;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityStatus {
    Supported,
    Unsupported,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentCapabilities {
    pub interactive_pty: CapabilityStatus,
    pub headless: CapabilityStatus,
    pub structured_output: CapabilityStatus,
    pub native_agents_md: CapabilityStatus,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentsMdDelivery {
    Native,
    PromptPrefix,
    Unsupported,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentAdapterDescriptor {
    pub id: &'static str,
    pub display_name: &'static str,
    pub executable: &'static str,
    pub capabilities: AgentCapabilities,
    pub agents_md_delivery: AgentsMdDelivery,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentDetection {
    pub adapter_id: &'static str,
    pub executable: &'static str,
    pub path: Option<PathBuf>,
    pub available: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentCommandRequest {
    pub executable_path: PathBuf,
    pub cwd: PathBuf,
    pub model: Option<String>,
    pub extra_args: Vec<String>,
}

impl AgentCommandRequest {
    pub fn new(executable_path: PathBuf, cwd: PathBuf) -> Self {
        Self {
            executable_path,
            cwd,
            model: None,
            extra_args: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentCommand {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub cwd: PathBuf,
}

impl AgentCommand {
    pub fn into_command_builder(self) -> CommandBuilder {
        let mut command = CommandBuilder::new(self.program);
        for arg in self.args {
            command.arg(arg);
        }
        command.cwd(self.cwd);
        command
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentInput<'a> {
    Raw(&'a str),
    Prompt(&'a str),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StructuredParseResult {
    Unsupported,
    Events(Vec<StructuredEvent>),
    Malformed(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StructuredEvent {
    pub kind: StructuredEventKind,
    pub content: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StructuredEventKind {
    Assistant,
    ToolCall,
    ToolResult,
    Notice,
    Error,
    Completion,
}

pub trait BinaryResolver {
    fn resolve(&self, executable: &str) -> Option<PathBuf>;
}

pub struct SystemBinaryResolver;

impl BinaryResolver for SystemBinaryResolver {
    fn resolve(&self, executable: &str) -> Option<PathBuf> {
        which::which(executable).ok()
    }
}

pub trait AgentAdapter: Send + Sync {
    fn id(&self) -> &'static str;
    fn display_name(&self) -> &'static str;
    fn executable(&self) -> &'static str;
    fn capabilities(&self) -> AgentCapabilities;
    fn agents_md_delivery(&self) -> AgentsMdDelivery;
    fn build_command(&self, request: &AgentCommandRequest) -> AppResult<AgentCommand>;

    fn descriptor(&self) -> AgentAdapterDescriptor {
        AgentAdapterDescriptor {
            id: self.id(),
            display_name: self.display_name(),
            executable: self.executable(),
            capabilities: self.capabilities(),
            agents_md_delivery: self.agents_md_delivery(),
        }
    }

    fn detect(&self, resolver: &dyn BinaryResolver) -> AgentDetection {
        let path = resolver.resolve(self.executable());
        AgentDetection {
            adapter_id: self.id(),
            executable: self.executable(),
            available: path.is_some(),
            path,
        }
    }

    fn encode_input(&self, input: AgentInput<'_>) -> Vec<u8> {
        match input {
            AgentInput::Raw(text) => text.as_bytes().to_vec(),
            AgentInput::Prompt(text) => {
                let mut bytes = text.as_bytes().to_vec();
                bytes.push(b'\n');
                bytes
            }
        }
    }

    fn parse_structured_chunk(&self, _bytes: &[u8]) -> StructuredParseResult {
        StructuredParseResult::Unsupported
    }
}

pub struct AgentRegistry {
    adapters: Vec<&'static dyn AgentAdapter>,
}

impl Default for AgentRegistry {
    fn default() -> Self {
        Self::builtin()
    }
}

impl AgentRegistry {
    pub fn builtin() -> Self {
        Self::with_adapters(vec![&CODEX_ADAPTER, &CLAUDE_CODE_ADAPTER, &KIMI_ADAPTER])
    }

    pub fn with_adapters(adapters: Vec<&'static dyn AgentAdapter>) -> Self {
        Self { adapters }
    }

    pub fn list(&self) -> Vec<AgentAdapterDescriptor> {
        self.adapters
            .iter()
            .map(|adapter| adapter.descriptor())
            .collect()
    }

    pub fn resolve(&self, id: &str) -> AppResult<&dyn AgentAdapter> {
        self.adapters
            .iter()
            .copied()
            .find(|adapter| adapter.id() == id)
            .ok_or_else(|| AppError::AdapterNotFound(id.to_string()))
    }
}

#[derive(Debug)]
pub struct CodexAdapter;

impl AgentAdapter for CodexAdapter {
    fn id(&self) -> &'static str {
        CODEX_ADAPTER_ID
    }

    fn display_name(&self) -> &'static str {
        "Codex"
    }

    fn executable(&self) -> &'static str {
        "codex"
    }

    fn capabilities(&self) -> AgentCapabilities {
        AgentCapabilities {
            interactive_pty: CapabilityStatus::Supported,
            headless: CapabilityStatus::Unknown,
            structured_output: CapabilityStatus::Unknown,
            native_agents_md: CapabilityStatus::Unknown,
        }
    }

    fn agents_md_delivery(&self) -> AgentsMdDelivery {
        AgentsMdDelivery::Unknown
    }

    fn build_command(&self, request: &AgentCommandRequest) -> AppResult<AgentCommand> {
        let mut args = vec![
            "--no-alt-screen".to_string(),
            "--cd".to_string(),
            path_arg(&request.cwd),
        ];
        args.extend(request.extra_args.clone());

        Ok(AgentCommand {
            program: request.executable_path.clone(),
            args,
            cwd: request.cwd.clone(),
        })
    }
}

#[derive(Debug)]
pub struct ClaudeCodeAdapter;

impl AgentAdapter for ClaudeCodeAdapter {
    fn id(&self) -> &'static str {
        CLAUDE_CODE_ADAPTER_ID
    }

    fn display_name(&self) -> &'static str {
        "Claude Code"
    }

    fn executable(&self) -> &'static str {
        "claude"
    }

    fn capabilities(&self) -> AgentCapabilities {
        AgentCapabilities {
            interactive_pty: CapabilityStatus::Unknown,
            headless: CapabilityStatus::Unknown,
            structured_output: CapabilityStatus::Unknown,
            native_agents_md: CapabilityStatus::Unknown,
        }
    }

    fn agents_md_delivery(&self) -> AgentsMdDelivery {
        AgentsMdDelivery::Unknown
    }

    fn build_command(&self, request: &AgentCommandRequest) -> AppResult<AgentCommand> {
        Ok(generic_command(request))
    }
}

#[derive(Debug)]
pub struct KimiAdapter;

impl AgentAdapter for KimiAdapter {
    fn id(&self) -> &'static str {
        KIMI_ADAPTER_ID
    }

    fn display_name(&self) -> &'static str {
        "Kimi"
    }

    fn executable(&self) -> &'static str {
        "kimi"
    }

    fn capabilities(&self) -> AgentCapabilities {
        AgentCapabilities {
            interactive_pty: CapabilityStatus::Unknown,
            headless: CapabilityStatus::Unknown,
            structured_output: CapabilityStatus::Unknown,
            native_agents_md: CapabilityStatus::Unsupported,
        }
    }

    fn agents_md_delivery(&self) -> AgentsMdDelivery {
        AgentsMdDelivery::PromptPrefix
    }

    fn build_command(&self, request: &AgentCommandRequest) -> AppResult<AgentCommand> {
        Ok(generic_command(request))
    }
}

fn generic_command(request: &AgentCommandRequest) -> AgentCommand {
    AgentCommand {
        program: request.executable_path.clone(),
        args: request.extra_args.clone(),
        cwd: request.cwd.clone(),
    }
}

fn path_arg(path: &Path) -> String {
    path.display().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    static FAKE_ADAPTER: FakeAdapter = FakeAdapter;

    struct FakeAdapter;

    impl AgentAdapter for FakeAdapter {
        fn id(&self) -> &'static str {
            "fake"
        }

        fn display_name(&self) -> &'static str {
            "Fake"
        }

        fn executable(&self) -> &'static str {
            "fake-cli"
        }

        fn capabilities(&self) -> AgentCapabilities {
            AgentCapabilities {
                interactive_pty: CapabilityStatus::Supported,
                headless: CapabilityStatus::Unsupported,
                structured_output: CapabilityStatus::Unknown,
                native_agents_md: CapabilityStatus::Unsupported,
            }
        }

        fn agents_md_delivery(&self) -> AgentsMdDelivery {
            AgentsMdDelivery::Unsupported
        }

        fn build_command(&self, request: &AgentCommandRequest) -> AppResult<AgentCommand> {
            Ok(generic_command(request))
        }
    }

    #[derive(Default)]
    struct FakeResolver {
        paths: HashMap<String, PathBuf>,
    }

    impl FakeResolver {
        fn with_path(mut self, executable: &str, path: PathBuf) -> Self {
            self.paths.insert(executable.to_string(), path);
            self
        }
    }

    impl BinaryResolver for FakeResolver {
        fn resolve(&self, executable: &str) -> Option<PathBuf> {
            self.paths.get(executable).cloned()
        }
    }

    #[test]
    fn builtin_registry_lists_and_resolves_adapters() {
        let registry = AgentRegistry::builtin();
        let adapters = registry.list();
        let ids = adapters
            .iter()
            .map(|adapter| adapter.id)
            .collect::<Vec<_>>();

        assert_eq!(ids, vec!["codex", "claude_code", "kimi"]);
        assert_eq!(
            registry.resolve("codex").expect("codex adapter").display_name(),
            "Codex"
        );
    }

    #[test]
    fn default_registry_uses_builtin_adapters() {
        let registry = AgentRegistry::default();

        assert!(registry.resolve("codex").is_ok());
        assert!(registry.resolve("claude_code").is_ok());
        assert!(registry.resolve("kimi").is_ok());
    }

    #[test]
    fn registry_returns_error_for_missing_adapter() {
        let registry = AgentRegistry::builtin();
        let err = match registry.resolve("missing") {
            Ok(_) => panic!("missing adapter should fail"),
            Err(err) => err,
        };

        assert!(matches!(err, AppError::AdapterNotFound(id) if id == "missing"));
    }

    #[test]
    fn detection_reports_available_and_missing_binaries() {
        let registry = AgentRegistry::with_adapters(vec![&FAKE_ADAPTER]);
        let adapter = registry.resolve("fake").expect("fake adapter");
        let resolver = FakeResolver::default().with_path("fake-cli", PathBuf::from("/bin/fake"));

        let available = adapter.detect(&resolver);
        assert!(available.available);
        assert_eq!(available.path, Some(PathBuf::from("/bin/fake")));

        let missing = adapter.detect(&FakeResolver::default());
        assert!(!missing.available);
        assert_eq!(missing.path, None);
    }

    #[test]
    fn codex_adapter_builds_current_smoke_test_command() {
        let adapter = CodexAdapter;
        let request = AgentCommandRequest::new(
            PathBuf::from("/usr/bin/codex"),
            PathBuf::from("/tmp/project"),
        );

        let command = adapter.build_command(&request).expect("command");

        assert_eq!(command.program, PathBuf::from("/usr/bin/codex"));
        assert_eq!(
            command.args,
            vec!["--no-alt-screen", "--cd", "/tmp/project"]
        );
        assert_eq!(command.cwd, PathBuf::from("/tmp/project"));
    }

    #[test]
    fn adapter_encodes_raw_and_prompt_input() {
        let adapter = FakeAdapter;

        assert_eq!(adapter.encode_input(AgentInput::Raw("abc\r")), b"abc\r");
        assert_eq!(adapter.encode_input(AgentInput::Prompt("abc")), b"abc\n");
    }

    #[test]
    fn adapter_descriptor_preserves_capability_edge_cases() {
        let descriptor = FAKE_ADAPTER.descriptor();

        assert_eq!(
            descriptor.capabilities.interactive_pty,
            CapabilityStatus::Supported
        );
        assert_eq!(descriptor.capabilities.headless, CapabilityStatus::Unsupported);
        assert_eq!(
            descriptor.capabilities.structured_output,
            CapabilityStatus::Unknown
        );
        assert_eq!(descriptor.agents_md_delivery, AgentsMdDelivery::Unsupported);
        assert_eq!(
            FAKE_ADAPTER.parse_structured_chunk(b"{}"),
            StructuredParseResult::Unsupported
        );
    }
}
