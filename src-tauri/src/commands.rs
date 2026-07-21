use crate::{
    acp::{
        list_acp_registry_candidates as build_acp_registry_candidates, AcpPromptResult,
        AcpRegistryCandidate, AcpSessionEvent, AcpSessionInfo, AcpSessionManager,
        SetAcpModelRequest, StartAcpRegistrySessionRequest,
    },
    adapters::{AgentDoctorReport, AgentRegistry, SystemBinaryResolver, SystemVersionRunner},
    errors::{AppError, AppResult},
    knowledge::{
        select_task_context, select_unified_task_context, TaskContextSelectionInfo,
        TaskContextSelectionRequest, UnifiedTaskContextSelectionInfo,
        UnifiedTaskContextSelectionRequest,
    },
    models::ModelCatalogInfo,
    session::{SessionInfo, SessionManager, StartCodexSessionRequest, StartFakeSessionRequest},
    storage::{
        CreateKnowledgeItemRequest, CreateProjectInitializationRequest,
        CreateProjectRepositoryRequest, CreateProjectRequest, CreateTaskContextDispatchRequest,
        CreateTaskPhaseArtifactRequest, CreateTaskRequest, CreateTranscriptSessionRequest,
        GenerateProjectInitializationSummaryRequest, KnowledgeItemInfo, KnowledgeUnitInfo,
        ProjectInfo, ProjectInitializationFactInfo, ProjectInitializationGuardrailInfo,
        ProjectInitializationInfo, ProjectInitializationMarkdownFindingInfo,
        ProjectInitializationSummaryInfo, ProjectRepositoryInfo, ProjectStore,
        RenameTranscriptSessionRequest, SaveProjectInitializationGuardrailsRequest,
        TaskContextDispatchReceiptInfo, TaskInfo, TaskPhaseArtifactInfo, TranscriptEventInfo,
        TranscriptEventInput, TranscriptSessionInfo, TransitionTaskPhaseRequest,
        UpdateTaskComplexityRequest,
    },
    synthesis::SynthesisProviderRegistry,
};
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskContextDispatchResultInfo {
    pub prompt_result: AcpPromptResult,
    pub receipt: TaskContextDispatchReceiptInfo,
}

#[tauri::command]
pub fn list_model_catalog() -> ModelCatalogInfo {
    SynthesisProviderRegistry::from_env().model_catalog()
}

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
pub fn analyze_project_initialization_markdown(
    state: State<'_, ProjectStore>,
    initialization_id: String,
) -> AppResult<Vec<ProjectInitializationMarkdownFindingInfo>> {
    state.analyze_project_initialization_markdown(&initialization_id)
}

#[tauri::command]
pub fn list_project_initialization_markdown_findings(
    state: State<'_, ProjectStore>,
    initialization_id: String,
) -> AppResult<Vec<ProjectInitializationMarkdownFindingInfo>> {
    state.list_project_initialization_markdown_findings(&initialization_id)
}

#[tauri::command]
pub fn save_project_initialization_guardrails(
    state: State<'_, ProjectStore>,
    request: SaveProjectInitializationGuardrailsRequest,
) -> AppResult<Vec<ProjectInitializationGuardrailInfo>> {
    state.save_project_initialization_guardrails(request)
}

#[tauri::command]
pub fn list_project_initialization_guardrails(
    state: State<'_, ProjectStore>,
    initialization_id: String,
) -> AppResult<Vec<ProjectInitializationGuardrailInfo>> {
    state.list_project_initialization_guardrails(&initialization_id)
}

#[tauri::command]
pub async fn generate_project_initialization_summary(
    state: State<'_, ProjectStore>,
    request: GenerateProjectInitializationSummaryRequest,
) -> AppResult<ProjectInitializationSummaryInfo> {
    let context = state.prepare_project_initialization_synthesis(request)?;
    let registry = SynthesisProviderRegistry::from_env();
    let result = registry.synthesize(&context).await?;
    state.persist_project_initialization_summary(&context, result.draft, result.generation_engine)
}

#[tauri::command]
pub fn list_project_initialization_summary(
    state: State<'_, ProjectStore>,
    initialization_id: String,
) -> AppResult<Option<ProjectInitializationSummaryInfo>> {
    state.list_project_initialization_summary(&initialization_id)
}

#[tauri::command]
pub fn list_project_initialization_knowledge_units(
    state: State<'_, ProjectStore>,
    initialization_id: String,
) -> AppResult<Vec<KnowledgeUnitInfo>> {
    state.list_project_initialization_knowledge_units(&initialization_id)
}

#[tauri::command]
pub fn select_project_task_context(
    state: State<'_, ProjectStore>,
    request: TaskContextSelectionRequest,
) -> AppResult<TaskContextSelectionInfo> {
    let units = state.list_project_initialization_knowledge_units(&request.initialization_id)?;
    select_task_context(request, units)
}

#[tauri::command]
pub fn select_unified_project_task_context(
    state: State<'_, ProjectStore>,
    request: UnifiedTaskContextSelectionRequest,
) -> AppResult<UnifiedTaskContextSelectionInfo> {
    let project_id = request.project_id.trim();
    if project_id.is_empty() {
        return Err(AppError::InvalidInput(
            "unified task context requires a project".into(),
        ));
    }
    let units = state.list_project_initialization_knowledge_units(&request.initialization_id)?;
    let initialization_matches = state
        .list_project_initializations(project_id)?
        .iter()
        .any(|initialization| initialization.id == request.initialization_id);
    if !initialization_matches {
        return Err(AppError::InvalidInput(
            "initialization does not belong to the selected project".into(),
        ));
    }
    if units.iter().any(|unit| unit.project_id != project_id) {
        return Err(AppError::InvalidInput(
            "initialization does not belong to the selected project".into(),
        ));
    }
    let cards = match request.transcript_session_id.as_deref() {
        Some(session_id) => {
            let session_matches = state
                .list_transcript_sessions(Some(project_id))?
                .iter()
                .any(|session| session.id == session_id);
            if !session_matches {
                return Err(AppError::InvalidInput(
                    "transcript does not belong to the selected project".into(),
                ));
            }
            state.list_attached_knowledge(session_id)?
        }
        None => Vec::new(),
    };
    let artifacts = match request.task_id.as_deref() {
        Some(task_id) => {
            let selected_task = state
                .list_project_tasks(project_id)?
                .into_iter()
                .find(|task| task.id == task_id);
            let Some(selected_task) = selected_task else {
                return Err(AppError::InvalidInput(
                    "task does not belong to the selected project".into(),
                ));
            };
            if request
                .transcript_session_id
                .as_deref()
                .is_some_and(|session_id| selected_task.transcript_session_id != session_id)
            {
                return Err(AppError::InvalidInput(
                    "task does not belong to the selected transcript".into(),
                ));
            }
            state.list_task_phase_artifacts(task_id)?
        }
        None => Vec::new(),
    };
    select_unified_task_context(request, units, cards, artifacts)
}

#[tauri::command]
pub fn approve_project_initialization_summary(
    state: State<'_, ProjectStore>,
    summary_id: String,
) -> AppResult<ProjectInitializationSummaryInfo> {
    state.approve_project_initialization_summary(&summary_id)
}

#[tauri::command]
pub fn create_transcript_session(
    state: State<'_, ProjectStore>,
    request: CreateTranscriptSessionRequest,
) -> AppResult<TranscriptSessionInfo> {
    state.create_transcript_session(request)
}

#[tauri::command]
pub fn create_task(
    state: State<'_, ProjectStore>,
    request: CreateTaskRequest,
) -> AppResult<TaskInfo> {
    state.create_task(request)
}

#[tauri::command]
pub fn list_project_tasks(
    state: State<'_, ProjectStore>,
    project_id: String,
) -> AppResult<Vec<TaskInfo>> {
    state.list_project_tasks(&project_id)
}

#[tauri::command]
pub fn update_task_complexity(
    state: State<'_, ProjectStore>,
    request: UpdateTaskComplexityRequest,
) -> AppResult<TaskInfo> {
    state.update_task_complexity(request)
}

#[tauri::command]
pub fn create_task_phase_artifact(
    state: State<'_, ProjectStore>,
    request: CreateTaskPhaseArtifactRequest,
) -> AppResult<TaskPhaseArtifactInfo> {
    state.create_task_phase_artifact(request)
}

#[tauri::command]
pub fn list_task_phase_artifacts(
    state: State<'_, ProjectStore>,
    task_id: String,
) -> AppResult<Vec<TaskPhaseArtifactInfo>> {
    state.list_task_phase_artifacts(&task_id)
}

#[tauri::command]
pub fn list_task_context_dispatch_receipts(
    state: State<'_, ProjectStore>,
    task_id: String,
) -> AppResult<Vec<TaskContextDispatchReceiptInfo>> {
    state.list_task_context_dispatch_receipts(&task_id)
}

#[tauri::command]
pub fn transition_task_phase(
    state: State<'_, ProjectStore>,
    request: TransitionTaskPhaseRequest,
) -> AppResult<TaskInfo> {
    state.transition_task_phase(request)
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
pub async fn send_acp_prompt_with_context(
    manager_state: State<'_, Arc<AcpSessionManager>>,
    store_state: State<'_, ProjectStore>,
    request: CreateTaskContextDispatchRequest,
) -> AppResult<TaskContextDispatchResultInfo> {
    let receipt = store_state.begin_task_context_dispatch(request)?;
    let receipt_id = receipt.id.clone();
    let wire_prompt = receipt.wire_prompt.clone();
    let acp_session_id = receipt.acp_session_id.clone();
    let manager = Arc::clone(manager_state.inner());
    match run_acp_task(move || manager.send_prompt(&acp_session_id, &wire_prompt)).await {
        Ok(prompt_result) => {
            let receipt = store_state.finalize_task_context_dispatch(
                &receipt_id,
                "sent",
                Some(&prompt_result.stop_reason),
                None,
            )?;
            Ok(TaskContextDispatchResultInfo {
                prompt_result,
                receipt,
            })
        }
        Err(error) => {
            let message = error.to_string();
            store_state.finalize_task_context_dispatch(
                &receipt_id,
                "failed",
                None,
                Some(&message),
            )?;
            Err(error)
        }
    }
}

#[tauri::command]
pub async fn set_acp_model(
    state: State<'_, Arc<AcpSessionManager>>,
    request: SetAcpModelRequest,
) -> AppResult<AcpSessionInfo> {
    let manager = Arc::clone(state.inner());
    run_acp_task(move || manager.set_model(request)).await
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
