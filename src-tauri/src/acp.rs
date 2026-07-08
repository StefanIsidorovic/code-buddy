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

const ACP_REQUEST_TIMEOUT: Duration = Duration::from_secs(2);
const ACP_STOP_TIMEOUT: Duration = Duration::from_millis(750);
const ACP_WAIT_POLL_INTERVAL: Duration = Duration::from_millis(25);
const ACP_EVENT_BUFFER_LIMIT: usize = 512;
const ACP_PROTOCOL_VERSION: u64 = 1;

pub type AcpSessionId = String;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartFakeAcpSessionRequest {
    pub cwd: Option<PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpSessionInfo {
    pub id: AcpSessionId,
    pub state: SessionState,
    pub pid: Option<u32>,
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
    stdin: Mutex<ChildStdin>,
    child: Mutex<Child>,
    next_request_id: AtomicU64,
    responses: Arc<ResponseQueue>,
    events: Arc<Mutex<VecDeque<AcpSessionEvent>>>,
    metadata: Mutex<AcpMetadata>,
    state: Mutex<AcpRuntimeState>,
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

impl AcpSession {
    fn spawn_fake(cwd: PathBuf) -> AppResult<Self> {
        Self::spawn_script(cwd, fake_acp_script())
    }

    #[cfg(test)]
    fn spawn_malformed_fake(cwd: PathBuf) -> AppResult<Self> {
        Self::spawn_script(cwd, malformed_fake_acp_script())
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
            stdin: Mutex::new(stdin),
            child: Mutex::new(child),
            next_request_id: AtomicU64::new(0),
            responses,
            events,
            metadata: Mutex::new(AcpMetadata::default()),
            state: Mutex::new(AcpRuntimeState::running()),
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
        self.wait_for_response(id)
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

    fn wait_for_response(&self, request_id: u64) -> AppResult<Value> {
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

            let elapsed = start.elapsed();
            if elapsed >= ACP_REQUEST_TIMEOUT {
                return Err(AppError::Acp(format!(
                    "timed out waiting for ACP response id {request_id}"
                )));
            }

            let remaining = ACP_REQUEST_TIMEOUT - elapsed;
            let (next_pending, timeout) = self
                .responses
                .available
                .wait_timeout(pending, remaining)
                .map_err(|_| AppError::Acp("acp response queue lock poisoned".to_string()))?;
            pending = next_pending;
            if timeout.timed_out() {
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
        append_event(events, event_from_session_update(&value));
    }
}

fn event_from_session_update(value: &Value) -> AcpSessionEvent {
    let update = value.pointer("/params/update").unwrap_or(&Value::Null);
    let update_kind = update
        .get("sessionUpdate")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let (kind, content) = match update_kind {
        "agent_message_chunk" => (
            AcpEventKind::AgentMessage,
            update
                .pointer("/content/text")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
        ),
        "user_message_chunk" => (
            AcpEventKind::UserMessage,
            update
                .pointer("/content/text")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
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
        "tool_call" | "tool_call_update" => (
            AcpEventKind::ToolCall,
            update
                .get("title")
                .or_else(|| update.get("status"))
                .and_then(Value::as_str)
                .unwrap_or(update_kind)
                .to_string(),
        ),
        "usage_update" => (AcpEventKind::Usage, "usage update".to_string()),
        _ => (AcpEventKind::Notice, update.to_string()),
    };

    AcpSessionEvent { kind, content }
}

fn append_event(events: &Arc<Mutex<VecDeque<AcpSessionEvent>>>, event: AcpSessionEvent) {
    let Ok(mut events) = events.lock() else {
        return;
    };
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
mod tests {
    use super::*;

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
