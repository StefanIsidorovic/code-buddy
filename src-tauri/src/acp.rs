pub use crate::acp_workspace::AcpWorkspaceIsolation;
use crate::{
    acp_workspace::{AcpLaunchContext, IsolatedAcpWorkspace},
    errors::{AppError, AppResult},
    session::SessionState,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, VecDeque},
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Condvar, Mutex, MutexGuard,
    },
    thread,
    time::{Duration, Instant},
};
use uuid::Uuid;

const ACP_CONTROL_REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const ACP_PROMPT_REQUEST_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const ACP_STOP_TIMEOUT: Duration = Duration::from_millis(750);
const ACP_WAIT_POLL_INTERVAL: Duration = Duration::from_millis(25);
const ACP_RESPONSE_POLL_INTERVAL: Duration = Duration::from_millis(250);
const ACP_EVENT_BUFFER_LIMIT: usize = 512;
const ACP_STDERR_TAIL_LIMIT: usize = 4_096;
const ACP_STDERR_CLOSE_WAIT: Duration = Duration::from_millis(100);
const ACP_PROTOCOL_VERSION: u64 = 1;

pub type AcpSessionId = String;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartFakeAcpSessionRequest {
    pub cwd: Option<PathBuf>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartAcpRegistrySessionRequest {
    pub candidate_id: String,
    pub cwd: Option<PathBuf>,
    pub workspace_isolation: Option<AcpWorkspaceIsolation>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadAcpRegistrySessionRequest {
    pub candidate_id: String,
    pub agent_session_id: String,
    pub cwd: Option<PathBuf>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetAcpModelRequest {
    pub session_id: AcpSessionId,
    pub model_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpModelOption {
    pub value: String,
    pub name: String,
    pub description: Option<String>,
    pub available: Option<bool>,
    pub unavailable_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpModelState {
    pub current_value: String,
    pub options: Vec<AcpModelOption>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpSessionInfo {
    pub id: AcpSessionId,
    pub state: SessionState,
    pub pid: Option<u32>,
    pub cwd: PathBuf,
    pub protocol_version: Option<u64>,
    pub agent_session_id: Option<String>,
    pub agent_name: Option<String>,
    pub agent_version: Option<String>,
    pub exit_code: Option<u32>,
    pub coding_model: Option<AcpModelState>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AcpEventKind {
    AgentMessage,
    UserMessage,
    Plan,
    ToolCall,
    Usage,
    Notice,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpSessionEvent {
    pub kind: AcpEventKind,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpPromptResult {
    pub session_id: AcpSessionId,
    pub stop_reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpPermissionOption {
    pub option_id: String,
    pub name: String,
    pub kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpPermissionRequest {
    pub id: String,
    pub title: String,
    pub options: Vec<AcpPermissionOption>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RespondAcpPermissionRequest {
    pub session_id: String,
    pub permission_id: String,
    pub option_id: String,
}

#[derive(Debug, Clone)]
struct PendingPermission {
    info: AcpPermissionRequest,
    rpc_id: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AcpRegistryCandidateStatus {
    Ready,
    Installable,
    MissingRunner,
    MissingBinary,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AcpRegistryDistributionKind {
    Npx,
    Binary,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpRegistryCandidate {
    pub id: &'static str,
    pub name: &'static str,
    pub version: &'static str,
    pub description: &'static str,
    pub distribution: AcpRegistryDistributionKind,
    pub status: AcpRegistryCandidateStatus,
    pub command: Vec<String>,
    pub runner_path: Option<PathBuf>,
    pub install_hint: String,
    pub source_url: &'static str,
}

trait AcpCommandResolver {
    fn resolve(&self, executable: &str) -> Option<PathBuf>;
}

struct SystemAcpCommandResolver;

impl AcpCommandResolver for SystemAcpCommandResolver {
    fn resolve(&self, executable: &str) -> Option<PathBuf> {
        which::which(executable).ok()
    }
}

#[derive(Debug, Clone, Copy)]
struct AcpRegistrySpec {
    id: &'static str,
    name: &'static str,
    version: &'static str,
    description: &'static str,
    source_url: &'static str,
    distribution: AcpRegistryDistribution,
}

#[derive(Debug, Clone, Copy)]
enum AcpRegistryDistribution {
    Npx {
        package: &'static str,
        args: &'static [&'static str],
    },
    Binary {
        executable: &'static str,
        args: &'static [&'static str],
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct AcpRegistryLaunchCommand {
    program: String,
    args: Vec<String>,
    distribution: AcpRegistryDistributionKind,
}

pub fn list_acp_registry_candidates() -> Vec<AcpRegistryCandidate> {
    acp_registry_candidates_with_resolver(&SystemAcpCommandResolver)
}

fn acp_registry_launch_command(
    candidate_id: &str,
    resolver: &dyn AcpCommandResolver,
) -> AppResult<AcpRegistryLaunchCommand> {
    let spec = ACP_REGISTRY_SPECS
        .iter()
        .find(|spec| spec.id == candidate_id)
        .ok_or_else(|| AppError::InvalidInput(format!("unknown ACP candidate: {candidate_id}")))?;

    spec.build_launch_command(resolver)
}

fn acp_registry_candidates_with_resolver(
    resolver: &dyn AcpCommandResolver,
) -> Vec<AcpRegistryCandidate> {
    ACP_REGISTRY_SPECS
        .iter()
        .map(|spec| spec.build_candidate(resolver))
        .collect()
}

impl AcpRegistrySpec {
    fn build_candidate(&self, resolver: &dyn AcpCommandResolver) -> AcpRegistryCandidate {
        match self.distribution {
            AcpRegistryDistribution::Npx { package, args } => {
                let runner_path = resolver.resolve("npx");
                let status = if runner_path.is_some() {
                    AcpRegistryCandidateStatus::Installable
                } else {
                    AcpRegistryCandidateStatus::MissingRunner
                };
                let mut command = vec!["npx".to_string(), "-y".to_string(), package.to_string()];
                command.extend(args.iter().map(|arg| (*arg).to_string()));

                AcpRegistryCandidate {
                    id: self.id,
                    name: self.name,
                    version: self.version,
                    description: self.description,
                    distribution: AcpRegistryDistributionKind::Npx,
                    status,
                    command,
                    runner_path,
                    install_hint: if status == AcpRegistryCandidateStatus::Installable {
                        "Available through npx; first launch may download the ACP package."
                            .to_string()
                    } else {
                        "Install Node/npm so `npx` is available on PATH.".to_string()
                    },
                    source_url: self.source_url,
                }
            }
            AcpRegistryDistribution::Binary { executable, args } => {
                let runner_path = resolver.resolve(executable);
                let status = if runner_path.is_some() {
                    AcpRegistryCandidateStatus::Ready
                } else {
                    AcpRegistryCandidateStatus::MissingBinary
                };
                let executable_display = runner_path
                    .as_ref()
                    .map(|path| path.display().to_string())
                    .unwrap_or_else(|| executable.to_string());
                let mut command = vec![executable_display];
                command.extend(args.iter().map(|arg| (*arg).to_string()));

                AcpRegistryCandidate {
                    id: self.id,
                    name: self.name,
                    version: self.version,
                    description: self.description,
                    distribution: AcpRegistryDistributionKind::Binary,
                    status,
                    command,
                    runner_path,
                    install_hint: if status == AcpRegistryCandidateStatus::Ready {
                        "Binary is available on PATH and can be launched in ACP mode.".to_string()
                    } else {
                        format!("Install `{executable}` and make sure it is available on PATH.")
                    },
                    source_url: self.source_url,
                }
            }
        }
    }

    fn build_launch_command(
        &self,
        resolver: &dyn AcpCommandResolver,
    ) -> AppResult<AcpRegistryLaunchCommand> {
        match self.distribution {
            AcpRegistryDistribution::Npx { package, args } => {
                let runner_path = resolver.resolve("npx").ok_or_else(|| {
                    AppError::InvalidInput(format!(
                        "ACP candidate {} requires `npx` on PATH",
                        self.id
                    ))
                })?;
                let mut launch_args = vec!["-y".to_string(), package.to_string()];
                launch_args.extend(args.iter().map(|arg| (*arg).to_string()));

                Ok(AcpRegistryLaunchCommand {
                    program: runner_path.display().to_string(),
                    args: launch_args,
                    distribution: AcpRegistryDistributionKind::Npx,
                })
            }
            AcpRegistryDistribution::Binary { executable, args } => {
                let runner_path = resolver.resolve(executable).ok_or_else(|| {
                    AppError::InvalidInput(format!(
                        "ACP candidate {} requires `{executable}` on PATH",
                        self.id
                    ))
                })?;

                Ok(AcpRegistryLaunchCommand {
                    program: runner_path.display().to_string(),
                    args: args.iter().map(|arg| (*arg).to_string()).collect(),
                    distribution: AcpRegistryDistributionKind::Binary,
                })
            }
        }
    }
}

const ACP_REGISTRY_SPECS: &[AcpRegistrySpec] = &[
    AcpRegistrySpec {
        id: "codex-acp",
        name: "Codex",
        version: "1.1.0",
        description: "ACP adapter for OpenAI's coding assistant",
        source_url: "https://github.com/agentclientprotocol/codex-acp",
        distribution: AcpRegistryDistribution::Npx {
            package: "@agentclientprotocol/codex-acp@1.1.0",
            args: &[],
        },
    },
    AcpRegistrySpec {
        id: "claude-acp",
        name: "Claude Agent",
        version: "0.57.0",
        description: "ACP wrapper for Anthropic's Claude",
        source_url: "https://github.com/agentclientprotocol/claude-agent-acp",
        distribution: AcpRegistryDistribution::Npx {
            package: "@agentclientprotocol/claude-agent-acp@0.57.0",
            args: &[],
        },
    },
    AcpRegistrySpec {
        id: "kimi",
        name: "Kimi CLI",
        version: "1.48.0",
        description: "Moonshot AI's coding assistant",
        source_url: "https://github.com/MoonshotAI/kimi-cli",
        distribution: AcpRegistryDistribution::Binary {
            executable: "kimi",
            args: &["acp"],
        },
    },
    AcpRegistrySpec {
        id: "gemini",
        name: "Gemini CLI",
        version: "0.49.0",
        description: "Google's official CLI for Gemini",
        source_url: "https://github.com/google-gemini/gemini-cli",
        distribution: AcpRegistryDistribution::Npx {
            package: "@google/gemini-cli@0.49.0",
            args: &["--acp"],
        },
    },
];

#[derive(Default)]
pub struct AcpSessionManager {
    sessions: Mutex<HashMap<AcpSessionId, Arc<AcpSession>>>,
}

impl AcpSessionManager {
    pub fn start_fake_session(
        &self,
        request: StartFakeAcpSessionRequest,
    ) -> AppResult<AcpSessionInfo> {
        let cwd = resolve_cwd(request.cwd)?;
        let session = Arc::new(AcpSession::spawn_fake(cwd)?);
        let info = session.info()?;

        self.sessions()?.insert(info.id.clone(), session);
        Ok(info)
    }

    #[cfg(test)]
    fn load_fake_session(&self, cwd: PathBuf, agent_session_id: &str) -> AppResult<AcpSessionInfo> {
        let session = Arc::new(AcpSession::spawn_load_fake(cwd, agent_session_id)?);
        let info = session.info()?;
        self.sessions()?.insert(info.id.clone(), session);
        Ok(info)
    }

    pub fn start_registry_session(
        &self,
        request: StartAcpRegistrySessionRequest,
    ) -> AppResult<AcpSessionInfo> {
        let cwd = resolve_cwd(request.cwd)?;
        let session = Arc::new(AcpSession::spawn_registry_candidate(
            &request.candidate_id,
            cwd,
            request.workspace_isolation,
            &SystemAcpCommandResolver,
        )?);
        let info = session.info()?;

        self.sessions()?.insert(info.id.clone(), session);
        Ok(info)
    }

    pub fn load_registry_session(
        &self,
        request: LoadAcpRegistrySessionRequest,
    ) -> AppResult<AcpSessionInfo> {
        let candidate_id = request.candidate_id.trim();
        let agent_session_id = request.agent_session_id.trim();
        if candidate_id.is_empty() || agent_session_id.is_empty() {
            return Err(AppError::InvalidInput(
                "ACP candidate and agent session ids must not be empty".to_string(),
            ));
        }
        let cwd = resolve_cwd(request.cwd)?;
        let session = Arc::new(AcpSession::load_registry_candidate(
            candidate_id,
            agent_session_id,
            cwd,
            &SystemAcpCommandResolver,
        )?);
        let info = session.info()?;
        self.sessions()?.insert(info.id.clone(), session);
        Ok(info)
    }

    pub fn send_prompt(&self, session_id: &str, prompt: &str) -> AppResult<AcpPromptResult> {
        self.session(session_id)?.send_prompt(prompt)
    }

    pub fn set_model(&self, request: SetAcpModelRequest) -> AppResult<AcpSessionInfo> {
        let session = self.session(&request.session_id)?;
        session.set_model(&request.model_id)?;
        session.info()
    }

    pub fn drain_events(&self, session_id: &str) -> AppResult<Vec<AcpSessionEvent>> {
        self.session(session_id)?.drain_events()
    }

    pub fn list_permissions(&self, session_id: &str) -> AppResult<Vec<AcpPermissionRequest>> {
        self.session(session_id)?.list_permissions()
    }

    pub fn respond_permission(&self, request: RespondAcpPermissionRequest) -> AppResult<()> {
        self.session(&request.session_id)?
            .respond_permission(&request.permission_id, &request.option_id)
    }

    pub fn stop_session(&self, session_id: &str, force: bool) -> AppResult<AcpSessionInfo> {
        let session = self.session(session_id)?;
        session.stop(force)?;
        session.info()
    }

    pub fn stop_and_remove_session(
        &self,
        session_id: &str,
        force: bool,
    ) -> AppResult<AcpSessionInfo> {
        let session = self
            .sessions()?
            .remove(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;
        session.stop(force)?;
        session.info()
    }

    pub fn list_sessions(&self) -> AppResult<Vec<AcpSessionInfo>> {
        self.sessions()?
            .values()
            .map(|session| session.info())
            .collect()
    }

    fn session(&self, session_id: &str) -> AppResult<Arc<AcpSession>> {
        self.sessions()?
            .get(session_id)
            .cloned()
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))
    }

    fn sessions(&self) -> AppResult<MutexGuard<'_, HashMap<AcpSessionId, Arc<AcpSession>>>> {
        self.sessions
            .lock()
            .map_err(|_| AppError::Acp("acp session registry lock poisoned".to_string()))
    }
}

impl Drop for AcpSessionManager {
    fn drop(&mut self) {
        if let Ok(sessions) = self.sessions.get_mut() {
            for session in sessions.values() {
                let _ = session.stop(true);
            }
            sessions.clear();
        }
    }
}

struct AcpSession {
    id: AcpSessionId,
    cwd: PathBuf,
    _workspace: Option<IsolatedAcpWorkspace>,
    stdin: Mutex<ChildStdin>,
    child: Mutex<Child>,
    next_request_id: AtomicU64,
    responses: Arc<ResponseQueue>,
    events: Arc<Mutex<VecDeque<AcpSessionEvent>>>,
    permissions: Arc<Mutex<VecDeque<PendingPermission>>>,
    stderr: Arc<StderrCapture>,
    metadata: Mutex<AcpMetadata>,
    state: Mutex<AcpRuntimeState>,
    prompt_in_flight: Mutex<bool>,
}

#[derive(Default)]
struct AcpMetadata {
    protocol_version: Option<u64>,
    agent_session_id: Option<String>,
    agent_name: Option<String>,
    agent_version: Option<String>,
    coding_model: Option<AcpModelState>,
    can_load_session: bool,
}

enum AcpSessionBootstrap<'a> {
    New,
    Load(&'a str),
}

#[derive(Debug, Clone, Copy)]
struct AcpRuntimeState {
    state: SessionState,
    exit_code: Option<u32>,
}

impl AcpRuntimeState {
    fn running() -> Self {
        Self {
            state: SessionState::Running,
            exit_code: None,
        }
    }
}

struct ResponseQueue {
    pending: Mutex<HashMap<u64, JsonRpcResponse>>,
    available: Condvar,
}

#[derive(Default)]
struct StderrCapture {
    state: Mutex<StderrState>,
    finished: Condvar,
}

#[derive(Default)]
struct StderrState {
    tail: String,
    closed: bool,
}

#[derive(Debug, Clone)]
struct JsonRpcResponse {
    result: Option<Value>,
    error: Option<Value>,
}

struct PromptPermit<'a> {
    prompt_in_flight: &'a Mutex<bool>,
}

impl Drop for PromptPermit<'_> {
    fn drop(&mut self) {
        if let Ok(mut in_flight) = self.prompt_in_flight.lock() {
            *in_flight = false;
        }
    }
}

impl AcpSession {
    fn spawn_fake(cwd: PathBuf) -> AppResult<Self> {
        Self::spawn_script(cwd, fake_acp_script())
    }

    fn spawn_registry_candidate(
        candidate_id: &str,
        cwd: PathBuf,
        isolation: Option<AcpWorkspaceIsolation>,
        resolver: &dyn AcpCommandResolver,
    ) -> AppResult<Self> {
        let launch = acp_registry_launch_command(candidate_id, resolver)?;
        let launch_context = AcpLaunchContext::new(launch.distribution, cwd, isolation)?;
        let command = launch_context.command(&launch.program, &launch.args);
        let session_cwd = launch_context.session_cwd();
        Self::spawn_command(
            command,
            session_cwd,
            AcpSessionBootstrap::New,
            launch_context.into_workspace(),
        )
    }

    fn load_registry_candidate(
        candidate_id: &str,
        agent_session_id: &str,
        cwd: PathBuf,
        resolver: &dyn AcpCommandResolver,
    ) -> AppResult<Self> {
        let launch = acp_registry_launch_command(candidate_id, resolver)?;
        let mut command = Command::new(&launch.program);
        command.args(&launch.args);
        command.current_dir(acp_process_cwd(launch.distribution, &cwd));
        Self::spawn_command(
            command,
            cwd,
            AcpSessionBootstrap::Load(agent_session_id),
            None,
        )
    }

    #[cfg(test)]
    fn spawn_malformed_fake(cwd: PathBuf) -> AppResult<Self> {
        Self::spawn_script(cwd, malformed_fake_acp_script())
    }

    #[cfg(test)]
    fn spawn_load_fake(cwd: PathBuf, agent_session_id: &str) -> AppResult<Self> {
        let mut command = fake_acp_command(load_fake_acp_script());
        command.env("EXPECTED_AGENT_SESSION_ID", agent_session_id);
        command.current_dir(&cwd);
        Self::spawn_command(
            command,
            cwd,
            AcpSessionBootstrap::Load(agent_session_id),
            None,
        )
    }

    #[cfg(test)]
    fn spawn_unsupported_load_fake(cwd: PathBuf, agent_session_id: &str) -> AppResult<Self> {
        let mut command = fake_acp_command(fake_acp_script());
        command.current_dir(&cwd);
        Self::spawn_command(
            command,
            cwd,
            AcpSessionBootstrap::Load(agent_session_id),
            None,
        )
    }

    #[cfg(test)]
    fn spawn_prompt_exit_fake(cwd: PathBuf) -> AppResult<Self> {
        Self::spawn_script(cwd, prompt_exit_fake_acp_script())
    }

    #[cfg(test)]
    fn spawn_permission_fake(cwd: PathBuf) -> AppResult<Self> {
        Self::spawn_script(cwd, permission_fake_acp_script())
    }

    #[cfg(test)]
    fn spawn_startup_error_fake(cwd: PathBuf) -> AppResult<Self> {
        Self::spawn_script(cwd, startup_error_fake_acp_script())
    }

    fn spawn_script(cwd: PathBuf, script: &str) -> AppResult<Self> {
        let mut command = fake_acp_command(script);
        command.current_dir(&cwd);
        Self::spawn_command(command, cwd, AcpSessionBootstrap::New, None)
    }

    fn spawn_command(
        mut command: Command,
        cwd: PathBuf,
        bootstrap: AcpSessionBootstrap<'_>,
        workspace: Option<IsolatedAcpWorkspace>,
    ) -> AppResult<Self> {
        let id = Uuid::new_v4().to_string();
        command.stdin(Stdio::piped());
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());

        let mut child = command.spawn()?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| AppError::Acp("acp child stdin unavailable".to_string()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| AppError::Acp("acp child stdout unavailable".to_string()))?;
        let stderr_capture = Arc::new(StderrCapture::default());
        if let Some(stderr) = child.stderr.take() {
            capture_stderr(stderr, Arc::clone(&stderr_capture));
        }

        let responses = Arc::new(ResponseQueue {
            pending: Mutex::new(HashMap::new()),
            available: Condvar::new(),
        });
        let events = Arc::new(Mutex::new(VecDeque::new()));
        let permissions = Arc::new(Mutex::new(VecDeque::new()));

        spawn_stdout_reader(
            stdout,
            Arc::clone(&responses),
            Arc::clone(&events),
            Arc::clone(&permissions),
        );

        let session = Self {
            id,
            cwd: cwd.clone(),
            _workspace: workspace,
            stdin: Mutex::new(stdin),
            child: Mutex::new(child),
            next_request_id: AtomicU64::new(0),
            responses,
            events,
            permissions,
            stderr: stderr_capture,
            metadata: Mutex::new(AcpMetadata::default()),
            state: Mutex::new(AcpRuntimeState::running()),
            prompt_in_flight: Mutex::new(false),
        };

        session.initialize()?;
        match bootstrap {
            AcpSessionBootstrap::New => session.create_agent_session(&cwd)?,
            AcpSessionBootstrap::Load(agent_session_id) => {
                session.load_agent_session(&cwd, agent_session_id)?
            }
        }
        Ok(session)
    }

    fn initialize(&self) -> AppResult<()> {
        let result = self.send_request(
            "initialize",
            json!({
                "protocolVersion": ACP_PROTOCOL_VERSION,
                "clientCapabilities": {},
                "clientInfo": {
                    "name": "aiadne",
                    "title": "AIadne",
                    "version": env!("CARGO_PKG_VERSION")
                }
            }),
        )?;

        let protocol_version = result
            .get("protocolVersion")
            .and_then(Value::as_u64)
            .ok_or_else(|| {
                AppError::Acp("initialize response missing protocolVersion".to_string())
            })?;
        if protocol_version != ACP_PROTOCOL_VERSION {
            return Err(AppError::Acp(format!(
                "unsupported ACP protocol version: {protocol_version}"
            )));
        }

        let mut metadata = self.metadata()?;
        metadata.protocol_version = Some(protocol_version);
        metadata.agent_name = result
            .pointer("/agentInfo/name")
            .and_then(Value::as_str)
            .map(ToString::to_string);
        metadata.agent_version = result
            .pointer("/agentInfo/version")
            .and_then(Value::as_str)
            .map(ToString::to_string);
        metadata.can_load_session = result
            .pointer("/agentCapabilities/loadSession")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        Ok(())
    }

    fn create_agent_session(&self, cwd: &Path) -> AppResult<()> {
        let result = self.send_request(
            "session/new",
            json!({
                "cwd": cwd.to_string_lossy(),
                "mcpServers": []
            }),
        )?;
        let agent_session_id = result
            .get("sessionId")
            .and_then(Value::as_str)
            .ok_or_else(|| AppError::Acp("session/new response missing sessionId".to_string()))?
            .to_string();

        let coding_model = parse_model_state(&result);
        let mut metadata = self.metadata()?;
        metadata.agent_session_id = Some(agent_session_id);
        metadata.coding_model = coding_model;
        Ok(())
    }

    fn load_agent_session(&self, cwd: &Path, agent_session_id: &str) -> AppResult<()> {
        if !self.metadata()?.can_load_session {
            return Err(AppError::Acp(
                "selected ACP agent does not support loading existing sessions".to_string(),
            ));
        }
        let result = self.send_request(
            "session/load",
            json!({
                "sessionId": agent_session_id,
                "cwd": cwd.to_string_lossy(),
                "mcpServers": []
            }),
        )?;
        let mut metadata = self.metadata()?;
        metadata.agent_session_id = Some(agent_session_id.to_string());
        metadata.coding_model = parse_model_state(&result);
        Ok(())
    }

    fn set_model(&self, model_id: &str) -> AppResult<()> {
        let model_id = model_id.trim();
        if model_id.is_empty() {
            return Err(AppError::InvalidInput(
                "ACP model id must not be empty".to_string(),
            ));
        }
        let _permit = self.acquire_prompt_permit()?;

        let (agent_session_id, advertised, available) = {
            let metadata = self.metadata()?;
            let state = metadata.coding_model.as_ref().ok_or_else(|| {
                AppError::InvalidInput(
                    "active ACP agent does not advertise model selection".to_string(),
                )
            })?;
            let advertised = state.options.iter().any(|option| option.value == model_id);
            let available = state
                .options
                .iter()
                .any(|option| option.value == model_id && option.available == Some(true));
            (
                metadata
                    .agent_session_id
                    .clone()
                    .ok_or_else(|| AppError::Acp("acp session is not initialized".to_string()))?,
                advertised,
                available,
            )
        };
        if !advertised {
            return Err(AppError::InvalidInput(format!(
                "ACP model is not advertised by the active agent: {model_id}"
            )));
        }
        if !available {
            return Err(AppError::InvalidInput(format!(
                "ACP model is not confirmed available by the active agent: {model_id}"
            )));
        }

        let result = self.send_request(
            "session/set_config_option",
            json!({
                "sessionId": agent_session_id,
                "configId": "model",
                "value": model_id
            }),
        )?;
        let updated = parse_model_state(&result).ok_or_else(|| {
            AppError::Acp("model update response missing model configuration".to_string())
        })?;
        if updated.current_value != model_id {
            return Err(AppError::Acp(format!(
                "agent did not activate requested model: {model_id}"
            )));
        }
        self.metadata()?.coding_model = Some(updated);
        Ok(())
    }

    fn send_prompt(&self, prompt: &str) -> AppResult<AcpPromptResult> {
        if prompt.trim().is_empty() {
            return Err(AppError::InvalidInput(
                "acp prompt must not be empty".to_string(),
            ));
        }
        let _permit = self.acquire_prompt_permit()?;

        let agent_session_id = self
            .metadata()?
            .agent_session_id
            .clone()
            .ok_or_else(|| AppError::Acp("acp session is not initialized".to_string()))?;
        let result = self.send_request(
            "session/prompt",
            json!({
                "sessionId": agent_session_id,
                "prompt": [
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }),
        )?;
        let stop_reason = result
            .get("stopReason")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_string();

        Ok(AcpPromptResult {
            session_id: self.id.clone(),
            stop_reason,
        })
    }

    fn acquire_prompt_permit(&self) -> AppResult<PromptPermit<'_>> {
        let mut in_flight = self
            .prompt_in_flight
            .lock()
            .map_err(|_| AppError::Acp("acp prompt lock poisoned".to_string()))?;
        if *in_flight {
            return Err(AppError::InvalidInput(
                "acp prompt already in progress".to_string(),
            ));
        }
        *in_flight = true;
        Ok(PromptPermit {
            prompt_in_flight: &self.prompt_in_flight,
        })
    }

    fn drain_events(&self) -> AppResult<Vec<AcpSessionEvent>> {
        let mut events = self
            .events
            .lock()
            .map_err(|_| AppError::Acp("acp event buffer lock poisoned".to_string()))?;
        Ok(events.drain(..).collect())
    }

    fn list_permissions(&self) -> AppResult<Vec<AcpPermissionRequest>> {
        Ok(self
            .permissions
            .lock()
            .map_err(|_| AppError::Acp("acp permission lock poisoned".into()))?
            .iter()
            .map(|pending| pending.info.clone())
            .collect())
    }

    fn respond_permission(&self, permission_id: &str, option_id: &str) -> AppResult<()> {
        let permissions = self
            .permissions
            .lock()
            .map_err(|_| AppError::Acp("acp permission lock poisoned".into()))?;
        let index = permissions
            .iter()
            .position(|pending| pending.info.id == permission_id)
            .ok_or_else(|| AppError::InvalidInput("ACP permission request is missing".into()))?;
        let pending = permissions.get(index).expect("permission index exists");
        if !pending
            .info
            .options
            .iter()
            .any(|option| option.option_id == option_id)
        {
            return Err(AppError::InvalidInput(
                "ACP permission option was not offered".into(),
            ));
        }
        let rpc_id = pending.rpc_id.clone();
        drop(permissions);
        self.write_json_line(&json!({"jsonrpc":"2.0","id":rpc_id,"result":{"outcome":{"outcome":"selected","optionId":option_id}}}))?;
        self.permissions
            .lock()
            .map_err(|_| AppError::Acp("acp permission lock poisoned".into()))?
            .retain(|pending| pending.info.id != permission_id);
        Ok(())
    }

    fn stop(&self, force: bool) -> AppResult<()> {
        if !self.is_running()? {
            return Ok(());
        }

        if !force {
            self.cancel_pending_permissions()?;
            let _ = self.send_cancel_notification();
            if self.wait_for_exit(ACP_STOP_TIMEOUT)?.is_some() {
                return Ok(());
            }
        }

        self.force_kill()
    }

    fn cancel_pending_permissions(&self) -> AppResult<()> {
        let pending = self
            .permissions
            .lock()
            .map_err(|_| AppError::Acp("acp permission lock poisoned".into()))?
            .drain(..)
            .map(|permission| permission.rpc_id)
            .collect::<Vec<_>>();
        for rpc_id in pending {
            self.write_json_line(&json!({"jsonrpc":"2.0","id":rpc_id,
            "result":{"outcome":{"outcome":"cancelled"}}}))?;
        }
        Ok(())
    }

    fn info(&self) -> AppResult<AcpSessionInfo> {
        self.refresh_state()?;
        let runtime = *self.runtime()?;
        let metadata = self.metadata()?;
        let pid = self.child()?.id();

        Ok(AcpSessionInfo {
            id: self.id.clone(),
            state: runtime.state,
            pid: Some(pid),
            cwd: self.cwd.clone(),
            protocol_version: metadata.protocol_version,
            agent_session_id: metadata.agent_session_id.clone(),
            agent_name: metadata.agent_name.clone(),
            agent_version: metadata.agent_version.clone(),
            exit_code: runtime.exit_code,
            coding_model: metadata.coding_model.clone(),
        })
    }

    fn send_request(&self, method: &str, params: Value) -> AppResult<Value> {
        let id = self.next_request_id.fetch_add(1, Ordering::SeqCst);
        let message = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        });
        self.write_json_line(&message)?;
        self.wait_for_response(id, acp_request_timeout(method))
    }

    fn send_cancel_notification(&self) -> AppResult<()> {
        let Some(agent_session_id) = self.metadata()?.agent_session_id.clone() else {
            return Ok(());
        };
        self.write_json_line(&json!({
            "jsonrpc": "2.0",
            "method": "session/cancel",
            "params": {
                "sessionId": agent_session_id
            }
        }))
    }

    fn write_json_line(&self, message: &Value) -> AppResult<()> {
        let mut stdin = self
            .stdin
            .lock()
            .map_err(|_| AppError::Acp("acp stdin lock poisoned".to_string()))?;
        let line = serde_json::to_string(message).map_err(|err| AppError::Acp(err.to_string()))?;
        stdin.write_all(line.as_bytes())?;
        stdin.write_all(b"\n")?;
        stdin.flush()?;
        Ok(())
    }

    fn wait_for_response(&self, request_id: u64, timeout: Duration) -> AppResult<Value> {
        let start = Instant::now();
        let mut pending = self
            .responses
            .pending
            .lock()
            .map_err(|_| AppError::Acp("acp response queue lock poisoned".to_string()))?;

        loop {
            if let Some(response) = pending.remove(&request_id) {
                if let Some(error) = response.error {
                    return Err(AppError::Acp(format!("agent returned error: {error}")));
                }
                return response
                    .result
                    .ok_or_else(|| AppError::Acp("agent response missing result".to_string()));
            }

            if let Some(exit_code) = self.try_record_exit()? {
                let detail = self.stderr.tail_after_exit();
                let stderr = if detail.is_empty() {
                    String::new()
                } else {
                    format!("; stderr={detail}")
                };
                return Err(AppError::Acp(format!(
                    "acp process exited while waiting for response id {request_id}; exit_code={exit_code:?}{stderr}"
                )));
            }

            let elapsed = start.elapsed();
            if elapsed >= timeout {
                return Err(AppError::Acp(format!(
                    "timed out waiting for ACP response id {request_id}"
                )));
            }

            let remaining = timeout - elapsed;
            let wait_for = remaining.min(ACP_RESPONSE_POLL_INTERVAL);
            let (next_pending, wait_result) = self
                .responses
                .available
                .wait_timeout(pending, wait_for)
                .map_err(|_| AppError::Acp("acp response queue lock poisoned".to_string()))?;
            pending = next_pending;
            if wait_result.timed_out() && start.elapsed() >= timeout {
                return Err(AppError::Acp(format!(
                    "timed out waiting for ACP response id {request_id}"
                )));
            }
        }
    }

    fn force_kill(&self) -> AppResult<()> {
        let mut child = self.child()?;
        if child.try_wait()?.is_none() {
            child.kill()?;
        }
        let status = child.wait()?;
        self.set_state(SessionState::Killed, status.code().map(|code| code as u32))
    }

    fn wait_for_exit(&self, timeout: Duration) -> AppResult<Option<u32>> {
        let start = Instant::now();
        while start.elapsed() < timeout {
            if let Some(exit_code) = self.try_record_exit()? {
                return Ok(Some(exit_code));
            }
            thread::sleep(ACP_WAIT_POLL_INTERVAL);
        }
        Ok(None)
    }

    fn refresh_state(&self) -> AppResult<()> {
        let _ = self.try_record_exit()?;
        Ok(())
    }

    fn try_record_exit(&self) -> AppResult<Option<u32>> {
        if !self.is_running()? {
            return Ok(self.runtime()?.exit_code);
        }

        let mut child = self.child()?;
        if let Some(status) = child.try_wait()? {
            let exit_code = status.code().map(|code| code as u32);
            drop(child);
            self.set_state(SessionState::Exited, exit_code)?;
            return Ok(exit_code);
        }

        Ok(None)
    }

    fn is_running(&self) -> AppResult<bool> {
        Ok(self.runtime()?.state == SessionState::Running)
    }

    fn set_state(&self, state: SessionState, exit_code: Option<u32>) -> AppResult<()> {
        let mut runtime = self.runtime()?;
        runtime.state = state;
        runtime.exit_code = exit_code;
        Ok(())
    }

    fn child(&self) -> AppResult<MutexGuard<'_, Child>> {
        self.child
            .lock()
            .map_err(|_| AppError::Acp("acp child lock poisoned".to_string()))
    }

    fn metadata(&self) -> AppResult<MutexGuard<'_, AcpMetadata>> {
        self.metadata
            .lock()
            .map_err(|_| AppError::Acp("acp metadata lock poisoned".to_string()))
    }

    fn runtime(&self) -> AppResult<MutexGuard<'_, AcpRuntimeState>> {
        self.state
            .lock()
            .map_err(|_| AppError::Acp("acp runtime state lock poisoned".to_string()))
    }
}

fn acp_process_cwd(distribution: AcpRegistryDistributionKind, project_cwd: &Path) -> PathBuf {
    match distribution {
        AcpRegistryDistributionKind::Npx => std::env::temp_dir(),
        AcpRegistryDistributionKind::Binary => project_cwd.to_path_buf(),
    }
}

fn parse_model_state(result: &Value) -> Option<AcpModelState> {
    let model = result
        .get("configOptions")?
        .as_array()?
        .iter()
        .find(|option| option.get("id").and_then(Value::as_str) == Some("model"))?;
    let current_value = model.get("currentValue")?.as_str()?.to_string();
    let options = model
        .get("options")?
        .as_array()?
        .iter()
        .filter_map(|option| {
            Some(AcpModelOption {
                value: option.get("value")?.as_str()?.to_string(),
                name: option.get("name")?.as_str()?.to_string(),
                description: option
                    .get("description")
                    .and_then(Value::as_str)
                    .map(ToString::to_string),
                available: option.get("available").and_then(Value::as_bool),
                unavailable_reason: option
                    .get("unavailableReason")
                    .and_then(Value::as_str)
                    .map(ToString::to_string),
            })
        })
        .collect::<Vec<_>>();
    if options.is_empty() || !options.iter().any(|option| option.value == current_value) {
        return None;
    }
    Some(AcpModelState {
        current_value,
        options,
    })
}

impl Drop for AcpSession {
    fn drop(&mut self) {
        if let Ok(mut child) = self.child.lock() {
            if matches!(child.try_wait(), Ok(None)) {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

fn spawn_stdout_reader(
    stdout: impl Read + Send + 'static,
    responses: Arc<ResponseQueue>,
    events: Arc<Mutex<VecDeque<AcpSessionEvent>>>,
    permissions: Arc<Mutex<VecDeque<PendingPermission>>>,
) {
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else {
                break;
            };
            handle_acp_line(&line, &responses, &events, &permissions);
        }
    });
}

fn handle_acp_line(
    line: &str,
    responses: &Arc<ResponseQueue>,
    events: &Arc<Mutex<VecDeque<AcpSessionEvent>>>,
    permissions: &Arc<Mutex<VecDeque<PendingPermission>>>,
) {
    let value = match serde_json::from_str::<Value>(line) {
        Ok(value) => value,
        Err(err) => {
            append_event(
                events,
                AcpSessionEvent {
                    kind: AcpEventKind::Error,
                    content: format!("invalid ACP JSON: {err}"),
                },
            );
            return;
        }
    };

    if value.get("method").and_then(Value::as_str) == Some("session/request_permission") {
        if let Some(pending) = permission_from_request(&value) {
            if let Ok(mut queue) = permissions.lock() {
                queue.push_back(pending);
            }
        }
        return;
    }

    if let Some(id) = value.get("id").and_then(Value::as_u64) {
        let response = JsonRpcResponse {
            result: value.get("result").cloned(),
            error: value.get("error").cloned(),
        };
        if let Ok(mut pending) = responses.pending.lock() {
            pending.insert(id, response);
            responses.available.notify_all();
        }
        return;
    }

    if value.get("method").and_then(Value::as_str) == Some("session/update") {
        if let Some(event) = event_from_session_update(&value) {
            append_event(events, event);
        }
    }
}

fn permission_from_request(value: &Value) -> Option<PendingPermission> {
    let rpc_id = value.get("id")?.clone();
    let tool_call = value.pointer("/params/toolCall")?;
    let options = value
        .pointer("/params/options")?
        .as_array()?
        .iter()
        .filter_map(|option| {
            Some(AcpPermissionOption {
                option_id: option.get("optionId")?.as_str()?.to_string(),
                name: option.get("name")?.as_str()?.to_string(),
                kind: option.get("kind")?.as_str()?.to_string(),
            })
        })
        .collect::<Vec<_>>();
    if options.is_empty() {
        return None;
    }
    Some(PendingPermission {
        info: AcpPermissionRequest {
            id: Uuid::new_v4().to_string(),
            title: tool_call
                .get("title")
                .and_then(Value::as_str)
                .unwrap_or("Agent tool request")
                .to_string(),
            options,
        },
        rpc_id,
    })
}

fn acp_request_timeout(method: &str) -> Duration {
    if method == "session/prompt" {
        ACP_PROMPT_REQUEST_TIMEOUT
    } else {
        ACP_CONTROL_REQUEST_TIMEOUT
    }
}

fn event_from_session_update(value: &Value) -> Option<AcpSessionEvent> {
    let update = value.pointer("/params/update").unwrap_or(&Value::Null);
    let update_kind = update
        .get("sessionUpdate")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let (kind, content) = match update_kind {
        "agent_message_chunk" => (
            AcpEventKind::AgentMessage,
            text_from_acp_content(update.get("content")),
        ),
        "user_message_chunk" => (
            AcpEventKind::UserMessage,
            text_from_acp_content(update.get("content")),
        ),
        "agent_thought_chunk" => (
            AcpEventKind::Plan,
            text_from_acp_content(update.get("content")),
        ),
        "plan" => {
            let entries = update
                .get("entries")
                .and_then(Value::as_array)
                .map(|entries| {
                    entries
                        .iter()
                        .filter_map(|entry| entry.get("content").and_then(Value::as_str))
                        .collect::<Vec<_>>()
                        .join("\n")
                })
                .unwrap_or_default();
            (AcpEventKind::Plan, entries)
        }
        "available_commands_update" | "session_info_update" | "usage_update" => {
            return None;
        }
        "tool_call_update" => return None,
        "tool_call" => (
            AcpEventKind::ToolCall,
            update
                .get("title")
                .or_else(|| update.get("status"))
                .and_then(Value::as_str)
                .unwrap_or(update_kind)
                .to_string(),
        ),
        _ => (AcpEventKind::Notice, update.to_string()),
    };

    Some(AcpSessionEvent { kind, content })
}

fn text_from_acp_content(content: Option<&Value>) -> String {
    match content {
        Some(Value::String(text)) => text.to_string(),
        Some(Value::Object(_)) => content
            .and_then(|content| content.get("text"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        Some(Value::Array(parts)) => parts
            .iter()
            .filter_map(|part| part.get("text").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join(""),
        _ => String::new(),
    }
}

fn append_event(events: &Arc<Mutex<VecDeque<AcpSessionEvent>>>, event: AcpSessionEvent) {
    if event.content.is_empty() && event.kind != AcpEventKind::Error {
        return;
    }

    let Ok(mut events) = events.lock() else {
        return;
    };
    if let Some(last_event) = events.back_mut() {
        if matches!(
            event.kind,
            AcpEventKind::AgentMessage | AcpEventKind::UserMessage | AcpEventKind::Plan
        ) && last_event.kind == event.kind
        {
            last_event.content.push_str(&event.content);
            return;
        }
    }

    while events.len() >= ACP_EVENT_BUFFER_LIMIT {
        events.pop_front();
    }
    events.push_back(event);
}

impl StderrCapture {
    fn append(&self, text: &str) {
        let Ok(mut state) = self.state.lock() else {
            return;
        };
        state.tail.push_str(text);
        if state.tail.len() > ACP_STDERR_TAIL_LIMIT {
            let mut start = state.tail.len() - ACP_STDERR_TAIL_LIMIT;
            while !state.tail.is_char_boundary(start) {
                start += 1;
            }
            state.tail.drain(..start);
        }
    }

    fn close(&self) {
        if let Ok(mut state) = self.state.lock() {
            state.closed = true;
            self.finished.notify_all();
        }
    }

    fn tail_after_exit(&self) -> String {
        let Ok(state) = self.state.lock() else {
            return String::new();
        };
        let (state, _) = self
            .finished
            .wait_timeout_while(state, ACP_STDERR_CLOSE_WAIT, |state| !state.closed)
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        state.tail.trim().to_string()
    }
}

fn capture_stderr(mut stderr: impl Read + Send + 'static, capture: Arc<StderrCapture>) {
    thread::spawn(move || {
        let mut buffer = [0_u8; 1_024];
        loop {
            match stderr.read(&mut buffer) {
                Ok(0) => break,
                Ok(read) => capture.append(&String::from_utf8_lossy(&buffer[..read])),
                Err(_) => break,
            }
        }
        capture.close();
    });
}

fn resolve_cwd(cwd: Option<PathBuf>) -> AppResult<PathBuf> {
    let cwd = cwd.unwrap_or(std::env::current_dir()?);
    if !cwd.is_dir() {
        return Err(AppError::InvalidInput(format!(
            "acp cwd is not a directory: {}",
            cwd.display()
        )));
    }
    Ok(cwd)
}

#[cfg(unix)]
fn fake_acp_command(script: &str) -> Command {
    let mut command = Command::new("/bin/sh");
    command.arg("-c");
    command.arg(script);
    command
}

#[cfg(windows)]
fn fake_acp_command(_script: &str) -> Command {
    let mut command = Command::new("cmd.exe");
    command.arg("/Q");
    command.arg("/C");
    command.arg("exit 1");
    command
}

fn fake_acp_script() -> &'static str {
    r#"while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
  case "$line" in
    *'"method":"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":false},"agentInfo":{"name":"fake-acp","title":"Fake ACP Agent","version":"0.1.0"},"authMethods":[]}}\n' "$id"
      ;;
    *'"method":"session/new"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"sessionId":"fake-acp-session","configOptions":[{"id":"model","name":"Model","type":"select","currentValue":"fake-code-fast","options":[{"value":"fake-code-fast","name":"Fake Code Fast","description":"Fast test model","available":true},{"value":"fake-code-deep","name":"Fake Code Deep","description":"Deep test model","available":true}]}]}}\n' "$id"
      ;;
    *'"method":"session/set_config_option"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"configOptions":[{"id":"model","name":"Model","type":"select","currentValue":"fake-code-deep","options":[{"value":"fake-code-fast","name":"Fake Code Fast","description":"Fast test model","available":true},{"value":"fake-code-deep","name":"Fake Code Deep","description":"Deep test model","available":true}]}]}}\n' "$id"
      ;;
    *'"method":"session/prompt"'*)
      printf '{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"fake-acp-session","update":{"sessionUpdate":"agent_message_chunk","messageId":"msg_fake","content":{"type":"text","text":"fake acp received prompt"}}}}\n'
      printf '{"jsonrpc":"2.0","id":%s,"result":{"stopReason":"end_turn"}}\n' "$id"
      ;;
    *'"method":"session/cancel"'*)
      exit 0
      ;;
    *)
      printf '{"jsonrpc":"2.0","id":%s,"error":{"code":-32601,"message":"method not found"}}\n' "$id"
      ;;
  esac
done"#
}

#[cfg(test)]
fn load_fake_acp_script() -> &'static str {
    r#"while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
  case "$line" in
    *'"method":"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":true},"agentInfo":{"name":"load-fake","version":"1.0.0"}}}\n' "$id"
      ;;
    *'"method":"session/load"'*)
      if printf '%s' "$line" | grep -Fq "\"sessionId\":\"$EXPECTED_AGENT_SESSION_ID\"" && printf '%s' "$line" | grep -q '"cwd":' && printf '%s' "$line" | grep -q '"mcpServers":\[\]'; then
        printf '{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"%s","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"restored history"}}}}\n' "$EXPECTED_AGENT_SESSION_ID"
        printf '{"jsonrpc":"2.0","id":%s,"result":{"configOptions":[{"id":"model","name":"Model","type":"select","currentValue":"restored-model","options":[{"value":"restored-model","name":"Restored Model"}]}]}}\n' "$id"
      else
        printf '{"jsonrpc":"2.0","id":%s,"error":{"code":-32602,"message":"invalid load payload"}}\n' "$id"
      fi
      ;;
    *'"method":"session/new"'*)
      printf '{"jsonrpc":"2.0","id":%s,"error":{"code":-32601,"message":"session/new must not be called"}}\n' "$id"
      ;;
    *'"method":"session/prompt"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"stopReason":"end_turn"}}\n' "$id"
      ;;
    *'"method":"session/cancel"'*) exit 0 ;;
  esac
done"#
}

#[cfg(test)]
fn malformed_fake_acp_script() -> &'static str {
    r#"printf 'not-json\n'
while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
  case "$line" in
    *'"method":"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":1,"agentCapabilities":{},"agentInfo":{"name":"malformed-fake","version":"0.1.0"},"authMethods":[]}}\n' "$id"
      ;;
    *'"method":"session/new"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"sessionId":"malformed-fake-session"}}\n' "$id"
      ;;
    *'"method":"session/prompt"'*)
      printf '{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"malformed-fake-session","update":{"sessionUpdate":"agent_message_chunk","messageId":"msg_fake","content":{"type":"text","text":"still works after malformed line"}}}}\n'
      printf '{"jsonrpc":"2.0","id":%s,"result":{"stopReason":"end_turn"}}\n' "$id"
      ;;
    *'"method":"session/cancel"'*)
      exit 0
      ;;
    *)
      printf '{"jsonrpc":"2.0","id":%s,"error":{"code":-32601,"message":"method not found"}}\n' "$id"
      ;;
  esac
done"#
}

#[cfg(test)]
fn prompt_exit_fake_acp_script() -> &'static str {
    r#"while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
  case "$line" in
    *'"method":"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":1,"agentCapabilities":{},"agentInfo":{"name":"prompt-exit-fake","version":"0.1.0"},"authMethods":[]}}\n' "$id"
      ;;
    *'"method":"session/new"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"sessionId":"prompt-exit-fake-session"}}\n' "$id"
      ;;
    *'"method":"session/prompt"'*)
      exit 7
      ;;
    *'"method":"session/cancel"'*)
      exit 0
      ;;
    *)
      printf '{"jsonrpc":"2.0","id":%s,"error":{"code":-32601,"message":"method not found"}}\n' "$id"
      ;;
  esac
done"#
}

#[cfg(test)]
fn permission_fake_acp_script() -> &'static str {
    r#"while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
  case "$line" in
    *'"method":"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":1,"agentCapabilities":{},"agentInfo":{"name":"permission-fake","version":"0.1.0"},"authMethods":[]}}\n' "$id"
      ;;
    *'"method":"session/new"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"sessionId":"permission-fake-session"}}\n' "$id"
      ;;
    *'"method":"session/prompt"'*)
      prompt_id=$id
      printf '{"jsonrpc":"2.0","id":900,"method":"session/request_permission","params":{"sessionId":"permission-fake-session","toolCall":{"toolCallId":"tool-1","title":"Write file"},"options":[{"optionId":"allow-once","name":"Allow once","kind":"allow_once"},{"optionId":"reject","name":"Reject","kind":"reject_once"}]}}\n'
      ;;
    *'"id":900'*'"optionId":"allow-once"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"stopReason":"end_turn"}}\n' "$prompt_id"
      ;;
    *'"method":"session/cancel"'*) exit 0 ;;
  esac
done"#
}

#[cfg(test)]
fn startup_error_fake_acp_script() -> &'static str {
    r#"sleep 0.05
printf 'Codex authentication missing; run codex login\n' >&2
exit 1"#
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn filters_tool_updates_but_keeps_meaningful_tool_calls() {
        let update = json!({ "params": { "update": {
            "sessionUpdate": "tool_call_update", "title": "noisy progress"
        } } });
        assert_eq!(event_from_session_update(&update), None);
        let call = json!({ "params": { "update": {
            "sessionUpdate": "tool_call", "title": "Run tests"
        } } });
        assert_eq!(
            event_from_session_update(&call),
            Some(AcpSessionEvent {
                kind: AcpEventKind::ToolCall,
                content: "Run tests".into()
            })
        );
    }

    #[test]
    fn routes_permission_requests_without_poisoning_response_queue() {
        let responses = Arc::new(ResponseQueue {
            pending: Mutex::new(HashMap::new()),
            available: Condvar::new(),
        });
        let events = Arc::new(Mutex::new(VecDeque::new()));
        let permissions = Arc::new(Mutex::new(VecDeque::new()));
        handle_acp_line(
            r#"{"jsonrpc":"2.0","id":7,"method":"session/request_permission","params":{"sessionId":"s","toolCall":{"toolCallId":"tool-1","title":"Run tests"},"options":[{"optionId":"once","name":"Allow once","kind":"allow_once"}]}}"#,
            &responses,
            &events,
            &permissions,
        );
        assert!(responses.pending.lock().expect("responses lock").is_empty());
        let permissions = permissions.lock().expect("permissions lock");
        assert_eq!(permissions.len(), 1);
        assert_eq!(permissions[0].rpc_id, json!(7));
        assert_eq!(permissions[0].info.title, "Run tests");
        assert_eq!(permissions[0].info.options[0].option_id, "once");
    }

    #[derive(Default)]
    struct FakeCommandResolver {
        paths: HashMap<String, PathBuf>,
    }

    impl FakeCommandResolver {
        fn with_path(mut self, executable: &str, path: PathBuf) -> Self {
            self.paths.insert(executable.to_string(), path);
            self
        }
    }

    impl AcpCommandResolver for FakeCommandResolver {
        fn resolve(&self, executable: &str) -> Option<PathBuf> {
            self.paths.get(executable).cloned()
        }
    }

    #[test]
    fn session_prompt_uses_longer_timeout_than_control_requests() {
        assert_eq!(
            acp_request_timeout("initialize"),
            ACP_CONTROL_REQUEST_TIMEOUT
        );
        assert_eq!(
            acp_request_timeout("session/new"),
            ACP_CONTROL_REQUEST_TIMEOUT
        );
        assert_eq!(
            acp_request_timeout("session/prompt"),
            ACP_PROMPT_REQUEST_TIMEOUT
        );
        assert!(ACP_PROMPT_REQUEST_TIMEOUT > ACP_CONTROL_REQUEST_TIMEOUT);
    }

    #[test]
    fn registry_candidates_report_npx_installable_when_runner_exists() {
        let resolver =
            FakeCommandResolver::default().with_path("npx", PathBuf::from("/usr/bin/npx"));

        let candidates = acp_registry_candidates_with_resolver(&resolver);
        let codex = candidates
            .iter()
            .find(|candidate| candidate.id == "codex-acp")
            .expect("codex candidate exists");

        assert_eq!(codex.status, AcpRegistryCandidateStatus::Installable);
        assert_eq!(codex.distribution, AcpRegistryDistributionKind::Npx);
        assert_eq!(
            codex.command,
            vec!["npx", "-y", "@agentclientprotocol/codex-acp@1.1.0"]
        );
        assert_eq!(codex.runner_path, Some(PathBuf::from("/usr/bin/npx")));
    }

    #[test]
    fn registry_candidates_report_missing_runner_for_npx_packages() {
        let candidates = acp_registry_candidates_with_resolver(&FakeCommandResolver::default());
        let claude = candidates
            .iter()
            .find(|candidate| candidate.id == "claude-acp")
            .expect("claude candidate exists");

        assert_eq!(claude.status, AcpRegistryCandidateStatus::MissingRunner);
        assert!(claude.install_hint.contains("npx"));
    }

    #[test]
    fn registry_candidates_report_binary_ready_and_missing() {
        let ready_resolver =
            FakeCommandResolver::default().with_path("kimi", PathBuf::from("/usr/local/bin/kimi"));
        let ready_candidates = acp_registry_candidates_with_resolver(&ready_resolver);
        let ready_kimi = ready_candidates
            .iter()
            .find(|candidate| candidate.id == "kimi")
            .expect("kimi candidate exists");

        assert_eq!(ready_kimi.status, AcpRegistryCandidateStatus::Ready);
        assert_eq!(ready_kimi.distribution, AcpRegistryDistributionKind::Binary);
        assert_eq!(ready_kimi.command, vec!["/usr/local/bin/kimi", "acp"]);

        let missing_candidates =
            acp_registry_candidates_with_resolver(&FakeCommandResolver::default());
        let missing_kimi = missing_candidates
            .iter()
            .find(|candidate| candidate.id == "kimi")
            .expect("kimi candidate exists");

        assert_eq!(
            missing_kimi.status,
            AcpRegistryCandidateStatus::MissingBinary
        );
        assert_eq!(missing_kimi.command, vec!["kimi", "acp"]);
    }

    #[test]
    fn registry_launch_command_uses_resolved_npx_runner() {
        let resolver =
            FakeCommandResolver::default().with_path("npx", PathBuf::from("/usr/bin/npx"));

        let command =
            acp_registry_launch_command("codex-acp", &resolver).expect("launch command exists");

        assert_eq!(command.program, "/usr/bin/npx");
        assert_eq!(command.distribution, AcpRegistryDistributionKind::Npx);
        assert_eq!(
            command.args,
            vec!["-y", "@agentclientprotocol/codex-acp@1.1.0"]
        );
    }

    #[test]
    fn npx_launch_is_neutral_while_binary_launch_keeps_project_cwd() {
        let project_cwd = PathBuf::from("/project/with/package-metadata");

        assert_eq!(
            acp_process_cwd(AcpRegistryDistributionKind::Npx, &project_cwd),
            std::env::temp_dir()
        );
        assert_eq!(
            acp_process_cwd(AcpRegistryDistributionKind::Binary, &project_cwd),
            project_cwd
        );
    }

    #[test]
    fn registry_launch_command_rejects_missing_runner_or_binary() {
        let resolver = FakeCommandResolver::default();

        let codex_error = acp_registry_launch_command("codex-acp", &resolver)
            .expect_err("missing npx is rejected");
        assert!(codex_error.to_string().contains("requires `npx`"));

        let kimi_error =
            acp_registry_launch_command("kimi", &resolver).expect_err("missing kimi is rejected");
        assert!(kimi_error.to_string().contains("requires `kimi`"));
    }

    #[test]
    fn registry_launch_command_rejects_unknown_candidate() {
        let resolver = FakeCommandResolver::default();

        let error = acp_registry_launch_command("unknown-agent", &resolver)
            .expect_err("unknown candidate is rejected");

        assert!(error.to_string().contains("unknown ACP candidate"));
    }

    #[test]
    fn acp_event_buffer_merges_message_chunks_and_filters_technical_updates() {
        let responses = Arc::new(ResponseQueue {
            pending: Mutex::new(HashMap::new()),
            available: Condvar::new(),
        });
        let events = Arc::new(Mutex::new(VecDeque::new()));
        let permissions = Arc::new(Mutex::new(VecDeque::new()));

        handle_acp_line(
            r#"{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"session_info_update","_meta":{"codex":{"threadStatus":{"type":"active"}}}}}}"#,
            &responses,
            &events,
            &permissions,
        );
        handle_acp_line(
            r#"{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"Hello"}}}}"#,
            &responses,
            &events,
            &permissions,
        );
        handle_acp_line(
            r#"{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":" there"}}}}"#,
            &responses,
            &events,
            &permissions,
        );

        let events = events.lock().expect("event buffer locks");

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].kind, AcpEventKind::AgentMessage);
        assert_eq!(events[0].content, "Hello there");
    }

    #[test]
    fn acp_event_buffer_extracts_array_content_and_thought_chunks() {
        let responses = Arc::new(ResponseQueue {
            pending: Mutex::new(HashMap::new()),
            available: Condvar::new(),
        });
        let events = Arc::new(Mutex::new(VecDeque::new()));
        let permissions = Arc::new(Mutex::new(VecDeque::new()));

        handle_acp_line(
            r#"{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"agent_thought_chunk","content":[{"type":"text","text":"Planning "},{"type":"text","text":"response"}]}}}"#,
            &responses,
            &events,
            &permissions,
        );
        handle_acp_line(
            r#"{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"agent_message_chunk","content":[{"type":"text","text":"Done"}]}}}"#,
            &responses,
            &events,
            &permissions,
        );

        let events = events.lock().expect("event buffer locks");

        assert_eq!(events.len(), 2);
        assert_eq!(events[0].kind, AcpEventKind::Plan);
        assert_eq!(events[0].content, "Planning response");
        assert_eq!(events[1].kind, AcpEventKind::AgentMessage);
        assert_eq!(events[1].content, "Done");
    }

    #[test]
    #[cfg(unix)]
    fn starts_fake_acp_session_and_initializes() {
        let manager = AcpSessionManager::default();
        let session = manager
            .start_fake_session(StartFakeAcpSessionRequest { cwd: None })
            .expect("acp session starts");

        assert_eq!(session.state, SessionState::Running);
        assert_eq!(session.protocol_version, Some(1));
        assert_eq!(
            session.agent_session_id.as_deref(),
            Some("fake-acp-session")
        );
        assert_eq!(session.agent_name.as_deref(), Some("fake-acp"));
        assert_eq!(
            session
                .coding_model
                .as_ref()
                .map(|model| model.current_value.as_str()),
            Some("fake-code-fast")
        );
        assert_eq!(session.coding_model.as_ref().unwrap().options.len(), 2);
    }

    #[test]
    #[cfg(unix)]
    fn loads_existing_agent_session_without_creating_a_replacement() {
        let manager = AcpSessionManager::default();
        let cwd = std::env::current_dir().expect("current dir exists");
        let session = manager
            .load_fake_session(cwd, "saved-agent-session")
            .expect("existing ACP session loads");

        assert_eq!(
            session.agent_session_id.as_deref(),
            Some("saved-agent-session")
        );
        assert_eq!(session.agent_name.as_deref(), Some("load-fake"));
        assert_eq!(
            session
                .coding_model
                .as_ref()
                .map(|model| model.current_value.as_str()),
            Some("restored-model")
        );
        assert_eq!(manager.list_sessions().expect("sessions list").len(), 1);
        assert_eq!(
            manager.drain_events(&session.id).expect("history drains")[0].content,
            "restored history"
        );
        assert_eq!(
            manager
                .send_prompt(&session.id, "Continue")
                .expect("prompt sends")
                .stop_reason,
            "end_turn"
        );
    }

    #[test]
    #[cfg(unix)]
    fn continues_external_session_after_local_manager_restart() {
        let (pid, agent_session_id) = {
            let first_manager = AcpSessionManager::default();
            let first = first_manager
                .start_fake_session(StartFakeAcpSessionRequest { cwd: None })
                .expect("first ACP session starts");
            (
                first.pid.expect("first local pid available"),
                first
                    .agent_session_id
                    .expect("external ACP session id available"),
            )
        };
        wait_until(Duration::from_secs(2), || !process_exists(pid))
            .expect("first local ACP process stops with its manager");

        let restarted_manager = AcpSessionManager::default();
        let recovered = restarted_manager
            .load_fake_session(
                std::env::current_dir().expect("current dir exists"),
                &agent_session_id,
            )
            .expect("external ACP session loads through a new manager");

        assert_eq!(
            recovered.agent_session_id.as_deref(),
            Some(agent_session_id.as_str())
        );
        let replay = restarted_manager
            .drain_events(&recovered.id)
            .expect("load replay drains");
        assert_eq!(replay.len(), 1);
        assert_eq!(replay[0].content, "restored history");
        assert!(restarted_manager
            .drain_events(&recovered.id)
            .expect("replay is consumed once")
            .is_empty());
        assert_eq!(
            restarted_manager
                .send_prompt(&recovered.id, "Continue after restart")
                .expect("recovered session accepts a follow-up prompt")
                .stop_reason,
            "end_turn"
        );
    }

    #[test]
    #[cfg(unix)]
    fn rejects_loading_when_agent_does_not_advertise_capability() {
        let result = AcpSession::spawn_unsupported_load_fake(
            std::env::current_dir().expect("current dir exists"),
            "saved-agent-session",
        );
        let error = match result {
            Ok(_) => panic!("unsupported load accepted"),
            Err(error) => error,
        };
        assert!(error.to_string().contains("does not support loading"));
    }

    #[test]
    fn rejects_blank_agent_session_id_before_registry_launch() {
        let manager = AcpSessionManager::default();
        for (candidate_id, agent_session_id) in [(" ", "saved"), ("codex-acp", " ")] {
            let error = manager
                .load_registry_session(LoadAcpRegistrySessionRequest {
                    candidate_id: candidate_id.to_string(),
                    agent_session_id: agent_session_id.to_string(),
                    cwd: None,
                })
                .expect_err("blank recovery id rejected");
            assert!(matches!(error, AppError::InvalidInput(_)));
        }
        assert!(manager.list_sessions().expect("sessions list").is_empty());
    }

    #[test]
    #[cfg(unix)]
    fn changes_to_an_advertised_coding_model() {
        let manager = AcpSessionManager::default();
        let session = manager
            .start_fake_session(StartFakeAcpSessionRequest { cwd: None })
            .expect("acp session starts");

        let updated = manager
            .set_model(SetAcpModelRequest {
                session_id: session.id,
                model_id: "fake-code-deep".to_string(),
            })
            .expect("advertised model changes");

        assert_eq!(
            updated.coding_model.map(|model| model.current_value),
            Some("fake-code-deep".to_string())
        );
    }

    #[test]
    #[cfg(unix)]
    fn rejects_unadvertised_coding_model_before_dispatch() {
        let manager = AcpSessionManager::default();
        let session = manager
            .start_fake_session(StartFakeAcpSessionRequest { cwd: None })
            .expect("acp session starts");

        let error = manager
            .set_model(SetAcpModelRequest {
                session_id: session.id,
                model_id: "invented-model".to_string(),
            })
            .expect_err("unadvertised model rejected");

        assert!(matches!(error, AppError::InvalidInput(_)));
        assert!(error.to_string().contains("not advertised"));
    }

    #[test]
    #[cfg(unix)]
    fn rejects_coding_model_without_confirmed_availability() {
        let manager = AcpSessionManager::default();
        let session = manager
            .load_fake_session(
                std::env::current_dir().expect("current dir exists"),
                "saved-agent-session",
            )
            .expect("existing ACP session loads");

        let error = manager
            .set_model(SetAcpModelRequest {
                session_id: session.id,
                model_id: "restored-model".to_string(),
            })
            .expect_err("unknown availability rejected");

        assert!(matches!(error, AppError::InvalidInput(_)));
        assert!(error.to_string().contains("not confirmed available"));
    }

    #[test]
    #[cfg(unix)]
    fn rejects_model_change_while_prompt_operation_is_in_flight() {
        let session = AcpSession::spawn_fake(std::env::current_dir().expect("current dir exists"))
            .expect("acp session starts");
        let _permit = session
            .acquire_prompt_permit()
            .expect("prompt permit acquired");

        let error = session
            .set_model("fake-code-deep")
            .expect_err("concurrent model change rejected");

        assert!(matches!(error, AppError::InvalidInput(_)));
        assert!(error.to_string().contains("already in progress"));
    }

    #[test]
    #[cfg(unix)]
    fn rejects_model_change_when_agent_has_no_model_option() {
        let manager = AcpSessionManager::default();
        let session = Arc::new(
            AcpSession::spawn_malformed_fake(std::env::current_dir().expect("current dir exists"))
                .expect("acp session starts"),
        );
        let session_id = session.id.clone();
        manager
            .sessions()
            .expect("session registry locks")
            .insert(session_id.clone(), session);

        let error = manager
            .set_model(SetAcpModelRequest {
                session_id,
                model_id: "fake-code-fast".to_string(),
            })
            .expect_err("unsupported model selection rejected");

        assert!(matches!(error, AppError::InvalidInput(_)));
        assert!(error.to_string().contains("does not advertise"));
    }

    #[test]
    #[cfg(unix)]
    fn sends_prompt_and_drains_streamed_update() {
        let manager = AcpSessionManager::default();
        let session = manager
            .start_fake_session(StartFakeAcpSessionRequest { cwd: None })
            .expect("acp session starts");

        let result = manager
            .send_prompt(&session.id, "hello acp")
            .expect("prompt succeeds");
        let events = manager.drain_events(&session.id).expect("drain events");

        assert_eq!(result.stop_reason, "end_turn");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].kind, AcpEventKind::AgentMessage);
        assert_eq!(events[0].content, "fake acp received prompt");
    }

    #[test]
    #[cfg(unix)]
    fn completes_prompt_after_explicit_permission_response() {
        let session = Arc::new(
            AcpSession::spawn_permission_fake(std::env::current_dir().expect("current dir exists"))
                .expect("permission fake starts"),
        );
        let prompt_session = Arc::clone(&session);
        let prompt = thread::spawn(move || prompt_session.send_prompt("write the file"));

        wait_until(Duration::from_secs(2), || {
            session
                .list_permissions()
                .map(|permissions| !permissions.is_empty())
                .unwrap_or(false)
        })
        .expect("permission request becomes visible");
        let permission = session.list_permissions().unwrap().remove(0);
        assert_eq!(permission.title, "Write file");
        session
            .respond_permission(&permission.id, "allow-once")
            .expect("offered permission response is sent");

        assert_eq!(
            prompt
                .join()
                .expect("prompt thread joins")
                .unwrap()
                .stop_reason,
            "end_turn"
        );
        assert!(session.list_permissions().unwrap().is_empty());
    }

    #[test]
    #[cfg(unix)]
    fn rejects_prompt_when_another_prompt_is_in_flight() {
        let session = AcpSession::spawn_fake(std::env::current_dir().expect("current dir exists"))
            .expect("acp session starts");
        let _permit = session
            .acquire_prompt_permit()
            .expect("prompt permit acquired");

        let error = session
            .send_prompt("hello while busy")
            .expect_err("concurrent prompt rejected");

        assert!(matches!(error, AppError::InvalidInput(_)));
        assert!(error.to_string().contains("already in progress"));
    }

    #[test]
    #[cfg(unix)]
    fn prompt_wait_returns_when_child_exits_without_response() {
        let session = AcpSession::spawn_prompt_exit_fake(
            std::env::current_dir().expect("current dir exists"),
        )
        .expect("acp session starts");

        let error = session
            .send_prompt("trigger process exit")
            .expect_err("prompt exit is reported");

        assert!(error.to_string().contains("process exited"));
    }

    #[test]
    #[cfg(unix)]
    fn startup_exit_reports_bounded_stderr_reason() {
        let error = AcpSession::spawn_startup_error_fake(
            std::env::current_dir().expect("current dir exists"),
        )
        .err()
        .expect("startup exit is reported");

        assert!(
            error.to_string().contains("exit_code=1"),
            "unexpected error: {error}"
        );
        assert!(error
            .to_string()
            .contains("Codex authentication missing; run codex login"));
    }

    #[test]
    fn stderr_capture_retains_only_the_bounded_tail() {
        let capture = StderrCapture::default();
        capture.append(&"a".repeat(ACP_STDERR_TAIL_LIMIT));
        capture.append("final reason");
        capture.close();

        let tail = capture.tail_after_exit();
        assert!(tail.len() <= ACP_STDERR_TAIL_LIMIT);
        assert!(tail.ends_with("final reason"));
    }

    #[test]
    #[cfg(unix)]
    fn malformed_json_becomes_error_event_without_breaking_session() {
        let session =
            AcpSession::spawn_malformed_fake(std::env::current_dir().expect("current dir exists"))
                .expect("acp session starts");

        let _ = session
            .send_prompt("hello after malformed line")
            .expect("prompt succeeds");
        let events = session.drain_events().expect("drain events");

        assert!(events
            .iter()
            .any(|event| event.kind == AcpEventKind::Error
                && event.content.contains("invalid ACP JSON")));
        assert!(events
            .iter()
            .any(|event| event.kind == AcpEventKind::AgentMessage
                && event.content == "still works after malformed line"));
    }

    #[test]
    fn missing_acp_session_returns_error() {
        let manager = AcpSessionManager::default();
        let err = manager
            .send_prompt("missing-session", "hello")
            .expect_err("missing session rejected");

        assert!(matches!(err, AppError::SessionNotFound(_)));
    }

    #[test]
    #[cfg(unix)]
    fn empty_prompt_is_rejected() {
        let manager = AcpSessionManager::default();
        let session = manager
            .start_fake_session(StartFakeAcpSessionRequest { cwd: None })
            .expect("acp session starts");
        let err = manager
            .send_prompt(&session.id, "  ")
            .expect_err("empty prompt rejected");

        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    #[cfg(unix)]
    fn dropping_manager_kills_acp_child_processes() {
        let pid = {
            let manager = AcpSessionManager::default();
            let session = manager
                .start_fake_session(StartFakeAcpSessionRequest { cwd: None })
                .expect("acp session starts");
            session.pid.expect("pid available")
        };

        wait_until(Duration::from_secs(2), || !process_exists(pid))
            .expect("acp child process should be gone after manager drop");
    }

    #[cfg(unix)]
    fn wait_until(timeout: Duration, mut condition: impl FnMut() -> bool) -> Result<(), String> {
        let start = Instant::now();
        while start.elapsed() < timeout {
            if condition() {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(25));
        }
        Err("condition timed out".to_string())
    }

    #[cfg(unix)]
    fn process_exists(pid: u32) -> bool {
        Command::new("kill")
            .arg("-0")
            .arg(pid.to_string())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }

    #[test]
    fn parses_explicit_model_availability_without_inventing_unknown_state() {
        let state = parse_model_state(&json!({
            "configOptions": [{
                "id": "model",
                "currentValue": "configured",
                "options": [
                    { "value": "configured", "name": "Configured", "available": true },
                    { "value": "blocked", "name": "Blocked", "available": false,
                      "unavailableReason": "Missing runtime configuration" },
                    { "value": "unknown", "name": "Unknown" }
                ]
            }]
        }))
        .expect("model state parses");

        assert_eq!(state.options[0].available, Some(true));
        assert_eq!(state.options[1].available, Some(false));
        assert_eq!(
            state.options[1].unavailable_reason.as_deref(),
            Some("Missing runtime configuration")
        );
        assert_eq!(state.options[2].available, None);
    }
}
