use crate::domain::{AgentEvent, SessionState};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const SESSION_OUTPUT_EVENT: &str = "session:output";
pub const SESSION_EVENT_EVENT: &str = "session:event";
pub const SESSION_STATE_EVENT: &str = "session:state";

#[derive(Debug, Clone, Serialize)]
pub struct SessionOutputPayload {
    pub session_id: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionEventPayload {
    pub session_id: String,
    pub event: AgentEvent,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionStatePayload {
    pub session_id: String,
    pub state: SessionState,
    pub exit_code: Option<i32>,
}

pub trait SessionEventEmitter: Send + Sync {
    fn emit_output(&self, payload: SessionOutputPayload);
    fn emit_agent_event(&self, payload: SessionEventPayload);
    fn emit_state(&self, payload: SessionStatePayload);
}

#[derive(Clone)]
pub struct TauriSessionEmitter {
    app: AppHandle,
}

impl TauriSessionEmitter {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl SessionEventEmitter for TauriSessionEmitter {
    fn emit_output(&self, payload: SessionOutputPayload) {
        let _ = self.app.emit(SESSION_OUTPUT_EVENT, payload);
    }

    fn emit_agent_event(&self, payload: SessionEventPayload) {
        let _ = self.app.emit(SESSION_EVENT_EVENT, payload);
    }

    fn emit_state(&self, payload: SessionStatePayload) {
        let _ = self.app.emit(SESSION_STATE_EVENT, payload);
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::{
        sync::{Condvar, Mutex},
        time::{Duration, Instant},
    };

    #[derive(Default)]
    pub struct RecordingEmitter {
        outputs: Mutex<Vec<SessionOutputPayload>>,
        events: Mutex<Vec<SessionEventPayload>>,
        states: Mutex<Vec<SessionStatePayload>>,
        changed: Condvar,
    }

    impl RecordingEmitter {
        pub fn wait_for_output(&self, session_id: &str, needle: &[u8]) -> bool {
            let deadline = Instant::now() + Duration::from_secs(5);
            let mut outputs = self.outputs.lock().expect("output lock");

            loop {
                if outputs.iter().any(|payload| {
                    payload.session_id == session_id
                        && payload
                            .bytes
                            .windows(needle.len())
                            .any(|window| window == needle)
                }) {
                    return true;
                }

                let now = Instant::now();
                if now >= deadline {
                    return false;
                }

                let timeout = deadline.saturating_duration_since(now);
                let (next, _) = self
                    .changed
                    .wait_timeout(outputs, timeout)
                    .expect("wait output");
                outputs = next;
            }
        }

        pub fn states(&self) -> Vec<SessionStatePayload> {
            self.states.lock().expect("state lock").clone()
        }
    }

    impl SessionEventEmitter for RecordingEmitter {
        fn emit_output(&self, payload: SessionOutputPayload) {
            self.outputs.lock().expect("output lock").push(payload);
            self.changed.notify_all();
        }

        fn emit_agent_event(&self, payload: SessionEventPayload) {
            self.events.lock().expect("event lock").push(payload);
            self.changed.notify_all();
        }

        fn emit_state(&self, payload: SessionStatePayload) {
            self.states.lock().expect("state lock").push(payload);
            self.changed.notify_all();
        }
    }
}
