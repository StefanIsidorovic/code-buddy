use crate::{
    acp::{
        list_acp_registry_candidates as build_acp_registry_candidates, AcpPromptResult,
        AcpRegistryCandidate, AcpSessionEvent, AcpSessionInfo, AcpSessionManager,
        StartAcpRegistrySessionRequest, StartFakeAcpSessionRequest,
    },
    adapters::{AgentDoctorReport, AgentRegistry, SystemBinaryResolver, SystemVersionRunner},
    errors::{AppError, AppResult},
    session::{SessionInfo, SessionManager, StartCodexSessionRequest, StartFakeSessionRequest},
};
use std::sync::Arc;
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
pub async fn start_fake_acp_session(
    state: State<'_, Arc<AcpSessionManager>>,
    request: StartFakeAcpSessionRequest,
) -> AppResult<AcpSessionInfo> {
    let manager = Arc::clone(state.inner());
    run_acp_task(move || manager.start_fake_session(request)).await
}

#[tauri::command]
pub async fn start_acp_registry_session(
    state: State<'_, Arc<AcpSessionManager>>,
    request: StartAcpRegistrySessionRequest,
) -> AppResult<AcpSessionInfo> {
    let manager = Arc::clone(state.inner());
    run_acp_task(move || manager.start_registry_session(request)).await
}

#[tauri::command]
pub async fn send_acp_prompt(
    state: State<'_, Arc<AcpSessionManager>>,
    session_id: String,
    prompt: String,
) -> AppResult<AcpPromptResult> {
    let manager = Arc::clone(state.inner());
    run_acp_task(move || manager.send_prompt(&session_id, &prompt)).await
}

#[tauri::command]
pub async fn drain_acp_events(
    state: State<'_, Arc<AcpSessionManager>>,
    session_id: String,
) -> AppResult<Vec<AcpSessionEvent>> {
    let manager = Arc::clone(state.inner());
    run_acp_task(move || manager.drain_events(&session_id)).await
}

#[tauri::command]
pub async fn stop_acp_session(
    state: State<'_, Arc<AcpSessionManager>>,
    session_id: String,
    force: bool,
) -> AppResult<AcpSessionInfo> {
    let manager = Arc::clone(state.inner());
    run_acp_task(move || manager.stop_session(&session_id, force)).await
}

#[tauri::command]
pub async fn list_acp_sessions(
    state: State<'_, Arc<AcpSessionManager>>,
) -> AppResult<Vec<AcpSessionInfo>> {
    let manager = Arc::clone(state.inner());
    run_acp_task(move || manager.list_sessions()).await
}

#[tauri::command]
pub fn list_acp_registry_candidates() -> Vec<AcpRegistryCandidate> {
    build_acp_registry_candidates()
}

async fn run_acp_task<T>(task: impl FnOnce() -> AppResult<T> + Send + 'static) -> AppResult<T>
where
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|err| AppError::Acp(format!("acp task failed: {err}")))?
}
