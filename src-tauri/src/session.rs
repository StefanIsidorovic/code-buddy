use crate::{
    adapters::AgentAdapter,
    domain::{CommandSpec, InputDelivery, RunMode, SessionConfig, SessionState},
    errors::{AppError, AppResult},
    events::{SessionEventEmitter, SessionEventPayload, SessionOutputPayload, SessionStatePayload},
};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use std::{
    collections::HashMap,
    io::{Read, Write},
    path::Path,
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};
use uuid::Uuid;

const DEFAULT_COLS: u16 = 100;
const DEFAULT_ROWS: u16 = 30;
const STOP_TIMEOUT: Duration = Duration::from_secs(2);

type SharedSessions = Arc<Mutex<HashMap<String, Arc<RunningSession>>>>;

pub struct SessionManager {
    sessions: SharedSessions,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn start_session(
        &self,
        adapter: Arc<dyn AgentAdapter>,
        cfg: SessionConfig,
        mode: RunMode,
        emitter: Arc<dyn SessionEventEmitter>,
    ) -> AppResult<String> {
        let spec = adapter.build_command(&cfg, mode)?;
        self.start_command(spec, adapter, mode, emitter)
    }

    pub fn start_command(
        &self,
        spec: CommandSpec,
        adapter: Arc<dyn AgentAdapter>,
        mode: RunMode,
        emitter: Arc<dyn SessionEventEmitter>,
    ) -> AppResult<String> {
        validate_cwd(&spec.cwd)?;

        let session_id = Uuid::new_v4().to_string();
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: DEFAULT_ROWS,
                cols: DEFAULT_COLS,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|err| AppError::Process(err.to_string()))?;

        let mut command = CommandBuilder::new(&spec.program);
        command.args(spec.args.iter());
        command.cwd(spec.cwd.as_os_str());
        for (key, value) in &spec.env {
            command.env(key, value);
        }

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|err| AppError::Process(err.to_string()))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|err| AppError::Process(err.to_string()))?;
        let mut child = pair
            .slave
            .spawn_command(command)
            .map_err(|err| AppError::Process(err.to_string()))?;
        let killer = child.clone_killer();

        let session = Arc::new(RunningSession {
            mode,
            adapter: adapter.clone(),
            master: Mutex::new(pair.master),
            writer: Mutex::new(writer),
            killer: Mutex::new(killer),
            state: Mutex::new(SessionState::Starting),
        });

        self.sessions
            .lock()
            .map_err(|_| AppError::Process("session registry lock poisoned".to_string()))?
            .insert(session_id.clone(), session.clone());

        emit_state(&emitter, &session_id, SessionState::Starting);
        emit_state(&emitter, &session_id, SessionState::Running);
        session.set_state(SessionState::Running)?;

        let sessions = self.sessions.clone();
        let thread_session_id = session_id.clone();
        thread::spawn(move || {
            reader_loop(
                thread_session_id,
                reader,
                &mut child,
                adapter,
                emitter,
                sessions,
            );
        });

        Ok(session_id)
    }

    pub fn write_input(&self, session_id: &str, text: &str) -> AppResult<()> {
        let session = self.get(session_id)?;
        match session.adapter.encode_input(text, session.mode) {
            InputDelivery::PtyBytes(bytes) => session.write_all(&bytes),
            InputDelivery::StdinText(text) => session.write_all(text.as_bytes()),
            InputDelivery::HeadlessPromptArg(text) => {
                session.write_all(format!("{text}\n").as_bytes())
            }
        }
    }

    pub fn write_raw(&self, session_id: &str, bytes: &[u8]) -> AppResult<()> {
        self.get(session_id)?.write_all(bytes)
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> AppResult<()> {
        if cols == 0 || rows == 0 {
            return Err(AppError::InvalidInput(
                "terminal size must be greater than zero".to_string(),
            ));
        }

        let session = self.get(session_id)?;
        let master = session
            .master
            .lock()
            .map_err(|_| AppError::Process("pty lock poisoned".to_string()))?;
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|err| AppError::Process(err.to_string()))
    }

    pub fn stop(
        &self,
        session_id: &str,
        force: bool,
        emitter: Arc<dyn SessionEventEmitter>,
    ) -> AppResult<()> {
        let session = self.get(session_id)?;

        if force {
            session.kill()?;
            session.set_state(SessionState::Killed)?;
            emit_state(&emitter, session_id, SessionState::Killed);
            self.remove(session_id)?;
            return Ok(());
        }

        session.write_all(&[0x03])?;
        let sessions = self.sessions.clone();
        let delayed_session = session.clone();
        let delayed_id = session_id.to_string();
        thread::spawn(move || {
            thread::sleep(STOP_TIMEOUT);
            if sessions
                .lock()
                .map(|sessions| sessions.contains_key(&delayed_id))
                .unwrap_or(false)
            {
                let _ = delayed_session.kill();
                let _ = delayed_session.set_state(SessionState::Killed);
                emit_state(&emitter, &delayed_id, SessionState::Killed);
                if let Ok(mut sessions) = sessions.lock() {
                    sessions.remove(&delayed_id);
                }
            }
        });

        Ok(())
    }

    pub fn active_count(&self) -> usize {
        self.sessions
            .lock()
            .map(|sessions| sessions.len())
            .unwrap_or_default()
    }

    pub fn is_active(&self, session_id: &str) -> bool {
        self.sessions
            .lock()
            .map(|sessions| sessions.contains_key(session_id))
            .unwrap_or(false)
    }

    pub fn kill_all(&self) {
        let sessions = self
            .sessions
            .lock()
            .map(|sessions| sessions.values().cloned().collect::<Vec<_>>())
            .unwrap_or_default();
        for session in sessions {
            let _ = session.kill();
        }
        if let Ok(mut sessions) = self.sessions.lock() {
            sessions.clear();
        }
    }

    fn get(&self, session_id: &str) -> AppResult<Arc<RunningSession>> {
        self.sessions
            .lock()
            .map_err(|_| AppError::Process("session registry lock poisoned".to_string()))?
            .get(session_id)
            .cloned()
            .ok_or_else(|| AppError::InvalidInput(format!("unknown session: {session_id}")))
    }

    fn remove(&self, session_id: &str) -> AppResult<()> {
        self.sessions
            .lock()
            .map_err(|_| AppError::Process("session registry lock poisoned".to_string()))?
            .remove(session_id);
        Ok(())
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for SessionManager {
    fn drop(&mut self) {
        self.kill_all();
    }
}

struct RunningSession {
    mode: RunMode,
    adapter: Arc<dyn AgentAdapter>,
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
    state: Mutex<SessionState>,
}

impl RunningSession {
    fn write_all(&self, bytes: &[u8]) -> AppResult<()> {
        let mut writer = self
            .writer
            .lock()
            .map_err(|_| AppError::Process("pty writer lock poisoned".to_string()))?;
        writer.write_all(bytes)?;
        writer.flush()?;
        Ok(())
    }

    fn kill(&self) -> AppResult<()> {
        self.killer
            .lock()
            .map_err(|_| AppError::Process("child killer lock poisoned".to_string()))?
            .kill()?;
        Ok(())
    }

    fn set_state(&self, state: SessionState) -> AppResult<()> {
        *self
            .state
            .lock()
            .map_err(|_| AppError::Process("session state lock poisoned".to_string()))? = state;
        Ok(())
    }
}

fn reader_loop(
    session_id: String,
    mut reader: Box<dyn Read + Send>,
    child: &mut Box<dyn portable_pty::Child + Send + Sync>,
    adapter: Arc<dyn AgentAdapter>,
    emitter: Arc<dyn SessionEventEmitter>,
    sessions: SharedSessions,
) {
    let mut buf = [0_u8; 8192];
    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                let bytes = buf[..n].to_vec();
                emitter.emit_output(SessionOutputPayload {
                    session_id: session_id.clone(),
                    bytes: bytes.clone(),
                });
                for event in adapter.parse_chunk(&bytes) {
                    emitter.emit_agent_event(SessionEventPayload {
                        session_id: session_id.clone(),
                        event,
                    });
                }
            }
            Err(_) => break,
        }
    }

    let exit_code = child.wait().ok().map(|status| status.exit_code() as i32);
    let was_active = sessions
        .lock()
        .map(|mut sessions| sessions.remove(&session_id).is_some())
        .unwrap_or(false);

    if was_active {
        emit_state(
            &emitter,
            &session_id,
            SessionState::Exited { code: exit_code },
        );
    }
}

fn emit_state(emitter: &Arc<dyn SessionEventEmitter>, session_id: &str, state: SessionState) {
    let exit_code = match state {
        SessionState::Exited { code } => code,
        _ => None,
    };
    emitter.emit_state(SessionStatePayload {
        session_id: session_id.to_string(),
        state,
        exit_code,
    });
}

fn validate_cwd(cwd: &Path) -> AppResult<()> {
    if cwd.is_dir() {
        Ok(())
    } else {
        Err(AppError::InvalidInput(format!(
            "session cwd is not a directory: {}",
            cwd.display()
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{adapters::FakeAdapter, events::tests::RecordingEmitter};
    use std::{collections::HashMap, path::PathBuf, time::Instant};

    fn fake_config() -> SessionConfig {
        SessionConfig {
            project_id: None,
            cwd: std::env::current_dir().expect("cwd"),
            binary_path: None,
            model: None,
            prompt: None,
            extra_args: Vec::new(),
            extra_env: HashMap::new(),
        }
    }

    fn emitter() -> Arc<RecordingEmitter> {
        Arc::new(RecordingEmitter::default())
    }

    #[test]
    fn fake_session_streams_and_accepts_input() {
        let manager = SessionManager::new();
        let emitter = emitter();
        let session_id = manager
            .start_session(
                Arc::new(FakeAdapter),
                fake_config(),
                RunMode::Interactive,
                emitter.clone(),
            )
            .expect("start");

        manager
            .write_input(&session_id, "hello from pty")
            .expect("write");

        assert!(emitter.wait_for_output(&session_id, b"hello from pty"));
        manager.stop(&session_id, true, emitter).expect("stop");
    }

    #[test]
    fn resize_rejects_zero_dimensions() {
        let manager = SessionManager::new();
        let emitter = emitter();
        let session_id = manager
            .start_session(
                Arc::new(FakeAdapter),
                fake_config(),
                RunMode::Interactive,
                emitter.clone(),
            )
            .expect("start");

        assert!(manager.resize(&session_id, 120, 40).is_ok());
        let err = manager
            .resize(&session_id, 0, 40)
            .expect_err("zero cols rejected");
        assert!(matches!(err, AppError::InvalidInput(_)));
        manager.stop(&session_id, true, emitter).expect("stop");
    }

    #[test]
    fn force_stop_removes_session() {
        let manager = SessionManager::new();
        let emitter = emitter();
        let session_id = manager
            .start_command(
                CommandSpec {
                    program: PathBuf::from("/bin/sh"),
                    args: vec!["-lc".to_string(), "sleep 60".to_string()],
                    env: HashMap::new(),
                    cwd: std::env::current_dir().expect("cwd"),
                },
                Arc::new(FakeAdapter),
                RunMode::Interactive,
                emitter.clone(),
            )
            .expect("start");

        manager.stop(&session_id, true, emitter).expect("stop");
        assert!(!manager.is_active(&session_id));
    }

    #[test]
    fn force_stop_does_not_emit_exited_after_killed() {
        let manager = SessionManager::new();
        let emitter = emitter();
        let session_id = manager
            .start_command(
                CommandSpec {
                    program: PathBuf::from("/bin/sh"),
                    args: vec!["-lc".to_string(), "sleep 60".to_string()],
                    env: HashMap::new(),
                    cwd: std::env::current_dir().expect("cwd"),
                },
                Arc::new(FakeAdapter),
                RunMode::Interactive,
                emitter.clone(),
            )
            .expect("start");

        manager
            .stop(&session_id, true, emitter.clone())
            .expect("stop");
        thread::sleep(Duration::from_millis(100));

        let states = emitter.states();
        assert!(states.iter().any(|payload| {
            payload.session_id == session_id && payload.state == SessionState::Killed
        }));
        assert!(!states.iter().any(|payload| {
            payload.session_id == session_id && matches!(payload.state, SessionState::Exited { .. })
        }));
    }

    #[test]
    fn runs_multiple_sessions_without_cross_interference() {
        let manager = SessionManager::new();
        let emitter = emitter();
        let mut ids = Vec::new();

        for index in 0..8 {
            let session_id = manager
                .start_session(
                    Arc::new(FakeAdapter),
                    fake_config(),
                    RunMode::Interactive,
                    emitter.clone(),
                )
                .expect("start");
            manager
                .write_input(&session_id, &format!("session-{index}"))
                .expect("write");
            ids.push((session_id, format!("session-{index}")));
        }

        for (session_id, text) in &ids {
            assert!(emitter.wait_for_output(session_id, text.as_bytes()));
        }

        for (session_id, _) in ids {
            manager
                .stop(&session_id, true, emitter.clone())
                .expect("stop");
        }
        assert_eventually(|| manager.active_count() == 0);
    }

    #[test]
    fn invalid_cwd_is_rejected_before_spawn() {
        let manager = SessionManager::new();
        let err = manager
            .start_command(
                CommandSpec {
                    program: PathBuf::from("/bin/sh"),
                    args: vec!["-lc".to_string(), "cat".to_string()],
                    env: HashMap::new(),
                    cwd: PathBuf::from("/definitely/missing/code-buddy"),
                },
                Arc::new(FakeAdapter),
                RunMode::Interactive,
                emitter(),
            )
            .expect_err("missing cwd rejected");

        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    fn assert_eventually(condition: impl Fn() -> bool) {
        let deadline = Instant::now() + Duration::from_secs(5);
        while Instant::now() < deadline {
            if condition() {
                return;
            }
            thread::sleep(Duration::from_millis(20));
        }
        assert!(condition());
    }
}
