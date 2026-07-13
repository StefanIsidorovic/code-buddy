use crate::{
    acp::{
        list_acp_registry_candidates as build_acp_registry_candidates, AcpPromptResult,
        AcpRegistryCandidate, AcpSessionEvent, AcpSessionInfo, AcpSessionManager,
        StartAcpRegistrySessionRequest, StartFakeAcpSessionRequest,
    },
    adapters::{AgentDoctorReport, AgentRegistry, SystemBinaryResolver, SystemVersionRunner},
    errors::{AppError, AppResult},
    session::{SessionInfo, SessionManager, StartCodexSessionRequest, StartFakeSessionRequest},
    storage::{
        CreateKnowledgeItemRequest, CreateProjectInitializationRequest,
        CreateProjectRepositoryRequest, CreateProjectRequest, CreateTranscriptSessionRequest,
        KnowledgeItemInfo, ProjectInfo, ProjectInitializationFactInfo, ProjectInitializationInfo,
        ProjectRepositoryInfo, ProjectStore, RenameTranscriptSessionRequest, TranscriptEventInfo,
        TranscriptEventInput, TranscriptSessionInfo,
    },
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
pub fn create_project(
    state: State<'_, ProjectStore>,
    request: CreateProjectRequest,
) -> AppResult<ProjectInfo> {
    state.create_project(request)
}

#[tauri::command]
pub fn list_projects(state: State<'_, ProjectStore>) -> AppResult<Vec<ProjectInfo>> {
    state.list_projects()
}

#[tauri::command]
pub fn delete_project(state: State<'_, ProjectStore>, project_id: String) -> AppResult<()> {
    state.delete_project(&project_id)
}

#[tauri::command]
pub fn create_project_repository(
    state: State<'_, ProjectStore>,
    request: CreateProjectRepositoryRequest,
) -> AppResult<ProjectRepositoryInfo> {
    state.create_project_repository(request)
}

#[tauri::command]
pub fn list_project_repositories(
    state: State<'_, ProjectStore>,
    project_id: String,
) -> AppResult<Vec<ProjectRepositoryInfo>> {
    state.list_project_repositories(&project_id)
}

#[tauri::command]
pub fn delete_project_repository(
    state: State<'_, ProjectStore>,
    repository_id: String,
) -> AppResult<()> {
    state.delete_project_repository(&repository_id)
}

#[tauri::command]
pub fn create_project_initialization(
    state: State<'_, ProjectStore>,
    request: CreateProjectInitializationRequest,
) -> AppResult<ProjectInitializationInfo> {
    state.create_project_initialization(request)
}

#[tauri::command]
pub fn list_project_initializations(
    state: State<'_, ProjectStore>,
    project_id: String,
) -> AppResult<Vec<ProjectInitializationInfo>> {
    state.list_project_initializations(&project_id)
}

#[tauri::command]
pub fn collect_project_initialization_facts(
    state: State<'_, ProjectStore>,
    initialization_id: String,
) -> AppResult<Vec<ProjectInitializationFactInfo>> {
    state.collect_project_initialization_facts(&initialization_id)
}

#[tauri::command]
pub fn list_project_initialization_facts(
    state: State<'_, ProjectStore>,
    initialization_id: String,
) -> AppResult<Vec<ProjectInitializationFactInfo>> {
    state.list_project_initialization_facts(&initialization_id)
}

#[tauri::command]
pub fn create_transcript_session(
    state: State<'_, ProjectStore>,
    request: CreateTranscriptSessionRequest,
) -> AppResult<TranscriptSessionInfo> {
    state.create_transcript_session(request)
}

#[tauri::command]
pub fn append_transcript_events(
    state: State<'_, ProjectStore>,
    session_id: String,
    events: Vec<TranscriptEventInput>,
) -> AppResult<Vec<TranscriptEventInfo>> {
    state.append_transcript_events(&session_id, events)
}

#[tauri::command]
pub fn list_transcript_sessions(
    state: State<'_, ProjectStore>,
    project_id: Option<String>,
) -> AppResult<Vec<TranscriptSessionInfo>> {
    state.list_transcript_sessions(project_id.as_deref())
}

#[tauri::command]
pub fn list_transcript_events(
    state: State<'_, ProjectStore>,
    session_id: String,
) -> AppResult<Vec<TranscriptEventInfo>> {
    state.list_transcript_events(&session_id)
}

#[tauri::command]
pub fn rename_transcript_session(
    state: State<'_, ProjectStore>,
    request: RenameTranscriptSessionRequest,
) -> AppResult<TranscriptSessionInfo> {
    state.rename_transcript_session(request)
}

#[tauri::command]
pub fn create_knowledge_item(
    state: State<'_, ProjectStore>,
    request: CreateKnowledgeItemRequest,
) -> AppResult<KnowledgeItemInfo> {
    state.create_knowledge_item(request)
}

#[tauri::command]
pub fn list_knowledge_items(
    state: State<'_, ProjectStore>,
    project_id: Option<String>,
) -> AppResult<Vec<KnowledgeItemInfo>> {
    state.list_knowledge_items(project_id.as_deref())
}

#[tauri::command]
pub fn attach_knowledge_to_transcript_session(
    state: State<'_, ProjectStore>,
    session_id: String,
    knowledge_item_id: String,
) -> AppResult<Vec<KnowledgeItemInfo>> {
    state.attach_knowledge_to_transcript_session(&session_id, &knowledge_item_id)
}

#[tauri::command]
pub fn list_attached_knowledge(
    state: State<'_, ProjectStore>,
    session_id: String,
) -> AppResult<Vec<KnowledgeItemInfo>> {
    state.list_attached_knowledge(&session_id)
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
