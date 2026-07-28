use crate::{
    acp::{
        list_acp_registry_candidates as build_acp_registry_candidates, AcpEventKind,
        AcpPermissionRequest, AcpPromptResult, AcpRegistryCandidate, AcpSessionEvent,
        AcpSessionInfo, AcpSessionManager, AcpWorkspaceIsolation, LoadAcpRegistrySessionRequest,
        RespondAcpPermissionRequest, SetAcpModelRequest, StartAcpRegistrySessionRequest,
    },
    adapters::{AgentDoctorReport, AgentRegistry, SystemBinaryResolver, SystemVersionRunner},
    delivery::{
        capture_git_workspace_snapshot, compare_git_workspace_snapshots,
        inspect_git_delivery_readiness as inspect_git_delivery_readiness_for_repo,
        list_git_delivery_provenance_history as list_git_delivery_provenance_history_for_repo,
        GitDeliveryProvenanceHistoryEntry, GitDeliveryReadinessInfo, GitWorkspaceVerificationInfo,
    },
    errors::{AppError, AppResult},
    knowledge::{
        select_task_context, select_unified_task_context, TaskContextSelectionInfo,
        TaskContextSelectionRequest, UnifiedTaskContextSelectionInfo,
        UnifiedTaskContextSelectionRequest,
    },
    models::ModelCatalogInfo,
    session::{
        SessionInfo, SessionManager, SessionState, StartCodexSessionRequest,
        StartFakeSessionRequest,
    },
    storage::{
        CreateAcpTranscriptSessionRequest, CreateKnowledgeItemRequest,
        CreateProjectInitializationRequest, CreateProjectRepositoryRequest, CreateProjectRequest,
        CreateTaskAgentReportRequest, CreateTaskAgentReportTranscriptRequest,
        CreateTaskContextDispatchRequest, CreateTaskPhaseArtifactRequest,
        CreateTaskPhaseRunRequest, CreateTaskRequest, CreateTranscriptSessionRequest,
        GenerateProjectInitializationSummaryRequest, KnowledgeItemInfo, KnowledgeUnitInfo,
        LinkTaskPhaseRunEventsRequest, ProjectInfo, ProjectInitializationFactInfo,
        ProjectInitializationGuardrailInfo, ProjectInitializationInfo,
        ProjectInitializationMarkdownFindingInfo, ProjectInitializationSummaryInfo,
        ProjectRepositoryInfo, ProjectStore, RegenerateProjectInitializationSummarySectionRequest,
        RenameTranscriptSessionRequest, ResolveTaskContextDispatchRequest,
        ResolveTaskPhaseRunRequest, ReviewProjectInitializationSummaryClaimRequest,
        SaveProjectInitializationGuardrailsRequest, TaskAgentReportInfo,
        TaskAgentReportTranscriptInfo, TaskContextDispatchReceiptInfo, TaskInfo,
        TaskPhaseArtifactInfo, TaskPhaseRunReceiptInfo, TranscriptAcpIdentityInfo,
        TranscriptEventInfo, TranscriptEventInput, TranscriptSessionInfo,
        TransitionTaskPhaseRequest, UpdateTaskComplexityRequest,
    },
    synthesis::SynthesisProviderRegistry,
};
use std::{path::PathBuf, sync::Arc};
use tauri::State;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskContextDispatchResultInfo {
    pub prompt_result: AcpPromptResult,
    pub receipt: TaskContextDispatchReceiptInfo,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPhaseRunResultInfo {
    pub prompt_result: AcpPromptResult,
    pub receipt: TaskPhaseRunReceiptInfo,
    pub workspace_verification: Option<GitWorkspaceVerificationInfo>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunTaskAgentReportRequest {
    pub task_id: String,
    pub phase: String,
    pub role: String,
    pub candidate_id: String,
    pub cwd: PathBuf,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunTaskAgentReportResultInfo {
    pub prompt_result: AcpPromptResult,
    pub transcript_session: TranscriptSessionInfo,
    pub report: TaskAgentReportInfo,
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
pub fn inspect_git_delivery_readiness(
    repository_path: PathBuf,
) -> AppResult<GitDeliveryReadinessInfo> {
    inspect_git_delivery_readiness_for_repo(repository_path)
}

#[tauri::command]
pub fn list_git_delivery_provenance_history(
    repository_path: PathBuf,
    limit: usize,
) -> AppResult<Vec<GitDeliveryProvenanceHistoryEntry>> {
    list_git_delivery_provenance_history_for_repo(repository_path, limit)
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
pub async fn regenerate_project_initialization_summary_section(
    state: State<'_, ProjectStore>,
    request: RegenerateProjectInitializationSummarySectionRequest,
) -> AppResult<ProjectInitializationSummaryInfo> {
    let (context, summary) = state.prepare_project_initialization_section_regeneration(&request)?;
    let registry = SynthesisProviderRegistry::from_env();
    let result = registry.synthesize(&context).await?;
    state.persist_project_initialization_summary_section(
        &context,
        &summary,
        &request.section,
        result.draft,
        result.generation_engine,
    )
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
pub fn review_project_initialization_summary_claim(
    state: State<'_, ProjectStore>,
    request: ReviewProjectInitializationSummaryClaimRequest,
) -> AppResult<ProjectInitializationSummaryInfo> {
    state.review_project_initialization_summary_claim(request)
}

#[tauri::command]
pub fn prepare_project_initialization_summary_autopilot(
    state: State<'_, ProjectStore>,
    summary_id: String,
) -> AppResult<ProjectInitializationSummaryInfo> {
    state.prepare_project_initialization_summary_autopilot(&summary_id)
}

#[tauri::command]
pub fn create_transcript_session(
    state: State<'_, ProjectStore>,
    request: CreateTranscriptSessionRequest,
) -> AppResult<TranscriptSessionInfo> {
    state.create_transcript_session(request)
}

#[tauri::command]
pub fn create_acp_transcript_session(
    state: State<'_, ProjectStore>,
    request: CreateAcpTranscriptSessionRequest,
) -> AppResult<TranscriptSessionInfo> {
    state.create_acp_transcript_session(request)
}

#[tauri::command]
pub fn get_transcript_acp_identity(
    state: State<'_, ProjectStore>,
    transcript_session_id: String,
) -> AppResult<Option<TranscriptAcpIdentityInfo>> {
    state.transcript_acp_identity(&transcript_session_id)
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
pub fn create_task_agent_report(
    state: State<'_, ProjectStore>,
    request: CreateTaskAgentReportRequest,
) -> AppResult<TaskAgentReportInfo> {
    state.create_task_agent_report(request)
}

#[tauri::command]
pub async fn run_task_agent_report(
    manager_state: State<'_, Arc<AcpSessionManager>>,
    store_state: State<'_, ProjectStore>,
    mut request: RunTaskAgentReportRequest,
) -> AppResult<RunTaskAgentReportResultInfo> {
    let candidate_id = request.candidate_id.trim().to_string();
    if candidate_id.is_empty() {
        return Err(AppError::InvalidInput(
            "task agent run requires an ACP candidate".into(),
        ));
    }
    let phase = request.phase.trim().to_lowercase();
    let role = request.role.trim().to_lowercase();
    let task = store_state.task(&request.task_id)?;
    validate_task_agent_report_run(&task, &phase, &role)?;
    request.candidate_id = candidate_id.clone();
    request.phase = phase;
    request.role = role;
    let manager = Arc::clone(manager_state.inner());
    let start_request = StartAcpRegistrySessionRequest {
        candidate_id,
        cwd: Some(request.cwd.clone()),
        workspace_isolation: Some(AcpWorkspaceIsolation::SnapshotSandbox),
    };
    let start_manager = Arc::clone(&manager);
    let session = run_acp_task(move || start_manager.start_registry_session(start_request)).await?;
    run_task_agent_report_against_session(manager, store_state.inner(), request, session).await
}

#[tauri::command]
pub fn list_task_agent_reports(
    state: State<'_, ProjectStore>,
    task_id: String,
) -> AppResult<Vec<TaskAgentReportInfo>> {
    state.list_task_agent_reports(&task_id)
}

#[tauri::command]
pub fn list_task_phase_run_receipts(
    state: State<'_, ProjectStore>,
    task_id: String,
) -> AppResult<Vec<TaskPhaseRunReceiptInfo>> {
    state.list_task_phase_run_receipts(&task_id)
}

#[tauri::command]
pub fn link_task_phase_run_events(
    state: State<'_, ProjectStore>,
    request: LinkTaskPhaseRunEventsRequest,
) -> AppResult<()> {
    state.link_task_phase_run_events(request)
}

#[tauri::command]
pub fn latest_task_phase_run_response_events(
    state: State<'_, ProjectStore>,
    task_id: String,
) -> AppResult<Vec<TranscriptEventInfo>> {
    state.latest_task_phase_run_response_events(&task_id)
}

#[tauri::command]
pub async fn resolve_pending_task_phase_run(
    store_state: State<'_, ProjectStore>,
    manager_state: State<'_, Arc<AcpSessionManager>>,
    request: ResolveTaskPhaseRunRequest,
) -> AppResult<TaskPhaseRunReceiptInfo> {
    let receipt = store_state
        .list_task_phase_run_receipts(&request.task_id)?
        .into_iter()
        .find(|value| value.id == request.receipt_id)
        .ok_or_else(|| {
            AppError::InvalidInput("phase run receipt is missing or belongs to another task".into())
        })?;
    let manager = Arc::clone(manager_state.inner());
    let sessions = run_acp_task(move || manager.list_sessions()).await?;
    if sessions.iter().any(|session| {
        session.id == receipt.acp_session_id && session.state == SessionState::Running
    }) {
        return Err(AppError::InvalidInput(
            "stop the associated ACP session before resolving its pending phase run".into(),
        ));
    }
    store_state.resolve_pending_task_phase_run(request)
}

#[tauri::command]
pub fn list_task_context_dispatch_receipts(
    state: State<'_, ProjectStore>,
    task_id: String,
) -> AppResult<Vec<TaskContextDispatchReceiptInfo>> {
    state.list_task_context_dispatch_receipts(&task_id)
}

#[tauri::command]
pub async fn resolve_pending_task_context_dispatch(
    store_state: State<'_, ProjectStore>,
    manager_state: State<'_, Arc<AcpSessionManager>>,
    request: ResolveTaskContextDispatchRequest,
) -> AppResult<TaskContextDispatchReceiptInfo> {
    let receipt = store_state
        .list_task_context_dispatch_receipts(&request.task_id)?
        .into_iter()
        .find(|receipt| receipt.id == request.receipt_id)
        .ok_or_else(|| {
            AppError::InvalidInput(
                "context dispatch receipt is missing or belongs to another task".into(),
            )
        })?;
    let manager = Arc::clone(manager_state.inner());
    let sessions = run_acp_task(move || manager.list_sessions()).await?;
    if sessions.iter().any(|session| {
        session.id == receipt.acp_session_id && session.state == SessionState::Running
    }) {
        return Err(AppError::InvalidInput(
            "stop the associated ACP session before resolving its pending receipt".into(),
        ));
    }
    store_state.resolve_pending_task_context_dispatch(request)
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
pub async fn load_acp_registry_session(
    state: State<'_, Arc<AcpSessionManager>>,
    request: LoadAcpRegistrySessionRequest,
) -> AppResult<AcpSessionInfo> {
    let manager = Arc::clone(state.inner());
    run_acp_task(move || manager.load_registry_session(request)).await
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
pub async fn send_task_phase_prompt(
    manager_state: State<'_, Arc<AcpSessionManager>>,
    store_state: State<'_, ProjectStore>,
    request: CreateTaskPhaseRunRequest,
) -> AppResult<TaskPhaseRunResultInfo> {
    let task_id = request.task_id.clone();
    let phase = request.phase.clone();
    let verification_baseline = if phase == "execution" {
        let manager = Arc::clone(manager_state.inner());
        let session_id = request.acp_session_id.clone();
        let workspace = run_acp_task(move || {
            manager
                .list_sessions()?
                .into_iter()
                .find(|session| session.id == session_id)
                .map(|session| session.cwd)
                .ok_or_else(|| AppError::InvalidInput("active ACP session not found".into()))
        })
        .await;
        Some(match workspace {
            Ok(path) => {
                let snapshot = capture_git_workspace_snapshot(&path);
                (path, snapshot)
            }
            Err(error) => (PathBuf::from("Unavailable ACP workspace"), Err(error)),
        })
    } else {
        None
    };
    let receipt = store_state.begin_task_phase_run(request)?;
    let receipt_id = receipt.id.clone();
    let instruction = receipt.instruction.clone();
    let acp_session_id = receipt.acp_session_id.clone();
    let manager = Arc::clone(manager_state.inner());
    match run_acp_task(move || manager.send_prompt(&acp_session_id, &instruction)).await {
        Ok(prompt_result) => {
            let mut receipt = store_state.finalize_task_phase_run(
                &receipt_id,
                "sent",
                Some(&prompt_result.stop_reason),
                None,
            )?;
            let workspace_verification = verification_baseline.map(|(workspace, before)| {
                compare_git_workspace_snapshots(
                    task_id,
                    phase,
                    &workspace,
                    before,
                    capture_git_workspace_snapshot(&workspace),
                )
            });
            if let Some(verification) = workspace_verification.as_ref() {
                let changed_files_json = serde_json::to_string(&verification.changed_files)
                    .map_err(|error| AppError::Storage(error.to_string()))?;
                receipt = store_state.record_task_phase_run_verification(
                    &receipt_id,
                    &verification.status,
                    &verification.workspace_path,
                    &changed_files_json,
                    verification.error.as_deref(),
                )?;
            }
            Ok(TaskPhaseRunResultInfo {
                prompt_result,
                receipt,
                workspace_verification,
            })
        }
        Err(error) => {
            store_state.finalize_task_phase_run(
                &receipt_id,
                "failed",
                None,
                Some(&error.to_string()),
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
pub async fn list_acp_permissions(
    state: State<'_, Arc<AcpSessionManager>>,
    session_id: String,
) -> AppResult<Vec<AcpPermissionRequest>> {
    let manager = Arc::clone(state.inner());
    run_acp_task(move || manager.list_permissions(&session_id)).await
}

#[tauri::command]
pub async fn respond_acp_permission(
    state: State<'_, Arc<AcpSessionManager>>,
    request: RespondAcpPermissionRequest,
) -> AppResult<()> {
    let manager = Arc::clone(state.inner());
    run_acp_task(move || manager.respond_permission(request)).await
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

async fn run_task_agent_report_against_session(
    manager: Arc<AcpSessionManager>,
    store: &ProjectStore,
    request: RunTaskAgentReportRequest,
    session: AcpSessionInfo,
) -> AppResult<RunTaskAgentReportResultInfo> {
    let task = store.task(&request.task_id)?;
    let phase = request.phase.trim().to_lowercase();
    let role = request.role.trim().to_lowercase();
    validate_task_agent_report_run(&task, &phase, &role)?;
    let instruction = task_agent_report_instruction(&task, &phase, &role);
    let agent_session_id = session.agent_session_id.clone().ok_or_else(|| {
        AppError::Acp("secondary ACP session did not return an agent session id".into())
    })?;
    let acp_session_id = session.id.clone();
    let prompt_manager = Arc::clone(&manager);
    let instruction_for_prompt = instruction.clone();
    let result = async {
        let prompt_result = run_acp_task(move || {
            prompt_manager.send_prompt(&acp_session_id, &instruction_for_prompt)
        })
        .await?;
        let drain_session_id = session.id.clone();
        let drain_manager = Arc::clone(&manager);
        let acp_events =
            run_acp_task(move || drain_manager.drain_events(&drain_session_id)).await?;
        let transcript_events = task_agent_transcript_events(&instruction, acp_events);
        let report_content = task_agent_report_content(&transcript_events)?;
        let TaskAgentReportTranscriptInfo {
            transcript_session,
            report,
        } = store.create_task_agent_report_transcript(CreateTaskAgentReportTranscriptRequest {
            task_id: task.id.clone(),
            phase,
            role,
            transcript_source: task_agent_transcript_source(&session, &request.role),
            transcript_title: Some(task_agent_transcript_title(&task, &request.role)),
            candidate_id: request.candidate_id,
            agent_session_id,
            events: transcript_events,
            content: report_content,
        })?;
        Ok(RunTaskAgentReportResultInfo {
            prompt_result,
            transcript_session,
            report,
        })
    }
    .await;

    let cleanup_session_id = session.id;
    let cleanup_manager = Arc::clone(&manager);
    let cleanup =
        run_acp_task(move || cleanup_manager.stop_and_remove_session(&cleanup_session_id, true))
            .await;
    if result.is_err() {
        let _ = cleanup;
    }
    result
}

fn validate_task_agent_report_run(task: &TaskInfo, phase: &str, role: &str) -> AppResult<()> {
    if !matches!(role, "advisor" | "reviewer") {
        return Err(AppError::InvalidInput(
            "task agent role must be advisor or reviewer".into(),
        ));
    }
    let phase_in_progress = task
        .phases
        .iter()
        .any(|item| item.phase == phase && item.status == "in_progress");
    if task.status != "in_progress" || task.current_phase != phase || !phase_in_progress {
        return Err(AppError::InvalidInput(
            "task agent reports may only target the current in-progress phase".into(),
        ));
    }
    Ok(())
}

fn task_agent_report_instruction(task: &TaskInfo, phase: &str, role: &str) -> String {
    format!(
        "Run only as a secondary {role} for this task.\n\
         Original task: {original}\n\
         Current phase: {phase}\n\
         Do not complete the phase, create evidence, change git state, or modify the executor repository.\n\
         Inspect the snapshot and return a concise report with concrete findings, risks, missing evidence, and recommended next checks.",
        original = task.original_prompt.trim(),
    )
}

fn task_agent_transcript_events(
    instruction: &str,
    acp_events: Vec<AcpSessionEvent>,
) -> Vec<TranscriptEventInput> {
    let mut events = vec![TranscriptEventInput {
        kind: "user_message".into(),
        content: instruction.to_string(),
    }];
    events.extend(
        acp_events
            .into_iter()
            .filter_map(acp_event_to_transcript_event),
    );
    events
}

fn acp_event_to_transcript_event(event: AcpSessionEvent) -> Option<TranscriptEventInput> {
    if event.content.trim().is_empty() {
        return None;
    }
    let kind = match event.kind {
        AcpEventKind::AgentMessage => "agent_message",
        AcpEventKind::Plan => "agent_thought",
        AcpEventKind::UserMessage => "user_message",
        AcpEventKind::ToolCall => "tool_call",
        AcpEventKind::Usage => "usage",
        AcpEventKind::Notice => "notice",
        AcpEventKind::Error => "error",
    };
    Some(TranscriptEventInput {
        kind: kind.into(),
        content: event.content,
    })
}

fn task_agent_report_content(events: &[TranscriptEventInput]) -> AppResult<String> {
    let content = events
        .iter()
        .filter(|event| matches!(event.kind.as_str(), "agent_message" | "agent_thought"))
        .map(|event| event.content.trim())
        .filter(|content| !content.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n");
    if content.is_empty() {
        Err(AppError::InvalidInput(
            "task agent report requires agent output".into(),
        ))
    } else {
        Ok(content)
    }
}

fn task_agent_transcript_source(session: &AcpSessionInfo, role: &str) -> String {
    let agent = session.agent_name.as_deref().unwrap_or("ACP");
    format!("{agent} {}", role.trim().to_lowercase())
}

fn task_agent_transcript_title(task: &TaskInfo, role: &str) -> String {
    format!(
        "{} report: {}",
        role.trim().to_lowercase(),
        task.current_phase
    )
}

async fn run_acp_task<T>(task: impl FnOnce() -> AppResult<T> + Send + 'static) -> AppResult<T>
where
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|err| AppError::Acp(format!("acp task failed: {err}")))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        acp::StartFakeAcpSessionRequest,
        storage::{
            CreateProjectRequest, CreateTaskRequest, CreateTranscriptSessionRequest,
            TransitionTaskPhaseRequest,
        },
    };
    use std::fs;
    use uuid::Uuid;

    fn temp_command_project_path(label: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("aiadne-command-{label}-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).expect("temp command project dir");
        path
    }

    #[test]
    #[cfg(unix)]
    fn run_task_agent_report_persists_fake_agent_output_and_removes_session() {
        tauri::async_runtime::block_on(async {
            let store = ProjectStore::in_memory().expect("store opens");
            let project_path = temp_command_project_path("agent-report");
            let project = store
                .create_project(CreateProjectRequest {
                    name: "AIadne".into(),
                    path: project_path.clone(),
                })
                .expect("project created");
            let executor = store
                .create_transcript_session(CreateTranscriptSessionRequest {
                    project_id: Some(project.id.clone()),
                    runtime: "acp".into(),
                    source: "Codex".into(),
                    title: None,
                })
                .expect("executor transcript");
            let task = store
                .create_task(CreateTaskRequest {
                    project_id: project.id,
                    transcript_session_id: executor.id,
                    original_prompt: "Review secondary reporting".into(),
                })
                .expect("task created");
            let task = store
                .transition_task_phase(TransitionTaskPhaseRequest {
                    task_id: task.id,
                    action: "start".into(),
                })
                .expect("analysis started");
            let manager = Arc::new(AcpSessionManager::default());
            let session = manager
                .start_fake_session(StartFakeAcpSessionRequest {
                    cwd: Some(project_path.clone()),
                })
                .expect("fake secondary starts");

            let result = run_task_agent_report_against_session(
                Arc::clone(&manager),
                &store,
                RunTaskAgentReportRequest {
                    task_id: task.id.clone(),
                    phase: "analysis".into(),
                    role: "advisor".into(),
                    candidate_id: "fake-acp".into(),
                    cwd: project_path.clone(),
                },
                session,
            )
            .await
            .expect("agent report run succeeds");

            assert!(result.report.content.contains("fake acp received prompt"));
            assert_eq!(result.report.role, "advisor");
            assert_eq!(result.transcript_session.event_count, 2);
            assert_eq!(
                store
                    .list_task_agent_reports(&task.id)
                    .expect("reports listed")
                    .len(),
                1
            );
            assert_eq!(
                store
                    .list_transcript_events(&result.transcript_session.id)
                    .expect("transcript events listed")
                    .iter()
                    .filter(|event| event.kind == "agent_message")
                    .count(),
                1
            );
            assert!(manager.list_sessions().expect("sessions list").is_empty());
            let _ = fs::remove_dir_all(project_path);
        });
    }
}
