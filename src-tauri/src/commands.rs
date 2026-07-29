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
        ApplyTaskPlanCritiqueRequest, ApproveTaskPlanVersionRequest,
        CreateAcpTranscriptSessionRequest, CreateKnowledgeItemRequest,
        CreateProjectInitializationRequest, CreateProjectRepositoryRequest, CreateProjectRequest,
        CreateTaskAgentReportRequest, CreateTaskAgentReportTranscriptRequest,
        CreateTaskContextDispatchRequest, CreateTaskPhaseArtifactRequest,
        CreateTaskPhaseRunRequest, CreateTaskPlanCritiqueRequest, CreateTaskPlanStepRunRequest,
        CreateTaskPlanVersionRequest, CreateTaskRequest, CreateTranscriptSessionRequest,
        EvaluateTaskPlanRequest, GenerateProjectInitializationSummaryRequest, KnowledgeItemInfo,
        KnowledgeUnitInfo, LinkTaskPhaseRunEventsRequest, ProjectInfo,
        ProjectInitializationFactInfo, ProjectInitializationGuardrailInfo,
        ProjectInitializationInfo, ProjectInitializationMarkdownFindingInfo,
        ProjectInitializationSummaryInfo, ProjectRepositoryInfo, ProjectStore,
        RegenerateProjectInitializationSummarySectionRequest, RenameTranscriptSessionRequest,
        ResolveTaskContextDispatchRequest, ResolveTaskPhaseRunRequest,
        ReviewProjectInitializationSummaryClaimRequest, ReviewTaskPlanStepRunRequest,
        SaveProjectInitializationGuardrailsRequest, TaskAgentReportInfo,
        TaskAgentReportTranscriptInfo, TaskContextDispatchReceiptInfo, TaskInfo,
        TaskPhaseArtifactInfo, TaskPhaseRunReceiptInfo, TaskPlanCritiqueInfo,
        TaskPlanEvaluationInfo, TaskPlanStepInfo, TaskPlanStepRunInfo, TaskPlanVersionInfo,
        TranscriptAcpIdentityInfo, TranscriptEventInfo, TranscriptEventInput,
        TranscriptSessionInfo, TransitionTaskPhaseRequest, UpdateTaskComplexityRequest,
    },
    synthesis::SynthesisProviderRegistry,
    task_plan_critique::critique_instruction,
    task_worktree::{
        integrate_task_step_worktree, prepare_task_step_worktree, remove_task_step_worktree,
        TaskStepWorktreeInfo,
    },
};
use std::{collections::HashSet, path::PathBuf, sync::Arc};
use tauri::State;
use uuid::Uuid;

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
pub struct SendTaskPlanStepRequest {
    pub task_id: String,
    pub plan_version_id: String,
    pub plan_step_id: String,
    pub acp_session_id: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendIsolatedTaskPlanStepRequest {
    pub task_id: String,
    pub plan_version_id: String,
    pub plan_step_id: String,
    pub candidate_id: String,
    pub repository_path: PathBuf,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPlanStepRunResultInfo {
    pub prompt_result: AcpPromptResult,
    pub receipt: TaskPlanStepRunInfo,
    pub workspace_verification: GitWorkspaceVerificationInfo,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IsolatedTaskPlanStepRunResultInfo {
    pub executor_session: AcpSessionInfo,
    pub prompt_result: AcpPromptResult,
    pub receipt: TaskPlanStepRunInfo,
    pub workspace_verification: GitWorkspaceVerificationInfo,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrateTaskPlanStepRunRequest {
    pub task_id: String,
    pub run_id: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrateTaskPlanStepRunResultInfo {
    pub receipt: TaskPlanStepRunInfo,
    pub cleanup_error: Option<String>,
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

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunTaskWaveEvaluationRequest {
    pub task_id: String,
    pub plan_version_id: String,
    pub candidate_id: String,
    pub cwd: PathBuf,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunTaskPlanCritiqueRequest {
    pub task_id: String,
    pub plan_version_id: String,
    pub evaluation_id: String,
    pub candidate_id: String,
    pub cwd: PathBuf,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunTaskPlanCritiqueResultInfo {
    pub critique: TaskPlanCritiqueInfo,
    pub cached: bool,
    pub prompt_result: Option<AcpPromptResult>,
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
pub fn approve_project_initialization_summary_autopilot(
    state: State<'_, ProjectStore>,
    summary_id: String,
) -> AppResult<ProjectInitializationSummaryInfo> {
    state.approve_project_initialization_summary_autopilot(&summary_id)
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
pub fn create_task_plan_version(
    state: State<'_, ProjectStore>,
    request: CreateTaskPlanVersionRequest,
) -> AppResult<TaskPlanVersionInfo> {
    state.create_task_plan_version(request)
}

#[tauri::command]
pub fn list_task_plan_versions(
    state: State<'_, ProjectStore>,
    task_id: String,
) -> AppResult<Vec<TaskPlanVersionInfo>> {
    state.list_task_plan_versions(&task_id)
}

#[tauri::command]
pub fn approve_task_plan_version(
    state: State<'_, ProjectStore>,
    request: ApproveTaskPlanVersionRequest,
) -> AppResult<TaskPlanVersionInfo> {
    state.approve_task_plan_version(request)
}

#[tauri::command]
pub fn evaluate_task_plan(
    state: State<'_, ProjectStore>,
    request: EvaluateTaskPlanRequest,
) -> AppResult<TaskPlanEvaluationInfo> {
    state.evaluate_task_plan(request)
}

#[tauri::command]
pub fn get_task_plan_evaluation(
    state: State<'_, ProjectStore>,
    plan_version_id: String,
) -> AppResult<Option<TaskPlanEvaluationInfo>> {
    state.task_plan_evaluation(&plan_version_id)
}

#[tauri::command]
pub fn get_task_plan_critique(
    state: State<'_, ProjectStore>,
    evaluation_id: String,
) -> AppResult<Option<TaskPlanCritiqueInfo>> {
    state.task_plan_critique(&evaluation_id)
}

#[tauri::command]
pub fn apply_task_plan_critique(
    state: State<'_, ProjectStore>,
    request: ApplyTaskPlanCritiqueRequest,
) -> AppResult<TaskPlanVersionInfo> {
    state.apply_task_plan_critique(request)
}

#[tauri::command]
pub async fn run_task_plan_critique(
    manager_state: State<'_, Arc<AcpSessionManager>>,
    store_state: State<'_, ProjectStore>,
    request: RunTaskPlanCritiqueRequest,
) -> AppResult<RunTaskPlanCritiqueResultInfo> {
    let (plan, evaluation) = validated_plan_critique_context(store_state.inner(), &request)?;
    if let Some(cached) = store_state.task_plan_critique(&evaluation.id)? {
        return Ok(RunTaskPlanCritiqueResultInfo {
            critique: cached,
            cached: true,
            prompt_result: None,
        });
    }
    let instruction = critique_instruction(&plan, &evaluation.findings)
        .map_err(|error| AppError::Storage(error.to_string()))?;
    let candidate_id = request.candidate_id.trim().to_string();
    if candidate_id.is_empty() {
        return Err(AppError::InvalidInput(
            "plan critique requires an ACP candidate".into(),
        ));
    }
    let start_request = StartAcpRegistrySessionRequest {
        candidate_id,
        cwd: Some(request.cwd.clone()),
        workspace_isolation: Some(AcpWorkspaceIsolation::SnapshotSandbox),
    };
    let manager = Arc::clone(manager_state.inner());
    let start_manager = Arc::clone(&manager);
    let session = run_acp_task(move || start_manager.start_registry_session(start_request)).await?;
    run_task_plan_critique_against_session(
        manager,
        store_state.inner(),
        request,
        session,
        instruction,
    )
    .await
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
pub async fn run_task_wave_evaluation(
    manager_state: State<'_, Arc<AcpSessionManager>>,
    store_state: State<'_, ProjectStore>,
    request: RunTaskWaveEvaluationRequest,
) -> AppResult<RunTaskAgentReportResultInfo> {
    let candidate_id = request.candidate_id.trim().to_string();
    if candidate_id.is_empty() {
        return Err(AppError::InvalidInput(
            "wave evaluation requires an ACP candidate".into(),
        ));
    }
    let (task, instruction) = task_wave_evaluator_instruction(store_state.inner(), &request)?;
    let manager = Arc::clone(manager_state.inner());
    let start_request = StartAcpRegistrySessionRequest {
        candidate_id: candidate_id.clone(),
        cwd: Some(request.cwd.clone()),
        workspace_isolation: Some(AcpWorkspaceIsolation::SnapshotSandbox),
    };
    let start_manager = Arc::clone(&manager);
    let session = run_acp_task(move || start_manager.start_registry_session(start_request)).await?;
    run_task_agent_report_with_instruction(
        manager,
        store_state.inner(),
        RunTaskAgentReportRequest {
            task_id: task.id,
            phase: "execution".into(),
            role: "reviewer".into(),
            candidate_id,
            cwd: request.cwd,
        },
        session,
        instruction,
    )
    .await
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
pub fn list_task_plan_step_runs(
    state: State<'_, ProjectStore>,
    task_id: String,
) -> AppResult<Vec<TaskPlanStepRunInfo>> {
    state.list_task_plan_step_runs(&task_id)
}

#[tauri::command]
pub fn review_task_plan_step_run(
    state: State<'_, ProjectStore>,
    request: ReviewTaskPlanStepRunRequest,
) -> AppResult<TaskPlanStepRunInfo> {
    state.review_task_plan_step_run(request)
}

#[tauri::command]
pub async fn integrate_task_plan_step_run(
    manager_state: State<'_, Arc<AcpSessionManager>>,
    store_state: State<'_, ProjectStore>,
    request: IntegrateTaskPlanStepRunRequest,
) -> AppResult<IntegrateTaskPlanStepRunResultInfo> {
    if let Some(receipt) =
        store_state.finalize_task_plan_step_run_no_change(&request.task_id, &request.run_id)?
    {
        let isolation = task_step_worktree_from_run(&receipt)?;
        let cleanup_manager = Arc::clone(manager_state.inner());
        let cleanup_session_id = receipt.acp_session_id.clone();
        let session_cleanup = run_acp_task(move || {
            cleanup_manager.stop_and_remove_session(&cleanup_session_id, true)
        })
        .await;
        let cleanup_error = match session_cleanup {
            Ok(_) => remove_task_step_worktree(&isolation).err(),
            Err(error) => Some(error),
        }
        .map(|error| error.to_string());
        return Ok(IntegrateTaskPlanStepRunResultInfo {
            receipt,
            cleanup_error,
        });
    }
    let pending =
        store_state.begin_task_plan_step_run_integration(&request.task_id, &request.run_id)?;
    let isolation = task_step_worktree_from_run(&pending)?;
    let integration = match integrate_task_step_worktree(
        &isolation,
        &pending.task_id,
        &pending.plan_step_id,
        &pending.id,
    ) {
        Ok(integration) => integration,
        Err(error) => {
            store_state.finalize_task_plan_step_run_integration(
                &pending.id,
                "conflicted",
                None,
                None,
                Some(&error.to_string()),
            )?;
            return Err(error);
        }
    };
    let receipt = store_state.finalize_task_plan_step_run_integration(
        &pending.id,
        "integrated",
        Some(&integration.isolated_commit_sha),
        Some(&integration.integrated_commit_sha),
        None,
    )?;

    let cleanup_manager = Arc::clone(manager_state.inner());
    let cleanup_session_id = pending.acp_session_id.clone();
    let session_cleanup =
        run_acp_task(move || cleanup_manager.stop_and_remove_session(&cleanup_session_id, true))
            .await;
    let cleanup_error = match session_cleanup {
        Ok(_) => remove_task_step_worktree(&isolation).err(),
        Err(error) => Some(error),
    }
    .map(|error| error.to_string());

    Ok(IntegrateTaskPlanStepRunResultInfo {
        receipt,
        cleanup_error,
    })
}

fn task_step_worktree_from_run(run: &TaskPlanStepRunInfo) -> AppResult<TaskStepWorktreeInfo> {
    let missing = || {
        AppError::InvalidInput("step run does not contain a complete isolation descriptor".into())
    };
    Ok(TaskStepWorktreeInfo {
        isolation_id: run.isolation_id.clone().ok_or_else(missing)?,
        repository_path: PathBuf::from(run.isolation_repository_path.clone().ok_or_else(missing)?),
        worktree_path: PathBuf::from(run.isolation_worktree_path.clone().ok_or_else(missing)?),
        branch: run.isolation_branch.clone().ok_or_else(missing)?,
        base_sha: run.isolation_base_sha.clone().ok_or_else(missing)?,
    })
}

#[tauri::command]
pub async fn send_task_plan_step_prompt(
    manager_state: State<'_, Arc<AcpSessionManager>>,
    store_state: State<'_, ProjectStore>,
    request: SendTaskPlanStepRequest,
) -> AppResult<TaskPlanStepRunResultInfo> {
    send_task_plan_step_prompt_with_manager(
        Arc::clone(manager_state.inner()),
        store_state.inner(),
        request,
    )
    .await
}

#[tauri::command]
pub async fn send_isolated_task_plan_step_prompt(
    manager_state: State<'_, Arc<AcpSessionManager>>,
    store_state: State<'_, ProjectStore>,
    request: SendIsolatedTaskPlanStepRequest,
) -> AppResult<IsolatedTaskPlanStepRunResultInfo> {
    let candidate_id = request.candidate_id.trim().to_string();
    if candidate_id.is_empty() {
        return Err(AppError::InvalidInput(
            "isolated step dispatch requires an ACP candidate".into(),
        ));
    }
    send_isolated_task_plan_step_prompt_with_starter(
        Arc::clone(manager_state.inner()),
        store_state.inner(),
        request,
        move |manager, cwd| {
            manager.start_registry_session(StartAcpRegistrySessionRequest {
                candidate_id,
                cwd: Some(cwd),
                workspace_isolation: None,
            })
        },
    )
    .await
}

async fn send_isolated_task_plan_step_prompt_with_starter<F>(
    manager: Arc<AcpSessionManager>,
    store: &ProjectStore,
    request: SendIsolatedTaskPlanStepRequest,
    starter: F,
) -> AppResult<IsolatedTaskPlanStepRunResultInfo>
where
    F: FnOnce(Arc<AcpSessionManager>, PathBuf) -> AppResult<AcpSessionInfo> + Send + 'static,
{
    let task = store.task(&request.task_id)?;
    let plan = store
        .list_task_plan_versions(&task.id)?
        .into_iter()
        .find(|plan| plan.id == request.plan_version_id && plan.status == "approved")
        .ok_or_else(|| {
            AppError::InvalidInput(
                "isolated dispatch requires the selected Task's approved plan".into(),
            )
        })?;
    let step = plan
        .steps
        .iter()
        .find(|step| step.id == request.plan_step_id)
        .cloned()
        .ok_or_else(|| {
            AppError::InvalidInput(
                "isolated dispatch requires a step from the approved plan".into(),
            )
        })?;
    if !store
        .list_project_repositories(&task.project_id)?
        .iter()
        .any(|repository| repository.path == request.repository_path)
    {
        return Err(AppError::InvalidInput(
            "isolated dispatch repository does not belong to the Task project".into(),
        ));
    }
    let attempt = store
        .list_task_plan_step_runs(&task.id)?
        .iter()
        .filter(|run| run.plan_step_id == step.id)
        .map(|run| run.attempt)
        .max()
        .unwrap_or(0)
        + 1;
    let isolation = prepare_task_step_worktree(
        &request.repository_path,
        &task.id,
        (step.order_index + 1) as usize,
        attempt as usize,
        &Uuid::new_v4().to_string(),
    )?;
    let start_manager = Arc::clone(&manager);
    let start_path = isolation.worktree_path.clone();
    let executor_session = match run_acp_task(move || starter(start_manager, start_path)).await {
        Ok(session) => session,
        Err(error) => {
            let _ = remove_task_step_worktree(&isolation);
            return Err(error);
        }
    };
    let instruction = task_plan_step_instruction(&task, &plan, &step);
    let receipt = match store.begin_task_plan_step_run(CreateTaskPlanStepRunRequest {
        task_id: task.id.clone(),
        plan_version_id: plan.id,
        plan_step_id: step.id,
        acp_session_id: executor_session.id.clone(),
        instruction: instruction.clone(),
    }) {
        Ok(receipt) => receipt,
        Err(error) => {
            let _ = manager.stop_and_remove_session(&executor_session.id, true);
            let _ = remove_task_step_worktree(&isolation);
            return Err(error);
        }
    };
    if let Err(error) = store.record_task_plan_step_run_isolation(&receipt.id, &isolation) {
        let _ = store.finalize_task_plan_step_run(
            &receipt.id,
            "failed",
            None,
            Some(&error.to_string()),
        );
        let _ = manager.stop_and_remove_session(&executor_session.id, true);
        let _ = remove_task_step_worktree(&isolation);
        return Err(error);
    }
    let before = capture_git_workspace_snapshot(&isolation.worktree_path);
    let receipt_id = receipt.id;
    let acp_session_id = executor_session.id.clone();
    let prompt_manager = Arc::clone(&manager);
    match run_acp_task(move || prompt_manager.send_prompt(&acp_session_id, &instruction)).await {
        Ok(prompt_result) => {
            store.finalize_task_plan_step_run(
                &receipt_id,
                "sent",
                Some(&prompt_result.stop_reason),
                None,
            )?;
            let workspace_verification = compare_git_workspace_snapshots(
                task.id,
                "execution".into(),
                &isolation.worktree_path,
                before,
                capture_git_workspace_snapshot(&isolation.worktree_path),
            );
            let touched_files_json = serde_json::to_string(&workspace_verification.touched_files)
                .map_err(|error| AppError::Storage(error.to_string()))?;
            let receipt = store.record_task_plan_step_run_verification(
                &receipt_id,
                &workspace_verification.status,
                &workspace_verification.workspace_path,
                &touched_files_json,
                workspace_verification.error.as_deref(),
            )?;
            Ok(IsolatedTaskPlanStepRunResultInfo {
                executor_session,
                prompt_result,
                receipt,
                workspace_verification,
            })
        }
        Err(error) => {
            store.finalize_task_plan_step_run(
                &receipt_id,
                "failed",
                None,
                Some(&error.to_string()),
            )?;
            Err(error)
        }
    }
}

async fn send_task_plan_step_prompt_with_manager(
    manager: Arc<AcpSessionManager>,
    store: &ProjectStore,
    request: SendTaskPlanStepRequest,
) -> AppResult<TaskPlanStepRunResultInfo> {
    let task = store.task(&request.task_id)?;
    let plan = store
        .list_task_plan_versions(&task.id)?
        .into_iter()
        .find(|plan| plan.id == request.plan_version_id && plan.status == "approved")
        .ok_or_else(|| {
            AppError::InvalidInput(
                "step dispatch requires the selected Task's approved plan".into(),
            )
        })?;
    let step = plan
        .steps
        .iter()
        .find(|step| step.id == request.plan_step_id)
        .cloned()
        .ok_or_else(|| {
            AppError::InvalidInput(
                "step dispatch requires a step from the selected approved plan".into(),
            )
        })?;
    let instruction = task_plan_step_instruction(&task, &plan, &step);
    let acp_session_id = request.acp_session_id.trim().to_string();
    let workspace = {
        let manager = Arc::clone(&manager);
        let session_id = acp_session_id.clone();
        run_acp_task(move || {
            manager
                .list_sessions()?
                .into_iter()
                .find(|session| session.id == session_id)
                .map(|session| session.cwd)
                .ok_or_else(|| AppError::InvalidInput("active ACP session not found".into()))
        })
        .await?
    };
    let workspace_allowed = store
        .list_project_repositories(&task.project_id)?
        .iter()
        .any(|repository| repository.path == workspace);
    if !workspace_allowed {
        return Err(AppError::InvalidInput(
            "active ACP workspace does not belong to the selected Task project".into(),
        ));
    }
    let before = capture_git_workspace_snapshot(&workspace);
    let receipt = store.begin_task_plan_step_run(CreateTaskPlanStepRunRequest {
        task_id: task.id.clone(),
        plan_version_id: plan.id,
        plan_step_id: step.id,
        acp_session_id: acp_session_id.clone(),
        instruction: instruction.clone(),
    })?;
    let receipt_id = receipt.id.clone();
    let prompt_manager = Arc::clone(&manager);
    match run_acp_task(move || prompt_manager.send_prompt(&acp_session_id, &instruction)).await {
        Ok(prompt_result) => {
            store.finalize_task_plan_step_run(
                &receipt_id,
                "sent",
                Some(&prompt_result.stop_reason),
                None,
            )?;
            let workspace_verification = compare_git_workspace_snapshots(
                task.id,
                "execution".into(),
                &workspace,
                before,
                capture_git_workspace_snapshot(&workspace),
            );
            let touched_files_json = serde_json::to_string(&workspace_verification.touched_files)
                .map_err(|error| AppError::Storage(error.to_string()))?;
            let receipt = store.record_task_plan_step_run_verification(
                &receipt_id,
                &workspace_verification.status,
                &workspace_verification.workspace_path,
                &touched_files_json,
                workspace_verification.error.as_deref(),
            )?;
            Ok(TaskPlanStepRunResultInfo {
                prompt_result,
                receipt,
                workspace_verification,
            })
        }
        Err(error) => {
            store.finalize_task_plan_step_run(
                &receipt_id,
                "failed",
                None,
                Some(&error.to_string()),
            )?;
            Err(error)
        }
    }
}

fn task_plan_step_instruction(
    task: &TaskInfo,
    plan: &TaskPlanVersionInfo,
    step: &TaskPlanStepInfo,
) -> String {
    let requirements = plan
        .requirements
        .iter()
        .filter(|requirement| step.satisfies.contains(&requirement.id))
        .take(20)
        .map(|requirement| {
            format!(
                "- {}: {}",
                bounded_instruction_field(&requirement.id, 100),
                bounded_instruction_field(&requirement.text, 1_000)
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let criteria = step
        .acceptance_criteria
        .iter()
        .take(20)
        .map(|criterion| format!("- {}", bounded_instruction_field(criterion, 1_000)))
        .collect::<Vec<_>>()
        .join("\n");
    let paths = if step.expected_paths.is_empty() {
        "- No expected paths were declared; inspect narrowly and report the exact required scope before writing.".into()
    } else {
        step.expected_paths
            .iter()
            .take(50)
            .map(|path| format!("- {}", bounded_instruction_field(path, 500)))
            .collect::<Vec<_>>()
            .join("\n")
    };
    format!(
        "Execute exactly one approved plan step.\n\
         Task: {task}\n\
         Plan version: {version}\n\
         Step {number}: {title}\n\
         Step ID: {step_id}\n\
         Required model tier: {tier}\n\
         Description: {description}\n\n\
         Requirements satisfied by this step:\n{requirements}\n\n\
         Acceptance criteria:\n{criteria}\n\n\
         Expected write scope:\n{paths}\n\n\
         Boundaries:\n\
         - Work only on this step; do not implement later plan steps.\n\
         - Do not commit, complete the Task, advance phases, or claim acceptance.\n\
         - Keep writes within the expected scope. If another path is necessary, stop and explain why before changing it.\n\
         - Run focused verification and report changed files, checks, failures, and uncertainty.\n\
         - Return a concise step result in the transcript.",
        task = bounded_instruction_field(&task.original_prompt, 4_000),
        version = plan.version,
        number = step.order_index + 1,
        title = bounded_instruction_field(&step.title, 500),
        step_id = step.id,
        tier = match step.complexity {
            1..=2 => "small",
            3 => "mid",
            _ => "high",
        },
        description = bounded_instruction_field(&step.description, 4_000),
    )
}

fn bounded_instruction_field(value: &str, max_chars: usize) -> String {
    let trimmed = value.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }
    let mut bounded = trimmed.chars().take(max_chars).collect::<String>();
    bounded.push('…');
    bounded
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
    run_task_agent_report_with_instruction(manager, store, request, session, instruction).await
}

async fn run_task_agent_report_with_instruction(
    manager: Arc<AcpSessionManager>,
    store: &ProjectStore,
    request: RunTaskAgentReportRequest,
    session: AcpSessionInfo,
    instruction: String,
) -> AppResult<RunTaskAgentReportResultInfo> {
    let task = store.task(&request.task_id)?;
    let phase = request.phase.trim().to_lowercase();
    let role = request.role.trim().to_lowercase();
    validate_task_agent_report_run(&task, &phase, &role)?;
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

fn task_wave_evaluator_instruction(
    store: &ProjectStore,
    request: &RunTaskWaveEvaluationRequest,
) -> AppResult<(TaskInfo, String)> {
    let task = store.task(request.task_id.trim())?;
    validate_task_agent_report_run(&task, "execution", "reviewer")?;
    if !store
        .list_project_repositories(&task.project_id)?
        .iter()
        .any(|repository| repository.path == request.cwd)
    {
        return Err(AppError::InvalidInput(
            "wave evaluation repository does not belong to the Task project".into(),
        ));
    }
    let plan = store
        .list_task_plan_versions(&task.id)?
        .into_iter()
        .find(|plan| plan.id == request.plan_version_id.trim() && plan.status == "approved")
        .ok_or_else(|| {
            AppError::InvalidInput(
                "wave evaluation requires the selected Task's approved plan".into(),
            )
        })?;
    let runs = store.list_task_plan_step_runs(&task.id)?;
    let completed = runs
        .iter()
        .filter(|run| {
            run.status == "accepted"
                && (run.verification_status.as_deref() == Some("unchanged")
                    || run.isolation_id.is_none()
                    || run.integration_status.as_deref() == Some("integrated"))
        })
        .map(|run| format!("STEP-{}", run.step_order_index + 1))
        .collect::<HashSet<_>>();
    let eligible = crate::task_plan::eligible_execution_step_ids(&plan.steps, &completed);
    if eligible.is_empty() {
        return Err(AppError::InvalidInput(
            "wave evaluation requires an incomplete execution wave".into(),
        ));
    }
    let mut evidence = Vec::new();
    for step_id in eligible {
        let step = plan
            .steps
            .iter()
            .find(|step| step.id == step_id)
            .ok_or_else(|| AppError::InvalidInput("wave step is missing from its plan".into()))?;
        let run = runs
            .iter()
            .filter(|run| run.plan_step_id == step.id)
            .max_by_key(|run| run.attempt)
            .ok_or_else(|| {
                AppError::InvalidInput(
                    "wave evaluation waits for every current-wave step to run".into(),
                )
            })?;
        if !matches!(run.status.as_str(), "sent" | "failed") {
            return Err(AppError::InvalidInput(
                "wave evaluation waits for every current-wave worker to settle".into(),
            ));
        }
        let changed = run
            .verification_changed_files
            .iter()
            .take(12)
            .cloned()
            .collect::<Vec<_>>()
            .join(", ");
        evidence.push(format!(
            "- STEP-{order} / {step_id} / run {run_id} / attempt {attempt}\n  \
             title: {title}\n  status: {status}; verification: {verification}; scope: {scope}; \
             integration: {integration}\n  changed files: {changed}\n  error: {error}",
            order = step.order_index + 1,
            step_id = step.id,
            run_id = run.id,
            attempt = run.attempt,
            title = step.title,
            status = run.status,
            verification = run.verification_status.as_deref().unwrap_or("missing"),
            scope = run.scope_status.as_deref().unwrap_or("missing"),
            integration = run.integration_status.as_deref().unwrap_or("not_started"),
            changed = if changed.is_empty() { "none" } else { &changed },
            error = run.error.as_deref().unwrap_or("none"),
        ));
    }
    let instruction = format!(
        "Run only as a read-only execution-wave evaluator.\n\
         Original task: {original}\n\
         Approved plan: {plan_id}\n\
         Exact current-wave evidence:\n{evidence}\n\n\
         Do not modify files, Git state, Task state, reviews, evidence, or integration state.\n\
         Evaluate only these runs. Return JSON only with this exact shape: \
         {{\"runs\":[{{\"runId\":\"exact persisted run ID\",\"verdict\":\"pass or needs_attention\",\
         \"summary\":\"short recommendation\",\"evidence\":[\"exact observed verification or scope fact\"]}}],\
         \"overall\":\"pass or needs_attention\",\"recommendation\":\"one bounded next action\"}}. \
         Include exactly one item for every supplied run ID. Cite only observed verification, scope, \
         changed-file, status, or error facts above. A worker failure or missing evidence must be \
         needs_attention. Never claim a check that is absent above and never wrap the JSON in prose.",
        original = task.original_prompt.trim(),
        plan_id = plan.id,
        evidence = evidence.join("\n"),
    );
    Ok((task, instruction))
}

fn validated_plan_critique_context(
    store: &ProjectStore,
    request: &RunTaskPlanCritiqueRequest,
) -> AppResult<(TaskPlanVersionInfo, TaskPlanEvaluationInfo)> {
    let task = store.task(&request.task_id)?;
    let planning_in_progress = task.status == "in_progress"
        && task.current_phase == "planning"
        && task
            .phases
            .iter()
            .any(|phase| phase.phase == "planning" && phase.status == "in_progress");
    if !planning_in_progress {
        return Err(AppError::InvalidInput(
            "plan critique may only run during the in-progress planning phase".into(),
        ));
    }
    let plan = store
        .list_task_plan_versions(&task.id)?
        .into_iter()
        .find(|plan| plan.id == request.plan_version_id && plan.status == "draft")
        .ok_or_else(|| {
            AppError::InvalidInput("plan critique requires a draft from the selected task".into())
        })?;
    let evaluation = store
        .task_plan_evaluation(&plan.id)?
        .filter(|item| item.id == request.evaluation_id && item.task_id == task.id)
        .ok_or_else(|| {
            AppError::InvalidInput(
                "plan critique requires the persisted evaluation for this plan version".into(),
            )
        })?;
    Ok((plan, evaluation))
}

async fn run_task_plan_critique_against_session(
    manager: Arc<AcpSessionManager>,
    store: &ProjectStore,
    request: RunTaskPlanCritiqueRequest,
    session: AcpSessionInfo,
    instruction: String,
) -> AppResult<RunTaskPlanCritiqueResultInfo> {
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
        let events = run_acp_task(move || drain_manager.drain_events(&drain_session_id)).await?;
        let response =
            task_agent_report_content(&task_agent_transcript_events(&instruction, events))?;
        let critique = store.create_task_plan_critique(CreateTaskPlanCritiqueRequest {
            task_id: request.task_id,
            plan_version_id: request.plan_version_id,
            evaluation_id: request.evaluation_id,
            source: request.candidate_id,
            response,
        })?;
        Ok(RunTaskPlanCritiqueResultInfo {
            critique,
            cached: false,
            prompt_result: Some(prompt_result),
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
            ApproveTaskPlanVersionRequest, CreateProjectRequest, CreateTaskPhaseArtifactRequest,
            CreateTaskPlanVersionRequest, CreateTaskRequest, CreateTranscriptSessionRequest,
            EvaluateTaskPlanRequest, TaskPlanRequirementInput, TaskPlanStepInput,
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

    #[cfg(unix)]
    fn initialize_command_git_repo(path: &PathBuf) {
        fs::write(path.join("README.md"), "# Test\n").expect("seed file");
        for args in [
            vec!["init"],
            vec!["add", "README.md"],
            vec![
                "-c",
                "user.email=test@example.com",
                "-c",
                "user.name=AIadne Test",
                "commit",
                "-m",
                "initial",
            ],
        ] {
            let status = std::process::Command::new("git")
                .args(args)
                .current_dir(path)
                .status()
                .expect("git command starts");
            assert!(status.success());
        }
    }

    #[test]
    fn step_instruction_is_bounded_to_one_approved_step() {
        let task = TaskInfo {
            id: "task-1".into(),
            project_id: "project-1".into(),
            transcript_session_id: "transcript-1".into(),
            original_prompt: "Build both authentication and billing".into(),
            status: "in_progress".into(),
            current_phase: "execution".into(),
            initial_complexity_profile: "standard".into(),
            initial_complexity_reasons: vec![],
            initial_complexity_confidence: 50,
            complexity_profile: "standard".into(),
            complexity_reasons: vec![],
            complexity_confidence: Some(50),
            complexity_source: "system".into(),
            complexity_assessment_version: "test".into(),
            complexity_changes: vec![],
            phases: vec![],
            created_at: 1,
            updated_at: 1,
        };
        let plan = TaskPlanVersionInfo {
            id: "plan-1".into(),
            task_id: task.id.clone(),
            version: 2,
            status: "approved".into(),
            source_artifact_id: "artifact-1".into(),
            requirements: vec![
                crate::storage::TaskPlanRequirementInfo {
                    id: "REQ-AUTH".into(),
                    text: "Authentication is enforced".into(),
                    kind: "functional".into(),
                    order_index: 0,
                },
                crate::storage::TaskPlanRequirementInfo {
                    id: "REQ-BILLING".into(),
                    text: "Billing is implemented later".into(),
                    kind: "functional".into(),
                    order_index: 1,
                },
            ],
            steps: vec![],
            created_at: 1,
            approved_at: Some(1),
        };
        let step = TaskPlanStepInfo {
            id: "step-auth".into(),
            order_index: 0,
            title: "Add authentication guard".into(),
            description: "Implement only the route guard".into(),
            kind: "implementation".into(),
            complexity: 2,
            acceptance_criteria: vec!["Unauthorized requests are rejected".into()],
            expected_paths: vec!["src/auth.ts".into()],
            satisfies: vec!["REQ-AUTH".into()],
            depends_on: vec![],
        };

        let instruction = task_plan_step_instruction(&task, &plan, &step);

        assert!(instruction.contains("Step ID: step-auth"));
        assert!(instruction.contains("Required model tier: small"));
        assert!(instruction.contains("REQ-AUTH: Authentication is enforced"));
        assert!(!instruction.contains("Billing is implemented later"));
        assert!(instruction.contains("- src/auth.ts"));
        assert!(instruction.contains("do not implement later plan steps"));
        assert!(instruction.contains("Do not commit"));
        assert_eq!(
            bounded_instruction_field(&"x".repeat(5_000), 4_000)
                .chars()
                .count(),
            4_001
        );
    }

    #[test]
    #[cfg(unix)]
    fn dispatches_one_plan_step_and_persists_its_sent_receipt() {
        tauri::async_runtime::block_on(async {
            let store = ProjectStore::in_memory().expect("store opens");
            let project_path = temp_command_project_path("step-dispatch");
            initialize_command_git_repo(&project_path);
            let project = store
                .create_project(CreateProjectRequest {
                    name: "AIadne".into(),
                    path: project_path.clone(),
                })
                .expect("project created");
            store.seed_ready_project_knowledge(&project.id);
            let transcript = store
                .create_transcript_session(CreateTranscriptSessionRequest {
                    project_id: Some(project.id.clone()),
                    runtime: "acp".into(),
                    source: "Codex".into(),
                    title: None,
                })
                .expect("transcript created");
            let task = store
                .create_task(CreateTaskRequest {
                    project_id: project.id,
                    transcript_session_id: transcript.id.clone(),
                    original_prompt: "Implement the approved bounded change".into(),
                })
                .expect("task created");
            let evidence_event = store
                .append_transcript_events(
                    &transcript.id,
                    vec![TranscriptEventInput {
                        kind: "agent_message".into(),
                        content: "Phase evidence".into(),
                    }],
                )
                .expect("event saved")
                .remove(0);
            store
                .transition_task_phase(TransitionTaskPhaseRequest {
                    task_id: task.id.clone(),
                    action: "start".into(),
                })
                .expect("analysis starts");
            store
                .create_task_phase_artifact(CreateTaskPhaseArtifactRequest {
                    task_id: task.id.clone(),
                    phase: "analysis".into(),
                    kind: "summary".into(),
                    content: "Analysis evidence".into(),
                    source_transcript_event_ids: vec![evidence_event.id.clone()],
                })
                .expect("analysis evidence");
            store
                .transition_task_phase(TransitionTaskPhaseRequest {
                    task_id: task.id.clone(),
                    action: "complete".into(),
                })
                .expect("analysis completes");
            store
                .transition_task_phase(TransitionTaskPhaseRequest {
                    task_id: task.id.clone(),
                    action: "start".into(),
                })
                .expect("planning starts");
            let planning_artifact = store
                .create_task_phase_artifact(CreateTaskPhaseArtifactRequest {
                    task_id: task.id.clone(),
                    phase: "planning".into(),
                    kind: "summary".into(),
                    content: "Planning evidence".into(),
                    source_transcript_event_ids: vec![evidence_event.id],
                })
                .expect("planning evidence");
            let plan = store
                .create_task_plan_version(CreateTaskPlanVersionRequest {
                    task_id: task.id.clone(),
                    source_artifact_id: planning_artifact.id,
                    requirements: vec![TaskPlanRequirementInput {
                        id: "REQ-1".into(),
                        text: "The bounded change works".into(),
                        kind: "functional".into(),
                    }],
                    steps: vec![
                        TaskPlanStepInput {
                            title: "Implement bounded change".into(),
                            description: "Touch only the declared file".into(),
                            kind: "implementation".into(),
                            complexity: 2,
                            acceptance_criteria: vec!["Focused check passes".into()],
                            expected_paths: vec!["src/bounded.rs".into()],
                            satisfies: vec!["REQ-1".into()],
                            depends_on: vec![],
                        },
                        TaskPlanStepInput {
                            title: "Verify bounded change".into(),
                            description: "Run the focused verification".into(),
                            kind: "infrastructure".into(),
                            complexity: 1,
                            acceptance_criteria: vec!["Verification is recorded".into()],
                            expected_paths: vec![],
                            satisfies: vec![],
                            depends_on: vec!["STEP-1".into()],
                        },
                    ],
                })
                .expect("plan created");
            store
                .evaluate_task_plan(EvaluateTaskPlanRequest {
                    task_id: task.id.clone(),
                    plan_version_id: plan.id.clone(),
                })
                .expect("plan evaluated");
            let plan = store
                .approve_task_plan_version(ApproveTaskPlanVersionRequest {
                    task_id: task.id.clone(),
                    plan_version_id: plan.id.clone(),
                })
                .expect("plan approved");
            store
                .transition_task_phase(TransitionTaskPhaseRequest {
                    task_id: task.id.clone(),
                    action: "complete".into(),
                })
                .expect("planning completes");
            store
                .transition_task_phase(TransitionTaskPhaseRequest {
                    task_id: task.id.clone(),
                    action: "start".into(),
                })
                .expect("execution starts");
            let manager = Arc::new(AcpSessionManager::default());
            let session = manager
                .start_fake_session(StartFakeAcpSessionRequest {
                    cwd: Some(project_path.clone()),
                })
                .expect("fake executor starts");

            let result = send_task_plan_step_prompt_with_manager(
                Arc::clone(&manager),
                &store,
                SendTaskPlanStepRequest {
                    task_id: task.id.clone(),
                    plan_version_id: plan.id.clone(),
                    plan_step_id: plan.steps[0].id.clone(),
                    acp_session_id: session.id.clone(),
                },
            )
            .await
            .expect("step dispatch succeeds");

            assert_eq!(result.receipt.status, "sent");
            assert_eq!(result.receipt.plan_step_id, plan.steps[0].id);
            assert_eq!(
                result.receipt.verification_status.as_deref(),
                Some("unchanged")
            );
            assert_eq!(result.receipt.scope_status.as_deref(), Some("within_scope"));
            assert!(result.receipt.verification_changed_files.is_empty());
            assert!(result.receipt.instruction.contains("Execute exactly one"));
            assert!(result
                .receipt
                .instruction
                .contains("Required model tier: small"));
            let (_, evaluator_instruction) = task_wave_evaluator_instruction(
                &store,
                &RunTaskWaveEvaluationRequest {
                    task_id: task.id.clone(),
                    plan_version_id: plan.id.clone(),
                    candidate_id: "fake-acp".into(),
                    cwd: project_path.clone(),
                },
            )
            .expect("settled current wave builds evaluator evidence");
            assert!(evaluator_instruction.contains(&result.receipt.id));
            assert!(evaluator_instruction.contains("verification: unchanged"));
            assert!(evaluator_instruction.contains("scope: within_scope"));
            assert!(evaluator_instruction.contains("STEP-1"));
            assert!(!evaluator_instruction.contains("STEP-2 /"));
            assert!(evaluator_instruction.contains("Do not modify files, Git state"));
            assert!(evaluator_instruction.contains("\"verdict\":\"pass or needs_attention\""));
            assert!(evaluator_instruction
                .contains("Include exactly one item for every supplied run ID"));
            let wrong_evaluator_path = temp_command_project_path("wrong-evaluator-workspace");
            let evaluator_error = task_wave_evaluator_instruction(
                &store,
                &RunTaskWaveEvaluationRequest {
                    task_id: task.id.clone(),
                    plan_version_id: plan.id.clone(),
                    candidate_id: "fake-acp".into(),
                    cwd: wrong_evaluator_path,
                },
            )
            .expect_err("unregistered evaluator repository rejected");
            assert!(evaluator_error
                .to_string()
                .contains("repository does not belong to the Task project"));
            store
                .review_task_plan_step_run(ReviewTaskPlanStepRunRequest {
                    task_id: task.id.clone(),
                    run_id: result.receipt.id.clone(),
                    decision: "accept".into(),
                    note: "Fake run stayed within the expected scope".into(),
                })
                .expect("first step accepted for failure-path setup");
            let other_path = temp_command_project_path("wrong-step-workspace");
            let mismatched = manager
                .start_fake_session(StartFakeAcpSessionRequest {
                    cwd: Some(other_path.clone()),
                })
                .expect("mismatched executor starts");
            let mismatch = send_task_plan_step_prompt_with_manager(
                Arc::clone(&manager),
                &store,
                SendTaskPlanStepRequest {
                    task_id: task.id.clone(),
                    plan_version_id: plan.id.clone(),
                    plan_step_id: plan.steps[1].id.clone(),
                    acp_session_id: mismatched.id.clone(),
                },
            )
            .await
            .expect_err("cross-project workspace rejected");
            assert!(mismatch.to_string().contains("does not belong"));
            assert_eq!(
                store
                    .list_task_plan_step_runs(&task.id)
                    .expect("mismatch creates no receipt")
                    .len(),
                1
            );
            manager
                .stop_and_remove_session(&mismatched.id, true)
                .expect("mismatched executor stops");
            let _ = fs::remove_dir_all(other_path);
            let stopped = manager
                .start_fake_session(StartFakeAcpSessionRequest {
                    cwd: Some(project_path.clone()),
                })
                .expect("second fake executor starts");
            manager
                .stop_session(&stopped.id, true)
                .expect("second executor stops but remains registered");
            let _failed = send_task_plan_step_prompt_with_manager(
                Arc::clone(&manager),
                &store,
                SendTaskPlanStepRequest {
                    task_id: task.id.clone(),
                    plan_version_id: plan.id.clone(),
                    plan_step_id: plan.steps[1].id.clone(),
                    acp_session_id: stopped.id,
                },
            )
            .await
            .expect_err("stopped executor fails dispatch");
            let runs = store
                .list_task_plan_step_runs(&task.id)
                .expect("runs listed");
            assert_eq!(runs.len(), 2);
            assert_eq!(runs[0].status, "accepted");
            assert_eq!(runs[1].status, "failed");
            assert!(runs[1]
                .error
                .as_deref()
                .is_some_and(|error| !error.is_empty()));
            let worktrees = || {
                std::process::Command::new("git")
                    .current_dir(&project_path)
                    .args(["worktree", "list", "--porcelain"])
                    .output()
                    .expect("worktrees listed")
                    .stdout
            };
            let unregistered = send_isolated_task_plan_step_prompt_with_starter(
                Arc::clone(&manager),
                &store,
                SendIsolatedTaskPlanStepRequest {
                    task_id: task.id.clone(),
                    plan_version_id: plan.id.clone(),
                    plan_step_id: plan.steps[1].id.clone(),
                    candidate_id: "fake".into(),
                    repository_path: PathBuf::from("/unregistered/repository"),
                },
                |_manager, _cwd| panic!("starter must not run for an unregistered repository"),
            )
            .await
            .expect_err("unregistered repository rejected before startup");
            assert!(unregistered.to_string().contains("does not belong"));
            let before_start_failure = worktrees();
            let startup_error = send_isolated_task_plan_step_prompt_with_starter(
                Arc::clone(&manager),
                &store,
                SendIsolatedTaskPlanStepRequest {
                    task_id: task.id.clone(),
                    plan_version_id: plan.id.clone(),
                    plan_step_id: plan.steps[1].id.clone(),
                    candidate_id: "fake".into(),
                    repository_path: project_path.clone(),
                },
                |_manager, _cwd| Err(AppError::Acp("startup failed".into())),
            )
            .await
            .expect_err("startup failure rolls isolation back");
            assert!(startup_error.to_string().contains("startup failed"));
            assert_eq!(worktrees(), before_start_failure);

            let prompt_error = send_isolated_task_plan_step_prompt_with_starter(
                Arc::clone(&manager),
                &store,
                SendIsolatedTaskPlanStepRequest {
                    task_id: task.id.clone(),
                    plan_version_id: plan.id.clone(),
                    plan_step_id: plan.steps[1].id.clone(),
                    candidate_id: "fake".into(),
                    repository_path: project_path.clone(),
                },
                |manager, cwd| {
                    let session = manager
                        .start_fake_session(StartFakeAcpSessionRequest { cwd: Some(cwd) })?;
                    manager.stop_session(&session.id, true)?;
                    Ok(session)
                },
            )
            .await
            .expect_err("prompt failure retains recovery state");
            assert!(!prompt_error.to_string().is_empty());
            let retained = store
                .list_task_plan_step_runs(&task.id)
                .expect("retained run listed")
                .into_iter()
                .last()
                .expect("retained run");
            assert_eq!(retained.status, "failed");
            let retained_isolation = crate::task_worktree::TaskStepWorktreeInfo {
                isolation_id: retained.isolation_id.expect("retained isolation id"),
                repository_path: project_path.clone(),
                worktree_path: PathBuf::from(
                    retained.isolation_worktree_path.expect("retained worktree"),
                ),
                branch: retained.isolation_branch.expect("retained branch"),
                base_sha: retained.isolation_base_sha.expect("retained base"),
            };
            assert!(retained_isolation.worktree_path.exists());
            manager
                .stop_and_remove_session(&retained.acp_session_id, true)
                .expect("failed isolated executor removed");
            remove_task_step_worktree(&retained_isolation)
                .expect("retained isolation explicitly cleaned");
            let isolated = send_isolated_task_plan_step_prompt_with_starter(
                Arc::clone(&manager),
                &store,
                SendIsolatedTaskPlanStepRequest {
                    task_id: task.id.clone(),
                    plan_version_id: plan.id,
                    plan_step_id: plan.steps[1].id.clone(),
                    candidate_id: "fake".into(),
                    repository_path: project_path.clone(),
                },
                |manager, cwd| {
                    manager.start_fake_session(StartFakeAcpSessionRequest { cwd: Some(cwd) })
                },
            )
            .await
            .expect("isolated retry succeeds");
            assert_eq!(
                isolated.executor_session.cwd,
                PathBuf::from(
                    isolated
                        .receipt
                        .isolation_worktree_path
                        .as_deref()
                        .expect("worktree persisted")
                )
            );
            assert_eq!(
                isolated.receipt.isolation_repository_path.as_deref(),
                project_path.to_str()
            );
            assert_eq!(
                isolated.receipt.verification_workspace_path,
                isolated.receipt.isolation_worktree_path
            );
            let isolation = crate::task_worktree::TaskStepWorktreeInfo {
                isolation_id: isolated.receipt.isolation_id.clone().expect("isolation id"),
                repository_path: project_path.clone(),
                worktree_path: isolated.executor_session.cwd.clone(),
                branch: isolated.receipt.isolation_branch.clone().expect("branch"),
                base_sha: isolated.receipt.isolation_base_sha.clone().expect("base"),
            };
            manager
                .stop_and_remove_session(&isolated.executor_session.id, true)
                .expect("isolated executor stops");
            remove_task_step_worktree(&isolation).expect("isolated worktree removed");
            manager
                .stop_and_remove_session(&session.id, true)
                .expect("fake executor stops");
            let _ = fs::remove_dir_all(project_path);
        });
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
            store.seed_ready_project_knowledge(&project.id);
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
