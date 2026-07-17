use crate::{
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

    pub fn start_registry_session(
        &self,
        request: StartAcpRegistrySessionRequest,
    ) -> AppResult<AcpSessionInfo> {
        let cwd = resolve_cwd(request.cwd)?;
        let session = Arc::new(AcpSession::spawn_registry_candidate(
            &request.candidate_id,
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

    pub fn drain_events(&self, session_id: &str) -> AppResult<Vec<AcpSessionEvent>> {
        self.session(session_id)?.drain_events()
    }

    pub fn stop_session(&self, session_id: &str, force: bool) -> AppResult<AcpSessionInfo> {
        let session = self.session(session_id)?;
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
    stdin: Mutex<ChildStdin>,
    child: Mutex<Child>,
    next_request_id: AtomicU64,
    responses: Arc<ResponseQueue>,
    events: Arc<Mutex<VecDeque<AcpSessionEvent>>>,
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
        resolver: &dyn AcpCommandResolver,
    ) -> AppResult<Self> {
        let launch = acp_registry_launch_command(candidate_id, resolver)?;
        let mut command = Command::new(&launch.program);
        command.args(&launch.args);
        command.current_dir(&cwd);
        Self::spawn_command(command, cwd)
    }

    #[cfg(test)]
    fn spawn_malformed_fake(cwd: PathBuf) -> AppResult<Self> {
        Self::spawn_script(cwd, malformed_fake_acp_script())
    }

    #[cfg(test)]
    fn spawn_prompt_exit_fake(cwd: PathBuf) -> AppResult<Self> {
        Self::spawn_script(cwd, prompt_exit_fake_acp_script())
    }

    fn spawn_script(cwd: PathBuf, script: &str) -> AppResult<Self> {
        let mut command = fake_acp_command(script);
        command.current_dir(&cwd);
        Self::spawn_command(command, cwd)
    }

    fn spawn_command(mut command: Command, cwd: PathBuf) -> AppResult<Self> {
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
        if let Some(stderr) = child.stderr.take() {
            drain_stderr(stderr);
        }

        let responses = Arc::new(ResponseQueue {
            pending: Mutex::new(HashMap::new()),
            available: Condvar::new(),
        });
        let events = Arc::new(Mutex::new(VecDeque::new()));

        spawn_stdout_reader(stdout, Arc::clone(&responses), Arc::clone(&events));

        let session = Self {
            id,
            cwd: cwd.clone(),
            stdin: Mutex::new(stdin),
            child: Mutex::new(child),
            next_request_id: AtomicU64::new(0),
            responses,
            events,
            metadata: Mutex::new(AcpMetadata::default()),
            state: Mutex::new(AcpRuntimeState::running()),
            prompt_in_flight: Mutex::new(false),
        };

        session.initialize()?;
        session.create_agent_session(&cwd)?;
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

        self.metadata()?.agent_session_id = Some(agent_session_id);
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

    fn stop(&self, force: bool) -> AppResult<()> {
        if !self.is_running()? {
            return Ok(());
        }

        if !force {
            let _ = self.send_cancel_notification();
            if self.wait_for_exit(ACP_STOP_TIMEOUT)?.is_some() {
                return Ok(());
            }
        }

        self.force_kill()
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
                return Err(AppError::Acp(format!(
                    "acp process exited while waiting for response id {request_id}; exit_code={exit_code:?}"
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
) {
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else {
                break;
            };
            handle_acp_line(&line, &responses, &events);
        }
    });
}

fn handle_acp_line(
    line: &str,
    responses: &Arc<ResponseQueue>,
    events: &Arc<Mutex<VecDeque<AcpSessionEvent>>>,
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
        "tool_call" | "tool_call_update" => (
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

fn drain_stderr(stderr: impl Read + Send + 'static) {
    thread::spawn(move || {
        let mut reader = BufReader::new(stderr);
        let mut buffer = String::new();
        loop {
            buffer.clear();
            match reader.read_line(&mut buffer) {
                Ok(0) => break,
                Ok(_) => {}
                Err(_) => break,
            }
        }
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
      printf '{"jsonrpc":"2.0","id":%s,"result":{"sessionId":"fake-acp-session"}}\n' "$id"
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
mod tests {
    use super::*;
    use std::collections::HashMap;

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
        assert_eq!(
            command.args,
            vec!["-y", "@agentclientprotocol/codex-acp@1.1.0"]
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

        handle_acp_line(
            r#"{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"session_info_update","_meta":{"codex":{"threadStatus":{"type":"active"}}}}}}"#,
            &responses,
            &events,
        );
        handle_acp_line(
            r#"{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"Hello"}}}}"#,
            &responses,
            &events,
        );
        handle_acp_line(
            r#"{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":" there"}}}}"#,
            &responses,
            &events,
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

        handle_acp_line(
            r#"{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"agent_thought_chunk","content":[{"type":"text","text":"Planning "},{"type":"text","text":"response"}]}}}"#,
            &responses,
            &events,
        );
        handle_acp_line(
            r#"{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s","update":{"sessionUpdate":"agent_message_chunk","content":[{"type":"text","text":"Done"}]}}}"#,
            &responses,
            &events,
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
}
