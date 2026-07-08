use crate::{
    adapters::{AgentAdapter, AgentCommandRequest, CodexAdapter, SystemBinaryResolver},
    errors::{AppError, AppResult},
};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, VecDeque},
    io::{Read, Write},
    path::PathBuf,
    sync::{Arc, Mutex, MutexGuard},
    thread,
    time::{Duration, Instant},
};
use uuid::Uuid;

const DEFAULT_COLS: u16 = 80;
const DEFAULT_ROWS: u16 = 24;
const OUTPUT_BUFFER_LIMIT: usize = 1024 * 1024;
const STOP_TIMEOUT: Duration = Duration::from_millis(750);
const WAIT_POLL_INTERVAL: Duration = Duration::from_millis(25);

pub type SessionId = String;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartFakeSessionRequest {
    pub cwd: Option<PathBuf>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartCodexSessionRequest {
    pub cwd: Option<PathBuf>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
}

impl Default for StartFakeSessionRequest {
    fn default() -> Self {
        Self {
            cwd: None,
            cols: Some(DEFAULT_COLS),
            rows: Some(DEFAULT_ROWS),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionState {
    Running,
    Exited,
    Killed,
    Errored,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: SessionId,
    pub state: SessionState,
    pub pid: Option<u32>,
    pub cols: u16,
    pub rows: u16,
    pub exit_code: Option<u32>,
}

#[derive(Default)]
pub struct SessionManager {
    sessions: Mutex<HashMap<SessionId, Arc<PtySession>>>,
}

impl SessionManager {
    pub fn start_fake_session(&self, request: StartFakeSessionRequest) -> AppResult<SessionInfo> {
        let cwd = resolve_cwd(request.cwd)?;
        let (cols, rows) = resolve_size(request.cols, request.rows)?;
        let session = Arc::new(PtySession::spawn_fake(cwd, cols, rows)?);
        let info = session.info()?;

        self.sessions()?.insert(info.id.clone(), session);
        Ok(info)
    }

    pub fn start_codex_session(
        &self,
        request: StartCodexSessionRequest,
    ) -> AppResult<SessionInfo> {
        let cwd = resolve_cwd(request.cwd)?;
        let (cols, rows) = resolve_size(request.cols, request.rows)?;
        let session = Arc::new(PtySession::spawn_codex(cwd, cols, rows)?);
        let info = session.info()?;

        self.sessions()?.insert(info.id.clone(), session);
        Ok(info)
    }

    pub fn write_input(&self, session_id: &str, text: &str) -> AppResult<()> {
        self.session(session_id)?.write_input(text)
    }

    pub fn resize_session(&self, session_id: &str, cols: u16, rows: u16) -> AppResult<SessionInfo> {
        self.session(session_id)?.resize(cols, rows)
    }

    pub fn stop_session(&self, session_id: &str, force: bool) -> AppResult<SessionInfo> {
        let session = self.session(session_id)?;
        session.stop(force)?;
        session.info()
    }

    pub fn drain_output(&self, session_id: &str) -> AppResult<String> {
        let bytes = self.session(session_id)?.drain_output()?;
        Ok(String::from_utf8_lossy(&bytes).to_string())
    }

    pub fn list_sessions(&self) -> AppResult<Vec<SessionInfo>> {
        self.sessions()?
            .values()
            .map(|session| session.info())
            .collect()
    }

    fn session(&self, session_id: &str) -> AppResult<Arc<PtySession>> {
        self.sessions()?
            .get(session_id)
            .cloned()
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))
    }

    fn sessions(&self) -> AppResult<MutexGuard<'_, HashMap<SessionId, Arc<PtySession>>>> {
        self.sessions
            .lock()
            .map_err(|_| AppError::Session("session registry lock poisoned".to_string()))
    }
}

impl Drop for SessionManager {
    fn drop(&mut self) {
        if let Ok(sessions) = self.sessions.get_mut() {
            for session in sessions.values() {
                let _ = session.stop(true);
            }
            sessions.clear();
        }
    }
}

struct PtySession {
    id: SessionId,
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Mutex<Box<dyn Child + Send>>,
    output: Arc<Mutex<VecDeque<u8>>>,
    state: Mutex<RuntimeState>,
}

#[derive(Debug, Clone, Copy)]
struct RuntimeState {
    state: SessionState,
    exit_code: Option<u32>,
}

impl RuntimeState {
    fn running() -> Self {
        Self {
            state: SessionState::Running,
            exit_code: None,
        }
    }
}

impl PtySession {
    fn spawn_fake(cwd: PathBuf, cols: u16, rows: u16) -> AppResult<Self> {
        Self::spawn_command(fake_command(&cwd), cols, rows)
    }

    fn spawn_codex(cwd: PathBuf, cols: u16, rows: u16) -> AppResult<Self> {
        Self::spawn_command(codex_command(&cwd)?, cols, rows)
    }

    fn spawn_command(command: CommandBuilder, cols: u16, rows: u16) -> AppResult<Self> {
        let id = Uuid::new_v4().to_string();
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|err| AppError::Pty(err.to_string()))?;

        let child = pair
            .slave
            .spawn_command(command)
            .map_err(|err| AppError::Pty(err.to_string()))?;
        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|err| AppError::Pty(err.to_string()))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|err| AppError::Pty(err.to_string()))?;
        let output = Arc::new(Mutex::new(VecDeque::new()));

        spawn_reader(id.clone(), reader, Arc::clone(&output));

        Ok(Self {
            id,
            master: Mutex::new(pair.master),
            writer: Mutex::new(writer),
            child: Mutex::new(child),
            output,
            state: Mutex::new(RuntimeState::running()),
        })
    }

    fn write_input(&self, text: &str) -> AppResult<()> {
        let mut writer = self.writer()?;
        writer.write_all(text.as_bytes())?;
        writer.flush()?;
        Ok(())
    }

    fn resize(&self, cols: u16, rows: u16) -> AppResult<SessionInfo> {
        if cols == 0 || rows == 0 {
            return Err(AppError::InvalidInput(
                "pty cols and rows must be greater than zero".to_string(),
            ));
        }

        self.master()?
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|err| AppError::Pty(err.to_string()))?;
        self.info()
    }

    fn stop(&self, force: bool) -> AppResult<()> {
        if !self.is_running()? {
            return Ok(());
        }

        if force {
            return self.force_kill();
        }

        self.write_interrupt()?;
        if self.wait_for_exit(STOP_TIMEOUT)?.is_some() {
            return Ok(());
        }

        self.force_kill()
    }

    fn info(&self) -> AppResult<SessionInfo> {
        self.refresh_state()?;
        let size = self
            .master()?
            .get_size()
            .map_err(|err| AppError::Pty(err.to_string()))?;
        let pid = self.child()?.process_id();
        let runtime = *self.runtime()?;

        Ok(SessionInfo {
            id: self.id.clone(),
            state: runtime.state,
            pid,
            cols: size.cols,
            rows: size.rows,
            exit_code: runtime.exit_code,
        })
    }

    fn drain_output(&self) -> AppResult<Vec<u8>> {
        let mut output = self
            .output
            .lock()
            .map_err(|_| AppError::Session("session output lock poisoned".to_string()))?;
        Ok(output.drain(..).collect())
    }

    fn force_kill(&self) -> AppResult<()> {
        {
            let mut child = self.child()?;
            if child.try_wait()?.is_none() {
                child.kill()?;
            }
            let status = child.wait()?;
            self.set_state(SessionState::Killed, Some(status.exit_code()))?;
        }
        Ok(())
    }

    fn wait_for_exit(&self, timeout: Duration) -> AppResult<Option<u32>> {
        let start = Instant::now();
        while start.elapsed() < timeout {
            if let Some(exit_code) = self.try_record_exit()? {
                return Ok(Some(exit_code));
            }
            thread::sleep(WAIT_POLL_INTERVAL);
        }
        Ok(None)
    }

    fn try_record_exit(&self) -> AppResult<Option<u32>> {
        if !self.is_running()? {
            return Ok(self.runtime()?.exit_code);
        }

        let mut child = self.child()?;
        if let Some(status) = child.try_wait()? {
            let exit_code = status.exit_code();
            drop(child);
            self.set_state(SessionState::Exited, Some(exit_code))?;
            return Ok(Some(exit_code));
        }

        Ok(None)
    }

    fn refresh_state(&self) -> AppResult<()> {
        let _ = self.try_record_exit()?;
        Ok(())
    }

    fn write_interrupt(&self) -> AppResult<()> {
        let mut writer = self.writer()?;
        writer.write_all(&[0x03])?;
        writer.flush()?;
        Ok(())
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

    fn master(&self) -> AppResult<MutexGuard<'_, Box<dyn MasterPty + Send>>> {
        self.master
            .lock()
            .map_err(|_| AppError::Session("pty master lock poisoned".to_string()))
    }

    fn writer(&self) -> AppResult<MutexGuard<'_, Box<dyn Write + Send>>> {
        self.writer
            .lock()
            .map_err(|_| AppError::Session("pty writer lock poisoned".to_string()))
    }

    fn child(&self) -> AppResult<MutexGuard<'_, Box<dyn Child + Send>>> {
        self.child
            .lock()
            .map_err(|_| AppError::Session("pty child lock poisoned".to_string()))
    }

    fn runtime(&self) -> AppResult<MutexGuard<'_, RuntimeState>> {
        self.state
            .lock()
            .map_err(|_| AppError::Session("session state lock poisoned".to_string()))
    }
}

impl Drop for PtySession {
    fn drop(&mut self) {
        if let Ok(mut child) = self.child.lock() {
            if matches!(child.try_wait(), Ok(None)) {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

fn spawn_reader(
    _session_id: SessionId,
    mut reader: Box<dyn Read + Send>,
    output: Arc<Mutex<VecDeque<u8>>>,
) {
    thread::spawn(move || {
        let mut buffer = [0; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => append_output(&output, &buffer[..n]),
                Err(err) if err.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(_) => break,
            }
        }
    });
}

fn append_output(output: &Arc<Mutex<VecDeque<u8>>>, bytes: &[u8]) {
    let Ok(mut output) = output.lock() else {
        return;
    };

    let overflow = output
        .len()
        .saturating_add(bytes.len())
        .saturating_sub(OUTPUT_BUFFER_LIMIT);
    for _ in 0..overflow {
        output.pop_front();
    }
    output.extend(bytes);
}

fn resolve_cwd(cwd: Option<PathBuf>) -> AppResult<PathBuf> {
    let cwd = cwd.unwrap_or(std::env::current_dir()?);
    if !cwd.is_dir() {
        return Err(AppError::InvalidInput(format!(
            "session cwd is not a directory: {}",
            cwd.display()
        )));
    }
    Ok(cwd)
}

fn resolve_size(cols: Option<u16>, rows: Option<u16>) -> AppResult<(u16, u16)> {
    let cols = cols.unwrap_or(DEFAULT_COLS);
    let rows = rows.unwrap_or(DEFAULT_ROWS);
    if cols == 0 || rows == 0 {
        return Err(AppError::InvalidInput(
            "pty cols and rows must be greater than zero".to_string(),
        ));
    }
    Ok((cols, rows))
}

fn codex_command(cwd: &std::path::Path) -> AppResult<CommandBuilder> {
    let adapter = CodexAdapter;
    let detection = adapter.detect(&SystemBinaryResolver);
    let executable_path = detection
        .path
        .ok_or_else(|| AppError::InvalidInput("codex CLI was not found on PATH".to_string()))?;
    let request = AgentCommandRequest::new(executable_path, cwd.to_path_buf());

    Ok(adapter.build_command(&request)?.into_command_builder())
}

#[cfg(unix)]
fn fake_command(cwd: &std::path::Path) -> CommandBuilder {
    let mut command = CommandBuilder::new("/bin/sh");
    command.arg("-c");
    command.arg(
        "printf 'fake-ready\\r\\n'; trap 'exit 0' INT TERM; while IFS= read -r line; do printf 'fake:%s\\r\\n' \"$line\"; done",
    );
    command.cwd(cwd);
    command
}

#[cfg(windows)]
fn fake_command(cwd: &std::path::Path) -> CommandBuilder {
    let mut command = CommandBuilder::new("cmd.exe");
    command.arg("/Q");
    command.arg("/K");
    command.arg("echo fake-ready");
    command.cwd(cwd);
    command
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        process::{Command, Stdio},
        time::Duration,
    };

    #[test]
    fn starts_fake_session_and_streams_ready_output() {
        let manager = SessionManager::default();
        let session = manager
            .start_fake_session(StartFakeSessionRequest::default())
            .expect("session starts");

        let output = wait_for_output(&manager, &session.id, "fake-ready");

        assert_eq!(session.state, SessionState::Running);
        assert!(output.contains("fake-ready"));
    }

    #[test]
    fn writes_input_and_receives_echo() {
        let manager = SessionManager::default();
        let session = manager
            .start_fake_session(StartFakeSessionRequest::default())
            .expect("session starts");
        let _ = wait_for_output(&manager, &session.id, "fake-ready");

        manager
            .write_input(&session.id, "hello from test\n")
            .expect("write input");
        let output = wait_for_output(&manager, &session.id, "fake:hello from test");

        assert!(output.contains("fake:hello from test"));
    }

    #[test]
    fn resizes_session() {
        let manager = SessionManager::default();
        let session = manager
            .start_fake_session(StartFakeSessionRequest {
                cwd: None,
                cols: Some(80),
                rows: Some(24),
            })
            .expect("session starts");

        let resized = manager
            .resize_session(&session.id, 132, 43)
            .expect("resize");

        assert_eq!(resized.cols, 132);
        assert_eq!(resized.rows, 43);
    }

    #[test]
    fn graceful_stop_exits_session() {
        let manager = SessionManager::default();
        let session = manager
            .start_fake_session(StartFakeSessionRequest::default())
            .expect("session starts");

        let stopped = manager
            .stop_session(&session.id, false)
            .expect("stop session");

        assert_eq!(stopped.state, SessionState::Exited);
    }

    #[test]
    fn force_stop_kills_session() {
        let manager = SessionManager::default();
        let session = manager
            .start_fake_session(StartFakeSessionRequest::default())
            .expect("session starts");

        let stopped = manager
            .stop_session(&session.id, true)
            .expect("force stop session");

        assert_eq!(stopped.state, SessionState::Killed);
    }

    #[test]
    fn missing_session_returns_error() {
        let manager = SessionManager::default();
        let err = manager
            .write_input("missing-session", "hello\n")
            .expect_err("missing session rejected");

        assert!(matches!(err, AppError::SessionNotFound(_)));
    }

    #[test]
    fn runs_eight_fake_sessions_without_cross_interference() {
        let manager = SessionManager::default();
        let sessions = (0..8)
            .map(|_| {
                manager
                    .start_fake_session(StartFakeSessionRequest::default())
                    .expect("session starts")
            })
            .collect::<Vec<_>>();

        for session in &sessions {
            let _ = wait_for_output(&manager, &session.id, "fake-ready");
        }

        for (index, session) in sessions.iter().enumerate() {
            manager
                .write_input(&session.id, &format!("session-{index}\n"))
                .expect("write input");
        }

        for (index, session) in sessions.iter().enumerate() {
            let output = wait_for_output(&manager, &session.id, &format!("fake:session-{index}"));
            assert!(output.contains(&format!("fake:session-{index}")));
        }
    }

    #[test]
    #[cfg(unix)]
    fn dropping_manager_kills_child_processes() {
        let pid = {
            let manager = SessionManager::default();
            let session = manager
                .start_fake_session(StartFakeSessionRequest::default())
                .expect("session starts");
            session.pid.expect("pid available")
        };

        wait_until(Duration::from_secs(2), || !process_exists(pid))
            .expect("child process should be gone after manager drop");
    }

    fn wait_for_output(manager: &SessionManager, session_id: &str, needle: &str) -> String {
        let mut collected = String::new();
        wait_until(Duration::from_secs(3), || {
            let chunk = manager.drain_output(session_id).expect("drain output");
            collected.push_str(&chunk);
            collected.contains(needle)
        })
        .expect("expected session output");
        collected
    }

    fn wait_until(
        timeout: Duration,
        mut condition: impl FnMut() -> bool,
    ) -> Result<(), &'static str> {
        let start = Instant::now();
        while start.elapsed() < timeout {
            if condition() {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(25));
        }
        Err("timed out")
    }

    #[cfg(unix)]
    fn process_exists(pid: u32) -> bool {
        Command::new("kill")
            .arg("-0")
            .arg(pid.to_string())
            .stderr(Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }
}
