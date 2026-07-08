use crate::{
    acp::{
        AcpPromptResult, AcpSessionEvent, AcpSessionInfo, AcpSessionManager,
        StartFakeAcpSessionRequest,
    },
    adapters::{AgentDoctorReport, AgentRegistry, SystemBinaryResolver, SystemVersionRunner},
    errors::AppResult,
    session::{SessionInfo, SessionManager, StartCodexSessionRequest, StartFakeSessionRequest},
};
use tauri::State;

#[tauri::command]
pub fn start_fake_session(
    state: State<'_, SessionManager>,
    request: StartFakeSessionRequest,
) -> AppResult<SessionInfo> {
    state.start_fake_session(request)
}

#[tauri::command]
pub fn start_codex_session(
    state: State<'_, SessionManager>,
    request: StartCodexSessionRequest,
) -> AppResult<SessionInfo> {
    state.start_codex_session(request)
}

#[tauri::command]
pub fn write_session_input(
    state: State<'_, SessionManager>,
    session_id: String,
    text: String,
) -> AppResult<()> {
    state.write_input(&session_id, &text)
}

#[tauri::command]
pub fn resize_session(
    state: State<'_, SessionManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> AppResult<SessionInfo> {
    state.resize_session(&session_id, cols, rows)
}

#[tauri::command]
pub fn stop_session(
    state: State<'_, SessionManager>,
    session_id: String,
    force: bool,
) -> AppResult<SessionInfo> {
    state.stop_session(&session_id, force)
}

#[tauri::command]
pub fn drain_session_output(
    state: State<'_, SessionManager>,
    session_id: String,
) -> AppResult<String> {
    state.drain_output(&session_id)
}

#[tauri::command]
pub fn list_sessions(state: State<'_, SessionManager>) -> AppResult<Vec<SessionInfo>> {
    state.list_sessions()
}

#[tauri::command]
pub fn list_agent_doctor_reports() -> Vec<AgentDoctorReport> {
    AgentRegistry::default().doctor_reports(&SystemBinaryResolver, &SystemVersionRunner)
}

#[tauri::command]
pub fn start_fake_acp_session(
    state: State<'_, AcpSessionManager>,
    request: StartFakeAcpSessionRequest,
) -> AppResult<AcpSessionInfo> {
    state.start_fake_session(request)
}

#[tauri::command]
pub fn send_acp_prompt(
    state: State<'_, AcpSessionManager>,
    session_id: String,
    prompt: String,
) -> AppResult<AcpPromptResult> {
    state.send_prompt(&session_id, &prompt)
}

#[tauri::command]
pub fn drain_acp_events(
    state: State<'_, AcpSessionManager>,
    session_id: String,
) -> AppResult<Vec<AcpSessionEvent>> {
    state.drain_events(&session_id)
}

#[tauri::command]
pub fn stop_acp_session(
    state: State<'_, AcpSessionManager>,
    session_id: String,
    force: bool,
) -> AppResult<AcpSessionInfo> {
    state.stop_session(&session_id, force)
}

#[tauri::command]
pub fn list_acp_sessions(state: State<'_, AcpSessionManager>) -> AppResult<Vec<AcpSessionInfo>> {
    state.list_sessions()
}
