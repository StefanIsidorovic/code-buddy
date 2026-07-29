use crate::errors::{AppError, AppResult};
use crate::models::{
    model_profile, ModelParameterInfo, ModelProfileInfo, MODEL_CATALOG_SCHEMA_VERSION,
    PROJECT_KNOWLEDGE_SCHEMA_VERSION,
};
use crate::synthesis::ProjectInitializationKnowledgeDraft;
use crate::task::{assess_task_complexity, is_task_complexity_profile};
use crate::task_plan::{self, TaskPlanFindingInfo};
use crate::task_plan_critique::{self, TaskPlanCritiqueIssue};
use crate::task_worktree::TaskStepWorktreeInfo;
use rusqlite::{params, types::Type, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{Mutex, MutexGuard},
    time::{SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub name: String,
    pub path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRepositoryRequest {
    pub project_id: String,
    pub name: String,
    pub path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRepositoryInfo {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub path: PathBuf,
    pub is_default: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInitializationRequest {
    pub project_id: String,
    pub repository_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInitializationInfo {
    pub id: String,
    pub project_id: String,
    pub status: String,
    pub repository_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInitializationFactInfo {
    pub id: String,
    pub initialization_id: String,
    pub repository_id: String,
    pub repository_name: String,
    pub repository_path: PathBuf,
    pub kind: String,
    pub label: String,
    pub value: String,
    pub source: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInitializationMarkdownFindingInfo {
    pub id: String,
    pub initialization_id: String,
    pub repository_id: String,
    pub repository_name: String,
    pub repository_path: PathBuf,
    pub file_path: String,
    pub category: String,
    pub title: String,
    pub excerpt: String,
    pub source: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProjectInitializationGuardrailsRequest {
    pub initialization_id: String,
    pub guardrails: Vec<ProjectInitializationGuardrailInput>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInitializationGuardrailInput {
    pub repository_id: Option<String>,
    pub kind: String,
    pub path_pattern: Option<String>,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInitializationGuardrailInfo {
    pub id: String,
    pub initialization_id: String,
    pub repository_id: Option<String>,
    pub repository_name: Option<String>,
    pub repository_path: Option<PathBuf>,
    pub guardrail_index: i64,
    pub scope: String,
    pub kind: String,
    pub path_pattern: Option<String>,
    pub content: String,
    pub source: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInitializationSummaryInfo {
    pub id: String,
    pub initialization_id: String,
    pub status: String,
    pub project_purpose: String,
    pub repository_map: String,
    pub repository_roles: String,
    pub build_test_matrix: String,
    pub fragile_areas: String,
    pub do_not_touch_rules: String,
    pub agent_working_rules: String,
    pub open_questions: String,
    pub claims: Vec<ProjectInitializationSummaryClaimInfo>,
    pub fact_count: i64,
    pub markdown_finding_count: i64,
    pub guardrail_count: i64,
    pub requested_model_profile_id: Option<String>,
    pub requested_model_provider_id: Option<String>,
    pub requested_model_id: Option<String>,
    pub requested_model_tier: Option<String>,
    pub requested_model_parameters: Vec<ModelParameterInfo>,
    pub model_catalog_schema_version: Option<i64>,
    pub knowledge_schema_version: i64,
    pub generation_engine: String,
    pub created_at: i64,
    pub approved_at: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInitializationSummaryClaimInfo {
    pub id: String,
    pub section: String,
    pub claim_index: i64,
    pub original_content: String,
    pub content: String,
    pub status: String,
    pub rejection_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewProjectInitializationSummaryClaimRequest {
    pub summary_id: String,
    pub claim_id: String,
    pub status: String,
    pub content: String,
    pub rejection_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateProjectInitializationSummaryRequest {
    pub initialization_id: String,
    pub model_profile_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegenerateProjectInitializationSummarySectionRequest {
    pub summary_id: String,
    pub section: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeUnitSourceInfo {
    pub source_key: String,
    pub repository_id: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeUnitInfo {
    pub id: String,
    pub project_id: String,
    pub initialization_id: String,
    pub derived_from_summary_id: String,
    pub kind: String,
    pub topic: String,
    pub content: String,
    pub scope: String,
    pub status: String,
    pub confidence: i64,
    pub schema_version: i64,
    pub sources: Vec<KnowledgeUnitSourceInfo>,
    pub created_at: i64,
}

#[derive(Debug, Clone)]
pub struct ProjectInitializationSynthesisContext {
    pub initialization_id: String,
    pub repositories: Vec<ProjectRepositoryInfo>,
    pub facts: Vec<ProjectInitializationFactInfo>,
    pub findings: Vec<ProjectInitializationMarkdownFindingInfo>,
    pub guardrails: Vec<ProjectInitializationGuardrailInfo>,
    pub model_profile: ModelProfileInfo,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTranscriptSessionRequest {
    pub project_id: Option<String>,
    pub runtime: String,
    pub source: String,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAcpTranscriptSessionRequest {
    pub project_id: Option<String>,
    pub source: String,
    pub title: Option<String>,
    pub candidate_id: String,
    pub agent_session_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptAcpIdentityInfo {
    pub transcript_session_id: String,
    pub candidate_id: String,
    pub agent_session_id: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptEventInput {
    pub kind: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameTranscriptSessionRequest {
    pub session_id: String,
    pub title: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptSessionInfo {
    pub id: String,
    pub project_id: Option<String>,
    pub runtime: String,
    pub source: String,
    pub title: String,
    pub started_at: i64,
    pub updated_at: i64,
    pub event_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptEventInfo {
    pub id: String,
    pub session_id: String,
    pub sequence: i64,
    pub kind: String,
    pub content: String,
    pub created_at: i64,
}

pub const TASK_PHASES: [&str; 4] = ["analysis", "planning", "execution", "review"];

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskRequest {
    pub project_id: String,
    pub transcript_session_id: String,
    pub original_prompt: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPhaseInfo {
    pub id: String,
    pub task_id: String,
    pub phase: String,
    pub phase_index: i64,
    pub status: String,
    pub started_at: Option<i64>,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskPhaseArtifactRequest {
    pub task_id: String,
    pub phase: String,
    pub kind: String,
    pub content: String,
    pub source_transcript_event_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPhaseArtifactInfo {
    pub id: String,
    pub task_id: String,
    pub phase: String,
    pub sequence: i64,
    pub kind: String,
    pub content: String,
    pub source_transcript_event_ids: Vec<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPlanRequirementInput {
    pub id: String,
    pub text: String,
    pub kind: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPlanStepInput {
    pub title: String,
    pub description: String,
    pub kind: String,
    pub complexity: i64,
    pub acceptance_criteria: Vec<String>,
    pub expected_paths: Vec<String>,
    pub satisfies: Vec<String>,
    #[serde(default)]
    pub depends_on: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskPlanVersionRequest {
    pub task_id: String,
    pub source_artifact_id: String,
    pub requirements: Vec<TaskPlanRequirementInput>,
    pub steps: Vec<TaskPlanStepInput>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApproveTaskPlanVersionRequest {
    pub task_id: String,
    pub plan_version_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateTaskPlanRequest {
    pub task_id: String,
    pub plan_version_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPlanRequirementInfo {
    pub id: String,
    pub text: String,
    pub kind: String,
    pub order_index: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPlanStepInfo {
    pub id: String,
    pub order_index: i64,
    pub title: String,
    pub description: String,
    pub kind: String,
    pub complexity: i64,
    pub acceptance_criteria: Vec<String>,
    pub expected_paths: Vec<String>,
    pub satisfies: Vec<String>,
    pub depends_on: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPlanVersionInfo {
    pub id: String,
    pub task_id: String,
    pub version: i64,
    pub status: String,
    pub source_artifact_id: String,
    pub requirements: Vec<TaskPlanRequirementInfo>,
    pub steps: Vec<TaskPlanStepInfo>,
    pub created_at: i64,
    pub approved_at: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskPlanStepRunRequest {
    pub task_id: String,
    pub plan_version_id: String,
    pub plan_step_id: String,
    pub acp_session_id: String,
    pub instruction: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewTaskPlanStepRunRequest {
    pub task_id: String,
    pub run_id: String,
    pub decision: String,
    pub note: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPlanStepRunInfo {
    pub id: String,
    pub task_id: String,
    pub plan_version_id: String,
    pub plan_step_id: String,
    pub step_order_index: i64,
    pub attempt: i64,
    pub acp_session_id: String,
    pub instruction: String,
    pub model_tier: String,
    pub model_tier_rationale: String,
    pub expected_paths: Vec<String>,
    pub isolation_id: Option<String>,
    pub isolation_repository_path: Option<String>,
    pub isolation_worktree_path: Option<String>,
    pub isolation_branch: Option<String>,
    pub isolation_base_sha: Option<String>,
    pub integration_status: Option<String>,
    pub isolated_commit_sha: Option<String>,
    pub integrated_commit_sha: Option<String>,
    pub integration_error: Option<String>,
    pub status: String,
    pub stop_reason: Option<String>,
    pub error: Option<String>,
    pub verification_status: Option<String>,
    pub verification_workspace_path: Option<String>,
    pub verification_changed_files: Vec<String>,
    pub verification_error: Option<String>,
    pub scope_status: Option<String>,
    pub scope_violations: Vec<String>,
    pub review_status: Option<String>,
    pub review_note: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

struct TaskPlanStepReviewState {
    task_id: String,
    plan_version_id: String,
    step_order_index: i64,
    verification_status: Option<String>,
    scope_status: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPlanEvaluationInfo {
    pub id: String,
    pub task_id: String,
    pub plan_version_id: String,
    pub plan_version: i64,
    pub verdict: String,
    pub findings: Vec<TaskPlanFindingInfo>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskPlanCritiqueRequest {
    pub task_id: String,
    pub plan_version_id: String,
    pub evaluation_id: String,
    pub source: String,
    pub response: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyTaskPlanCritiqueRequest {
    pub task_id: String,
    pub critique_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPlanCritiqueInfo {
    pub id: String,
    pub task_id: String,
    pub plan_version_id: String,
    pub evaluation_id: String,
    pub source: String,
    pub issues: Vec<TaskPlanCritiqueIssue>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskAgentReportRequest {
    pub task_id: String,
    pub phase: String,
    pub role: String,
    pub transcript_session_id: String,
    pub content: String,
    pub source_transcript_event_ids: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct CreateTaskAgentReportTranscriptRequest {
    pub task_id: String,
    pub phase: String,
    pub role: String,
    pub transcript_source: String,
    pub transcript_title: Option<String>,
    pub candidate_id: String,
    pub agent_session_id: String,
    pub events: Vec<TranscriptEventInput>,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskAgentReportTranscriptInfo {
    pub transcript_session: TranscriptSessionInfo,
    pub report: TaskAgentReportInfo,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskAgentReportInfo {
    pub id: String,
    pub task_id: String,
    pub phase: String,
    pub sequence: i64,
    pub role: String,
    pub transcript_session_id: String,
    pub content: String,
    pub source_transcript_event_ids: Vec<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskPhaseRunRequest {
    pub task_id: String,
    pub transcript_session_id: String,
    pub phase: String,
    pub acp_session_id: String,
    pub instruction: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveTaskPhaseRunRequest {
    pub task_id: String,
    pub receipt_id: String,
    pub reason: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkTaskPhaseRunEventsRequest {
    pub task_id: String,
    pub receipt_id: String,
    pub transcript_event_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPhaseRunReceiptInfo {
    pub id: String,
    pub task_id: String,
    pub transcript_session_id: String,
    pub sequence: i64,
    pub phase: String,
    pub acp_session_id: String,
    pub instruction: String,
    pub status: String,
    pub stop_reason: Option<String>,
    pub error: Option<String>,
    pub verification_status: Option<String>,
    pub verification_workspace_path: Option<String>,
    pub verification_changed_files_json: Option<String>,
    pub verification_error: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskContextDispatchSourceInput {
    pub source_id: String,
    pub source_type: String,
    pub reason: String,
    pub score: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskContextDispatchRequest {
    pub task_id: String,
    pub transcript_session_id: String,
    pub acp_session_id: String,
    pub user_prompt: String,
    pub rendered_context: String,
    pub sources: Vec<TaskContextDispatchSourceInput>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveTaskContextDispatchRequest {
    pub task_id: String,
    pub receipt_id: String,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskContextDispatchReceiptInfo {
    pub id: String,
    pub task_id: String,
    pub transcript_session_id: String,
    pub sequence: i64,
    pub acp_session_id: String,
    pub user_prompt: String,
    pub rendered_context: String,
    pub wire_prompt: String,
    pub sources: Vec<TaskContextDispatchSourceInput>,
    pub status: String,
    pub stop_reason: Option<String>,
    pub error: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransitionTaskPhaseRequest {
    pub task_id: String,
    pub action: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInfo {
    pub id: String,
    pub project_id: String,
    pub transcript_session_id: String,
    pub original_prompt: String,
    pub status: String,
    pub current_phase: String,
    pub initial_complexity_profile: String,
    pub initial_complexity_reasons: Vec<String>,
    pub initial_complexity_confidence: i64,
    pub complexity_profile: String,
    pub complexity_reasons: Vec<String>,
    pub complexity_confidence: Option<i64>,
    pub complexity_source: String,
    pub complexity_assessment_version: String,
    pub complexity_changes: Vec<TaskComplexityChangeInfo>,
    pub phases: Vec<TaskPhaseInfo>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskComplexityChangeInfo {
    pub id: String,
    pub task_id: String,
    pub sequence: i64,
    pub profile: String,
    pub reasons: Vec<String>,
    pub confidence: Option<i64>,
    pub source: String,
    pub assessment_version: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskComplexityRequest {
    pub task_id: String,
    pub profile: String,
    pub reason: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateKnowledgeItemRequest {
    pub project_id: Option<String>,
    pub title: String,
    pub body: String,
    pub kind: String,
    pub scope: String,
    pub source_transcript_session_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeItemInfo {
    pub id: String,
    pub project_id: Option<String>,
    pub title: String,
    pub body: String,
    pub kind: String,
    pub scope: String,
    pub source_transcript_session_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct ProjectStore {
    connection: Mutex<Connection>,
}

impl ProjectStore {
    pub fn open(path: impl AsRef<Path>) -> AppResult<Self> {
        if let Some(parent) = path.as_ref().parent() {
            std::fs::create_dir_all(parent)?;
        }
        let connection = Connection::open(path).map_err(storage_error)?;
        let store = Self {
            connection: Mutex::new(connection),
        };
        store.migrate()?;
        Ok(store)
    }

    #[cfg(test)]
    pub(crate) fn in_memory() -> AppResult<Self> {
        let store = Self {
            connection: Mutex::new(Connection::open_in_memory().map_err(storage_error)?),
        };
        store.migrate()?;
        Ok(store)
    }

    pub fn create_project(&self, request: CreateProjectRequest) -> AppResult<ProjectInfo> {
        let name = request.name.trim();
        if name.is_empty() {
            return Err(AppError::InvalidInput(
                "project name must not be empty".to_string(),
            ));
        }

        let path = resolve_project_path(&request.path)?;
        let now = unix_timestamp()?;
        let project = ProjectInfo {
            id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            path,
            created_at: now,
            updated_at: now,
        };
        let path_text = project.path.to_string_lossy().to_string();

        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        transaction.execute(
            "INSERT INTO projects (id, name, path, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                &project.id,
                &project.name,
                path_text,
                project.created_at,
                project.updated_at
            ],
        )
        .map_err(|err| {
            if is_unique_constraint(&err) {
                AppError::InvalidInput("project path already exists".to_string())
            } else {
                storage_error(err)
            }
        })?;
        insert_project_repository(
            &transaction,
            ProjectRepositoryInfo {
                id: Uuid::new_v4().to_string(),
                project_id: project.id.clone(),
                name: project.name.clone(),
                path: project.path.clone(),
                is_default: true,
                created_at: now,
                updated_at: now,
            },
        )?;
        transaction.commit().map_err(storage_error)?;

        Ok(project)
    }

    pub fn list_projects(&self) -> AppResult<Vec<ProjectInfo>> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id, name, path, created_at, updated_at FROM projects ORDER BY updated_at DESC, name ASC",
            )
            .map_err(storage_error)?;
        let projects = statement
            .query_map([], project_from_row)
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;

        Ok(projects)
    }

    pub fn delete_project(&self, project_id: &str) -> AppResult<()> {
        let deleted = self
            .connection()?
            .execute("DELETE FROM projects WHERE id = ?1", params![project_id])
            .map_err(storage_error)?;
        if deleted == 0 {
            return Err(AppError::InvalidInput(format!(
                "project not found: {project_id}"
            )));
        }
        Ok(())
    }

    pub fn create_project_repository(
        &self,
        request: CreateProjectRepositoryRequest,
    ) -> AppResult<ProjectRepositoryInfo> {
        let project_id = request.project_id.trim();
        if project_id.is_empty() {
            return Err(AppError::InvalidInput(
                "repository project id must not be empty".to_string(),
            ));
        }
        self.require_project(project_id)?;

        let name = request.name.trim();
        if name.is_empty() {
            return Err(AppError::InvalidInput(
                "repository name must not be empty".to_string(),
            ));
        }

        let path = resolve_project_path(&request.path)?;
        let now = unix_timestamp()?;
        let repository = ProjectRepositoryInfo {
            id: Uuid::new_v4().to_string(),
            project_id: project_id.to_string(),
            name: name.to_string(),
            path,
            is_default: false,
            created_at: now,
            updated_at: now,
        };

        let connection = self.connection()?;
        insert_project_repository(&connection, repository.clone())?;
        Ok(repository)
    }

    pub fn list_project_repositories(
        &self,
        project_id: &str,
    ) -> AppResult<Vec<ProjectRepositoryInfo>> {
        self.require_project(project_id)?;

        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id, project_id, name, path, is_default, created_at, updated_at
                 FROM project_repositories
                 WHERE project_id = ?1
                 ORDER BY is_default DESC, updated_at DESC, name ASC",
            )
            .map_err(storage_error)?;
        let repositories = statement
            .query_map(params![project_id], project_repository_from_row)
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;

        Ok(repositories)
    }

    pub fn delete_project_repository(&self, repository_id: &str) -> AppResult<()> {
        let deleted = self
            .connection()?
            .execute(
                "DELETE FROM project_repositories WHERE id = ?1",
                params![repository_id],
            )
            .map_err(storage_error)?;
        if deleted == 0 {
            return Err(AppError::InvalidInput(format!(
                "project repository not found: {repository_id}"
            )));
        }
        Ok(())
    }

    pub fn create_project_initialization(
        &self,
        request: CreateProjectInitializationRequest,
    ) -> AppResult<ProjectInitializationInfo> {
        let project_id = request.project_id.trim();
        if project_id.is_empty() {
            return Err(AppError::InvalidInput(
                "initialization project id must not be empty".to_string(),
            ));
        }
        self.require_project(project_id)?;

        let mut seen_repository_ids = HashSet::new();
        let mut repository_ids = Vec::new();
        for repository_id in request.repository_ids {
            let repository_id = repository_id.trim();
            if repository_id.is_empty() {
                return Err(AppError::InvalidInput(
                    "initialization repository id must not be empty".to_string(),
                ));
            }
            if !seen_repository_ids.insert(repository_id.to_string()) {
                return Err(AppError::InvalidInput(format!(
                    "duplicate initialization repository id: {repository_id}"
                )));
            }
            repository_ids.push(repository_id.to_string());
        }
        if repository_ids.is_empty() {
            return Err(AppError::InvalidInput(
                "initialization must include at least one repository".to_string(),
            ));
        }

        let now = unix_timestamp()?;
        let initialization = ProjectInitializationInfo {
            id: Uuid::new_v4().to_string(),
            project_id: project_id.to_string(),
            status: "preflight".to_string(),
            repository_count: repository_ids.len() as i64,
            created_at: now,
            updated_at: now,
        };

        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        for repository_id in &repository_ids {
            require_project_repository(&transaction, project_id, repository_id)?;
        }
        transaction
            .execute(
                "INSERT INTO project_initialization_runs
                 (id, project_id, status, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    &initialization.id,
                    &initialization.project_id,
                    &initialization.status,
                    initialization.created_at,
                    initialization.updated_at
                ],
            )
            .map_err(storage_error)?;
        for (repository_index, repository_id) in repository_ids.iter().enumerate() {
            transaction
                .execute(
                    "INSERT INTO project_initialization_repositories
                     (initialization_id, repository_id, repository_index, created_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![
                        &initialization.id,
                        repository_id,
                        repository_index as i64,
                        now
                    ],
                )
                .map_err(storage_error)?;
        }
        transaction.commit().map_err(storage_error)?;

        Ok(initialization)
    }

    pub fn list_project_initializations(
        &self,
        project_id: &str,
    ) -> AppResult<Vec<ProjectInitializationInfo>> {
        self.require_project(project_id)?;

        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT r.id, r.project_id, r.status, COUNT(ir.repository_id), r.created_at, r.updated_at
                 FROM project_initialization_runs r
                 LEFT JOIN project_initialization_repositories ir ON ir.initialization_id = r.id
                 WHERE r.project_id = ?1
                 GROUP BY r.id, r.project_id, r.status, r.created_at, r.updated_at
                 ORDER BY r.updated_at DESC, r.created_at DESC",
            )
            .map_err(storage_error)?;
        let initializations = statement
            .query_map(params![project_id], project_initialization_from_row)
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;

        Ok(initializations)
    }

    pub fn collect_project_initialization_facts(
        &self,
        initialization_id: &str,
    ) -> AppResult<Vec<ProjectInitializationFactInfo>> {
        let initialization_id = initialization_id.trim();
        if initialization_id.is_empty() {
            return Err(AppError::InvalidInput(
                "initialization id must not be empty".to_string(),
            ));
        }

        let repositories = {
            let connection = self.connection()?;
            list_initialization_repositories(&connection, initialization_id)?
        };
        let now = unix_timestamp()?;
        let facts = repositories
            .iter()
            .flat_map(|repository| collect_repository_facts(initialization_id, repository, now))
            .collect::<Vec<_>>();

        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        require_project_initialization(&transaction, initialization_id)?;
        transaction
            .execute(
                "DELETE FROM project_initialization_facts WHERE initialization_id = ?1",
                params![initialization_id],
            )
            .map_err(storage_error)?;
        for fact in &facts {
            insert_project_initialization_fact(&transaction, fact)?;
        }
        transaction
            .execute(
                "UPDATE project_initialization_runs SET status = ?1, updated_at = ?2 WHERE id = ?3",
                params!["facts", now, initialization_id],
            )
            .map_err(storage_error)?;
        transaction.commit().map_err(storage_error)?;

        Ok(facts)
    }

    pub fn list_project_initialization_facts(
        &self,
        initialization_id: &str,
    ) -> AppResult<Vec<ProjectInitializationFactInfo>> {
        let initialization_id = initialization_id.trim();
        if initialization_id.is_empty() {
            return Err(AppError::InvalidInput(
                "initialization id must not be empty".to_string(),
            ));
        }

        let connection = self.connection()?;
        require_project_initialization(&connection, initialization_id)?;
        list_project_initialization_facts(&connection, initialization_id)
    }

    pub fn analyze_project_initialization_markdown(
        &self,
        initialization_id: &str,
    ) -> AppResult<Vec<ProjectInitializationMarkdownFindingInfo>> {
        let initialization_id = initialization_id.trim();
        if initialization_id.is_empty() {
            return Err(AppError::InvalidInput(
                "initialization id must not be empty".to_string(),
            ));
        }

        let repositories = {
            let connection = self.connection()?;
            list_initialization_repositories(&connection, initialization_id)?
        };
        let now = unix_timestamp()?;
        let findings = repositories
            .iter()
            .flat_map(|repository| analyze_repository_markdown(initialization_id, repository, now))
            .collect::<Vec<_>>();

        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        require_project_initialization(&transaction, initialization_id)?;
        transaction
            .execute(
                "DELETE FROM project_initialization_markdown_findings WHERE initialization_id = ?1",
                params![initialization_id],
            )
            .map_err(storage_error)?;
        for finding in &findings {
            insert_project_initialization_markdown_finding(&transaction, finding)?;
        }
        transaction
            .execute(
                "UPDATE project_initialization_runs SET status = ?1, updated_at = ?2 WHERE id = ?3",
                params!["markdown", now, initialization_id],
            )
            .map_err(storage_error)?;
        transaction.commit().map_err(storage_error)?;

        Ok(findings)
    }

    pub fn list_project_initialization_markdown_findings(
        &self,
        initialization_id: &str,
    ) -> AppResult<Vec<ProjectInitializationMarkdownFindingInfo>> {
        let initialization_id = initialization_id.trim();
        if initialization_id.is_empty() {
            return Err(AppError::InvalidInput(
                "initialization id must not be empty".to_string(),
            ));
        }

        let connection = self.connection()?;
        require_project_initialization(&connection, initialization_id)?;
        list_project_initialization_markdown_findings(&connection, initialization_id)
    }

    pub fn save_project_initialization_guardrails(
        &self,
        request: SaveProjectInitializationGuardrailsRequest,
    ) -> AppResult<Vec<ProjectInitializationGuardrailInfo>> {
        let initialization_id = request.initialization_id.trim();
        if initialization_id.is_empty() {
            return Err(AppError::InvalidInput(
                "initialization id must not be empty".to_string(),
            ));
        }
        if request.guardrails.is_empty() {
            return Err(AppError::InvalidInput(
                "at least one guardrail is required".to_string(),
            ));
        }

        let now = unix_timestamp()?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        require_project_initialization(&transaction, initialization_id)?;
        let selected_repository_ids =
            selected_initialization_repository_ids(&transaction, initialization_id)?;
        let guardrails = request
            .guardrails
            .into_iter()
            .enumerate()
            .map(|(index, guardrail)| {
                normalize_project_initialization_guardrail(
                    initialization_id,
                    guardrail,
                    index as i64,
                    &selected_repository_ids,
                    now,
                )
            })
            .collect::<AppResult<Vec<_>>>()?;

        transaction
            .execute(
                "DELETE FROM project_initialization_guardrails WHERE initialization_id = ?1",
                params![initialization_id],
            )
            .map_err(storage_error)?;
        for guardrail in &guardrails {
            insert_project_initialization_guardrail(&transaction, guardrail)?;
        }
        transaction
            .execute(
                "UPDATE project_initialization_runs SET status = ?1, updated_at = ?2 WHERE id = ?3",
                params!["interview", now, initialization_id],
            )
            .map_err(storage_error)?;
        transaction.commit().map_err(storage_error)?;
        drop(connection);

        self.list_project_initialization_guardrails(initialization_id)
    }

    pub fn list_project_initialization_guardrails(
        &self,
        initialization_id: &str,
    ) -> AppResult<Vec<ProjectInitializationGuardrailInfo>> {
        let initialization_id = initialization_id.trim();
        if initialization_id.is_empty() {
            return Err(AppError::InvalidInput(
                "initialization id must not be empty".to_string(),
            ));
        }

        let connection = self.connection()?;
        require_project_initialization(&connection, initialization_id)?;
        list_project_initialization_guardrails(&connection, initialization_id)
    }

    pub fn prepare_project_initialization_synthesis(
        &self,
        request: GenerateProjectInitializationSummaryRequest,
    ) -> AppResult<ProjectInitializationSynthesisContext> {
        let initialization_id = request.initialization_id.trim();
        if initialization_id.is_empty() {
            return Err(AppError::InvalidInput(
                "initialization id must not be empty".to_string(),
            ));
        }
        let model_profile_id = request.model_profile_id.trim();
        if model_profile_id.is_empty() {
            return Err(AppError::InvalidInput(
                "model profile id must not be empty".to_string(),
            ));
        }
        let profile = model_profile(model_profile_id).ok_or_else(|| {
            AppError::InvalidInput(format!("model profile not found: {model_profile_id}"))
        })?;

        let (repositories, facts, findings, guardrails) = {
            let connection = self.connection()?;
            require_project_initialization(&connection, initialization_id)?;
            (
                list_initialization_repositories(&connection, initialization_id)?,
                list_project_initialization_facts(&connection, initialization_id)?,
                list_project_initialization_markdown_findings(&connection, initialization_id)?,
                list_project_initialization_guardrails(&connection, initialization_id)?,
            )
        };
        Ok(ProjectInitializationSynthesisContext {
            initialization_id: initialization_id.to_string(),
            repositories,
            facts,
            findings,
            guardrails,
            model_profile: profile,
        })
    }

    pub fn persist_project_initialization_summary(
        &self,
        context: &ProjectInitializationSynthesisContext,
        draft: ProjectInitializationKnowledgeDraft,
        generation_engine: &str,
    ) -> AppResult<ProjectInitializationSummaryInfo> {
        let generation_engine = generation_engine.trim();
        if generation_engine.is_empty() {
            return Err(AppError::InvalidInput(
                "generation engine must not be empty".to_string(),
            ));
        }
        let draft = draft.validate()?;
        let now = unix_timestamp()?;
        let summary = build_project_initialization_summary(context, draft, generation_engine, now);

        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        require_project_initialization(&transaction, &context.initialization_id)?;
        if list_initialization_repositories(&transaction, &context.initialization_id)?
            != context.repositories
            || list_project_initialization_facts(&transaction, &context.initialization_id)?
                != context.facts
            || list_project_initialization_markdown_findings(
                &transaction,
                &context.initialization_id,
            )? != context.findings
            || list_project_initialization_guardrails(&transaction, &context.initialization_id)?
                != context.guardrails
        {
            return Err(AppError::Synthesis(
                "initialization evidence changed while synthesis was running; generate the summary again"
                    .to_string(),
            ));
        }
        transaction
            .execute(
                "DELETE FROM project_initialization_summaries WHERE initialization_id = ?1",
                params![&context.initialization_id],
            )
            .map_err(storage_error)?;
        insert_project_initialization_summary(&transaction, &summary)?;
        transaction
            .execute(
                "UPDATE project_initialization_runs SET status = ?1, updated_at = ?2 WHERE id = ?3",
                params!["summary", now, &context.initialization_id],
            )
            .map_err(storage_error)?;
        transaction.commit().map_err(storage_error)?;
        drop(connection);

        self.list_project_initialization_summary(&context.initialization_id)?
            .ok_or_else(|| AppError::Storage("generated summary was not persisted".to_string()))
    }

    pub fn prepare_project_initialization_section_regeneration(
        &self,
        request: &RegenerateProjectInitializationSummarySectionRequest,
    ) -> AppResult<(
        ProjectInitializationSynthesisContext,
        ProjectInitializationSummaryInfo,
    )> {
        validate_summary_section(&request.section)?;
        let connection = self.connection()?;
        let summary = project_initialization_summary_by_id(&connection, request.summary_id.trim())?
            .ok_or_else(|| {
                AppError::InvalidInput(format!(
                    "project initialization summary not found: {}",
                    request.summary_id.trim()
                ))
            })?;
        if summary.status == "approved" {
            return Err(AppError::InvalidInput(
                "approved summaries cannot be regenerated".into(),
            ));
        }
        let model_profile_id = summary.requested_model_profile_id.clone().ok_or_else(|| {
            AppError::InvalidInput("legacy summaries cannot regenerate one section".into())
        })?;
        drop(connection);
        let context = self.prepare_project_initialization_synthesis(
            GenerateProjectInitializationSummaryRequest {
                initialization_id: summary.initialization_id.clone(),
                model_profile_id,
            },
        )?;
        Ok((context, summary))
    }

    pub fn persist_project_initialization_summary_section(
        &self,
        context: &ProjectInitializationSynthesisContext,
        expected_summary: &ProjectInitializationSummaryInfo,
        section: &str,
        draft: ProjectInitializationKnowledgeDraft,
        generation_engine: &str,
    ) -> AppResult<ProjectInitializationSummaryInfo> {
        validate_summary_section(section)?;
        let draft = draft.validate()?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        let current = project_initialization_summary_by_id(&transaction, &expected_summary.id)?
            .ok_or_else(|| {
                AppError::InvalidInput("summary changed while regeneration was running".into())
            })?;
        if &current != expected_summary {
            return Err(AppError::Synthesis(
                "summary review changed while regeneration was running; try again".into(),
            ));
        }
        if list_initialization_repositories(&transaction, &context.initialization_id)?
            != context.repositories
            || list_project_initialization_facts(&transaction, &context.initialization_id)?
                != context.facts
            || list_project_initialization_markdown_findings(
                &transaction,
                &context.initialization_id,
            )? != context.findings
            || list_project_initialization_guardrails(&transaction, &context.initialization_id)?
                != context.guardrails
        {
            return Err(AppError::Synthesis(
                "initialization evidence changed while regeneration was running; try again".into(),
            ));
        }
        let mut updated = current;
        set_summary_section(&mut updated, section, draft_section(&draft, section)?);
        let insertion_index = updated
            .claims
            .iter()
            .position(|claim| claim.section == section)
            .unwrap_or(updated.claims.len());
        updated.claims.retain(|claim| claim.section != section);
        let replacement = summary_claims(&updated)
            .into_iter()
            .filter(|claim| claim.section == section)
            .collect::<Vec<_>>();
        updated
            .claims
            .splice(insertion_index..insertion_index, replacement);
        let claims_json = serde_json::to_string(&updated.claims)
            .map_err(|err| AppError::Storage(err.to_string()))?;
        transaction
            .execute(
                "UPDATE project_initialization_summaries SET project_purpose=?1, repository_map=?2,
             repository_roles=?3, build_test_matrix=?4, fragile_areas=?5, do_not_touch_rules=?6,
             agent_working_rules=?7, open_questions=?8, claims_json=?9, generation_engine=?10
             WHERE id=?11",
                params![
                    updated.project_purpose,
                    updated.repository_map,
                    updated.repository_roles,
                    updated.build_test_matrix,
                    updated.fragile_areas,
                    updated.do_not_touch_rules,
                    updated.agent_working_rules,
                    updated.open_questions,
                    claims_json,
                    generation_engine.trim(),
                    updated.id
                ],
            )
            .map_err(storage_error)?;
        transaction.commit().map_err(storage_error)?;
        drop(connection);
        self.list_project_initialization_summary(&context.initialization_id)?
            .ok_or_else(|| AppError::Storage("regenerated summary was not found".into()))
    }

    pub fn list_project_initialization_summary(
        &self,
        initialization_id: &str,
    ) -> AppResult<Option<ProjectInitializationSummaryInfo>> {
        let initialization_id = initialization_id.trim();
        if initialization_id.is_empty() {
            return Err(AppError::InvalidInput(
                "initialization id must not be empty".to_string(),
            ));
        }

        let connection = self.connection()?;
        require_project_initialization(&connection, initialization_id)?;
        list_project_initialization_summary(&connection, initialization_id)
    }

    pub fn approve_project_initialization_summary(
        &self,
        summary_id: &str,
    ) -> AppResult<ProjectInitializationSummaryInfo> {
        let summary_id = summary_id.trim();
        if summary_id.is_empty() {
            return Err(AppError::InvalidInput(
                "summary id must not be empty".to_string(),
            ));
        }

        let now = unix_timestamp()?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        let summary =
            project_initialization_summary_by_id(&transaction, summary_id)?.ok_or_else(|| {
                AppError::InvalidInput(format!(
                    "project initialization summary not found: {summary_id}"
                ))
            })?;
        if summary.claims.iter().any(|claim| claim.status == "pending") {
            return Err(AppError::InvalidInput(
                "review every summary claim before approval".to_string(),
            ));
        }
        let project_id: String = transaction
            .query_row(
                "SELECT project_id FROM project_initialization_runs WHERE id = ?1",
                params![&summary.initialization_id],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        let knowledge_units = build_knowledge_units(&summary, &project_id, now)?;

        transaction
            .execute(
                "UPDATE project_initialization_summaries
                 SET status = ?1, approved_at = ?2
                 WHERE id = ?3",
                params!["approved", now, summary_id],
            )
            .map_err(storage_error)?;
        transaction
            .execute(
                "DELETE FROM knowledge_units WHERE derived_from_summary_id = ?1",
                params![summary_id],
            )
            .map_err(storage_error)?;
        for unit in &knowledge_units {
            insert_knowledge_unit(&transaction, unit)?;
        }
        transaction
            .execute(
                "UPDATE project_initialization_runs
                 SET status = ?1, updated_at = ?2
                 WHERE id = (
                    SELECT initialization_id
                    FROM project_initialization_summaries
                    WHERE id = ?3
                 )",
                params!["summary", now, summary_id],
            )
            .map_err(storage_error)?;
        transaction.commit().map_err(storage_error)?;
        drop(connection);

        let connection = self.connection()?;
        project_initialization_summary_by_id(&connection, summary_id)?
            .ok_or_else(|| AppError::Storage("approved summary was not found".to_string()))
    }

    pub fn review_project_initialization_summary_claim(
        &self,
        request: ReviewProjectInitializationSummaryClaimRequest,
    ) -> AppResult<ProjectInitializationSummaryInfo> {
        let summary_id = request.summary_id.trim();
        let claim_id = request.claim_id.trim();
        let status = request.status.trim();
        if summary_id.is_empty() || claim_id.is_empty() {
            return Err(AppError::InvalidInput(
                "summary and claim ids must not be empty".into(),
            ));
        }
        if !matches!(status, "accepted" | "rejected" | "deferred") {
            return Err(AppError::InvalidInput(
                "unsupported summary claim review status".into(),
            ));
        }
        let content = request.content.trim();
        if content.is_empty() {
            return Err(AppError::InvalidInput(
                "summary claim content must not be empty".into(),
            ));
        }
        let reason = request
            .rejection_reason
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        if status == "rejected" && reason.is_none() {
            return Err(AppError::InvalidInput(
                "rejected summary claims require a reason".into(),
            ));
        }
        let connection = self.connection()?;
        let mut summary = project_initialization_summary_by_id(&connection, summary_id)?
            .ok_or_else(|| {
                AppError::InvalidInput(format!(
                    "project initialization summary not found: {summary_id}"
                ))
            })?;
        if summary.status == "approved" {
            return Err(AppError::InvalidInput(
                "approved summaries cannot be reviewed".into(),
            ));
        }
        let claim = summary
            .claims
            .iter_mut()
            .find(|claim| claim.id == claim_id)
            .ok_or_else(|| {
                AppError::InvalidInput(format!("summary claim not found: {claim_id}"))
            })?;
        claim.content = content.to_string();
        claim.status = status.to_string();
        claim.rejection_reason = if status == "rejected" { reason } else { None };
        let claims_json = serde_json::to_string(&summary.claims)
            .map_err(|err| AppError::Storage(err.to_string()))?;
        connection
            .execute(
                "UPDATE project_initialization_summaries SET claims_json = ?1 WHERE id = ?2",
                params![claims_json, summary_id],
            )
            .map_err(storage_error)?;
        project_initialization_summary_by_id(&connection, summary_id)?
            .ok_or_else(|| AppError::Storage("reviewed summary was not found".into()))
    }

    pub fn prepare_project_initialization_summary_autopilot(
        &self,
        summary_id: &str,
    ) -> AppResult<ProjectInitializationSummaryInfo> {
        let summary_id = summary_id.trim();
        if summary_id.is_empty() {
            return Err(AppError::InvalidInput(
                "summary id must not be empty".to_string(),
            ));
        }
        let connection = self.connection()?;
        let mut summary = project_initialization_summary_by_id(&connection, summary_id)?
            .ok_or_else(|| {
                AppError::InvalidInput(format!(
                    "project initialization summary not found: {summary_id}"
                ))
            })?;
        if summary.status == "approved" {
            return Err(AppError::InvalidInput(
                "approved summaries cannot be prepared by autopilot".into(),
            ));
        }
        if summary.claims.is_empty() {
            return Err(AppError::InvalidInput(
                "summary has no claims to prepare".into(),
            ));
        }
        for claim in &mut summary.claims {
            if claim.content.trim().is_empty() {
                return Err(AppError::InvalidInput(
                    "summary claims must not be empty".into(),
                ));
            }
            if claim.status == "pending" {
                claim.status = if claim.section == "open_questions" {
                    "deferred"
                } else {
                    "accepted"
                }
                .to_string();
                claim.rejection_reason = None;
            }
        }
        let project_id: String = connection
            .query_row(
                "SELECT project_id FROM project_initialization_runs WHERE id = ?1",
                params![&summary.initialization_id],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        build_knowledge_units(&summary, &project_id, unix_timestamp()?)?;
        let claims_json = serde_json::to_string(&summary.claims)
            .map_err(|err| AppError::Storage(err.to_string()))?;
        connection
            .execute(
                "UPDATE project_initialization_summaries SET claims_json = ?1 WHERE id = ?2",
                params![claims_json, summary_id],
            )
            .map_err(storage_error)?;
        project_initialization_summary_by_id(&connection, summary_id)?
            .ok_or_else(|| AppError::Storage("autopilot-prepared summary was not found".into()))
    }

    pub fn approve_project_initialization_summary_autopilot(
        &self,
        summary_id: &str,
    ) -> AppResult<ProjectInitializationSummaryInfo> {
        let summary_id = summary_id.trim();
        if summary_id.is_empty() {
            return Err(AppError::InvalidInput(
                "summary id must not be empty".to_string(),
            ));
        }
        let now = unix_timestamp()?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        let mut summary = project_initialization_summary_by_id(&transaction, summary_id)?
            .ok_or_else(|| {
                AppError::InvalidInput(format!(
                    "project initialization summary not found: {summary_id}"
                ))
            })?;
        if summary.status == "approved" {
            return Err(AppError::InvalidInput(
                "approved summaries cannot be approved by autopilot".into(),
            ));
        }
        if summary.claims.is_empty() {
            return Err(AppError::InvalidInput(
                "summary has no claims to approve".into(),
            ));
        }
        for claim in &mut summary.claims {
            if claim.content.trim().is_empty() {
                return Err(AppError::InvalidInput(
                    "summary claims must not be empty".into(),
                ));
            }
            if claim.status == "pending" {
                claim.status = if claim.section == "open_questions" {
                    "deferred"
                } else {
                    "accepted"
                }
                .to_string();
                claim.rejection_reason = None;
            }
        }
        let project_id: String = transaction
            .query_row(
                "SELECT project_id FROM project_initialization_runs WHERE id = ?1",
                params![&summary.initialization_id],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        let knowledge_units = build_knowledge_units(&summary, &project_id, now)?;
        let claims_json = serde_json::to_string(&summary.claims)
            .map_err(|err| AppError::Storage(err.to_string()))?;
        transaction
            .execute(
                "UPDATE project_initialization_summaries
                 SET claims_json = ?1, status = 'approved', approved_at = ?2 WHERE id = ?3",
                params![claims_json, now, summary_id],
            )
            .map_err(storage_error)?;
        transaction
            .execute(
                "DELETE FROM knowledge_units WHERE derived_from_summary_id = ?1",
                params![summary_id],
            )
            .map_err(storage_error)?;
        for unit in &knowledge_units {
            insert_knowledge_unit(&transaction, unit)?;
        }
        transaction
            .execute(
                "UPDATE project_initialization_runs SET status = 'summary', updated_at = ?1
                 WHERE id = ?2",
                params![now, summary.initialization_id],
            )
            .map_err(storage_error)?;
        transaction.commit().map_err(storage_error)?;
        drop(connection);
        let connection = self.connection()?;
        project_initialization_summary_by_id(&connection, summary_id)?
            .ok_or_else(|| AppError::Storage("autopilot-approved summary was not found".into()))
    }

    pub fn list_project_initialization_knowledge_units(
        &self,
        initialization_id: &str,
    ) -> AppResult<Vec<KnowledgeUnitInfo>> {
        let initialization_id = initialization_id.trim();
        if initialization_id.is_empty() {
            return Err(AppError::InvalidInput(
                "initialization id must not be empty".to_string(),
            ));
        }
        let connection = self.connection()?;
        require_project_initialization(&connection, initialization_id)?;
        list_project_initialization_knowledge_units(&connection, initialization_id)
    }

    pub fn create_transcript_session(
        &self,
        request: CreateTranscriptSessionRequest,
    ) -> AppResult<TranscriptSessionInfo> {
        let runtime = request.runtime.trim();
        if runtime.is_empty() {
            return Err(AppError::InvalidInput(
                "transcript runtime must not be empty".to_string(),
            ));
        }
        let source = request.source.trim();
        if source.is_empty() {
            return Err(AppError::InvalidInput(
                "transcript source must not be empty".to_string(),
            ));
        }

        if let Some(project_id) = request.project_id.as_deref() {
            self.require_project(project_id)?;
        }

        let now = unix_timestamp()?;
        let title = request
            .title
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(source)
            .to_string();
        let session = TranscriptSessionInfo {
            id: Uuid::new_v4().to_string(),
            project_id: request.project_id,
            runtime: runtime.to_string(),
            source: source.to_string(),
            title,
            started_at: now,
            updated_at: now,
            event_count: 0,
        };

        self.connection()?.execute(
            "INSERT INTO transcript_sessions (id, project_id, runtime, source, title, started_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                &session.id,
                session.project_id.as_deref(),
                &session.runtime,
                &session.source,
                &session.title,
                session.started_at,
                session.updated_at
            ],
        )
        .map_err(storage_error)?;

        Ok(session)
    }

    pub fn create_acp_transcript_session(
        &self,
        request: CreateAcpTranscriptSessionRequest,
    ) -> AppResult<TranscriptSessionInfo> {
        let source = request.source.trim();
        let candidate_id = request.candidate_id.trim();
        let agent_session_id = request.agent_session_id.trim();
        if source.is_empty() || candidate_id.is_empty() || agent_session_id.is_empty() {
            return Err(AppError::InvalidInput(
                "ACP source, candidate id, and agent session id must not be empty".into(),
            ));
        }
        if let Some(project_id) = request.project_id.as_deref() {
            self.require_project(project_id)?;
        }
        let now = unix_timestamp()?;
        let session = TranscriptSessionInfo {
            id: Uuid::new_v4().to_string(),
            project_id: request.project_id,
            runtime: "acp".to_string(),
            source: source.to_string(),
            title: request
                .title
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or(source)
                .to_string(),
            started_at: now,
            updated_at: now,
            event_count: 0,
        };
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        transaction.execute(
            "INSERT INTO transcript_sessions (id, project_id, runtime, source, title, started_at, updated_at)
             VALUES (?1, ?2, 'acp', ?3, ?4, ?5, ?6)",
            params![&session.id, session.project_id.as_deref(), &session.source, &session.title,
                session.started_at, session.updated_at],
        ).map_err(storage_error)?;
        transaction.execute(
            "INSERT INTO transcript_acp_identities
             (transcript_session_id, candidate_id, agent_session_id, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![&session.id, candidate_id, agent_session_id, now],
        ).map_err(storage_error)?;
        transaction.commit().map_err(storage_error)?;
        Ok(session)
    }

    pub fn transcript_acp_identity(
        &self,
        transcript_session_id: &str,
    ) -> AppResult<Option<TranscriptAcpIdentityInfo>> {
        let transcript_session_id = transcript_session_id.trim();
        if transcript_session_id.is_empty() {
            return Err(AppError::InvalidInput(
                "transcript session id must not be empty".into(),
            ));
        }
        self.connection()?
            .query_row(
                "SELECT transcript_session_id, candidate_id, agent_session_id, created_at
             FROM transcript_acp_identities WHERE transcript_session_id = ?1",
                params![transcript_session_id],
                |row| {
                    Ok(TranscriptAcpIdentityInfo {
                        transcript_session_id: row.get(0)?,
                        candidate_id: row.get(1)?,
                        agent_session_id: row.get(2)?,
                        created_at: row.get(3)?,
                    })
                },
            )
            .optional()
            .map_err(storage_error)
    }

    pub fn create_task(&self, request: CreateTaskRequest) -> AppResult<TaskInfo> {
        let project_id = request.project_id.trim();
        if project_id.is_empty() {
            return Err(AppError::InvalidInput(
                "task project id must not be empty".to_string(),
            ));
        }
        let transcript_session_id = request.transcript_session_id.trim();
        if transcript_session_id.is_empty() {
            return Err(AppError::InvalidInput(
                "task transcript session id must not be empty".to_string(),
            ));
        }
        if request.original_prompt.trim().is_empty() {
            return Err(AppError::InvalidInput(
                "task original prompt must not be empty".to_string(),
            ));
        }

        let complexity = assess_task_complexity(&request.original_prompt);
        let complexity_reasons_json = serde_json::to_string(&complexity.reasons)
            .map_err(|error| AppError::Storage(error.to_string()))?;
        self.require_project(project_id)?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        let transcript_project_id: Option<String> = transaction
            .query_row(
                "SELECT project_id FROM transcript_sessions WHERE id = ?1",
                params![transcript_session_id],
                |row| row.get(0),
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => AppError::InvalidInput(format!(
                    "transcript session not found: {transcript_session_id}"
                )),
                other => storage_error(other),
            })?;
        if transcript_project_id.as_deref() != Some(project_id) {
            return Err(AppError::InvalidInput(
                "task transcript session must belong to the selected project".to_string(),
            ));
        }

        let now = unix_timestamp()?;
        let task_id = Uuid::new_v4().to_string();
        transaction
            .execute(
                "INSERT INTO tasks
                 (id, project_id, transcript_session_id, original_prompt, status, current_phase,
                  initial_complexity_profile, initial_complexity_reasons_json,
                  initial_complexity_confidence, complexity_profile, complexity_reasons_json,
                  complexity_confidence, complexity_source, complexity_assessment_version,
                  created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, 'pending', 'analysis', ?5, ?6, ?7, ?5, ?6, ?7,
                         'system', ?8, ?9, ?9)",
                params![
                    task_id,
                    project_id,
                    transcript_session_id,
                    request.original_prompt,
                    &complexity.profile,
                    &complexity_reasons_json,
                    complexity.confidence,
                    &complexity.version,
                    now,
                ],
            )
            .map_err(|error| match error {
                rusqlite::Error::SqliteFailure(ref failure, _)
                    if failure.code == rusqlite::ErrorCode::ConstraintViolation =>
                {
                    AppError::InvalidInput(
                        "a task already exists for this transcript session".to_string(),
                    )
                }
                other => storage_error(other),
            })?;

        for (phase_index, phase) in TASK_PHASES.iter().enumerate() {
            transaction
                .execute(
                    "INSERT INTO task_phases
                     (id, task_id, phase, phase_index, status, started_at, completed_at)
                     VALUES (?1, ?2, ?3, ?4, 'pending', NULL, NULL)",
                    params![
                        Uuid::new_v4().to_string(),
                        &task_id,
                        phase,
                        phase_index as i64
                    ],
                )
                .map_err(storage_error)?;
        }
        insert_task_complexity_change(
            &transaction,
            TaskComplexityChangeInput {
                task_id: &task_id,
                sequence: 0,
                profile: &complexity.profile,
                reasons_json: &complexity_reasons_json,
                confidence: Some(complexity.confidence),
                source: "system",
                assessment_version: &complexity.version,
                created_at: now,
            },
        )?;
        transaction.commit().map_err(storage_error)?;
        drop(connection);

        self.task(&task_id)
    }

    pub fn update_task_complexity(
        &self,
        request: UpdateTaskComplexityRequest,
    ) -> AppResult<TaskInfo> {
        let task_id = request.task_id.trim();
        if task_id.is_empty() {
            return Err(AppError::InvalidInput(
                "task id must not be empty".to_string(),
            ));
        }
        let profile = request.profile.trim().to_lowercase();
        if !is_task_complexity_profile(&profile) {
            return Err(AppError::InvalidInput(
                "task complexity profile must be quick, standard, or complex".to_string(),
            ));
        }
        let reason = request.reason.trim();
        if reason.is_empty() {
            return Err(AppError::InvalidInput(
                "task complexity override reason must not be empty".to_string(),
            ));
        }
        let reasons_json = serde_json::to_string(&vec![reason])
            .map_err(|error| AppError::Storage(error.to_string()))?;
        let now = unix_timestamp()?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        let assessment_version: String = transaction
            .query_row(
                "SELECT complexity_assessment_version FROM tasks WHERE id = ?1",
                params![task_id],
                |row| row.get(0),
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::InvalidInput(format!("task not found: {task_id}"))
                }
                other => storage_error(other),
            })?;
        let next_sequence: i64 = transaction
            .query_row(
                "SELECT COALESCE(MAX(sequence), -1) + 1
                 FROM task_complexity_changes WHERE task_id = ?1",
                params![task_id],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        transaction
            .execute(
                "UPDATE tasks
                 SET complexity_profile = ?1, complexity_reasons_json = ?2,
                     complexity_confidence = NULL, complexity_source = 'user', updated_at = ?3
                 WHERE id = ?4",
                params![profile, reasons_json, now, task_id],
            )
            .map_err(storage_error)?;
        insert_task_complexity_change(
            &transaction,
            TaskComplexityChangeInput {
                task_id,
                sequence: next_sequence,
                profile: &profile,
                reasons_json: &reasons_json,
                confidence: None,
                source: "user",
                assessment_version: &assessment_version,
                created_at: now,
            },
        )?;
        transaction.commit().map_err(storage_error)?;
        drop(connection);
        self.task(task_id)
    }

    pub fn list_project_tasks(&self, project_id: &str) -> AppResult<Vec<TaskInfo>> {
        let project_id = project_id.trim();
        if project_id.is_empty() {
            return Err(AppError::InvalidInput(
                "task project id must not be empty".to_string(),
            ));
        }
        self.require_project(project_id)?;

        let task_ids = {
            let connection = self.connection()?;
            let mut statement = connection
                .prepare(
                    "SELECT id FROM tasks
                     WHERE project_id = ?1
                     ORDER BY updated_at DESC, created_at DESC, id ASC",
                )
                .map_err(storage_error)?;
            let ids = statement
                .query_map(params![project_id], |row| row.get::<_, String>(0))
                .map_err(storage_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(storage_error)?;
            ids
        };

        task_ids.iter().map(|task_id| self.task(task_id)).collect()
    }

    pub fn create_task_phase_artifact(
        &self,
        request: CreateTaskPhaseArtifactRequest,
    ) -> AppResult<TaskPhaseArtifactInfo> {
        let task_id = request.task_id.trim();
        let phase = request.phase.trim().to_lowercase();
        let kind = request.kind.trim().to_lowercase();
        let content = request.content.trim();
        if task_id.is_empty() || !TASK_PHASES.contains(&phase.as_str()) {
            return Err(AppError::InvalidInput(
                "task artifact requires a valid task and phase".to_string(),
            ));
        }
        if kind.is_empty() || content.is_empty() {
            return Err(AppError::InvalidInput(
                "task artifact kind and content must not be empty".to_string(),
            ));
        }
        let mut source_ids = Vec::new();
        for source_id in request.source_transcript_event_ids {
            let source_id = source_id.trim().to_string();
            if !source_ids.contains(&source_id) {
                source_ids.push(source_id);
            }
        }
        if source_ids.is_empty() || source_ids.iter().any(String::is_empty) {
            return Err(AppError::InvalidInput(
                "task artifact requires transcript event provenance".to_string(),
            ));
        }

        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        let (transcript_session_id, current_phase): (String, String) = transaction
            .query_row(
                "SELECT transcript_session_id, current_phase FROM tasks WHERE id = ?1",
                params![task_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::InvalidInput(format!("task not found: {task_id}"))
                }
                other => storage_error(other),
            })?;
        let phase_status: String = transaction
            .query_row(
                "SELECT status FROM task_phases WHERE task_id = ?1 AND phase = ?2",
                params![task_id, phase],
                |row| row.get(0),
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::InvalidInput("task phase not found".to_string())
                }
                other => storage_error(other),
            })?;
        if phase != current_phase || phase_status != "in_progress" {
            return Err(AppError::InvalidInput(
                "artifacts may only be added to the current in-progress phase".to_string(),
            ));
        }
        let mut sourced_events = Vec::new();
        for event_id in &source_ids {
            let (event_session_id, event_sequence): (String, i64) = transaction
                .query_row(
                    "SELECT session_id, sequence FROM transcript_events WHERE id = ?1",
                    params![event_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .map_err(|error| match error {
                    rusqlite::Error::QueryReturnedNoRows => {
                        AppError::InvalidInput(format!("transcript event not found: {event_id}"))
                    }
                    other => storage_error(other),
                })?;
            if event_session_id != transcript_session_id {
                return Err(AppError::InvalidInput(
                    "artifact provenance must belong to the task transcript".to_string(),
                ));
            }
            sourced_events.push((event_id.clone(), event_sequence));
        }
        sourced_events.sort_by_key(|(_, sequence)| *sequence);
        source_ids = sourced_events.into_iter().map(|(id, _)| id).collect();
        let sequence: i64 = transaction.query_row(
            "SELECT COALESCE(MAX(sequence), -1) + 1 FROM task_phase_artifacts WHERE task_id = ?1 AND phase = ?2",
            params![task_id, phase], |row| row.get(0),
        ).map_err(storage_error)?;
        let artifact_id = Uuid::new_v4().to_string();
        let created_at = unix_timestamp()?;
        transaction.execute(
            "INSERT INTO task_phase_artifacts (id, task_id, phase, sequence, kind, content, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![artifact_id, task_id, phase, sequence, kind, content, created_at],
        ).map_err(storage_error)?;
        for event_id in &source_ids {
            transaction.execute(
                "INSERT INTO task_phase_artifact_event_sources (artifact_id, transcript_event_id) VALUES (?1, ?2)",
                params![artifact_id, event_id],
            ).map_err(storage_error)?;
        }
        transaction.commit().map_err(storage_error)?;
        Ok(TaskPhaseArtifactInfo {
            id: artifact_id,
            task_id: task_id.to_string(),
            phase,
            sequence,
            kind,
            content: content.to_string(),
            source_transcript_event_ids: source_ids,
            created_at,
        })
    }

    pub fn list_task_phase_artifacts(
        &self,
        task_id: &str,
    ) -> AppResult<Vec<TaskPhaseArtifactInfo>> {
        let task_id = task_id.trim();
        if task_id.is_empty() {
            return Err(AppError::InvalidInput(
                "task id must not be empty".to_string(),
            ));
        }
        self.task(task_id)?;
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT id, task_id, phase, sequence, kind, content, created_at FROM task_phase_artifacts
             WHERE task_id = ?1 ORDER BY CASE phase WHEN 'analysis' THEN 0 WHEN 'planning' THEN 1
             WHEN 'execution' THEN 2 ELSE 3 END, sequence ASC",
        ).map_err(storage_error)?;
        let mut artifacts = statement
            .query_map(params![task_id], |row| {
                Ok(TaskPhaseArtifactInfo {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    phase: row.get(2)?,
                    sequence: row.get(3)?,
                    kind: row.get(4)?,
                    content: row.get(5)?,
                    source_transcript_event_ids: Vec::new(),
                    created_at: row.get(6)?,
                })
            })
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;
        drop(statement);
        for artifact in &mut artifacts {
            let mut sources = connection.prepare(
                "SELECT sources.transcript_event_id FROM task_phase_artifact_event_sources sources
                 JOIN transcript_events events ON events.id = sources.transcript_event_id
                 WHERE sources.artifact_id = ?1 ORDER BY events.sequence ASC",
            ).map_err(storage_error)?;
            artifact.source_transcript_event_ids = sources
                .query_map(params![artifact.id], |row| row.get(0))
                .map_err(storage_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(storage_error)?;
        }
        Ok(artifacts)
    }

    pub fn create_task_plan_version(
        &self,
        request: CreateTaskPlanVersionRequest,
    ) -> AppResult<TaskPlanVersionInfo> {
        self.create_task_plan_version_attributed(request, None)
    }

    fn create_task_plan_version_attributed(
        &self,
        request: CreateTaskPlanVersionRequest,
        attribution: Option<(&str, &str)>,
    ) -> AppResult<TaskPlanVersionInfo> {
        let task_id = request.task_id.trim();
        let source_artifact_id = request.source_artifact_id.trim();
        if task_id.is_empty() || source_artifact_id.is_empty() {
            return Err(AppError::InvalidInput(
                "structured plan requires a task and planning evidence artifact".into(),
            ));
        }
        if request.requirements.is_empty() || request.steps.is_empty() {
            return Err(AppError::InvalidInput(
                "structured plan requires at least one requirement and one step".into(),
            ));
        }
        let mut requirement_ids = HashSet::new();
        let requirements = request
            .requirements
            .into_iter()
            .enumerate()
            .map(|(index, item)| {
                let id = item.id.trim().to_uppercase();
                let text = item.text.trim().to_string();
                let kind = item.kind.trim().to_lowercase();
                if id.is_empty()
                    || text.is_empty()
                    || !matches!(
                        kind.as_str(),
                        "functional" | "constraint" | "non_functional" | "out_of_scope"
                    )
                    || !requirement_ids.insert(id.clone())
                {
                    return Err(AppError::InvalidInput(
                        "requirements need unique IDs, text, and a supported kind".into(),
                    ));
                }
                Ok((index as i64, id, text, kind))
            })
            .collect::<AppResult<Vec<_>>>()?;
        let declared_ids = requirement_ids;
        let steps = request.steps.into_iter().enumerate().map(|(index, item)| {
            let title = item.title.trim().to_string();
            let description = item.description.trim().to_string();
            let kind = item.kind.trim().to_lowercase();
            let acceptance_criteria = normalized_non_empty(item.acceptance_criteria);
            let expected_paths = normalized_non_empty(item.expected_paths);
            let satisfies = normalized_non_empty(item.satisfies)
                .into_iter().map(|id| id.to_uppercase()).collect::<Vec<_>>();
            let depends_on = normalized_non_empty(item.depends_on)
                .into_iter().map(|id| id.to_uppercase()).collect::<Vec<_>>();
            let valid_dependencies = depends_on.iter().all(|dependency| {
                dependency.strip_prefix("STEP-")
                    .and_then(|value| value.parse::<usize>().ok())
                    .is_some_and(|order| order > 0 && order <= index)
            });
            if title.is_empty() || description.is_empty()
                || !matches!(kind.as_str(), "implementation" | "infrastructure")
                || !(1..=5).contains(&item.complexity)
                || acceptance_criteria.is_empty()
                || kind == "implementation" && satisfies.is_empty()
                || satisfies.iter().any(|id| !declared_ids.contains(id))
                || !valid_dependencies {
                return Err(AppError::InvalidInput(
                    "steps need title, description, complexity 1-5, criteria, and valid requirement links".into(),
                ));
            }
            Ok((index as i64, title, description, kind, item.complexity,
                acceptance_criteria, expected_paths, satisfies, depends_on))
        }).collect::<AppResult<Vec<_>>>()?;

        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        let phase: (String, String) = transaction.query_row(
            "SELECT tasks.current_phase, phases.status FROM tasks
             JOIN task_phases phases ON phases.task_id = tasks.id AND phases.phase = tasks.current_phase
             WHERE tasks.id = ?1",
            [task_id], |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::InvalidInput(format!("task not found: {task_id}")),
            other => storage_error(other),
        })?;
        if phase != ("planning".into(), "in_progress".into()) {
            return Err(AppError::InvalidInput(
                "structured plans may only be created during the in-progress planning phase".into(),
            ));
        }
        let artifact_valid: bool = transaction
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM task_phase_artifacts
             WHERE id = ?1 AND task_id = ?2 AND phase = 'planning')",
                params![source_artifact_id, task_id],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        if !artifact_valid {
            return Err(AppError::InvalidInput(
                "structured plan source must be planning evidence from the same task".into(),
            ));
        }
        let approved_exists: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM task_plan_versions WHERE task_id = ?1 AND status = 'approved')",
            [task_id], |row| row.get(0),
        ).map_err(storage_error)?;
        if approved_exists {
            return Err(AppError::InvalidInput(
                "approved structured plan is immutable".into(),
            ));
        }
        let version: i64 = transaction
            .query_row(
                "SELECT COALESCE(MAX(version), 0) + 1 FROM task_plan_versions WHERE task_id = ?1",
                [task_id],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        let id = Uuid::new_v4().to_string();
        let now = unix_timestamp()?;
        transaction
            .execute(
                "INSERT INTO task_plan_versions
             (id, task_id, version, status, source_artifact_id, created_at, approved_at)
             VALUES (?1, ?2, ?3, 'draft', ?4, ?5, NULL)",
                params![id, task_id, version, source_artifact_id, now],
            )
            .map_err(storage_error)?;
        for (order, requirement_id, text, kind) in requirements {
            transaction
                .execute(
                    "INSERT INTO task_plan_requirements
                 (plan_version_id, requirement_id, order_index, text, kind)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![id, requirement_id, order, text, kind],
                )
                .map_err(storage_error)?;
        }
        for (order, title, description, kind, complexity, criteria, paths, satisfies, depends_on) in
            steps
        {
            transaction
                .execute(
                    "INSERT INTO task_plan_steps
                 (id, plan_version_id, order_index, title, description, kind, complexity,
                  acceptance_criteria_json, expected_paths_json, satisfies_json, depends_on_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                    params![
                        Uuid::new_v4().to_string(),
                        id,
                        order,
                        title,
                        description,
                        kind,
                        complexity,
                        json_string_list(&criteria)?,
                        json_string_list(&paths)?,
                        json_string_list(&satisfies)?,
                        json_string_list(&depends_on)?
                    ],
                )
                .map_err(storage_error)?;
        }
        if let Some((critique_id, source_plan_version_id)) = attribution {
            let critique_valid: bool = transaction
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM task_plan_critiques
                     WHERE id = ?1 AND task_id = ?2 AND plan_version_id = ?3)",
                    params![critique_id, task_id, source_plan_version_id],
                    |row| row.get(0),
                )
                .map_err(storage_error)?;
            if !critique_valid {
                return Err(AppError::InvalidInput(
                    "repair attribution does not belong to the selected task and source plan"
                        .into(),
                ));
            }
            transaction
                .execute(
                    "INSERT INTO task_plan_repair_applications
                     (id, critique_id, source_plan_version_id, repaired_plan_version_id, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        Uuid::new_v4().to_string(),
                        critique_id,
                        source_plan_version_id,
                        id,
                        now
                    ],
                )
                .map_err(|error| match error {
                    rusqlite::Error::SqliteFailure(ref failure, _)
                        if failure.code == rusqlite::ErrorCode::ConstraintViolation =>
                    {
                        AppError::InvalidInput("plan critique repairs were already applied".into())
                    }
                    other => storage_error(other),
                })?;
        }
        transaction.commit().map_err(storage_error)?;
        drop(connection);
        self.task_plan_version(&id)
    }

    pub fn list_task_plan_versions(&self, task_id: &str) -> AppResult<Vec<TaskPlanVersionInfo>> {
        let task_id = task_id.trim();
        self.task(task_id)?;
        let connection = self.connection()?;
        let ids = {
            let mut statement = connection
                .prepare(
                    "SELECT id FROM task_plan_versions WHERE task_id = ?1 ORDER BY version ASC",
                )
                .map_err(storage_error)?;
            let values = statement
                .query_map([task_id], |row| row.get(0))
                .map_err(storage_error)?
                .collect::<Result<Vec<String>, _>>()
                .map_err(storage_error)?;
            values
        };
        drop(connection);
        ids.iter().map(|id| self.task_plan_version(id)).collect()
    }

    pub fn approve_task_plan_version(
        &self,
        request: ApproveTaskPlanVersionRequest,
    ) -> AppResult<TaskPlanVersionInfo> {
        let task_id = request.task_id.trim();
        let plan_id = request.plan_version_id.trim();
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        let state: Option<(String, String, String)> = transaction.query_row(
            "SELECT versions.status, tasks.current_phase, phases.status
             FROM task_plan_versions versions JOIN tasks ON tasks.id = versions.task_id
             JOIN task_phases phases ON phases.task_id = tasks.id AND phases.phase = tasks.current_phase
             WHERE versions.id = ?1 AND versions.task_id = ?2",
            params![plan_id, task_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).optional().map_err(storage_error)?;
        if state
            .as_ref()
            .is_none_or(|(_, phase, status)| phase != "planning" || status != "in_progress")
        {
            return Err(AppError::InvalidInput(
                "only a draft from the current in-progress planning phase can be approved".into(),
            ));
        }
        if state.is_some_and(|(status, _, _)| status != "draft") {
            return Err(AppError::InvalidInput(
                "structured plan version is already finalized".into(),
            ));
        }
        let evaluation_verdict: Option<String> = transaction
            .query_row(
                "SELECT verdict FROM task_plan_evaluations WHERE plan_version_id = ?1",
                [plan_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(storage_error)?;
        if evaluation_verdict
            .as_deref()
            .is_none_or(|verdict| verdict == "blocked")
        {
            return Err(AppError::InvalidInput(
                "plan approval requires a current non-blocking deterministic evaluation".into(),
            ));
        }
        let now = unix_timestamp()?;
        transaction
            .execute(
                "UPDATE task_plan_versions SET status = 'approved', approved_at = ?1 WHERE id = ?2",
                params![now, plan_id],
            )
            .map_err(|error| match error {
                rusqlite::Error::SqliteFailure(ref failure, _)
                    if failure.code == rusqlite::ErrorCode::ConstraintViolation =>
                {
                    AppError::InvalidInput("task already has an approved structured plan".into())
                }
                other => storage_error(other),
            })?;
        transaction.commit().map_err(storage_error)?;
        drop(connection);
        self.task_plan_version(plan_id)
    }

    pub fn evaluate_task_plan(
        &self,
        request: EvaluateTaskPlanRequest,
    ) -> AppResult<TaskPlanEvaluationInfo> {
        let task_id = request.task_id.trim();
        let plan_id = request.plan_version_id.trim();
        let plan = self.task_plan_version(plan_id)?;
        if plan.task_id != task_id {
            return Err(AppError::InvalidInput(
                "plan version does not belong to the selected task".into(),
            ));
        }
        if let Some(existing) = self.task_plan_evaluation(plan_id)? {
            return Ok(existing);
        }
        let (verdict, findings) = task_plan::evaluate(&plan);
        let findings_json = serde_json::to_string(&findings)
            .map_err(|error| AppError::Storage(error.to_string()))?;
        let id = Uuid::new_v4().to_string();
        let created_at = unix_timestamp()?;
        let connection = self.connection()?;
        connection
            .execute(
                "INSERT OR IGNORE INTO task_plan_evaluations
             (id, task_id, plan_version_id, plan_version, verdict, findings_json, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    id,
                    task_id,
                    plan_id,
                    plan.version,
                    verdict,
                    findings_json,
                    created_at
                ],
            )
            .map_err(storage_error)?;
        drop(connection);
        self.task_plan_evaluation(plan_id)?
            .ok_or_else(|| AppError::Storage("structured plan evaluation was not persisted".into()))
    }

    pub fn task_plan_evaluation(
        &self,
        plan_version_id: &str,
    ) -> AppResult<Option<TaskPlanEvaluationInfo>> {
        let connection = self.connection()?;
        connection.query_row(
            "SELECT id, task_id, plan_version_id, plan_version, verdict, findings_json, created_at
             FROM task_plan_evaluations WHERE plan_version_id = ?1",
            [plan_version_id], |row| {
                let json: String = row.get(5)?;
                let findings = serde_json::from_str(&json).map_err(|error|
                    rusqlite::Error::FromSqlConversionFailure(5, Type::Text, Box::new(error)))?;
                Ok(TaskPlanEvaluationInfo {
                    id: row.get(0)?, task_id: row.get(1)?, plan_version_id: row.get(2)?,
                    plan_version: row.get(3)?, verdict: row.get(4)?, findings,
                    created_at: row.get(6)?,
                })
            },
        ).optional().map_err(storage_error)
    }

    pub fn create_task_plan_critique(
        &self,
        request: CreateTaskPlanCritiqueRequest,
    ) -> AppResult<TaskPlanCritiqueInfo> {
        let task_id = request.task_id.trim();
        let plan_id = request.plan_version_id.trim();
        let evaluation_id = request.evaluation_id.trim();
        let source = request.source.trim();
        if task_id.is_empty() || plan_id.is_empty() || evaluation_id.is_empty() || source.is_empty()
        {
            return Err(AppError::InvalidInput(
                "plan critique requires a task, plan version, evaluation, and source".into(),
            ));
        }
        let evaluation = self
            .task_plan_evaluation(plan_id)?
            .filter(|item| item.id == evaluation_id && item.task_id == task_id)
            .ok_or_else(|| {
                AppError::InvalidInput(
                    "plan critique evaluation does not belong to the selected task and plan".into(),
                )
            })?;
        if let Some(existing) = self.task_plan_critique(evaluation_id)? {
            return Ok(existing);
        }
        let plan = self.task_plan_version(plan_id)?;
        let issues =
            task_plan_critique::grounded_issues(&request.response, &plan, &evaluation.findings);
        if !evaluation.findings.is_empty() && issues.is_empty() {
            return Err(AppError::InvalidInput(
                "plan critique response contains no grounded issues".into(),
            ));
        }
        let issues_json =
            serde_json::to_string(&issues).map_err(|error| AppError::Storage(error.to_string()))?;
        let id = Uuid::new_v4().to_string();
        let created_at = unix_timestamp()?;
        let connection = self.connection()?;
        connection
            .execute(
                "INSERT OR IGNORE INTO task_plan_critiques
                 (id, task_id, plan_version_id, evaluation_id, source, issues_json, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    id,
                    task_id,
                    plan_id,
                    evaluation_id,
                    source,
                    issues_json,
                    created_at
                ],
            )
            .map_err(storage_error)?;
        drop(connection);
        self.task_plan_critique(evaluation_id)?
            .ok_or_else(|| AppError::Storage("plan critique was not persisted".into()))
    }

    pub fn task_plan_critique(
        &self,
        evaluation_id: &str,
    ) -> AppResult<Option<TaskPlanCritiqueInfo>> {
        let connection = self.connection()?;
        connection
            .query_row(
                "SELECT id, task_id, plan_version_id, evaluation_id, source, issues_json, created_at
                 FROM task_plan_critiques WHERE evaluation_id = ?1",
                [evaluation_id],
                |row| {
                    let json: String = row.get(5)?;
                    let issues = serde_json::from_str(&json).map_err(|error| {
                        rusqlite::Error::FromSqlConversionFailure(
                            5,
                            Type::Text,
                            Box::new(error),
                        )
                    })?;
                    Ok(TaskPlanCritiqueInfo {
                        id: row.get(0)?,
                        task_id: row.get(1)?,
                        plan_version_id: row.get(2)?,
                        evaluation_id: row.get(3)?,
                        source: row.get(4)?,
                        issues,
                        created_at: row.get(6)?,
                    })
                },
            )
            .optional()
            .map_err(storage_error)
    }

    pub fn apply_task_plan_critique(
        &self,
        request: ApplyTaskPlanCritiqueRequest,
    ) -> AppResult<TaskPlanVersionInfo> {
        let task_id = request.task_id.trim();
        let critique_id = request.critique_id.trim();
        if task_id.is_empty() || critique_id.is_empty() {
            return Err(AppError::InvalidInput(
                "applying plan repairs requires a task and critique".into(),
            ));
        }
        let critique = self
            .task_plan_critique_by_id(critique_id)?
            .filter(|item| item.task_id == task_id)
            .ok_or_else(|| {
                AppError::InvalidInput("plan critique does not belong to the selected task".into())
            })?;
        let source = self.task_plan_version(&critique.plan_version_id)?;
        if source.status != "draft" {
            return Err(AppError::InvalidInput(
                "repairs may only be applied to a draft plan version".into(),
            ));
        }
        let repaired = task_plan_critique::repair_draft(&source, &critique.issues)
            .map_err(AppError::InvalidInput)?;
        self.create_task_plan_version_attributed(repaired, Some((&critique.id, &source.id)))
    }

    fn task_plan_critique_by_id(
        &self,
        critique_id: &str,
    ) -> AppResult<Option<TaskPlanCritiqueInfo>> {
        let connection = self.connection()?;
        connection
            .query_row(
                "SELECT id, task_id, plan_version_id, evaluation_id, source, issues_json, created_at
                 FROM task_plan_critiques WHERE id = ?1",
                [critique_id],
                |row| {
                    let json: String = row.get(5)?;
                    let issues = serde_json::from_str(&json).map_err(|error| {
                        rusqlite::Error::FromSqlConversionFailure(
                            5,
                            Type::Text,
                            Box::new(error),
                        )
                    })?;
                    Ok(TaskPlanCritiqueInfo {
                        id: row.get(0)?,
                        task_id: row.get(1)?,
                        plan_version_id: row.get(2)?,
                        evaluation_id: row.get(3)?,
                        source: row.get(4)?,
                        issues,
                        created_at: row.get(6)?,
                    })
                },
            )
            .optional()
            .map_err(storage_error)
    }

    fn task_plan_version(&self, plan_id: &str) -> AppResult<TaskPlanVersionInfo> {
        let connection = self.connection()?;
        let mut plan = connection
            .query_row(
                "SELECT id, task_id, version, status, source_artifact_id, created_at, approved_at
             FROM task_plan_versions WHERE id = ?1",
                [plan_id],
                |row| {
                    Ok(TaskPlanVersionInfo {
                        id: row.get(0)?,
                        task_id: row.get(1)?,
                        version: row.get(2)?,
                        status: row.get(3)?,
                        source_artifact_id: row.get(4)?,
                        requirements: Vec::new(),
                        steps: Vec::new(),
                        created_at: row.get(5)?,
                        approved_at: row.get(6)?,
                    })
                },
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::InvalidInput(format!("structured plan version not found: {plan_id}"))
                }
                other => storage_error(other),
            })?;
        let mut requirements = connection
            .prepare(
                "SELECT requirement_id, text, kind, order_index FROM task_plan_requirements
             WHERE plan_version_id = ?1 ORDER BY order_index ASC",
            )
            .map_err(storage_error)?;
        plan.requirements = requirements
            .query_map([plan_id], |row| {
                Ok(TaskPlanRequirementInfo {
                    id: row.get(0)?,
                    text: row.get(1)?,
                    kind: row.get(2)?,
                    order_index: row.get(3)?,
                })
            })
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;
        drop(requirements);
        let mut steps = connection
            .prepare(
                "SELECT id, order_index, title, description, kind, complexity,
                    acceptance_criteria_json, expected_paths_json, satisfies_json, depends_on_json
             FROM task_plan_steps WHERE plan_version_id = ?1 ORDER BY order_index ASC",
            )
            .map_err(storage_error)?;
        plan.steps = steps
            .query_map([plan_id], |row| {
                Ok(TaskPlanStepInfo {
                    id: row.get(0)?,
                    order_index: row.get(1)?,
                    title: row.get(2)?,
                    description: row.get(3)?,
                    kind: row.get(4)?,
                    complexity: row.get(5)?,
                    acceptance_criteria: json_string_list_from_row(row, 6)?,
                    expected_paths: json_string_list_from_row(row, 7)?,
                    satisfies: json_string_list_from_row(row, 8)?,
                    depends_on: json_string_list_from_row(row, 9)?,
                })
            })
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;
        Ok(plan)
    }

    pub fn create_task_agent_report(
        &self,
        request: CreateTaskAgentReportRequest,
    ) -> AppResult<TaskAgentReportInfo> {
        let task_id = request.task_id.trim();
        let phase = request.phase.trim().to_lowercase();
        let role = request.role.trim().to_lowercase();
        let transcript_session_id = request.transcript_session_id.trim();
        let content = request.content.trim();
        if task_id.is_empty()
            || !TASK_PHASES.contains(&phase.as_str())
            || !matches!(role.as_str(), "advisor" | "reviewer")
            || transcript_session_id.is_empty()
            || content.is_empty()
        {
            return Err(AppError::InvalidInput(
                "task agent report requires a task, current phase, advisor/reviewer role, ACP transcript, and content".into(),
            ));
        }
        let mut source_ids = Vec::new();
        for source_id in request.source_transcript_event_ids {
            let source_id = source_id.trim().to_string();
            if !source_ids.contains(&source_id) {
                source_ids.push(source_id);
            }
        }
        if source_ids.is_empty() || source_ids.iter().any(String::is_empty) {
            return Err(AppError::InvalidInput(
                "task agent report requires transcript event provenance".into(),
            ));
        }

        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        let (project_id, task_transcript_id, current_phase, task_status):
            (String, String, String, String) = transaction
            .query_row(
                "SELECT project_id, transcript_session_id, current_phase, status FROM tasks WHERE id = ?1",
                params![task_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::InvalidInput(format!("task not found: {task_id}"))
                }
                other => storage_error(other),
            })?;
        let phase_status: String = transaction
            .query_row(
                "SELECT status FROM task_phases WHERE task_id = ?1 AND phase = ?2",
                params![task_id, phase],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        if phase != current_phase || task_status != "in_progress" || phase_status != "in_progress" {
            return Err(AppError::InvalidInput(
                "task agent reports may only target the current in-progress phase".into(),
            ));
        }
        let (report_project_id, runtime): (Option<String>, String) = transaction
            .query_row(
                "SELECT project_id, runtime FROM transcript_sessions WHERE id = ?1",
                params![transcript_session_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::InvalidInput("task agent transcript not found".into())
                }
                other => storage_error(other),
            })?;
        let transcript_owns_task: bool = transaction
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM tasks WHERE transcript_session_id = ?1)",
                params![transcript_session_id],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        if transcript_session_id == task_transcript_id
            || transcript_owns_task
            || report_project_id.as_deref() != Some(project_id.as_str())
            || runtime != "acp"
        {
            return Err(AppError::InvalidInput(
                "task agent reports require a separate same-project ACP transcript".into(),
            ));
        }
        let mut sourced_events = Vec::new();
        for event_id in &source_ids {
            let (event_session_id, event_sequence, event_kind): (String, i64, String) = transaction
                .query_row(
                    "SELECT session_id, sequence, kind FROM transcript_events WHERE id = ?1",
                    params![event_id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                )
                .map_err(|error| match error {
                    rusqlite::Error::QueryReturnedNoRows => {
                        AppError::InvalidInput(format!("transcript event not found: {event_id}"))
                    }
                    other => storage_error(other),
                })?;
            if event_session_id != transcript_session_id
                || !matches!(event_kind.as_str(), "agent_message" | "agent_thought")
            {
                return Err(AppError::InvalidInput(
                    "task agent report provenance must be agent output from its exact transcript"
                        .into(),
                ));
            }
            sourced_events.push((event_id.clone(), event_sequence));
        }
        sourced_events.sort_by_key(|(_, sequence)| *sequence);
        source_ids = sourced_events.into_iter().map(|(id, _)| id).collect();
        let sequence: i64 = transaction
            .query_row(
                "SELECT COALESCE(MAX(sequence), -1) + 1 FROM task_agent_reports WHERE task_id = ?1 AND phase = ?2",
                params![task_id, phase],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        let id = Uuid::new_v4().to_string();
        let created_at = unix_timestamp()?;
        transaction
            .execute(
                "INSERT INTO task_agent_reports
             (id, task_id, phase, sequence, role, transcript_session_id, content, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    id,
                    task_id,
                    phase,
                    sequence,
                    role,
                    transcript_session_id,
                    content,
                    created_at
                ],
            )
            .map_err(storage_error)?;
        for event_id in &source_ids {
            transaction.execute(
                "INSERT INTO task_agent_report_event_sources (report_id, transcript_event_id) VALUES (?1, ?2)",
                params![id, event_id],
            ).map_err(storage_error)?;
        }
        transaction.commit().map_err(storage_error)?;
        Ok(TaskAgentReportInfo {
            id,
            task_id: task_id.into(),
            phase,
            sequence,
            role,
            transcript_session_id: transcript_session_id.into(),
            content: content.into(),
            source_transcript_event_ids: source_ids,
            created_at,
        })
    }

    pub fn create_task_agent_report_transcript(
        &self,
        request: CreateTaskAgentReportTranscriptRequest,
    ) -> AppResult<TaskAgentReportTranscriptInfo> {
        let task_id = request.task_id.trim();
        let phase = request.phase.trim().to_lowercase();
        let role = request.role.trim().to_lowercase();
        let source = request.transcript_source.trim();
        let candidate_id = request.candidate_id.trim();
        let agent_session_id = request.agent_session_id.trim();
        let content = request.content.trim();
        if task_id.is_empty()
            || !TASK_PHASES.contains(&phase.as_str())
            || !matches!(role.as_str(), "advisor" | "reviewer")
            || source.is_empty()
            || candidate_id.is_empty()
            || agent_session_id.is_empty()
            || content.is_empty()
            || request.events.is_empty()
        {
            return Err(AppError::InvalidInput(
                "task agent report transcript requires task, current phase, role, ACP identity, events, and content".into(),
            ));
        }
        let title = request
            .transcript_title
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(source)
            .to_string();
        let mut normalized_events = Vec::with_capacity(request.events.len());
        for event in request.events {
            let kind = event.kind.trim();
            if kind.is_empty() || event.content.trim().is_empty() {
                return Err(AppError::InvalidInput(
                    "task agent report transcript events must not be empty".into(),
                ));
            }
            normalized_events.push(TranscriptEventInput {
                kind: kind.to_string(),
                content: event.content,
            });
        }

        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        let (project_id, current_phase, task_status): (String, String, String) = transaction
            .query_row(
                "SELECT project_id, current_phase, status FROM tasks WHERE id = ?1",
                params![task_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::InvalidInput(format!("task not found: {task_id}"))
                }
                other => storage_error(other),
            })?;
        let phase_status: String = transaction
            .query_row(
                "SELECT status FROM task_phases WHERE task_id = ?1 AND phase = ?2",
                params![task_id, phase],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        if phase != current_phase || task_status != "in_progress" || phase_status != "in_progress" {
            return Err(AppError::InvalidInput(
                "task agent reports may only target the current in-progress phase".into(),
            ));
        }

        let now = unix_timestamp()?;
        let transcript = TranscriptSessionInfo {
            id: Uuid::new_v4().to_string(),
            project_id: Some(project_id.clone()),
            runtime: "acp".to_string(),
            source: source.to_string(),
            title,
            started_at: now,
            updated_at: now,
            event_count: normalized_events.len() as i64,
        };
        transaction.execute(
            "INSERT INTO transcript_sessions (id, project_id, runtime, source, title, started_at, updated_at)
             VALUES (?1, ?2, 'acp', ?3, ?4, ?5, ?6)",
            params![&transcript.id, transcript.project_id.as_deref(), &transcript.source,
                &transcript.title, transcript.started_at, transcript.updated_at],
        ).map_err(storage_error)?;
        transaction.execute(
            "INSERT INTO transcript_acp_identities
             (transcript_session_id, candidate_id, agent_session_id, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![&transcript.id, candidate_id, agent_session_id, now],
        ).map_err(storage_error)?;

        let mut source_ids = Vec::new();
        for (offset, event) in normalized_events.into_iter().enumerate() {
            let event_id = Uuid::new_v4().to_string();
            let sequence = offset as i64;
            transaction
                .execute(
                    "INSERT INTO transcript_events (id, session_id, sequence, kind, content, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![&event_id, &transcript.id, sequence, &event.kind, &event.content, now],
                )
                .map_err(storage_error)?;
            if matches!(event.kind.as_str(), "agent_message" | "agent_thought") {
                source_ids.push(event_id);
            }
        }
        if source_ids.is_empty() {
            return Err(AppError::InvalidInput(
                "task agent report requires persisted agent output".into(),
            ));
        }

        let sequence: i64 = transaction
            .query_row(
                "SELECT COALESCE(MAX(sequence), -1) + 1 FROM task_agent_reports WHERE task_id = ?1 AND phase = ?2",
                params![task_id, phase],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        let report = TaskAgentReportInfo {
            id: Uuid::new_v4().to_string(),
            task_id: task_id.into(),
            phase,
            sequence,
            role,
            transcript_session_id: transcript.id.clone(),
            content: content.into(),
            source_transcript_event_ids: source_ids,
            created_at: now,
        };
        transaction
            .execute(
                "INSERT INTO task_agent_reports
             (id, task_id, phase, sequence, role, transcript_session_id, content, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    &report.id,
                    &report.task_id,
                    &report.phase,
                    report.sequence,
                    &report.role,
                    &report.transcript_session_id,
                    &report.content,
                    report.created_at
                ],
            )
            .map_err(storage_error)?;
        for event_id in &report.source_transcript_event_ids {
            transaction.execute(
                "INSERT INTO task_agent_report_event_sources (report_id, transcript_event_id) VALUES (?1, ?2)",
                params![&report.id, event_id],
            ).map_err(storage_error)?;
        }
        transaction.commit().map_err(storage_error)?;

        Ok(TaskAgentReportTranscriptInfo {
            transcript_session: transcript,
            report,
        })
    }

    pub fn list_task_agent_reports(&self, task_id: &str) -> AppResult<Vec<TaskAgentReportInfo>> {
        self.task(task_id)?;
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT id, task_id, phase, sequence, role, transcript_session_id, content, created_at
             FROM task_agent_reports WHERE task_id = ?1 ORDER BY CASE phase
             WHEN 'analysis' THEN 0 WHEN 'planning' THEN 1 WHEN 'execution' THEN 2 ELSE 3 END,
             sequence ASC",
        ).map_err(storage_error)?;
        let mut reports = statement
            .query_map(params![task_id], |row| {
                Ok(TaskAgentReportInfo {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    phase: row.get(2)?,
                    sequence: row.get(3)?,
                    role: row.get(4)?,
                    transcript_session_id: row.get(5)?,
                    content: row.get(6)?,
                    source_transcript_event_ids: Vec::new(),
                    created_at: row.get(7)?,
                })
            })
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;
        drop(statement);
        for report in &mut reports {
            let mut sources = connection.prepare(
                "SELECT sources.transcript_event_id FROM task_agent_report_event_sources sources
                 JOIN transcript_events events ON events.id = sources.transcript_event_id
                 WHERE sources.report_id = ?1 ORDER BY events.sequence ASC",
            ).map_err(storage_error)?;
            report.source_transcript_event_ids = sources
                .query_map(params![report.id], |row| row.get(0))
                .map_err(storage_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(storage_error)?;
        }
        Ok(reports)
    }

    pub fn begin_task_context_dispatch(
        &self,
        request: CreateTaskContextDispatchRequest,
    ) -> AppResult<TaskContextDispatchReceiptInfo> {
        let task_id = request.task_id.trim();
        let transcript_session_id = request.transcript_session_id.trim();
        let acp_session_id = request.acp_session_id.trim();
        let user_prompt = request.user_prompt.as_str();
        let rendered_context = request.rendered_context.as_str();
        if task_id.is_empty()
            || transcript_session_id.is_empty()
            || acp_session_id.is_empty()
            || user_prompt.trim().is_empty()
            || rendered_context.trim().is_empty()
            || request.sources.is_empty()
        {
            return Err(AppError::InvalidInput(
                "context dispatch requires task, transcript, ACP session, prompt, context, and sources".into(),
            ));
        }
        let task = self.task(task_id)?;
        if task.transcript_session_id != transcript_session_id {
            return Err(AppError::InvalidInput(
                "context dispatch transcript does not belong to the task".into(),
            ));
        }
        let mut source_keys = HashSet::new();
        if request.sources.iter().any(|source| {
            source.source_id.trim().is_empty()
                || !matches!(
                    source.source_type.as_str(),
                    "project_knowledge" | "knowledge_card" | "task_artifact"
                )
                || source.reason.trim().is_empty()
                || !source_keys.insert((source.source_type.as_str(), source.source_id.as_str()))
        }) {
            return Err(AppError::InvalidInput(
                "context dispatch sources must be complete".into(),
            ));
        }
        let wire_prompt =
            format!("Selected task context:\n{rendered_context}\n\nUser prompt:\n{user_prompt}");
        let sources_json = serde_json::to_string(&request.sources)
            .map_err(|error| AppError::Storage(error.to_string()))?;
        let id = Uuid::new_v4().to_string();
        let now = unix_timestamp()?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        let sequence: i64 = transaction.query_row(
            "SELECT COALESCE(MAX(sequence), -1) + 1 FROM task_context_dispatch_receipts WHERE task_id = ?1",
            params![task_id], |row| row.get(0)).map_err(storage_error)?;
        transaction
            .execute(
                "INSERT INTO task_context_dispatch_receipts
             (id, task_id, transcript_session_id, sequence, acp_session_id, user_prompt,
              rendered_context, wire_prompt, sources_json, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', ?10, ?10)",
                params![
                    id,
                    task_id,
                    transcript_session_id,
                    sequence,
                    acp_session_id,
                    user_prompt,
                    rendered_context,
                    wire_prompt,
                    sources_json,
                    now
                ],
            )
            .map_err(storage_error)?;
        transaction.commit().map_err(storage_error)?;
        drop(connection);
        self.task_context_dispatch_receipt(&id)
    }

    pub fn begin_task_phase_run(
        &self,
        request: CreateTaskPhaseRunRequest,
    ) -> AppResult<TaskPhaseRunReceiptInfo> {
        let task_id = request.task_id.trim();
        let transcript_id = request.transcript_session_id.trim();
        let phase = request.phase.trim().to_lowercase();
        let acp_session_id = request.acp_session_id.trim();
        if task_id.is_empty()
            || transcript_id.is_empty()
            || acp_session_id.is_empty()
            || request.instruction.trim().is_empty()
            || !TASK_PHASES.contains(&phase.as_str())
        {
            return Err(AppError::InvalidInput(
                "phase run intent is incomplete".into(),
            ));
        }
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        require_task_project_knowledge_ready(&transaction, task_id)?;
        let (owned_transcript, current_phase): (String, String) = transaction
            .query_row(
                "SELECT transcript_session_id, current_phase FROM tasks WHERE id = ?1",
                [task_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|_| AppError::InvalidInput("phase run Task was not found".into()))?;
        if owned_transcript != transcript_id || current_phase != phase {
            return Err(AppError::InvalidInput(
                "phase run does not match the current Task phase and transcript".into(),
            ));
        }
        let status: String = transaction
            .query_row(
                "SELECT status FROM task_phases WHERE task_id = ?1 AND phase = ?2",
                params![task_id, phase],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        if status != "in_progress" {
            return Err(AppError::InvalidInput(
                "only the current in-progress phase can run".into(),
            ));
        }
        let sequence: i64 = transaction.query_row(
            "SELECT COALESCE(MAX(sequence), -1) + 1 FROM task_phase_run_receipts WHERE task_id = ?1",
            [task_id], |row| row.get(0)).map_err(storage_error)?;
        let id = Uuid::new_v4().to_string();
        let now = unix_timestamp()?;
        transaction
            .execute(
                "INSERT INTO task_phase_run_receipts
             (id, task_id, transcript_session_id, sequence, phase, acp_session_id, instruction,
              status, stop_reason, error, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', NULL, NULL, ?8, ?8)",
                params![
                    id,
                    task_id,
                    transcript_id,
                    sequence,
                    phase,
                    acp_session_id,
                    request.instruction,
                    now
                ],
            )
            .map_err(storage_error)?;
        transaction.commit().map_err(storage_error)?;
        drop(connection);
        self.task_phase_run_receipt(&id)
    }

    pub fn finalize_task_phase_run(
        &self,
        receipt_id: &str,
        status: &str,
        stop_reason: Option<&str>,
        error: Option<&str>,
    ) -> AppResult<TaskPhaseRunReceiptInfo> {
        if !matches!(status, "sent" | "failed") {
            return Err(AppError::InvalidInput(
                "phase run final status is invalid".into(),
            ));
        }
        let connection = self.connection()?;
        let changed = connection
            .execute(
                "UPDATE task_phase_run_receipts SET status = ?2, stop_reason = ?3, error = ?4,
             updated_at = ?5 WHERE id = ?1 AND status = 'pending'",
                params![receipt_id, status, stop_reason, error, unix_timestamp()?],
            )
            .map_err(storage_error)?;
        if changed != 1 {
            return Err(AppError::InvalidInput(
                "phase run receipt is missing or already finalized".into(),
            ));
        }
        drop(connection);
        self.task_phase_run_receipt(receipt_id)
    }

    pub fn record_task_phase_run_verification(
        &self,
        receipt_id: &str,
        status: &str,
        workspace_path: &str,
        changed_files_json: &str,
        error: Option<&str>,
    ) -> AppResult<TaskPhaseRunReceiptInfo> {
        if !matches!(status, "changed" | "unchanged" | "unavailable") {
            return Err(AppError::InvalidInput(
                "phase run verification status is invalid".into(),
            ));
        }
        let connection = self.connection()?;
        let changed = connection
            .execute(
                "UPDATE task_phase_run_receipts SET verification_status = ?2,
                 verification_workspace_path = ?3, verification_changed_files_json = ?4,
                 verification_error = ?5, updated_at = ?6
                 WHERE id = ?1 AND status = 'sent'",
                params![
                    receipt_id,
                    status,
                    workspace_path,
                    changed_files_json,
                    error,
                    unix_timestamp()?
                ],
            )
            .map_err(storage_error)?;
        if changed != 1 {
            return Err(AppError::InvalidInput(
                "sent phase run receipt is required for verification".into(),
            ));
        }
        drop(connection);
        self.task_phase_run_receipt(receipt_id)
    }

    pub fn list_task_phase_run_receipts(
        &self,
        task_id: &str,
    ) -> AppResult<Vec<TaskPhaseRunReceiptInfo>> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id FROM task_phase_run_receipts WHERE task_id = ?1 ORDER BY sequence ASC",
            )
            .map_err(storage_error)?;
        let ids = statement
            .query_map([task_id], |row| row.get::<_, String>(0))
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;
        drop(statement);
        drop(connection);
        ids.into_iter()
            .map(|id| self.task_phase_run_receipt(&id))
            .collect()
    }

    pub fn begin_task_plan_step_run(
        &self,
        request: CreateTaskPlanStepRunRequest,
    ) -> AppResult<TaskPlanStepRunInfo> {
        let task_id = request.task_id.trim();
        let plan_id = request.plan_version_id.trim();
        let step_id = request.plan_step_id.trim();
        let acp_session_id = request.acp_session_id.trim();
        let instruction = request.instruction.trim();
        if task_id.is_empty()
            || plan_id.is_empty()
            || step_id.is_empty()
            || acp_session_id.is_empty()
            || instruction.is_empty()
        {
            return Err(AppError::InvalidInput(
                "step run requires task, approved plan step, ACP session, and instruction".into(),
            ));
        }

        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        require_task_project_knowledge_ready(&transaction, task_id)?;
        let phase_state: Option<(String, String)> = transaction
            .query_row(
                "SELECT tasks.current_phase, phases.status FROM tasks
                 JOIN task_phases phases
                   ON phases.task_id = tasks.id AND phases.phase = tasks.current_phase
                 WHERE tasks.id = ?1",
                [task_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(storage_error)?;
        if phase_state.as_ref() != Some(&("execution".into(), "in_progress".into())) {
            return Err(AppError::InvalidInput(
                "plan steps may run only during the in-progress execution phase".into(),
            ));
        }

        let step: Option<(i64, i64, String)> = transaction
            .query_row(
                "SELECT steps.order_index, steps.complexity, steps.expected_paths_json
                 FROM task_plan_steps steps
                 JOIN task_plan_versions versions ON versions.id = steps.plan_version_id
                 WHERE steps.id = ?1 AND versions.id = ?2
                   AND versions.task_id = ?3 AND versions.status = 'approved'",
                params![step_id, plan_id, task_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()
            .map_err(storage_error)?;
        let Some((step_order_index, complexity, expected_paths_json)) = step else {
            return Err(AppError::InvalidInput(
                "step run must target a step from this Task's approved plan".into(),
            ));
        };

        let plan_steps = {
            let mut statement = transaction
                .prepare(
                    "SELECT id, order_index, title, description, kind, complexity,
                            acceptance_criteria_json, expected_paths_json, satisfies_json,
                            depends_on_json
                     FROM task_plan_steps
                     WHERE plan_version_id = ?1
                     ORDER BY order_index ASC",
                )
                .map_err(storage_error)?;
            let steps = statement
                .query_map([plan_id], |row| {
                    Ok(TaskPlanStepInfo {
                        id: row.get(0)?,
                        order_index: row.get(1)?,
                        title: row.get(2)?,
                        description: row.get(3)?,
                        kind: row.get(4)?,
                        complexity: row.get(5)?,
                        acceptance_criteria: json_string_list_from_row(row, 6)?,
                        expected_paths: json_string_list_from_row(row, 7)?,
                        satisfies: json_string_list_from_row(row, 8)?,
                        depends_on: json_string_list_from_row(row, 9)?,
                    })
                })
                .map_err(storage_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(storage_error)?;
            steps
        };
        let accepted_step_keys = {
            let mut statement = transaction
                .prepare(
                    "SELECT DISTINCT runs.step_order_index
                     FROM task_plan_step_runs runs
                     WHERE runs.task_id = ?1 AND runs.plan_version_id = ?2
                       AND runs.status = 'accepted'
                       AND (runs.verification_status = 'unchanged'
                         OR runs.isolation_id IS NULL
                         OR runs.integration_status = 'integrated')",
                )
                .map_err(storage_error)?;
            let keys = statement
                .query_map(params![task_id, plan_id], |row| row.get::<_, i64>(0))
                .map_err(storage_error)?
                .map(|order| order.map(|value| format!("STEP-{}", value + 1)))
                .collect::<Result<HashSet<_>, _>>()
                .map_err(storage_error)?;
            keys
        };
        let eligible_step_ids =
            task_plan::eligible_execution_step_ids(&plan_steps, &accepted_step_keys);
        if !eligible_step_ids.iter().any(|id| id == step_id) {
            return Err(AppError::InvalidInput(
                "the selected plan step is not eligible in the current execution wave".into(),
            ));
        }
        let pending_exists: bool = transaction
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM task_plan_step_runs
                 WHERE plan_step_id = ?1 AND status IN ('pending', 'sent'))",
                [step_id],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        if pending_exists {
            return Err(AppError::InvalidInput(
                "the selected plan step already has an open run".into(),
            ));
        }

        let attempt: i64 = transaction
            .query_row(
                "SELECT COALESCE(MAX(attempt), 0) + 1 FROM task_plan_step_runs
                 WHERE plan_step_id = ?1",
                [step_id],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        let (model_tier, model_tier_rationale) = match complexity {
            1..=2 => ("small", format!("step complexity {complexity}/5")),
            3 => ("mid", "step complexity 3/5".to_string()),
            _ => ("high", format!("step complexity {complexity}/5")),
        };
        let id = Uuid::new_v4().to_string();
        let now = unix_timestamp()?;
        transaction
            .execute(
                "INSERT INTO task_plan_step_runs
                 (id, task_id, plan_version_id, plan_step_id, step_order_index, attempt,
                  acp_session_id, instruction, model_tier, model_tier_rationale,
                  expected_paths_json, status, stop_reason, error, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
                         'pending', NULL, NULL, ?12, ?12)",
                params![
                    id,
                    task_id,
                    plan_id,
                    step_id,
                    step_order_index,
                    attempt,
                    acp_session_id,
                    instruction,
                    model_tier,
                    model_tier_rationale,
                    expected_paths_json,
                    now
                ],
            )
            .map_err(storage_error)?;
        transaction.commit().map_err(storage_error)?;
        drop(connection);
        self.task_plan_step_run(&id)
    }

    pub fn finalize_task_plan_step_run(
        &self,
        run_id: &str,
        status: &str,
        stop_reason: Option<&str>,
        error: Option<&str>,
    ) -> AppResult<TaskPlanStepRunInfo> {
        if !matches!(status, "sent" | "failed") {
            return Err(AppError::InvalidInput(
                "step run final status is invalid".into(),
            ));
        }
        let connection = self.connection()?;
        let changed = connection
            .execute(
                "UPDATE task_plan_step_runs
                 SET status = ?2, stop_reason = ?3, error = ?4, updated_at = ?5
                 WHERE id = ?1 AND status = 'pending'",
                params![run_id, status, stop_reason, error, unix_timestamp()?],
            )
            .map_err(storage_error)?;
        if changed != 1 {
            return Err(AppError::InvalidInput(
                "step run is missing or already finalized".into(),
            ));
        }
        drop(connection);
        self.task_plan_step_run(run_id)
    }

    pub fn record_task_plan_step_run_isolation(
        &self,
        run_id: &str,
        isolation: &TaskStepWorktreeInfo,
    ) -> AppResult<TaskPlanStepRunInfo> {
        let run_id = run_id.trim();
        let repository_path = isolation.repository_path.to_string_lossy();
        let worktree_path = isolation.worktree_path.to_string_lossy();
        let base_sha = isolation.base_sha.trim();
        if run_id.is_empty()
            || isolation.isolation_id.trim().is_empty()
            || !isolation.repository_path.is_absolute()
            || !isolation.worktree_path.is_absolute()
            || repository_path == worktree_path
            || !isolation.branch.starts_with("aiadne/")
            || !(7..=64).contains(&base_sha.len())
            || !base_sha
                .chars()
                .all(|character| character.is_ascii_hexdigit())
        {
            return Err(AppError::InvalidInput(
                "step isolation descriptor is invalid".into(),
            ));
        }
        let connection = self.connection()?;
        let changed = connection
            .execute(
                "UPDATE task_plan_step_runs SET isolation_id = ?2,
                 isolation_repository_path = ?3, isolation_worktree_path = ?4,
                 isolation_branch = ?5, isolation_base_sha = ?6, updated_at = ?7
                 WHERE id = ?1 AND status = 'pending' AND isolation_id IS NULL",
                params![
                    run_id,
                    isolation.isolation_id.trim(),
                    repository_path.as_ref(),
                    worktree_path.as_ref(),
                    &isolation.branch,
                    base_sha,
                    unix_timestamp()?
                ],
            )
            .map_err(storage_error)?;
        if changed != 1 {
            return Err(AppError::InvalidInput(
                "pending step run without isolation is required".into(),
            ));
        }
        drop(connection);
        self.task_plan_step_run(run_id)
    }

    pub fn begin_task_plan_step_run_integration(
        &self,
        task_id: &str,
        run_id: &str,
    ) -> AppResult<TaskPlanStepRunInfo> {
        let connection = self.connection()?;
        let changed = connection
            .execute(
                "UPDATE task_plan_step_runs SET integration_status = 'pending',
                 integration_error = NULL, updated_at = ?3
                 WHERE id = ?1 AND task_id = ?2 AND status = 'accepted'
                   AND isolation_id IS NOT NULL
                   AND isolation_repository_path IS NOT NULL
                   AND isolation_worktree_path IS NOT NULL
                   AND isolation_branch IS NOT NULL
                   AND isolation_base_sha IS NOT NULL
                   AND integration_status IS NULL",
                params![run_id.trim(), task_id.trim(), unix_timestamp()?],
            )
            .map_err(storage_error)?;
        if changed != 1 {
            return Err(AppError::InvalidInput(
                "accepted isolated step run without an integration attempt is required".into(),
            ));
        }
        drop(connection);
        self.task_plan_step_run(run_id.trim())
    }

    pub fn finalize_task_plan_step_run_no_change(
        &self,
        task_id: &str,
        run_id: &str,
    ) -> AppResult<Option<TaskPlanStepRunInfo>> {
        let connection = self.connection()?;
        let changed = connection
            .execute(
                "UPDATE task_plan_step_runs SET integration_status = 'integrated',
                 isolated_commit_sha = NULL, integrated_commit_sha = NULL,
                 integration_error = NULL, updated_at = ?3
                 WHERE id = ?1 AND task_id = ?2 AND status = 'accepted'
                   AND verification_status = 'unchanged'
                   AND scope_status = 'within_scope'
                   AND isolation_id IS NOT NULL
                   AND (integration_status IS NULL OR integration_status = 'conflicted')",
                params![run_id.trim(), task_id.trim(), unix_timestamp()?],
            )
            .map_err(storage_error)?;
        drop(connection);
        if changed == 0 {
            return Ok(None);
        }
        self.task_plan_step_run(run_id.trim()).map(Some)
    }

    pub fn finalize_task_plan_step_run_integration(
        &self,
        run_id: &str,
        status: &str,
        isolated_commit_sha: Option<&str>,
        integrated_commit_sha: Option<&str>,
        error: Option<&str>,
    ) -> AppResult<TaskPlanStepRunInfo> {
        let valid_sha = |value: Option<&str>| {
            value.is_some_and(|sha| {
                (7..=64).contains(&sha.len())
                    && sha.chars().all(|character| character.is_ascii_hexdigit())
            })
        };
        let valid = match status {
            "integrated" => {
                valid_sha(isolated_commit_sha)
                    && valid_sha(integrated_commit_sha)
                    && error.is_none()
            }
            "conflicted" => {
                isolated_commit_sha.is_none_or(|_| valid_sha(isolated_commit_sha))
                    && integrated_commit_sha.is_none()
                    && error.is_some_and(|message| !message.trim().is_empty())
            }
            _ => false,
        };
        if !valid {
            return Err(AppError::InvalidInput(
                "step integration result is invalid".into(),
            ));
        }
        let connection = self.connection()?;
        let changed = connection
            .execute(
                "UPDATE task_plan_step_runs SET integration_status = ?2,
                 isolated_commit_sha = ?3, integrated_commit_sha = ?4,
                 integration_error = ?5, updated_at = ?6
                 WHERE id = ?1 AND integration_status = 'pending'",
                params![
                    run_id.trim(),
                    status,
                    isolated_commit_sha,
                    integrated_commit_sha,
                    error,
                    unix_timestamp()?
                ],
            )
            .map_err(storage_error)?;
        if changed != 1 {
            return Err(AppError::InvalidInput(
                "pending step integration is required".into(),
            ));
        }
        drop(connection);
        self.task_plan_step_run(run_id.trim())
    }

    pub fn record_task_plan_step_run_verification(
        &self,
        run_id: &str,
        status: &str,
        workspace_path: &str,
        changed_files_json: &str,
        error: Option<&str>,
    ) -> AppResult<TaskPlanStepRunInfo> {
        if !matches!(status, "changed" | "unchanged" | "unavailable") {
            return Err(AppError::InvalidInput(
                "step verification status is invalid".into(),
            ));
        }
        let changed_paths = serde_json::from_str::<Vec<serde_json::Value>>(changed_files_json)
            .map_err(|_| {
                AppError::InvalidInput("step verification changed files are invalid".into())
            })?
            .into_iter()
            .map(|file| {
                file.get("path")
                    .and_then(serde_json::Value::as_str)
                    .map(str::trim)
                    .filter(|path| !path.is_empty())
                    .map(ToString::to_string)
                    .ok_or_else(|| {
                        AppError::InvalidInput("step verification changed files need paths".into())
                    })
            })
            .collect::<AppResult<Vec<_>>>()?;
        let connection = self.connection()?;
        let (expected_paths_json, isolation_worktree_path): (String, Option<String>) = connection
            .query_row(
                "SELECT expected_paths_json, isolation_worktree_path FROM task_plan_step_runs
                 WHERE id = ?1 AND status = 'sent'",
                [run_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|_| {
                AppError::InvalidInput(
                    "sent step run is required for repository verification".into(),
                )
            })?;
        if isolation_worktree_path
            .as_deref()
            .is_some_and(|expected| expected != workspace_path.trim())
        {
            return Err(AppError::InvalidInput(
                "isolated step verification must use its recorded worktree".into(),
            ));
        }
        let expected_paths =
            serde_json::from_str::<Vec<String>>(&expected_paths_json).unwrap_or_default();
        let scope_violations = if status == "unavailable" {
            Vec::new()
        } else {
            changed_paths
                .iter()
                .filter(|path| !path_matches_step_scope(path, &expected_paths))
                .cloned()
                .collect::<Vec<_>>()
        };
        let scope_status = if status == "unavailable" {
            "unavailable"
        } else if scope_violations.is_empty() {
            "within_scope"
        } else {
            "out_of_scope"
        };
        let changed = connection
            .execute(
                "UPDATE task_plan_step_runs SET verification_status = ?2,
                 verification_workspace_path = ?3, verification_changed_files_json = ?4,
                 verification_error = ?5, scope_status = ?6, scope_violations_json = ?7,
                 updated_at = ?8 WHERE id = ?1 AND status = 'sent'
                   AND verification_status IS NULL",
                params![
                    run_id,
                    status,
                    workspace_path,
                    changed_files_json,
                    error,
                    scope_status,
                    json_string_list(&scope_violations)?,
                    unix_timestamp()?
                ],
            )
            .map_err(storage_error)?;
        if changed != 1 {
            return Err(AppError::InvalidInput(
                "sent step run is required for repository verification".into(),
            ));
        }
        drop(connection);
        self.task_plan_step_run(run_id)
    }

    pub fn review_task_plan_step_run(
        &self,
        request: ReviewTaskPlanStepRunRequest,
    ) -> AppResult<TaskPlanStepRunInfo> {
        let task_id = request.task_id.trim();
        let run_id = request.run_id.trim();
        let decision = request.decision.trim().to_lowercase();
        let note = request.note.trim();
        if task_id.is_empty()
            || run_id.is_empty()
            || !matches!(decision.as_str(), "accept" | "reject")
            || note.is_empty()
            || note.chars().count() > 2_000
        {
            return Err(AppError::InvalidInput(
                "step review requires task, run, accept/reject decision, and a note up to 2000 characters".into(),
            ));
        }
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        let run: Option<TaskPlanStepReviewState> = transaction
            .query_row(
                "SELECT task_id, plan_version_id, step_order_index,
                 verification_status, scope_status
                 FROM task_plan_step_runs
                 WHERE id = ?1 AND task_id = ?2 AND status = 'sent'",
                params![run_id, task_id],
                |row| {
                    Ok(TaskPlanStepReviewState {
                        task_id: row.get(0)?,
                        plan_version_id: row.get(1)?,
                        step_order_index: row.get(2)?,
                        verification_status: row.get(3)?,
                        scope_status: row.get(4)?,
                    })
                },
            )
            .optional()
            .map_err(storage_error)?;
        let Some(run) = run else {
            return Err(AppError::InvalidInput(
                "only a sent step run may be accepted".into(),
            ));
        };
        if decision == "reject" {
            transaction
                .execute(
                    "UPDATE task_plan_step_runs SET status = 'failed',
                     error = ?2, review_status = 'rejected', review_note = ?3, updated_at = ?4
                     WHERE id = ?1 AND status = 'sent'",
                    params![
                        run_id,
                        format!("review rejected: {note}"),
                        note,
                        unix_timestamp()?
                    ],
                )
                .map_err(storage_error)?;
            transaction.commit().map_err(storage_error)?;
            drop(connection);
            return self.task_plan_step_run(run_id);
        }
        if !matches!(
            run.verification_status.as_deref(),
            Some("changed" | "unchanged")
        ) || run.scope_status.as_deref() != Some("within_scope")
        {
            return Err(AppError::InvalidInput(
                "step acceptance requires available repository verification within expected scope"
                    .into(),
            ));
        }
        let state: (String, String, String) = transaction
            .query_row(
                "SELECT tasks.current_phase, phases.status, versions.status
                 FROM tasks
                 JOIN task_phases phases
                   ON phases.task_id = tasks.id AND phases.phase = tasks.current_phase
                 JOIN task_plan_versions versions
                   ON versions.task_id = tasks.id AND versions.id = ?2
                 WHERE tasks.id = ?1",
                params![run.task_id, run.plan_version_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(storage_error)?;
        if state != ("execution".into(), "in_progress".into(), "approved".into()) {
            return Err(AppError::InvalidInput(
                "step acceptance requires the same approved plan in active execution".into(),
            ));
        }
        let accepted_before: i64 = transaction
            .query_row(
                "SELECT COUNT(*) FROM task_plan_step_runs
                 WHERE plan_version_id = ?1 AND status = 'accepted'
                   AND step_order_index < ?2",
                params![run.plan_version_id, run.step_order_index],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        if accepted_before != run.step_order_index {
            return Err(AppError::InvalidInput(
                "plan step runs must be accepted in order".into(),
            ));
        }
        transaction
            .execute(
                "UPDATE task_plan_step_runs SET status = 'accepted',
                 review_status = 'accepted', review_note = ?2, updated_at = ?3
                 WHERE id = ?1 AND status = 'sent'",
                params![run_id, note, unix_timestamp()?],
            )
            .map_err(storage_error)?;
        transaction.commit().map_err(storage_error)?;
        drop(connection);
        self.task_plan_step_run(run_id)
    }

    pub fn list_task_plan_step_runs(&self, task_id: &str) -> AppResult<Vec<TaskPlanStepRunInfo>> {
        self.task(task_id.trim())?;
        let connection = self.connection()?;
        let ids = {
            let mut statement = connection
                .prepare(
                    "SELECT id FROM task_plan_step_runs
                     WHERE task_id = ?1 ORDER BY step_order_index ASC, attempt ASC",
                )
                .map_err(storage_error)?;
            let values = statement
                .query_map([task_id.trim()], |row| row.get::<_, String>(0))
                .map_err(storage_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(storage_error)?;
            values
        };
        drop(connection);
        ids.iter().map(|id| self.task_plan_step_run(id)).collect()
    }

    fn task_plan_step_run(&self, run_id: &str) -> AppResult<TaskPlanStepRunInfo> {
        self.connection()?
            .query_row(
                "SELECT id, task_id, plan_version_id, plan_step_id, step_order_index,
                 attempt, acp_session_id, instruction, model_tier, model_tier_rationale,
                 expected_paths_json, status, stop_reason, error,
                 isolation_id, isolation_repository_path, isolation_worktree_path,
                 isolation_branch, isolation_base_sha,
                 integration_status, isolated_commit_sha, integrated_commit_sha,
                 integration_error,
                 verification_status, verification_workspace_path,
                 verification_changed_files_json, verification_error,
                 scope_status, scope_violations_json, review_status, review_note,
                 created_at, updated_at
                 FROM task_plan_step_runs WHERE id = ?1",
                [run_id],
                |row| {
                    let expected_paths_json: String = row.get(10)?;
                    Ok(TaskPlanStepRunInfo {
                        id: row.get(0)?,
                        task_id: row.get(1)?,
                        plan_version_id: row.get(2)?,
                        plan_step_id: row.get(3)?,
                        step_order_index: row.get(4)?,
                        attempt: row.get(5)?,
                        acp_session_id: row.get(6)?,
                        instruction: row.get(7)?,
                        model_tier: row.get(8)?,
                        model_tier_rationale: row.get(9)?,
                        expected_paths: serde_json::from_str(&expected_paths_json)
                            .unwrap_or_default(),
                        status: row.get(11)?,
                        stop_reason: row.get(12)?,
                        error: row.get(13)?,
                        isolation_id: row.get(14)?,
                        isolation_repository_path: row.get(15)?,
                        isolation_worktree_path: row.get(16)?,
                        isolation_branch: row.get(17)?,
                        isolation_base_sha: row.get(18)?,
                        integration_status: row.get(19)?,
                        isolated_commit_sha: row.get(20)?,
                        integrated_commit_sha: row.get(21)?,
                        integration_error: row.get(22)?,
                        verification_status: row.get(23)?,
                        verification_workspace_path: row.get(24)?,
                        verification_changed_files: row
                            .get::<_, Option<String>>(25)?
                            .and_then(|value| {
                                serde_json::from_str::<Vec<serde_json::Value>>(&value).ok()
                            })
                            .unwrap_or_default()
                            .into_iter()
                            .filter_map(|file| {
                                file.get("path")
                                    .and_then(serde_json::Value::as_str)
                                    .map(ToString::to_string)
                            })
                            .collect(),
                        verification_error: row.get(26)?,
                        scope_status: row.get(27)?,
                        scope_violations: row
                            .get::<_, Option<String>>(28)?
                            .and_then(|value| serde_json::from_str(&value).ok())
                            .unwrap_or_default(),
                        review_status: row.get(29)?,
                        review_note: row.get(30)?,
                        created_at: row.get(31)?,
                        updated_at: row.get(32)?,
                    })
                },
            )
            .map_err(|_| AppError::InvalidInput(format!("step run not found: {run_id}")))
    }

    pub fn link_task_phase_run_events(
        &self,
        request: LinkTaskPhaseRunEventsRequest,
    ) -> AppResult<()> {
        if request.task_id.trim().is_empty()
            || request.receipt_id.trim().is_empty()
            || request.transcript_event_ids.is_empty()
        {
            return Err(AppError::InvalidInput(
                "phase run response provenance is incomplete".into(),
            ));
        }
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        let transcript_id: String = transaction.query_row(
            "SELECT transcript_session_id FROM task_phase_run_receipts WHERE id = ?1 AND task_id = ?2 AND status = 'sent'",
            params![request.receipt_id, request.task_id], |row| row.get(0))
            .map_err(|_| AppError::InvalidInput("sent phase run receipt was not found".into()))?;
        for event_id in &request.transcript_event_ids {
            let valid: i64 = transaction.query_row(
                "SELECT COUNT(*) FROM transcript_events WHERE id = ?1 AND session_id = ?2 AND kind IN ('agent_message', 'agent_thought')",
                params![event_id, transcript_id], |row| row.get(0)).map_err(storage_error)?;
            if valid != 1 {
                return Err(AppError::InvalidInput(
                    "phase run provenance must be agent events from its Task transcript".into(),
                ));
            }
            transaction.execute("INSERT OR IGNORE INTO task_phase_run_response_events (receipt_id, transcript_event_id) VALUES (?1, ?2)",
                params![request.receipt_id, event_id]).map_err(storage_error)?;
        }
        transaction.commit().map_err(storage_error)?;
        Ok(())
    }

    pub fn latest_task_phase_run_response_events(
        &self,
        task_id: &str,
    ) -> AppResult<Vec<TranscriptEventInfo>> {
        let connection = self.connection()?;
        let current_phase: String = connection
            .query_row(
                "SELECT current_phase FROM tasks WHERE id = ?1",
                [task_id],
                |row| row.get(0),
            )
            .map_err(|_| AppError::InvalidInput("phase response Task was not found".into()))?;
        let receipt_id = connection.query_row(
            "SELECT id FROM task_phase_run_receipts WHERE task_id = ?1 AND phase = ?2 AND status = 'sent' ORDER BY sequence DESC LIMIT 1",
            params![task_id, current_phase], |row| row.get::<_, String>(0)).optional().map_err(storage_error)?;
        let Some(receipt_id) = receipt_id else {
            return Ok(Vec::new());
        };
        let mut statement = connection.prepare(
            "SELECT e.id, e.session_id, e.sequence, e.kind, e.content, e.created_at
             FROM task_phase_run_response_events r JOIN transcript_events e ON e.id = r.transcript_event_id
             WHERE r.receipt_id = ?1 ORDER BY e.sequence ASC").map_err(storage_error)?;
        let events = statement
            .query_map([receipt_id], |row| {
                Ok(TranscriptEventInfo {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    sequence: row.get(2)?,
                    kind: row.get(3)?,
                    content: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;
        Ok(events)
    }

    pub fn resolve_pending_task_phase_run(
        &self,
        request: ResolveTaskPhaseRunRequest,
    ) -> AppResult<TaskPhaseRunReceiptInfo> {
        let task_id = request.task_id.trim();
        let receipt_id = request.receipt_id.trim();
        let reason = request.reason.trim();
        if task_id.is_empty()
            || receipt_id.is_empty()
            || reason.is_empty()
            || reason.chars().count() > 1000
        {
            return Err(AppError::InvalidInput("pending phase run resolution requires task, receipt, and a reason up to 1000 characters".into()));
        }
        let connection = self.connection()?;
        let changed = connection.execute("UPDATE task_phase_run_receipts SET status = 'failed', error = ?3, updated_at = ?4 WHERE id = ?1 AND task_id = ?2 AND status = 'pending'",
            params![receipt_id, task_id, format!("manually resolved as failed: {reason}"), unix_timestamp()?]).map_err(storage_error)?;
        if changed != 1 {
            return Err(AppError::InvalidInput(
                "phase run receipt is missing, finalized, or belongs to another task".into(),
            ));
        }
        drop(connection);
        self.task_phase_run_receipt(receipt_id)
    }

    fn task_phase_run_receipt(&self, receipt_id: &str) -> AppResult<TaskPhaseRunReceiptInfo> {
        self.connection()?
            .query_row(
                "SELECT id, task_id, transcript_session_id, sequence, phase, acp_session_id,
             instruction, status, stop_reason, error, created_at, updated_at,
             verification_status, verification_workspace_path,
             verification_changed_files_json, verification_error
             FROM task_phase_run_receipts WHERE id = ?1",
                [receipt_id],
                |row| {
                    Ok(TaskPhaseRunReceiptInfo {
                        id: row.get(0)?,
                        task_id: row.get(1)?,
                        transcript_session_id: row.get(2)?,
                        sequence: row.get(3)?,
                        phase: row.get(4)?,
                        acp_session_id: row.get(5)?,
                        instruction: row.get(6)?,
                        status: row.get(7)?,
                        stop_reason: row.get(8)?,
                        error: row.get(9)?,
                        created_at: row.get(10)?,
                        updated_at: row.get(11)?,
                        verification_status: row.get(12)?,
                        verification_workspace_path: row.get(13)?,
                        verification_changed_files_json: row.get(14)?,
                        verification_error: row.get(15)?,
                    })
                },
            )
            .map_err(|_| {
                AppError::InvalidInput(format!("phase run receipt not found: {receipt_id}"))
            })
    }

    pub fn finalize_task_context_dispatch(
        &self,
        receipt_id: &str,
        status: &str,
        stop_reason: Option<&str>,
        error: Option<&str>,
    ) -> AppResult<TaskContextDispatchReceiptInfo> {
        if !matches!(status, "sent" | "failed") {
            return Err(AppError::InvalidInput(
                "context dispatch final status is invalid".into(),
            ));
        }
        let now = unix_timestamp()?;
        let changed = self.connection()?.execute(
            "UPDATE task_context_dispatch_receipts SET status = ?2, stop_reason = ?3, error = ?4,
             updated_at = ?5 WHERE id = ?1 AND status = 'pending'",
            params![receipt_id, status, stop_reason, error, now],
        ).map_err(storage_error)?;
        if changed != 1 {
            return Err(AppError::InvalidInput(
                "context dispatch receipt is missing or already finalized".into(),
            ));
        }
        self.task_context_dispatch_receipt(receipt_id)
    }

    pub fn list_task_context_dispatch_receipts(
        &self,
        task_id: &str,
    ) -> AppResult<Vec<TaskContextDispatchReceiptInfo>> {
        self.task(task_id)?;
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT id FROM task_context_dispatch_receipts WHERE task_id = ?1 ORDER BY sequence ASC",
        ).map_err(storage_error)?;
        let ids = statement
            .query_map(params![task_id], |row| row.get::<_, String>(0))
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;
        drop(statement);
        drop(connection);
        ids.iter()
            .map(|id| self.task_context_dispatch_receipt(id))
            .collect()
    }

    pub fn resolve_pending_task_context_dispatch(
        &self,
        request: ResolveTaskContextDispatchRequest,
    ) -> AppResult<TaskContextDispatchReceiptInfo> {
        let task_id = request.task_id.trim();
        let receipt_id = request.receipt_id.trim();
        let reason = request.reason.trim();
        if task_id.is_empty()
            || receipt_id.is_empty()
            || reason.is_empty()
            || reason.chars().count() > 1_000
        {
            return Err(AppError::InvalidInput(
                "pending context dispatch resolution requires task, receipt, and a reason up to 1000 characters".into(),
            ));
        }
        self.task(task_id)?;
        let now = unix_timestamp()?;
        let error = format!("manually resolved as failed: {reason}");
        let changed = self
            .connection()?
            .execute(
                "UPDATE task_context_dispatch_receipts SET status = 'failed', error = ?3,
             updated_at = ?4 WHERE id = ?1 AND task_id = ?2 AND status = 'pending'",
                params![receipt_id, task_id, error, now],
            )
            .map_err(storage_error)?;
        if changed != 1 {
            return Err(AppError::InvalidInput(
                "context dispatch receipt is missing, finalized, or belongs to another task".into(),
            ));
        }
        self.task_context_dispatch_receipt(receipt_id)
    }

    fn task_context_dispatch_receipt(
        &self,
        receipt_id: &str,
    ) -> AppResult<TaskContextDispatchReceiptInfo> {
        self.connection()?
            .query_row(
                "SELECT id, task_id, transcript_session_id, sequence, acp_session_id, user_prompt,
                    rendered_context, wire_prompt, sources_json, status, stop_reason, error,
                    created_at, updated_at FROM task_context_dispatch_receipts WHERE id = ?1",
                params![receipt_id],
                |row| {
                    let sources_json: String = row.get(8)?;
                    let sources = serde_json::from_str(&sources_json).map_err(|error| {
                        rusqlite::Error::FromSqlConversionFailure(8, Type::Text, Box::new(error))
                    })?;
                    Ok(TaskContextDispatchReceiptInfo {
                        id: row.get(0)?,
                        task_id: row.get(1)?,
                        transcript_session_id: row.get(2)?,
                        sequence: row.get(3)?,
                        acp_session_id: row.get(4)?,
                        user_prompt: row.get(5)?,
                        rendered_context: row.get(6)?,
                        wire_prompt: row.get(7)?,
                        sources,
                        status: row.get(9)?,
                        stop_reason: row.get(10)?,
                        error: row.get(11)?,
                        created_at: row.get(12)?,
                        updated_at: row.get(13)?,
                    })
                },
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => AppError::InvalidInput(format!(
                    "context dispatch receipt not found: {receipt_id}"
                )),
                other => storage_error(other),
            })
    }

    pub fn transition_task_phase(
        &self,
        request: TransitionTaskPhaseRequest,
    ) -> AppResult<TaskInfo> {
        let task_id = request.task_id.trim();
        let action = request.action.trim().to_lowercase();
        if task_id.is_empty() || !matches!(action.as_str(), "start" | "complete") {
            return Err(AppError::InvalidInput(
                "task phase transition requires a task and start or complete action".to_string(),
            ));
        }
        let now = unix_timestamp()?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        let (task_status, current_phase): (String, String) = transaction
            .query_row(
                "SELECT status, current_phase FROM tasks WHERE id = ?1",
                params![task_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::InvalidInput(format!("task not found: {task_id}"))
                }
                other => storage_error(other),
            })?;
        if task_status == "completed" {
            return Err(AppError::InvalidInput(
                "completed task cannot transition".to_string(),
            ));
        }
        let (phase_index, phase_status): (i64, String) = transaction
            .query_row(
                "SELECT phase_index, status FROM task_phases WHERE task_id = ?1 AND phase = ?2",
                params![task_id, current_phase],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(storage_error)?;

        if action == "start" {
            if phase_status != "pending" {
                return Err(AppError::InvalidInput(
                    "only a pending current phase can start".to_string(),
                ));
            }
            require_task_project_knowledge_ready(&transaction, task_id)?;
            transaction
                .execute(
                    "UPDATE task_phases SET status = 'in_progress', started_at = ?1
                 WHERE task_id = ?2 AND phase = ?3",
                    params![now, task_id, current_phase],
                )
                .map_err(storage_error)?;
            transaction
                .execute(
                    "UPDATE tasks SET status = 'in_progress', updated_at = ?1 WHERE id = ?2",
                    params![now, task_id],
                )
                .map_err(storage_error)?;
        } else {
            if phase_status != "in_progress" {
                return Err(AppError::InvalidInput(
                    "only the in-progress current phase can complete".to_string(),
                ));
            }
            let artifact_count: i64 = transaction
                .query_row(
                    "SELECT COUNT(*) FROM task_phase_artifacts WHERE task_id = ?1 AND phase = ?2",
                    params![task_id, current_phase],
                    |row| row.get(0),
                )
                .map_err(storage_error)?;
            if artifact_count == 0 {
                return Err(AppError::InvalidInput(
                    "current phase requires at least one evidence artifact before completion"
                        .to_string(),
                ));
            }
            if current_phase == "planning" {
                let approved_plan_count: i64 = transaction
                    .query_row(
                        "SELECT COUNT(*) FROM task_plan_versions
                     WHERE task_id = ?1 AND status = 'approved'",
                        [task_id],
                        |row| row.get(0),
                    )
                    .map_err(storage_error)?;
                if approved_plan_count != 1 {
                    return Err(AppError::InvalidInput(
                        "planning completion requires one approved structured plan".into(),
                    ));
                }
            }
            if current_phase == "execution" {
                let approved_plan_id: Option<String> = transaction
                    .query_row(
                        "SELECT id FROM task_plan_versions
                         WHERE task_id = ?1 AND status = 'approved'",
                        [task_id],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(storage_error)?;
                if let Some(plan_id) = approved_plan_id {
                    let (step_count, accepted_count): (i64, i64) = transaction
                        .query_row(
                            "SELECT
                               (SELECT COUNT(*) FROM task_plan_steps WHERE plan_version_id = ?1),
                               (SELECT COUNT(DISTINCT plan_step_id) FROM task_plan_step_runs
                                WHERE plan_version_id = ?1 AND status = 'accepted')",
                            [plan_id],
                            |row| Ok((row.get(0)?, row.get(1)?)),
                        )
                        .map_err(storage_error)?;
                    if step_count == 0 || accepted_count != step_count {
                        return Err(AppError::InvalidInput(
                            "execution completion requires every approved plan step to be accepted"
                                .into(),
                        ));
                    }
                } else {
                    let latest_verification: Option<(Option<String>, Option<String>)> = transaction
                        .query_row(
                            "SELECT verification_status, verification_changed_files_json
                             FROM task_phase_run_receipts
                             WHERE task_id = ?1 AND phase = 'execution' AND status = 'sent'
                             ORDER BY sequence DESC LIMIT 1",
                            [task_id],
                            |row| Ok((row.get(0)?, row.get(1)?)),
                        )
                        .optional()
                        .map_err(storage_error)?;
                    let verification_accepted =
                        latest_verification
                            .as_ref()
                            .is_none_or(|(status, changed_files)| {
                                status.as_deref() == Some("changed")
                                    || status.as_deref() == Some("unchanged")
                                        && changed_files
                                            .as_deref()
                                            .is_some_and(|value| value != "[]")
                            });
                    if !verification_accepted {
                        return Err(AppError::InvalidInput(
                            "execution completion requires a verified repository change from the latest phase run"
                                .into(),
                        ));
                    }
                }
            }
            transaction
                .execute(
                    "UPDATE task_phases SET status = 'completed', completed_at = ?1
                 WHERE task_id = ?2 AND phase = ?3",
                    params![now, task_id, current_phase],
                )
                .map_err(storage_error)?;
            if let Some(next_phase) = TASK_PHASES.get((phase_index + 1) as usize) {
                transaction
                    .execute(
                        "UPDATE tasks SET current_phase = ?1, updated_at = ?2 WHERE id = ?3",
                        params![next_phase, now, task_id],
                    )
                    .map_err(storage_error)?;
            } else {
                transaction
                    .execute(
                        "UPDATE tasks SET status = 'completed', updated_at = ?1 WHERE id = ?2",
                        params![now, task_id],
                    )
                    .map_err(storage_error)?;
            }
        }
        transaction.commit().map_err(storage_error)?;
        drop(connection);
        self.task(task_id)
    }

    pub fn append_transcript_events(
        &self,
        session_id: &str,
        events: Vec<TranscriptEventInput>,
    ) -> AppResult<Vec<TranscriptEventInfo>> {
        if events.is_empty() {
            return Err(AppError::InvalidInput(
                "transcript event batch must not be empty".to_string(),
            ));
        }

        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(storage_error)?;
        require_transcript_session(&transaction, session_id)?;

        let next_sequence: i64 = transaction
            .query_row(
                "SELECT COALESCE(MAX(sequence), -1) + 1 FROM transcript_events WHERE session_id = ?1",
                params![session_id],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        let now = unix_timestamp()?;
        let mut inserted = Vec::with_capacity(events.len());

        for (offset, event) in events.into_iter().enumerate() {
            let kind = event.kind.trim();
            if kind.is_empty() {
                return Err(AppError::InvalidInput(
                    "transcript event kind must not be empty".to_string(),
                ));
            }
            if event.content.trim().is_empty() {
                return Err(AppError::InvalidInput(
                    "transcript event content must not be empty".to_string(),
                ));
            }

            let info = TranscriptEventInfo {
                id: Uuid::new_v4().to_string(),
                session_id: session_id.to_string(),
                sequence: next_sequence + offset as i64,
                kind: kind.to_string(),
                content: event.content,
                created_at: now,
            };

            transaction
                .execute(
                    "INSERT INTO transcript_events (id, session_id, sequence, kind, content, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        &info.id,
                        &info.session_id,
                        info.sequence,
                        &info.kind,
                        &info.content,
                        info.created_at
                    ],
                )
                .map_err(storage_error)?;
            inserted.push(info);
        }

        transaction
            .execute(
                "UPDATE transcript_sessions SET updated_at = ?1 WHERE id = ?2",
                params![now, session_id],
            )
            .map_err(storage_error)?;
        transaction.commit().map_err(storage_error)?;

        Ok(inserted)
    }

    pub fn list_transcript_sessions(
        &self,
        project_id: Option<&str>,
    ) -> AppResult<Vec<TranscriptSessionInfo>> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT s.id, s.project_id, s.runtime, s.source, s.title, s.started_at, s.updated_at, COUNT(e.id)
                 FROM transcript_sessions s
                 LEFT JOIN transcript_events e ON e.session_id = s.id
                 WHERE (?1 IS NULL OR s.project_id = ?1)
                 GROUP BY s.id, s.project_id, s.runtime, s.source, s.title, s.started_at, s.updated_at
                 ORDER BY s.updated_at DESC, s.started_at DESC",
            )
            .map_err(storage_error)?;
        let sessions = statement
            .query_map(params![project_id], transcript_session_from_row)
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;

        Ok(sessions)
    }

    pub fn list_transcript_events(&self, session_id: &str) -> AppResult<Vec<TranscriptEventInfo>> {
        self.require_transcript_session(session_id)?;

        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id, session_id, sequence, kind, content, created_at
                 FROM transcript_events
                 WHERE session_id = ?1
                 ORDER BY sequence ASC",
            )
            .map_err(storage_error)?;
        let events = statement
            .query_map(params![session_id], transcript_event_from_row)
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;

        Ok(events)
    }

    pub fn rename_transcript_session(
        &self,
        request: RenameTranscriptSessionRequest,
    ) -> AppResult<TranscriptSessionInfo> {
        let title = request.title.trim();
        if title.is_empty() {
            return Err(AppError::InvalidInput(
                "transcript title must not be empty".to_string(),
            ));
        }

        let now = unix_timestamp()?;
        let updated = self
            .connection()?
            .execute(
                "UPDATE transcript_sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
                params![title, now, &request.session_id],
            )
            .map_err(storage_error)?;
        if updated == 0 {
            return Err(AppError::InvalidInput(format!(
                "transcript session not found: {}",
                request.session_id
            )));
        }

        self.transcript_session(&request.session_id)
    }

    pub fn create_knowledge_item(
        &self,
        request: CreateKnowledgeItemRequest,
    ) -> AppResult<KnowledgeItemInfo> {
        let title = request.title.trim();
        if title.is_empty() {
            return Err(AppError::InvalidInput(
                "knowledge title must not be empty".to_string(),
            ));
        }

        let body = request.body.trim();
        if body.is_empty() {
            return Err(AppError::InvalidInput(
                "knowledge body must not be empty".to_string(),
            ));
        }

        let kind = request.kind.trim();
        if kind.is_empty() {
            return Err(AppError::InvalidInput(
                "knowledge kind must not be empty".to_string(),
            ));
        }

        let scope = request.scope.trim();
        if scope.is_empty() {
            return Err(AppError::InvalidInput(
                "knowledge scope must not be empty".to_string(),
            ));
        }

        if let Some(project_id) = request.project_id.as_deref() {
            self.require_project(project_id)?;
        }
        if let Some(session_id) = request.source_transcript_session_id.as_deref() {
            self.require_transcript_session(session_id)?;
        }

        let now = unix_timestamp()?;
        let item = KnowledgeItemInfo {
            id: Uuid::new_v4().to_string(),
            project_id: request.project_id,
            title: title.to_string(),
            body: body.to_string(),
            kind: kind.to_string(),
            scope: scope.to_string(),
            source_transcript_session_id: request.source_transcript_session_id,
            created_at: now,
            updated_at: now,
        };

        self.connection()?.execute(
            "INSERT INTO knowledge_items
             (id, project_id, title, body, kind, scope, source_transcript_session_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &item.id,
                item.project_id.as_deref(),
                &item.title,
                &item.body,
                &item.kind,
                &item.scope,
                item.source_transcript_session_id.as_deref(),
                item.created_at,
                item.updated_at
            ],
        )
        .map_err(storage_error)?;

        Ok(item)
    }

    pub fn list_knowledge_items(
        &self,
        project_id: Option<&str>,
    ) -> AppResult<Vec<KnowledgeItemInfo>> {
        if let Some(project_id) = project_id {
            self.require_project(project_id)?;
        }

        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id, project_id, title, body, kind, scope, source_transcript_session_id, created_at, updated_at
                 FROM knowledge_items
                 WHERE (?1 IS NULL AND project_id IS NULL) OR (?1 IS NOT NULL AND (project_id IS NULL OR project_id = ?1))
                 ORDER BY CASE WHEN project_id IS NULL THEN 1 ELSE 0 END, updated_at DESC, title ASC",
            )
            .map_err(storage_error)?;
        let items = statement
            .query_map(params![project_id], knowledge_item_from_row)
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;

        Ok(items)
    }

    pub fn attach_knowledge_to_transcript_session(
        &self,
        session_id: &str,
        knowledge_item_id: &str,
    ) -> AppResult<Vec<KnowledgeItemInfo>> {
        let connection = self.connection()?;
        require_transcript_session(&connection, session_id)?;
        require_knowledge_item(&connection, knowledge_item_id)?;
        require_knowledge_available_for_session(&connection, session_id, knowledge_item_id)?;

        connection
            .execute(
                "INSERT OR IGNORE INTO transcript_knowledge_links
                 (transcript_session_id, knowledge_item_id, created_at)
                 VALUES (?1, ?2, ?3)",
                params![session_id, knowledge_item_id, unix_timestamp()?],
            )
            .map_err(storage_error)?;

        list_attached_knowledge_items(&connection, session_id)
    }

    pub fn list_attached_knowledge(&self, session_id: &str) -> AppResult<Vec<KnowledgeItemInfo>> {
        let connection = self.connection()?;
        require_transcript_session(&connection, session_id)?;
        list_attached_knowledge_items(&connection, session_id)
    }

    fn migrate(&self) -> AppResult<()> {
        self.connection()?
            .execute_batch(
                r#"
                PRAGMA foreign_keys = ON;

                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    path TEXT NOT NULL UNIQUE,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS project_repositories (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    path TEXT NOT NULL UNIQUE,
                    is_default INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_project_repositories_project_updated
                    ON project_repositories(project_id, is_default DESC, updated_at DESC);

                INSERT OR IGNORE INTO project_repositories
                    (id, project_id, name, path, is_default, created_at, updated_at)
                SELECT 'legacy-' || id, id, name, path, 1, created_at, updated_at
                FROM projects
                WHERE path IS NOT NULL AND path != '';

                CREATE TABLE IF NOT EXISTS project_initialization_runs (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    status TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_project_initialization_runs_project_updated
                    ON project_initialization_runs(project_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS project_initialization_repositories (
                    initialization_id TEXT NOT NULL REFERENCES project_initialization_runs(id) ON DELETE CASCADE,
                    repository_id TEXT NOT NULL REFERENCES project_repositories(id) ON DELETE CASCADE,
                    repository_index INTEGER NOT NULL,
                    created_at INTEGER NOT NULL,
                    PRIMARY KEY (initialization_id, repository_id),
                    UNIQUE(initialization_id, repository_index)
                );

                CREATE INDEX IF NOT EXISTS idx_project_initialization_repositories_repo
                    ON project_initialization_repositories(repository_id);

                CREATE TABLE IF NOT EXISTS project_initialization_facts (
                    id TEXT PRIMARY KEY,
                    initialization_id TEXT NOT NULL REFERENCES project_initialization_runs(id) ON DELETE CASCADE,
                    repository_id TEXT NOT NULL REFERENCES project_repositories(id) ON DELETE CASCADE,
                    kind TEXT NOT NULL,
                    label TEXT NOT NULL,
                    value TEXT NOT NULL,
                    source TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_project_initialization_facts_initialization
                    ON project_initialization_facts(initialization_id, repository_id, kind);

                CREATE TABLE IF NOT EXISTS project_initialization_markdown_findings (
                    id TEXT PRIMARY KEY,
                    initialization_id TEXT NOT NULL REFERENCES project_initialization_runs(id) ON DELETE CASCADE,
                    repository_id TEXT NOT NULL REFERENCES project_repositories(id) ON DELETE CASCADE,
                    file_path TEXT NOT NULL,
                    category TEXT NOT NULL,
                    title TEXT NOT NULL,
                    excerpt TEXT NOT NULL,
                    source TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_project_initialization_markdown_findings_initialization
                    ON project_initialization_markdown_findings(initialization_id, repository_id, file_path);

                CREATE TABLE IF NOT EXISTS project_initialization_guardrails (
                    id TEXT PRIMARY KEY,
                    initialization_id TEXT NOT NULL REFERENCES project_initialization_runs(id) ON DELETE CASCADE,
                    repository_id TEXT REFERENCES project_repositories(id) ON DELETE CASCADE,
                    guardrail_index INTEGER NOT NULL,
                    scope TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    path_pattern TEXT,
                    content TEXT NOT NULL,
                    source TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    UNIQUE(initialization_id, guardrail_index)
                );

                CREATE INDEX IF NOT EXISTS idx_project_initialization_guardrails_initialization
                    ON project_initialization_guardrails(initialization_id, repository_id, guardrail_index);

                CREATE TABLE IF NOT EXISTS project_initialization_summaries (
                    id TEXT PRIMARY KEY,
                    initialization_id TEXT NOT NULL UNIQUE REFERENCES project_initialization_runs(id) ON DELETE CASCADE,
                    status TEXT NOT NULL,
                    project_purpose TEXT NOT NULL,
                    repository_map TEXT NOT NULL,
                    repository_roles TEXT NOT NULL,
                    build_test_matrix TEXT NOT NULL,
                    fragile_areas TEXT NOT NULL,
                    do_not_touch_rules TEXT NOT NULL,
                    agent_working_rules TEXT NOT NULL,
                    open_questions TEXT NOT NULL,
                    claims_json TEXT NOT NULL DEFAULT '[]',
                    fact_count INTEGER NOT NULL,
                    markdown_finding_count INTEGER NOT NULL,
                    guardrail_count INTEGER NOT NULL,
                    requested_model_profile_id TEXT,
                    requested_model_provider_id TEXT,
                    requested_model_id TEXT,
                    requested_model_tier TEXT,
                    requested_model_parameters_json TEXT NOT NULL DEFAULT '[]',
                    model_catalog_schema_version INTEGER,
                    knowledge_schema_version INTEGER NOT NULL DEFAULT 1,
                    generation_engine TEXT NOT NULL DEFAULT 'deterministic_v1',
                    created_at INTEGER NOT NULL,
                    approved_at INTEGER
                );

                CREATE INDEX IF NOT EXISTS idx_project_initialization_summaries_initialization
                    ON project_initialization_summaries(initialization_id, status);

                CREATE TABLE IF NOT EXISTS knowledge_units (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    initialization_id TEXT NOT NULL REFERENCES project_initialization_runs(id) ON DELETE CASCADE,
                    derived_from_summary_id TEXT NOT NULL REFERENCES project_initialization_summaries(id) ON DELETE CASCADE,
                    kind TEXT NOT NULL,
                    topic TEXT NOT NULL,
                    content TEXT NOT NULL,
                    scope TEXT NOT NULL,
                    status TEXT NOT NULL,
                    confidence INTEGER NOT NULL,
                    schema_version INTEGER NOT NULL,
                    created_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_knowledge_units_initialization
                    ON knowledge_units(initialization_id, status, kind, id);

                CREATE TABLE IF NOT EXISTS knowledge_unit_sources (
                    knowledge_unit_id TEXT NOT NULL REFERENCES knowledge_units(id) ON DELETE CASCADE,
                    source_index INTEGER NOT NULL,
                    source_key TEXT NOT NULL,
                    repository_id TEXT REFERENCES project_repositories(id) ON DELETE SET NULL,
                    path TEXT,
                    PRIMARY KEY (knowledge_unit_id, source_index)
                );

                CREATE TABLE IF NOT EXISTS transcript_sessions (
                    id TEXT PRIMARY KEY,
                    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
                    runtime TEXT NOT NULL,
                    source TEXT NOT NULL,
                    title TEXT NOT NULL,
                    started_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_transcript_sessions_project_updated
                    ON transcript_sessions(project_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS transcript_acp_identities (
                    transcript_session_id TEXT PRIMARY KEY REFERENCES transcript_sessions(id) ON DELETE CASCADE,
                    candidate_id TEXT NOT NULL,
                    agent_session_id TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS transcript_events (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL REFERENCES transcript_sessions(id) ON DELETE CASCADE,
                    sequence INTEGER NOT NULL,
                    kind TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    UNIQUE(session_id, sequence)
                );

                CREATE INDEX IF NOT EXISTS idx_transcript_events_session_sequence
                    ON transcript_events(session_id, sequence);

                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    transcript_session_id TEXT NOT NULL UNIQUE REFERENCES transcript_sessions(id) ON DELETE CASCADE,
                    original_prompt TEXT NOT NULL,
                    status TEXT NOT NULL,
                    current_phase TEXT NOT NULL,
                    initial_complexity_profile TEXT NOT NULL DEFAULT 'standard',
                    initial_complexity_reasons_json TEXT NOT NULL DEFAULT '["legacy task without assessment"]',
                    initial_complexity_confidence INTEGER NOT NULL DEFAULT 0,
                    complexity_profile TEXT NOT NULL DEFAULT 'standard',
                    complexity_reasons_json TEXT NOT NULL DEFAULT '["legacy task without assessment"]',
                    complexity_confidence INTEGER,
                    complexity_source TEXT NOT NULL DEFAULT 'system',
                    complexity_assessment_version TEXT NOT NULL DEFAULT 'legacy_v0',
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_tasks_project_updated
                    ON tasks(project_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS task_phases (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    phase TEXT NOT NULL,
                    phase_index INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    started_at INTEGER,
                    completed_at INTEGER,
                    UNIQUE(task_id, phase),
                    UNIQUE(task_id, phase_index)
                );

                CREATE INDEX IF NOT EXISTS idx_task_phases_task_order
                    ON task_phases(task_id, phase_index);

                CREATE TABLE IF NOT EXISTS task_phase_artifacts (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    phase TEXT NOT NULL CHECK(phase IN ('analysis', 'planning', 'execution', 'review')),
                    sequence INTEGER NOT NULL,
                    kind TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    UNIQUE(task_id, phase, sequence)
                );

                CREATE INDEX IF NOT EXISTS idx_task_phase_artifacts_task_phase_sequence
                    ON task_phase_artifacts(task_id, phase, sequence);

                CREATE TABLE IF NOT EXISTS task_phase_artifact_event_sources (
                    artifact_id TEXT NOT NULL REFERENCES task_phase_artifacts(id) ON DELETE CASCADE,
                    transcript_event_id TEXT NOT NULL REFERENCES transcript_events(id) ON DELETE RESTRICT,
                    PRIMARY KEY (artifact_id, transcript_event_id)
                );

                CREATE TABLE IF NOT EXISTS task_plan_versions (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    version INTEGER NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('draft', 'approved')),
                    source_artifact_id TEXT NOT NULL REFERENCES task_phase_artifacts(id) ON DELETE RESTRICT,
                    created_at INTEGER NOT NULL,
                    approved_at INTEGER,
                    UNIQUE(task_id, version)
                );

                CREATE UNIQUE INDEX IF NOT EXISTS idx_task_plan_versions_one_approved
                    ON task_plan_versions(task_id) WHERE status = 'approved';

                CREATE TABLE IF NOT EXISTS task_plan_requirements (
                    plan_version_id TEXT NOT NULL REFERENCES task_plan_versions(id) ON DELETE CASCADE,
                    requirement_id TEXT NOT NULL,
                    order_index INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    kind TEXT NOT NULL CHECK(kind IN ('functional', 'constraint', 'non_functional', 'out_of_scope')),
                    PRIMARY KEY(plan_version_id, requirement_id),
                    UNIQUE(plan_version_id, order_index)
                );

                CREATE TABLE IF NOT EXISTS task_plan_steps (
                    id TEXT PRIMARY KEY,
                    plan_version_id TEXT NOT NULL REFERENCES task_plan_versions(id) ON DELETE CASCADE,
                    order_index INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    kind TEXT NOT NULL CHECK(kind IN ('implementation', 'infrastructure')),
                    complexity INTEGER NOT NULL CHECK(complexity BETWEEN 1 AND 5),
                    acceptance_criteria_json TEXT NOT NULL,
                    expected_paths_json TEXT NOT NULL,
                    satisfies_json TEXT NOT NULL,
                    depends_on_json TEXT NOT NULL DEFAULT '[]',
                    UNIQUE(plan_version_id, order_index)
                );

                CREATE INDEX IF NOT EXISTS idx_task_plan_versions_task_version
                    ON task_plan_versions(task_id, version DESC);

                CREATE TABLE IF NOT EXISTS task_plan_evaluations (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    plan_version_id TEXT NOT NULL UNIQUE REFERENCES task_plan_versions(id) ON DELETE CASCADE,
                    plan_version INTEGER NOT NULL,
                    verdict TEXT NOT NULL CHECK(verdict IN ('clean', 'flags', 'blocked')),
                    findings_json TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS task_plan_critiques (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    plan_version_id TEXT NOT NULL REFERENCES task_plan_versions(id) ON DELETE CASCADE,
                    evaluation_id TEXT NOT NULL UNIQUE REFERENCES task_plan_evaluations(id) ON DELETE CASCADE,
                    source TEXT NOT NULL,
                    issues_json TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS task_plan_repair_applications (
                    id TEXT PRIMARY KEY,
                    critique_id TEXT NOT NULL UNIQUE REFERENCES task_plan_critiques(id) ON DELETE RESTRICT,
                    source_plan_version_id TEXT NOT NULL REFERENCES task_plan_versions(id) ON DELETE RESTRICT,
                    repaired_plan_version_id TEXT NOT NULL UNIQUE REFERENCES task_plan_versions(id) ON DELETE CASCADE,
                    created_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS task_agent_reports (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    phase TEXT NOT NULL CHECK(phase IN ('analysis', 'planning', 'execution', 'review')),
                    sequence INTEGER NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('advisor', 'reviewer')),
                    transcript_session_id TEXT NOT NULL REFERENCES transcript_sessions(id) ON DELETE CASCADE,
                    content TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    UNIQUE(task_id, phase, sequence)
                );

                CREATE INDEX IF NOT EXISTS idx_task_agent_reports_task_phase_sequence
                    ON task_agent_reports(task_id, phase, sequence);

                CREATE TABLE IF NOT EXISTS task_agent_report_event_sources (
                    report_id TEXT NOT NULL REFERENCES task_agent_reports(id) ON DELETE CASCADE,
                    transcript_event_id TEXT NOT NULL REFERENCES transcript_events(id) ON DELETE RESTRICT,
                    PRIMARY KEY (report_id, transcript_event_id)
                );

                CREATE TABLE IF NOT EXISTS task_context_dispatch_receipts (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    transcript_session_id TEXT NOT NULL REFERENCES transcript_sessions(id) ON DELETE CASCADE,
                    sequence INTEGER NOT NULL,
                    acp_session_id TEXT NOT NULL,
                    user_prompt TEXT NOT NULL,
                    rendered_context TEXT NOT NULL,
                    wire_prompt TEXT NOT NULL,
                    sources_json TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'failed')),
                    stop_reason TEXT,
                    error TEXT,
                    verification_status TEXT,
                    verification_workspace_path TEXT,
                    verification_changed_files_json TEXT,
                    verification_error TEXT,
                    scope_status TEXT,
                    scope_violations_json TEXT,
                    review_status TEXT,
                    review_note TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    UNIQUE(task_id, sequence)
                );

                CREATE INDEX IF NOT EXISTS idx_task_context_dispatch_receipts_task_sequence
                    ON task_context_dispatch_receipts(task_id, sequence);

                CREATE TABLE IF NOT EXISTS task_phase_run_receipts (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    transcript_session_id TEXT NOT NULL REFERENCES transcript_sessions(id) ON DELETE CASCADE,
                    sequence INTEGER NOT NULL,
                    phase TEXT NOT NULL CHECK(phase IN ('analysis', 'planning', 'execution', 'review')),
                    acp_session_id TEXT NOT NULL,
                    instruction TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'failed')),
                    stop_reason TEXT,
                    error TEXT,
                    verification_status TEXT,
                    verification_workspace_path TEXT,
                    verification_changed_files_json TEXT,
                    verification_error TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    UNIQUE(task_id, sequence)
                );

                CREATE INDEX IF NOT EXISTS idx_task_phase_run_receipts_task_sequence
                    ON task_phase_run_receipts(task_id, sequence);

                CREATE TABLE IF NOT EXISTS task_phase_run_response_events (
                    receipt_id TEXT NOT NULL REFERENCES task_phase_run_receipts(id) ON DELETE CASCADE,
                    transcript_event_id TEXT NOT NULL REFERENCES transcript_events(id) ON DELETE RESTRICT,
                    PRIMARY KEY(receipt_id, transcript_event_id),
                    UNIQUE(transcript_event_id)
                );

                CREATE TABLE IF NOT EXISTS task_plan_step_runs (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    plan_version_id TEXT NOT NULL REFERENCES task_plan_versions(id) ON DELETE RESTRICT,
                    plan_step_id TEXT NOT NULL REFERENCES task_plan_steps(id) ON DELETE RESTRICT,
                    step_order_index INTEGER NOT NULL,
                    attempt INTEGER NOT NULL,
                    acp_session_id TEXT NOT NULL,
                    instruction TEXT NOT NULL,
                    model_tier TEXT NOT NULL CHECK(model_tier IN ('small', 'mid', 'high')),
                    model_tier_rationale TEXT NOT NULL,
                    expected_paths_json TEXT NOT NULL,
                    isolation_id TEXT,
                    isolation_repository_path TEXT,
                    isolation_worktree_path TEXT,
                    isolation_branch TEXT,
                    isolation_base_sha TEXT,
                    integration_status TEXT CHECK(integration_status IN ('pending', 'integrated', 'conflicted')),
                    isolated_commit_sha TEXT,
                    integrated_commit_sha TEXT,
                    integration_error TEXT,
                    status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'failed', 'accepted')),
                    stop_reason TEXT,
                    error TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    UNIQUE(plan_step_id, attempt)
                );

                CREATE INDEX IF NOT EXISTS idx_task_plan_step_runs_task_order_attempt
                    ON task_plan_step_runs(task_id, step_order_index, attempt);

                CREATE UNIQUE INDEX IF NOT EXISTS idx_task_plan_step_runs_one_open
                    ON task_plan_step_runs(plan_step_id)
                    WHERE status IN ('pending', 'sent');

                CREATE TABLE IF NOT EXISTS task_complexity_changes (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    sequence INTEGER NOT NULL,
                    profile TEXT NOT NULL CHECK(profile IN ('quick', 'standard', 'complex')),
                    reasons_json TEXT NOT NULL,
                    confidence INTEGER CHECK(confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),
                    source TEXT NOT NULL CHECK(source IN ('system', 'user', 'analysis')),
                    assessment_version TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    UNIQUE(task_id, sequence)
                );

                CREATE INDEX IF NOT EXISTS idx_task_complexity_changes_task_sequence
                    ON task_complexity_changes(task_id, sequence);

                CREATE TABLE IF NOT EXISTS knowledge_items (
                    id TEXT PRIMARY KEY,
                    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
                    title TEXT NOT NULL,
                    body TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    scope TEXT NOT NULL,
                    source_transcript_session_id TEXT REFERENCES transcript_sessions(id) ON DELETE SET NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_knowledge_items_project_updated
                    ON knowledge_items(project_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS transcript_knowledge_links (
                    transcript_session_id TEXT NOT NULL REFERENCES transcript_sessions(id) ON DELETE CASCADE,
                    knowledge_item_id TEXT NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
                    created_at INTEGER NOT NULL,
                    PRIMARY KEY (transcript_session_id, knowledge_item_id)
                );

                CREATE INDEX IF NOT EXISTS idx_transcript_knowledge_links_item
                    ON transcript_knowledge_links(knowledge_item_id);
                "#,
            )
            .map_err(storage_error)?;

        let connection = self.connection()?;
        ensure_table_column(
            &connection,
            "task_plan_steps",
            "depends_on_json",
            "TEXT NOT NULL DEFAULT '[]'",
        )?;
        ensure_table_column(
            &connection,
            "project_initialization_summaries",
            "claims_json",
            "TEXT NOT NULL DEFAULT '[]'",
        )?;
        ensure_table_column(
            &connection,
            "task_phase_run_receipts",
            "verification_status",
            "TEXT",
        )?;
        for (column, definition) in [
            ("isolation_id", "TEXT"),
            ("isolation_repository_path", "TEXT"),
            ("isolation_worktree_path", "TEXT"),
            ("isolation_branch", "TEXT"),
            ("isolation_base_sha", "TEXT"),
            ("integration_status", "TEXT"),
            ("isolated_commit_sha", "TEXT"),
            ("integrated_commit_sha", "TEXT"),
            ("integration_error", "TEXT"),
            ("verification_status", "TEXT"),
            ("verification_workspace_path", "TEXT"),
            ("verification_changed_files_json", "TEXT"),
            ("verification_error", "TEXT"),
            ("scope_status", "TEXT"),
            ("scope_violations_json", "TEXT"),
            ("review_status", "TEXT"),
            ("review_note", "TEXT"),
        ] {
            ensure_table_column(&connection, "task_plan_step_runs", column, definition)?;
        }
        ensure_table_column(
            &connection,
            "task_phase_run_receipts",
            "verification_workspace_path",
            "TEXT",
        )?;
        ensure_table_column(
            &connection,
            "task_phase_run_receipts",
            "verification_changed_files_json",
            "TEXT",
        )?;
        ensure_table_column(
            &connection,
            "task_phase_run_receipts",
            "verification_error",
            "TEXT",
        )?;
        ensure_table_column(
            &connection,
            "project_initialization_summaries",
            "requested_model_profile_id",
            "TEXT",
        )?;
        ensure_table_column(
            &connection,
            "project_initialization_summaries",
            "requested_model_provider_id",
            "TEXT",
        )?;
        ensure_table_column(
            &connection,
            "project_initialization_summaries",
            "requested_model_id",
            "TEXT",
        )?;
        ensure_table_column(
            &connection,
            "project_initialization_summaries",
            "requested_model_tier",
            "TEXT",
        )?;
        ensure_table_column(
            &connection,
            "project_initialization_summaries",
            "requested_model_parameters_json",
            "TEXT NOT NULL DEFAULT '[]'",
        )?;
        ensure_table_column(
            &connection,
            "project_initialization_summaries",
            "model_catalog_schema_version",
            "INTEGER",
        )?;
        ensure_table_column(
            &connection,
            "project_initialization_summaries",
            "knowledge_schema_version",
            "INTEGER NOT NULL DEFAULT 1",
        )?;
        ensure_table_column(
            &connection,
            "project_initialization_summaries",
            "generation_engine",
            "TEXT NOT NULL DEFAULT 'deterministic_v1'",
        )?;
        ensure_table_column(
            &connection,
            "tasks",
            "initial_complexity_profile",
            "TEXT NOT NULL DEFAULT 'standard'",
        )?;
        ensure_table_column(
            &connection,
            "tasks",
            "initial_complexity_reasons_json",
            "TEXT NOT NULL DEFAULT '[\"legacy task without assessment\"]'",
        )?;
        ensure_table_column(
            &connection,
            "tasks",
            "initial_complexity_confidence",
            "INTEGER NOT NULL DEFAULT 0",
        )?;
        ensure_table_column(
            &connection,
            "tasks",
            "complexity_profile",
            "TEXT NOT NULL DEFAULT 'standard'",
        )?;
        ensure_table_column(
            &connection,
            "tasks",
            "complexity_reasons_json",
            "TEXT NOT NULL DEFAULT '[\"legacy task without assessment\"]'",
        )?;
        ensure_table_column(&connection, "tasks", "complexity_confidence", "INTEGER")?;
        ensure_table_column(
            &connection,
            "tasks",
            "complexity_source",
            "TEXT NOT NULL DEFAULT 'system'",
        )?;
        ensure_table_column(
            &connection,
            "tasks",
            "complexity_assessment_version",
            "TEXT NOT NULL DEFAULT 'legacy_v0'",
        )?;
        connection
            .execute(
                "INSERT INTO task_complexity_changes
                 (id, task_id, sequence, profile, reasons_json, confidence, source,
                  assessment_version, created_at)
                 SELECT 'legacy-' || id, id, 0, complexity_profile, complexity_reasons_json,
                        complexity_confidence, complexity_source, complexity_assessment_version,
                        created_at
                 FROM tasks
                 WHERE NOT EXISTS (
                    SELECT 1 FROM task_complexity_changes c WHERE c.task_id = tasks.id
                 )",
                [],
            )
            .map_err(storage_error)?;
        Ok(())
    }

    #[cfg(test)]
    pub(crate) fn seed_ready_project_knowledge(&self, project_id: &str) {
        let initialization_id = Uuid::new_v4().to_string();
        let summary_id = Uuid::new_v4().to_string();
        let unit_id = Uuid::new_v4().to_string();
        let connection = self.connection().expect("test store opens");
        connection
            .execute(
                "INSERT INTO project_initialization_runs
             (id, project_id, status, created_at, updated_at)
             VALUES (?1, ?2, 'summary', 1, 1)",
                params![initialization_id, project_id],
            )
            .expect("test initialization inserted");
        connection
            .execute(
                "INSERT INTO project_initialization_summaries
             (id, initialization_id, status, project_purpose, repository_map, repository_roles,
              build_test_matrix, fragile_areas, do_not_touch_rules, agent_working_rules,
              open_questions, claims_json, fact_count, markdown_finding_count, guardrail_count,
              requested_model_parameters_json, knowledge_schema_version, generation_engine,
              created_at, approved_at)
             VALUES (?1, ?2, 'approved', 'purpose', 'map', 'roles', 'tests', 'fragile',
              'rules', 'agent rules', 'questions', '[]', 1, 1, 1, '[]', 1, 'test', 1, 1)",
                params![summary_id, initialization_id],
            )
            .expect("test summary inserted");
        connection
            .execute(
                "INSERT INTO knowledge_units
             (id, project_id, initialization_id, derived_from_summary_id, kind, topic, content,
              scope, status, confidence, schema_version, created_at)
             VALUES (?1, ?2, ?3, ?4, 'purpose', 'project_purpose', 'purpose',
              'project', 'active', 100, 1, 1)",
                params![unit_id, project_id, initialization_id, summary_id],
            )
            .expect("test knowledge unit inserted");
    }

    fn connection(&self) -> AppResult<MutexGuard<'_, Connection>> {
        self.connection
            .lock()
            .map_err(|_| AppError::Storage("project store lock poisoned".to_string()))
    }

    fn require_project(&self, project_id: &str) -> AppResult<()> {
        let exists: i64 = self
            .connection()?
            .query_row(
                "SELECT COUNT(*) FROM projects WHERE id = ?1",
                params![project_id],
                |row| row.get(0),
            )
            .map_err(storage_error)?;
        if exists == 0 {
            return Err(AppError::InvalidInput(format!(
                "project not found: {project_id}"
            )));
        }
        Ok(())
    }

    pub fn task(&self, task_id: &str) -> AppResult<TaskInfo> {
        let connection = self.connection()?;
        let mut task = connection
            .query_row(
                "SELECT id, project_id, transcript_session_id, original_prompt, status,
                        current_phase, initial_complexity_profile,
                        initial_complexity_reasons_json, initial_complexity_confidence,
                        complexity_profile, complexity_reasons_json, complexity_confidence,
                        complexity_source, complexity_assessment_version, created_at, updated_at
                 FROM tasks WHERE id = ?1",
                params![task_id],
                |row| {
                    Ok(TaskInfo {
                        id: row.get(0)?,
                        project_id: row.get(1)?,
                        transcript_session_id: row.get(2)?,
                        original_prompt: row.get(3)?,
                        status: row.get(4)?,
                        current_phase: row.get(5)?,
                        initial_complexity_profile: row.get(6)?,
                        initial_complexity_reasons: json_string_list_from_row(row, 7)?,
                        initial_complexity_confidence: row.get(8)?,
                        complexity_profile: row.get(9)?,
                        complexity_reasons: json_string_list_from_row(row, 10)?,
                        complexity_confidence: row.get(11)?,
                        complexity_source: row.get(12)?,
                        complexity_assessment_version: row.get(13)?,
                        complexity_changes: Vec::new(),
                        phases: Vec::new(),
                        created_at: row.get(14)?,
                        updated_at: row.get(15)?,
                    })
                },
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::InvalidInput(format!("task not found: {task_id}"))
                }
                other => storage_error(other),
            })?;
        let mut statement = connection
            .prepare(
                "SELECT id, task_id, phase, phase_index, status, started_at, completed_at
                 FROM task_phases WHERE task_id = ?1 ORDER BY phase_index ASC",
            )
            .map_err(storage_error)?;
        task.phases = statement
            .query_map(params![task_id], |row| {
                Ok(TaskPhaseInfo {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    phase: row.get(2)?,
                    phase_index: row.get(3)?,
                    status: row.get(4)?,
                    started_at: row.get(5)?,
                    completed_at: row.get(6)?,
                })
            })
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;
        let mut statement = connection
            .prepare(
                "SELECT id, task_id, sequence, profile, reasons_json, confidence, source,
                        assessment_version, created_at
                 FROM task_complexity_changes WHERE task_id = ?1 ORDER BY sequence ASC",
            )
            .map_err(storage_error)?;
        task.complexity_changes = statement
            .query_map(params![task_id], |row| {
                Ok(TaskComplexityChangeInfo {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    sequence: row.get(2)?,
                    profile: row.get(3)?,
                    reasons: json_string_list_from_row(row, 4)?,
                    confidence: row.get(5)?,
                    source: row.get(6)?,
                    assessment_version: row.get(7)?,
                    created_at: row.get(8)?,
                })
            })
            .map_err(storage_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(storage_error)?;
        Ok(task)
    }

    fn require_transcript_session(&self, session_id: &str) -> AppResult<()> {
        let connection = self.connection()?;
        require_transcript_session(&connection, session_id)
    }

    fn transcript_session(&self, session_id: &str) -> AppResult<TranscriptSessionInfo> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT s.id, s.project_id, s.runtime, s.source, s.title, s.started_at, s.updated_at, COUNT(e.id)
                 FROM transcript_sessions s
                 LEFT JOIN transcript_events e ON e.session_id = s.id
                 WHERE s.id = ?1
                 GROUP BY s.id, s.project_id, s.runtime, s.source, s.title, s.started_at, s.updated_at",
            )
            .map_err(storage_error)?;
        statement
            .query_row(params![session_id], transcript_session_from_row)
            .map_err(|err| {
                if matches!(err, rusqlite::Error::QueryReturnedNoRows) {
                    AppError::InvalidInput(format!("transcript session not found: {session_id}"))
                } else {
                    storage_error(err)
                }
            })
    }
}

pub fn default_database_path() -> AppResult<PathBuf> {
    if let Some(path) = std::env::var_os("AIADNE_DB_PATH") {
        return Ok(PathBuf::from(path));
    }

    let data_home = if let Some(path) = std::env::var_os("XDG_DATA_HOME") {
        PathBuf::from(path)
    } else if let Some(home) = std::env::var_os("HOME") {
        PathBuf::from(home).join(".local").join("share")
    } else {
        std::env::current_dir()?
    };

    Ok(data_home.join("aiadne").join("aiadne.sqlite3"))
}

fn project_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectInfo> {
    Ok(ProjectInfo {
        id: row.get(0)?,
        name: row.get(1)?,
        path: PathBuf::from(row.get::<_, String>(2)?),
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

fn project_repository_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectRepositoryInfo> {
    let is_default: i64 = row.get(4)?;
    Ok(ProjectRepositoryInfo {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        path: PathBuf::from(row.get::<_, String>(3)?),
        is_default: is_default != 0,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn project_initialization_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<ProjectInitializationInfo> {
    Ok(ProjectInitializationInfo {
        id: row.get(0)?,
        project_id: row.get(1)?,
        status: row.get(2)?,
        repository_count: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

fn project_initialization_fact_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<ProjectInitializationFactInfo> {
    Ok(ProjectInitializationFactInfo {
        id: row.get(0)?,
        initialization_id: row.get(1)?,
        repository_id: row.get(2)?,
        repository_name: row.get(3)?,
        repository_path: PathBuf::from(row.get::<_, String>(4)?),
        kind: row.get(5)?,
        label: row.get(6)?,
        value: row.get(7)?,
        source: row.get(8)?,
        created_at: row.get(9)?,
    })
}

fn project_initialization_markdown_finding_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<ProjectInitializationMarkdownFindingInfo> {
    Ok(ProjectInitializationMarkdownFindingInfo {
        id: row.get(0)?,
        initialization_id: row.get(1)?,
        repository_id: row.get(2)?,
        repository_name: row.get(3)?,
        repository_path: PathBuf::from(row.get::<_, String>(4)?),
        file_path: row.get(5)?,
        category: row.get(6)?,
        title: row.get(7)?,
        excerpt: row.get(8)?,
        source: row.get(9)?,
        created_at: row.get(10)?,
    })
}

fn project_initialization_guardrail_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<ProjectInitializationGuardrailInfo> {
    let repository_path: Option<String> = row.get(4)?;
    Ok(ProjectInitializationGuardrailInfo {
        id: row.get(0)?,
        initialization_id: row.get(1)?,
        repository_id: row.get(2)?,
        repository_name: row.get(3)?,
        repository_path: repository_path.map(PathBuf::from),
        guardrail_index: row.get(5)?,
        scope: row.get(6)?,
        kind: row.get(7)?,
        path_pattern: row.get(8)?,
        content: row.get(9)?,
        source: row.get(10)?,
        created_at: row.get(11)?,
    })
}

fn project_initialization_summary_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<ProjectInitializationSummaryInfo> {
    let claims_json: String = row.get(11)?;
    let claims = serde_json::from_str(&claims_json)
        .map_err(|err| rusqlite::Error::FromSqlConversionFailure(11, Type::Text, Box::new(err)))?;
    let requested_model_parameters_json: String = row.get(21)?;
    let requested_model_parameters = serde_json::from_str(&requested_model_parameters_json)
        .map_err(|err| rusqlite::Error::FromSqlConversionFailure(21, Type::Text, Box::new(err)))?;
    let mut summary = ProjectInitializationSummaryInfo {
        id: row.get(0)?,
        initialization_id: row.get(1)?,
        status: row.get(2)?,
        project_purpose: row.get(3)?,
        repository_map: row.get(4)?,
        repository_roles: row.get(5)?,
        build_test_matrix: row.get(6)?,
        fragile_areas: row.get(7)?,
        do_not_touch_rules: row.get(8)?,
        agent_working_rules: row.get(9)?,
        open_questions: row.get(10)?,
        claims,
        fact_count: row.get(12)?,
        markdown_finding_count: row.get(13)?,
        guardrail_count: row.get(14)?,
        created_at: row.get(15)?,
        approved_at: row.get(16)?,
        requested_model_profile_id: row.get(17)?,
        requested_model_provider_id: row.get(18)?,
        requested_model_id: row.get(19)?,
        requested_model_tier: row.get(20)?,
        requested_model_parameters,
        model_catalog_schema_version: row.get(22)?,
        knowledge_schema_version: row.get(23)?,
        generation_engine: row.get(24)?,
    };
    if summary.claims.is_empty() {
        summary.claims = summary_claims(&summary);
        if summary.status == "approved" {
            for claim in &mut summary.claims {
                claim.status = if claim.section == "open_questions" {
                    "deferred"
                } else {
                    "accepted"
                }
                .to_string();
            }
        }
    }
    Ok(summary)
}

fn transcript_session_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TranscriptSessionInfo> {
    Ok(TranscriptSessionInfo {
        id: row.get(0)?,
        project_id: row.get(1)?,
        runtime: row.get(2)?,
        source: row.get(3)?,
        title: row.get(4)?,
        started_at: row.get(5)?,
        updated_at: row.get(6)?,
        event_count: row.get(7)?,
    })
}

fn transcript_event_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TranscriptEventInfo> {
    Ok(TranscriptEventInfo {
        id: row.get(0)?,
        session_id: row.get(1)?,
        sequence: row.get(2)?,
        kind: row.get(3)?,
        content: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn knowledge_item_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<KnowledgeItemInfo> {
    Ok(KnowledgeItemInfo {
        id: row.get(0)?,
        project_id: row.get(1)?,
        title: row.get(2)?,
        body: row.get(3)?,
        kind: row.get(4)?,
        scope: row.get(5)?,
        source_transcript_session_id: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

fn require_transcript_session(connection: &Connection, session_id: &str) -> AppResult<()> {
    let exists: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM transcript_sessions WHERE id = ?1",
            params![session_id],
            |row| row.get(0),
        )
        .map_err(storage_error)?;
    if exists == 0 {
        return Err(AppError::InvalidInput(format!(
            "transcript session not found: {session_id}"
        )));
    }
    Ok(())
}

fn require_knowledge_item(connection: &Connection, knowledge_item_id: &str) -> AppResult<()> {
    let exists: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM knowledge_items WHERE id = ?1",
            params![knowledge_item_id],
            |row| row.get(0),
        )
        .map_err(storage_error)?;
    if exists == 0 {
        return Err(AppError::InvalidInput(format!(
            "knowledge item not found: {knowledge_item_id}"
        )));
    }
    Ok(())
}

fn require_project_repository(
    connection: &Connection,
    project_id: &str,
    repository_id: &str,
) -> AppResult<()> {
    let exists: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM project_repositories WHERE id = ?1 AND project_id = ?2",
            params![repository_id, project_id],
            |row| row.get(0),
        )
        .map_err(storage_error)?;
    if exists == 0 {
        return Err(AppError::InvalidInput(format!(
            "project repository not found for project: {repository_id}"
        )));
    }
    Ok(())
}

fn require_project_initialization(
    connection: &Connection,
    initialization_id: &str,
) -> AppResult<()> {
    let exists: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM project_initialization_runs WHERE id = ?1",
            params![initialization_id],
            |row| row.get(0),
        )
        .map_err(storage_error)?;
    if exists == 0 {
        return Err(AppError::InvalidInput(format!(
            "project initialization not found: {initialization_id}"
        )));
    }
    Ok(())
}

fn require_task_project_knowledge_ready(connection: &Connection, task_id: &str) -> AppResult<()> {
    let ready: bool = connection
        .query_row(
            "SELECT EXISTS(
                SELECT 1
                FROM tasks
                JOIN project_initialization_runs runs
                  ON runs.project_id = tasks.project_id
                JOIN project_initialization_summaries summaries
                  ON summaries.initialization_id = runs.id AND summaries.status = 'approved'
                JOIN knowledge_units units
                  ON units.derived_from_summary_id = summaries.id
                 AND units.project_id = tasks.project_id AND units.status = 'active'
                WHERE tasks.id = ?1
             )",
            [task_id],
            |row| row.get(0),
        )
        .map_err(storage_error)?;
    if !ready {
        return Err(AppError::InvalidInput(
            "initialize and approve Project Knowledge before starting Task work".into(),
        ));
    }
    Ok(())
}

fn list_initialization_repositories(
    connection: &Connection,
    initialization_id: &str,
) -> AppResult<Vec<ProjectRepositoryInfo>> {
    require_project_initialization(connection, initialization_id)?;
    let mut statement = connection
        .prepare(
            "SELECT pr.id, pr.project_id, pr.name, pr.path, pr.is_default, pr.created_at, pr.updated_at
             FROM project_initialization_repositories ir
             JOIN project_repositories pr ON pr.id = ir.repository_id
             WHERE ir.initialization_id = ?1
             ORDER BY ir.repository_index ASC",
        )
        .map_err(storage_error)?;
    let repositories = statement
        .query_map(params![initialization_id], project_repository_from_row)
        .map_err(storage_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage_error)?;

    Ok(repositories)
}

fn selected_initialization_repository_ids(
    connection: &Connection,
    initialization_id: &str,
) -> AppResult<HashSet<String>> {
    let mut statement = connection
        .prepare(
            "SELECT repository_id
             FROM project_initialization_repositories
             WHERE initialization_id = ?1",
        )
        .map_err(storage_error)?;
    let repository_ids = statement
        .query_map(params![initialization_id], |row| row.get::<_, String>(0))
        .map_err(storage_error)?
        .collect::<Result<HashSet<_>, _>>()
        .map_err(storage_error)?;

    Ok(repository_ids)
}

fn list_project_initialization_facts(
    connection: &Connection,
    initialization_id: &str,
) -> AppResult<Vec<ProjectInitializationFactInfo>> {
    let mut statement = connection
        .prepare(
            "SELECT f.id, f.initialization_id, f.repository_id, pr.name, pr.path,
                    f.kind, f.label, f.value, f.source, f.created_at
             FROM project_initialization_facts f
             JOIN project_repositories pr ON pr.id = f.repository_id
             WHERE f.initialization_id = ?1
             ORDER BY pr.name ASC, f.created_at ASC, f.kind ASC",
        )
        .map_err(storage_error)?;
    let facts = statement
        .query_map(
            params![initialization_id],
            project_initialization_fact_from_row,
        )
        .map_err(storage_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage_error)?;

    Ok(facts)
}

fn insert_project_initialization_fact(
    connection: &Connection,
    fact: &ProjectInitializationFactInfo,
) -> AppResult<()> {
    connection
        .execute(
            "INSERT INTO project_initialization_facts
             (id, initialization_id, repository_id, kind, label, value, source, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                &fact.id,
                &fact.initialization_id,
                &fact.repository_id,
                &fact.kind,
                &fact.label,
                &fact.value,
                &fact.source,
                fact.created_at
            ],
        )
        .map_err(storage_error)?;
    Ok(())
}

fn list_project_initialization_markdown_findings(
    connection: &Connection,
    initialization_id: &str,
) -> AppResult<Vec<ProjectInitializationMarkdownFindingInfo>> {
    let mut statement = connection
        .prepare(
            "SELECT f.id, f.initialization_id, f.repository_id, pr.name, pr.path,
                    f.file_path, f.category, f.title, f.excerpt, f.source, f.created_at
             FROM project_initialization_markdown_findings f
             JOIN project_repositories pr ON pr.id = f.repository_id
             WHERE f.initialization_id = ?1
             ORDER BY pr.name ASC, f.file_path ASC, f.created_at ASC, f.category ASC",
        )
        .map_err(storage_error)?;
    let findings = statement
        .query_map(
            params![initialization_id],
            project_initialization_markdown_finding_from_row,
        )
        .map_err(storage_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage_error)?;

    Ok(findings)
}

fn insert_project_initialization_markdown_finding(
    connection: &Connection,
    finding: &ProjectInitializationMarkdownFindingInfo,
) -> AppResult<()> {
    connection
        .execute(
            "INSERT INTO project_initialization_markdown_findings
             (id, initialization_id, repository_id, file_path, category, title, excerpt, source, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &finding.id,
                &finding.initialization_id,
                &finding.repository_id,
                &finding.file_path,
                &finding.category,
                &finding.title,
                &finding.excerpt,
                &finding.source,
                finding.created_at
            ],
        )
        .map_err(storage_error)?;
    Ok(())
}

fn list_project_initialization_guardrails(
    connection: &Connection,
    initialization_id: &str,
) -> AppResult<Vec<ProjectInitializationGuardrailInfo>> {
    let mut statement = connection
        .prepare(
            "SELECT g.id, g.initialization_id, g.repository_id, pr.name, pr.path,
                    g.guardrail_index, g.scope, g.kind, g.path_pattern, g.content, g.source, g.created_at
             FROM project_initialization_guardrails g
             LEFT JOIN project_repositories pr ON pr.id = g.repository_id
             WHERE g.initialization_id = ?1
             ORDER BY g.guardrail_index ASC",
        )
        .map_err(storage_error)?;
    let guardrails = statement
        .query_map(
            params![initialization_id],
            project_initialization_guardrail_from_row,
        )
        .map_err(storage_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage_error)?;

    Ok(guardrails)
}

fn insert_project_initialization_guardrail(
    connection: &Connection,
    guardrail: &ProjectInitializationGuardrailInfo,
) -> AppResult<()> {
    connection
        .execute(
            "INSERT INTO project_initialization_guardrails
             (id, initialization_id, repository_id, guardrail_index, scope, kind, path_pattern, content, source, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                &guardrail.id,
                &guardrail.initialization_id,
                &guardrail.repository_id,
                guardrail.guardrail_index,
                &guardrail.scope,
                &guardrail.kind,
                &guardrail.path_pattern,
                &guardrail.content,
                &guardrail.source,
                guardrail.created_at
            ],
        )
        .map_err(storage_error)?;
    Ok(())
}

fn list_project_initialization_summary(
    connection: &Connection,
    initialization_id: &str,
) -> AppResult<Option<ProjectInitializationSummaryInfo>> {
    let mut statement = connection
        .prepare(
            "SELECT id, initialization_id, status, project_purpose, repository_map,
                    repository_roles, build_test_matrix, fragile_areas,
                    do_not_touch_rules, agent_working_rules, open_questions, claims_json,
                    fact_count, markdown_finding_count, guardrail_count, created_at, approved_at,
                    requested_model_profile_id, requested_model_provider_id,
                    requested_model_id, requested_model_tier,
                    requested_model_parameters_json, model_catalog_schema_version,
                    knowledge_schema_version, generation_engine
             FROM project_initialization_summaries
             WHERE initialization_id = ?1",
        )
        .map_err(storage_error)?;
    let mut rows = statement
        .query(params![initialization_id])
        .map_err(storage_error)?;
    if let Some(row) = rows.next().map_err(storage_error)? {
        Ok(Some(
            project_initialization_summary_from_row(row).map_err(storage_error)?,
        ))
    } else {
        Ok(None)
    }
}

fn project_initialization_summary_by_id(
    connection: &Connection,
    summary_id: &str,
) -> AppResult<Option<ProjectInitializationSummaryInfo>> {
    let mut statement = connection
        .prepare(
            "SELECT id, initialization_id, status, project_purpose, repository_map,
                    repository_roles, build_test_matrix, fragile_areas,
                    do_not_touch_rules, agent_working_rules, open_questions, claims_json,
                    fact_count, markdown_finding_count, guardrail_count, created_at, approved_at,
                    requested_model_profile_id, requested_model_provider_id,
                    requested_model_id, requested_model_tier,
                    requested_model_parameters_json, model_catalog_schema_version,
                    knowledge_schema_version, generation_engine
             FROM project_initialization_summaries
             WHERE id = ?1",
        )
        .map_err(storage_error)?;
    let mut rows = statement
        .query(params![summary_id])
        .map_err(storage_error)?;
    if let Some(row) = rows.next().map_err(storage_error)? {
        Ok(Some(
            project_initialization_summary_from_row(row).map_err(storage_error)?,
        ))
    } else {
        Ok(None)
    }
}

fn insert_project_initialization_summary(
    connection: &Connection,
    summary: &ProjectInitializationSummaryInfo,
) -> AppResult<()> {
    let requested_model_parameters_json =
        serde_json::to_string(&summary.requested_model_parameters)
            .map_err(|err| AppError::Storage(err.to_string()))?;
    let claims_json =
        serde_json::to_string(&summary.claims).map_err(|err| AppError::Storage(err.to_string()))?;
    connection
        .execute(
            "INSERT INTO project_initialization_summaries
             (id, initialization_id, status, project_purpose, repository_map,
              repository_roles, build_test_matrix, fragile_areas,
              do_not_touch_rules, agent_working_rules, open_questions, claims_json,
              fact_count, markdown_finding_count, guardrail_count, created_at, approved_at,
              requested_model_profile_id, requested_model_provider_id, requested_model_id,
              requested_model_tier, requested_model_parameters_json,
              model_catalog_schema_version, knowledge_schema_version, generation_engine)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                     ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25)",
            params![
                &summary.id,
                &summary.initialization_id,
                &summary.status,
                &summary.project_purpose,
                &summary.repository_map,
                &summary.repository_roles,
                &summary.build_test_matrix,
                &summary.fragile_areas,
                &summary.do_not_touch_rules,
                &summary.agent_working_rules,
                &summary.open_questions,
                &claims_json,
                summary.fact_count,
                summary.markdown_finding_count,
                summary.guardrail_count,
                summary.created_at,
                summary.approved_at,
                &summary.requested_model_profile_id,
                &summary.requested_model_provider_id,
                &summary.requested_model_id,
                &summary.requested_model_tier,
                &requested_model_parameters_json,
                summary.model_catalog_schema_version,
                summary.knowledge_schema_version,
                &summary.generation_engine
            ],
        )
        .map_err(storage_error)?;
    Ok(())
}

fn build_knowledge_units(
    summary: &ProjectInitializationSummaryInfo,
    project_id: &str,
    created_at: i64,
) -> AppResult<Vec<KnowledgeUnitInfo>> {
    let mut units = Vec::new();
    for claim in summary
        .claims
        .iter()
        .filter(|claim| claim.status == "accepted")
    {
        let topic = claim.section.as_str();
        let kind = match topic {
            "project_purpose" => "purpose",
            "repository_map" => "repository",
            "repository_roles" => "repository_role",
            "build_test_matrix" => "command",
            "fragile_areas" => "fragile_area",
            "do_not_touch_rules" => "constraint",
            "agent_working_rules" => "agent_rule",
            "open_questions" => continue,
            _ => {
                return Err(AppError::InvalidInput(format!(
                    "unsupported summary claim section: {topic}"
                )))
            }
        };
        let line = &claim.content;
        let sources = knowledge_unit_source_keys(line)?;
        let content = strip_knowledge_unit_source_markers(line);
        let content = trim_list_prefix(&content);
        if content.is_empty() {
            return Err(AppError::InvalidInput(format!(
                "summary {topic} contains a source marker without knowledge content"
            )));
        }
        let is_uncertain = is_uncertain_knowledge_content(content);
        if sources.is_empty() && !is_uncertain {
            return Err(AppError::InvalidInput(format!(
                "summary {topic} contains an uncited knowledge unit"
            )));
        }
        let identity = format!("{}\n{}\n{content}", summary.id, claim.id);
        units.push(KnowledgeUnitInfo {
            id: Uuid::new_v5(&Uuid::NAMESPACE_OID, identity.as_bytes()).to_string(),
            project_id: project_id.to_string(),
            initialization_id: summary.initialization_id.clone(),
            derived_from_summary_id: summary.id.clone(),
            kind: kind.to_string(),
            topic: topic.to_string(),
            content: content.to_string(),
            scope: "project".to_string(),
            status: if is_uncertain {
                "needs_confirmation".to_string()
            } else {
                "active".to_string()
            },
            confidence: if is_uncertain { 0 } else { 100 },
            schema_version: summary.knowledge_schema_version,
            sources: sources
                .into_iter()
                .map(|source_key| KnowledgeUnitSourceInfo {
                    source_key,
                    repository_id: None,
                    path: None,
                })
                .collect(),
            created_at,
        });
    }
    if units.is_empty() {
        return Err(AppError::InvalidInput(
            "approved summary must produce at least one knowledge unit".to_string(),
        ));
    }
    Ok(units)
}

fn knowledge_unit_source_keys(value: &str) -> AppResult<Vec<String>> {
    const MARKER: &str = "[source:";
    let mut remaining = value;
    let mut sources = Vec::new();
    while let Some(index) = remaining.find(MARKER) {
        remaining = &remaining[index + MARKER.len()..];
        let end = remaining.find(']').ok_or_else(|| {
            AppError::InvalidInput("summary contains a malformed source marker".to_string())
        })?;
        let source = remaining[..end].trim();
        if source.is_empty() {
            return Err(AppError::InvalidInput(
                "summary contains an empty source marker".to_string(),
            ));
        }
        if !sources.iter().any(|existing| existing == source) {
            sources.push(source.to_string());
        }
        remaining = &remaining[end + 1..];
    }
    Ok(sources)
}

fn strip_knowledge_unit_source_markers(value: &str) -> String {
    let mut content = String::with_capacity(value.len());
    let mut remaining = value;
    while let Some(index) = remaining.find("[source:") {
        content.push_str(&remaining[..index]);
        let marker = &remaining[index..];
        let Some(end) = marker.find(']') else {
            content.push_str(marker);
            return content.trim().to_string();
        };
        remaining = &marker[end + 1..];
    }
    content.push_str(remaining);
    content.trim().to_string()
}

fn trim_list_prefix(value: &str) -> &str {
    let value = value.trim();
    if let Some(stripped) = value
        .strip_prefix("- ")
        .or_else(|| value.strip_prefix("* "))
    {
        return stripped.trim();
    }
    let digit_count = value
        .chars()
        .take_while(|character| character.is_ascii_digit())
        .count();
    if digit_count > 0 {
        let suffix = &value[digit_count..];
        if let Some(stripped) = suffix.strip_prefix(". ") {
            return stripped.trim();
        }
    }
    value
}

fn is_markdown_heading(value: &str) -> bool {
    let value = value.trim_start_matches(' ').trim_end();
    let marker_count = value
        .chars()
        .take_while(|character| *character == '#')
        .count();
    (1..=6).contains(&marker_count)
        && value[marker_count..]
            .chars()
            .next()
            .is_none_or(char::is_whitespace)
}

fn is_uncertain_knowledge_content(value: &str) -> bool {
    let normalized = value.to_ascii_lowercase();
    normalized.contains("needs confirmation:")
        || normalized.contains("no evidence")
        || (normalized.contains("no ") && normalized.contains(" supplied"))
}

fn insert_knowledge_unit(connection: &Connection, unit: &KnowledgeUnitInfo) -> AppResult<()> {
    connection
        .execute(
            "INSERT INTO knowledge_units
             (id, project_id, initialization_id, derived_from_summary_id, kind, topic,
              content, scope, status, confidence, schema_version, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                &unit.id,
                &unit.project_id,
                &unit.initialization_id,
                &unit.derived_from_summary_id,
                &unit.kind,
                &unit.topic,
                &unit.content,
                &unit.scope,
                &unit.status,
                unit.confidence,
                unit.schema_version,
                unit.created_at,
            ],
        )
        .map_err(storage_error)?;
    for (source_index, source) in unit.sources.iter().enumerate() {
        connection
            .execute(
                "INSERT INTO knowledge_unit_sources
                 (knowledge_unit_id, source_index, source_key, repository_id, path)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    &unit.id,
                    source_index as i64,
                    &source.source_key,
                    &source.repository_id,
                    &source.path,
                ],
            )
            .map_err(storage_error)?;
    }
    Ok(())
}

fn list_project_initialization_knowledge_units(
    connection: &Connection,
    initialization_id: &str,
) -> AppResult<Vec<KnowledgeUnitInfo>> {
    let mut statement = connection
        .prepare(
            "SELECT id, project_id, initialization_id, derived_from_summary_id, kind, topic,
                    content, scope, status, confidence, schema_version, created_at
             FROM knowledge_units
             WHERE initialization_id = ?1
             ORDER BY topic, id",
        )
        .map_err(storage_error)?;
    let rows = statement
        .query_map(params![initialization_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, i64>(9)?,
                row.get::<_, i64>(10)?,
                row.get::<_, i64>(11)?,
            ))
        })
        .map_err(storage_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage_error)?;
    rows.into_iter()
        .map(
            |(
                id,
                project_id,
                initialization_id,
                derived_from_summary_id,
                kind,
                topic,
                content,
                scope,
                status,
                confidence,
                schema_version,
                created_at,
            )| {
                let mut source_statement = connection
                    .prepare(
                        "SELECT source_key, repository_id, path
                         FROM knowledge_unit_sources
                         WHERE knowledge_unit_id = ?1
                         ORDER BY source_index",
                    )
                    .map_err(storage_error)?;
                let sources = source_statement
                    .query_map(params![&id], |row| {
                        Ok(KnowledgeUnitSourceInfo {
                            source_key: row.get(0)?,
                            repository_id: row.get(1)?,
                            path: row.get(2)?,
                        })
                    })
                    .map_err(storage_error)?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(storage_error)?;
                Ok(KnowledgeUnitInfo {
                    id,
                    project_id,
                    initialization_id,
                    derived_from_summary_id,
                    kind,
                    topic,
                    content,
                    scope,
                    status,
                    confidence,
                    schema_version,
                    sources,
                    created_at,
                })
            },
        )
        .collect()
}

fn normalize_project_initialization_guardrail(
    initialization_id: &str,
    input: ProjectInitializationGuardrailInput,
    guardrail_index: i64,
    selected_repository_ids: &HashSet<String>,
    created_at: i64,
) -> AppResult<ProjectInitializationGuardrailInfo> {
    let kind = input.kind.trim();
    if !is_supported_guardrail_kind(kind) {
        return Err(AppError::InvalidInput(format!(
            "unsupported guardrail kind: {kind}"
        )));
    }

    let repository_id = input
        .repository_id
        .map(|repository_id| repository_id.trim().to_string())
        .filter(|repository_id| !repository_id.is_empty());
    if let Some(repository_id) = &repository_id {
        if !selected_repository_ids.contains(repository_id) {
            return Err(AppError::InvalidInput(format!(
                "repository is not selected for initialization: {repository_id}"
            )));
        }
    }

    let content = input.content.trim();
    if content.is_empty() {
        return Err(AppError::InvalidInput(
            "guardrail content must not be empty".to_string(),
        ));
    }

    let path_pattern = input
        .path_pattern
        .map(|path_pattern| path_pattern.trim().to_string())
        .filter(|path_pattern| !path_pattern.is_empty());
    let scope = if repository_id.is_some() {
        "repository".to_string()
    } else {
        "project".to_string()
    };

    Ok(ProjectInitializationGuardrailInfo {
        id: Uuid::new_v4().to_string(),
        initialization_id: initialization_id.to_string(),
        repository_id,
        repository_name: None,
        repository_path: None,
        guardrail_index,
        scope,
        kind: kind.to_string(),
        path_pattern,
        content: content.to_string(),
        source: "user_interview".to_string(),
        created_at,
    })
}

fn is_supported_guardrail_kind(kind: &str) -> bool {
    matches!(
        kind,
        "fragile" | "do_not_touch" | "requires_review" | "agent_rule"
    )
}

fn build_project_initialization_summary(
    context: &ProjectInitializationSynthesisContext,
    draft: ProjectInitializationKnowledgeDraft,
    generation_engine: &str,
    created_at: i64,
) -> ProjectInitializationSummaryInfo {
    let mut summary = ProjectInitializationSummaryInfo {
        id: Uuid::new_v4().to_string(),
        initialization_id: context.initialization_id.clone(),
        status: "draft".to_string(),
        project_purpose: draft.project_purpose,
        repository_map: draft.repository_map,
        repository_roles: draft.repository_roles,
        build_test_matrix: draft.build_test_matrix,
        fragile_areas: draft.fragile_areas,
        do_not_touch_rules: draft.do_not_touch_rules,
        agent_working_rules: draft.agent_working_rules,
        open_questions: draft.open_questions,
        claims: Vec::new(),
        fact_count: context.facts.len() as i64,
        markdown_finding_count: context.findings.len() as i64,
        guardrail_count: context.guardrails.len() as i64,
        requested_model_profile_id: Some(context.model_profile.id.clone()),
        requested_model_provider_id: Some(context.model_profile.provider_id.clone()),
        requested_model_id: Some(context.model_profile.model_id.clone()),
        requested_model_tier: Some(context.model_profile.tier.as_str().to_string()),
        requested_model_parameters: context.model_profile.parameters.clone(),
        model_catalog_schema_version: Some(MODEL_CATALOG_SCHEMA_VERSION),
        knowledge_schema_version: PROJECT_KNOWLEDGE_SCHEMA_VERSION,
        generation_engine: generation_engine.to_string(),
        created_at,
        approved_at: None,
    };
    summary.claims = summary_claims(&summary);
    summary
}

fn summary_claims(
    summary: &ProjectInitializationSummaryInfo,
) -> Vec<ProjectInitializationSummaryClaimInfo> {
    [
        ("project_purpose", &summary.project_purpose),
        ("repository_map", &summary.repository_map),
        ("repository_roles", &summary.repository_roles),
        ("build_test_matrix", &summary.build_test_matrix),
        ("fragile_areas", &summary.fragile_areas),
        ("do_not_touch_rules", &summary.do_not_touch_rules),
        ("agent_working_rules", &summary.agent_working_rules),
        ("open_questions", &summary.open_questions),
    ]
    .into_iter()
    .flat_map(|(section, value)| {
        value
            .lines()
            .filter(|line| !line.trim().is_empty() && !is_markdown_heading(line))
            .enumerate()
            .map(move |(index, line)| {
                let content = line.trim().to_string();
                let identity = format!("{}\n{section}\n{index}\n{content}", summary.id);
                ProjectInitializationSummaryClaimInfo {
                    id: Uuid::new_v5(&Uuid::NAMESPACE_OID, identity.as_bytes()).to_string(),
                    section: section.to_string(),
                    claim_index: index as i64,
                    original_content: content.clone(),
                    content,
                    status: "pending".to_string(),
                    rejection_reason: None,
                }
            })
    })
    .collect()
}

fn validate_summary_section(section: &str) -> AppResult<()> {
    if matches!(
        section,
        "project_purpose"
            | "repository_map"
            | "repository_roles"
            | "build_test_matrix"
            | "fragile_areas"
            | "do_not_touch_rules"
            | "agent_working_rules"
            | "open_questions"
    ) {
        Ok(())
    } else {
        Err(AppError::InvalidInput(format!(
            "unsupported summary section: {section}"
        )))
    }
}

fn draft_section<'a>(
    draft: &'a ProjectInitializationKnowledgeDraft,
    section: &str,
) -> AppResult<&'a str> {
    match section {
        "project_purpose" => Ok(&draft.project_purpose),
        "repository_map" => Ok(&draft.repository_map),
        "repository_roles" => Ok(&draft.repository_roles),
        "build_test_matrix" => Ok(&draft.build_test_matrix),
        "fragile_areas" => Ok(&draft.fragile_areas),
        "do_not_touch_rules" => Ok(&draft.do_not_touch_rules),
        "agent_working_rules" => Ok(&draft.agent_working_rules),
        "open_questions" => Ok(&draft.open_questions),
        _ => Err(AppError::InvalidInput(format!(
            "unsupported summary section: {section}"
        ))),
    }
}

fn set_summary_section(summary: &mut ProjectInitializationSummaryInfo, section: &str, value: &str) {
    match section {
        "project_purpose" => summary.project_purpose = value.to_string(),
        "repository_map" => summary.repository_map = value.to_string(),
        "repository_roles" => summary.repository_roles = value.to_string(),
        "build_test_matrix" => summary.build_test_matrix = value.to_string(),
        "fragile_areas" => summary.fragile_areas = value.to_string(),
        "do_not_touch_rules" => summary.do_not_touch_rules = value.to_string(),
        "agent_working_rules" => summary.agent_working_rules = value.to_string(),
        "open_questions" => summary.open_questions = value.to_string(),
        _ => unreachable!("section was validated"),
    }
}

fn analyze_repository_markdown(
    initialization_id: &str,
    repository: &ProjectRepositoryInfo,
    created_at: i64,
) -> Vec<ProjectInitializationMarkdownFindingInfo> {
    markdown_paths_for_repository(&repository.path)
        .into_iter()
        .take(100)
        .flat_map(|file_path| {
            analyze_markdown_file(initialization_id, repository, &file_path, created_at)
        })
        .collect()
}

fn markdown_paths_for_repository(repository_path: &Path) -> Vec<String> {
    let is_git_repository = git_output(repository_path, &["rev-parse", "--show-toplevel"])
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty());
    let tracked_files = git_lines(repository_path, &["ls-files"]);
    let mut markdown_files = tracked_files
        .into_iter()
        .filter(|path| is_markdown_path(path) && !is_skipped_repository_path(path))
        .collect::<Vec<_>>();
    if !is_git_repository && markdown_files.is_empty() {
        markdown_files = collect_filesystem_markdown_paths(repository_path);
    }

    markdown_files.sort_by(|left, right| {
        markdown_priority(left)
            .cmp(&markdown_priority(right))
            .then_with(|| left.cmp(right))
    });
    markdown_files
}

fn analyze_markdown_file(
    initialization_id: &str,
    repository: &ProjectRepositoryInfo,
    file_path: &str,
    created_at: i64,
) -> Vec<ProjectInitializationMarkdownFindingInfo> {
    let context = MarkdownFindingContext {
        initialization_id,
        repository,
        created_at,
    };
    let absolute_path = repository.path.join(file_path);
    let metadata = match fs::metadata(&absolute_path) {
        Ok(metadata) => metadata,
        Err(_) => return Vec::new(),
    };
    if metadata.len() > 256 * 1024 {
        return Vec::new();
    }

    let content = match fs::read_to_string(&absolute_path) {
        Ok(content) => content,
        Err(_) => return Vec::new(),
    };

    let mut findings = Vec::new();
    if let Some(excerpt) = first_meaningful_excerpt(&content) {
        findings.push(build_markdown_finding(
            &context,
            file_path,
            "document",
            markdown_title(file_path, &content),
            excerpt,
            file_path,
        ));
    }

    for section in markdown_sections(&content).into_iter().take(12) {
        if let Some(category) = markdown_category(&section.heading) {
            let source = format!("{file_path}#{}", markdown_anchor(&section.heading));
            findings.push(build_markdown_finding(
                &context,
                file_path,
                category,
                section.heading,
                section_excerpt(&section.body),
                source,
            ));
        }
        if findings.len() >= 6 {
            break;
        }
    }

    findings
}

struct MarkdownFindingContext<'a> {
    initialization_id: &'a str,
    repository: &'a ProjectRepositoryInfo,
    created_at: i64,
}

fn build_markdown_finding(
    context: &MarkdownFindingContext<'_>,
    file_path: &str,
    category: &str,
    title: impl Into<String>,
    excerpt: impl Into<String>,
    source: impl Into<String>,
) -> ProjectInitializationMarkdownFindingInfo {
    ProjectInitializationMarkdownFindingInfo {
        id: Uuid::new_v4().to_string(),
        initialization_id: context.initialization_id.to_string(),
        repository_id: context.repository.id.clone(),
        repository_name: context.repository.name.clone(),
        repository_path: context.repository.path.clone(),
        file_path: file_path.to_string(),
        category: category.to_string(),
        title: title.into(),
        excerpt: excerpt.into(),
        source: source.into(),
        created_at: context.created_at,
    }
}

fn collect_filesystem_markdown_paths(repository_path: &Path) -> Vec<String> {
    let mut markdown_files = Vec::new();
    collect_filesystem_markdown_paths_inner(repository_path, repository_path, &mut markdown_files);
    markdown_files
}

fn collect_filesystem_markdown_paths_inner(
    root: &Path,
    current: &Path,
    markdown_files: &mut Vec<String>,
) {
    if markdown_files.len() >= 100 {
        return;
    }

    let entries = match fs::read_dir(current) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let relative = match relative_repository_path(root, &path) {
            Some(relative) => relative,
            None => continue,
        };
        if is_skipped_repository_path(&relative) {
            continue;
        }

        if path.is_dir() {
            collect_filesystem_markdown_paths_inner(root, &path, markdown_files);
        } else if is_markdown_path(&relative) {
            markdown_files.push(relative);
        }

        if markdown_files.len() >= 100 {
            return;
        }
    }
}

fn relative_repository_path(root: &Path, path: &Path) -> Option<String> {
    path.strip_prefix(root)
        .ok()
        .map(|relative| relative.to_string_lossy().replace('\\', "/"))
}

fn is_markdown_path(path: &str) -> bool {
    path.to_ascii_lowercase().ends_with(".md")
}

fn is_skipped_repository_path(path: &str) -> bool {
    path.split('/').any(|part| {
        matches!(
            part,
            ".git" | ".next" | "build" | "coverage" | "dist" | "node_modules" | "target" | "vendor"
        )
    })
}

fn markdown_priority(path: &str) -> u8 {
    let lower = path.to_ascii_lowercase();
    if lower == "agents.md" {
        0
    } else if lower == "readme.md" {
        1
    } else if lower == "contributing.md" {
        2
    } else if lower == "architecture.md" {
        3
    } else if lower.starts_with("docs/") {
        4
    } else {
        5
    }
}

fn markdown_title(file_path: &str, content: &str) -> String {
    content
        .lines()
        .find_map(markdown_heading_text)
        .unwrap_or_else(|| file_path.to_string())
}

fn first_meaningful_excerpt(content: &str) -> Option<String> {
    let excerpt = content
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(8)
        .collect::<Vec<_>>()
        .join(" ");
    truncate_excerpt(&excerpt)
}

#[derive(Debug)]
struct MarkdownSection {
    heading: String,
    body: Vec<String>,
}

fn markdown_sections(content: &str) -> Vec<MarkdownSection> {
    let mut sections = Vec::new();
    let mut current_heading: Option<String> = None;
    let mut current_body = Vec::new();

    for line in content.lines() {
        if let Some(heading) = markdown_heading_text(line) {
            if let Some(previous_heading) = current_heading.replace(heading) {
                sections.push(MarkdownSection {
                    heading: previous_heading,
                    body: current_body,
                });
                current_body = Vec::new();
            }
            continue;
        }

        if current_heading.is_some() {
            current_body.push(line.to_string());
        }
    }

    if let Some(heading) = current_heading {
        sections.push(MarkdownSection {
            heading,
            body: current_body,
        });
    }

    sections
}

fn markdown_heading_text(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if !trimmed.starts_with('#') {
        return None;
    }

    let heading = trimmed.trim_start_matches('#').trim();
    if heading.is_empty() {
        None
    } else {
        Some(heading.to_string())
    }
}

fn markdown_category(heading: &str) -> Option<&'static str> {
    let lower = heading.to_ascii_lowercase();
    if contains_any(
        &lower,
        &["install", "setup", "getting started", "quickstart"],
    ) {
        Some("setup")
    } else if contains_any(&lower, &["command", "script", "run", "build", "test"]) {
        Some("commands")
    } else if contains_any(&lower, &["convention", "style", "standard", "workflow"]) {
        Some("conventions")
    } else if contains_any(
        &lower,
        &[
            "warning",
            "caution",
            "important",
            "do not",
            "danger",
            "fragile",
        ],
    ) {
        Some("warnings")
    } else if contains_any(
        &lower,
        &["architecture", "design", "overview", "structure", "layout"],
    ) {
        Some("architecture")
    } else if contains_any(&lower, &["decision", "rationale", "tradeoff"]) {
        Some("decisions")
    } else if contains_any(&lower, &["contributing", "review", "release"]) {
        Some("process")
    } else {
        None
    }
}

fn contains_any(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| value.contains(needle))
}

fn section_excerpt(body: &[String]) -> String {
    let excerpt = body
        .iter()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .take(8)
        .collect::<Vec<_>>()
        .join(" ");
    truncate_excerpt(&excerpt).unwrap_or_else(|| "Heading has no body text.".to_string())
}

fn truncate_excerpt(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut excerpt = trimmed.chars().take(520).collect::<String>();
    if trimmed.chars().count() > 520 {
        excerpt.push_str("...");
    }
    Some(excerpt)
}

fn markdown_anchor(heading: &str) -> String {
    heading
        .chars()
        .filter_map(|character| {
            if character.is_ascii_alphanumeric() {
                Some(character.to_ascii_lowercase())
            } else if character.is_whitespace() || character == '-' {
                Some('-')
            } else {
                None
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn collect_repository_facts(
    initialization_id: &str,
    repository: &ProjectRepositoryInfo,
    created_at: i64,
) -> Vec<ProjectInitializationFactInfo> {
    let mut facts = vec![build_initialization_fact(
        initialization_id,
        repository,
        "repository_path",
        "Repository path",
        repository.path.to_string_lossy(),
        "project_repositories.path",
        created_at,
    )];

    let git_root = git_output(&repository.path, &["rev-parse", "--show-toplevel"]);
    let is_git_repository = git_root
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty());
    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "git_repository",
        "Git repository",
        if is_git_repository { "yes" } else { "no" },
        "git rev-parse --show-toplevel",
        created_at,
    ));

    if !is_git_repository {
        return facts;
    }

    let branch = git_output(&repository.path, &["branch", "--show-current"])
        .filter(|value| !value.trim().is_empty())
        .or_else(|| git_output(&repository.path, &["rev-parse", "--abbrev-ref", "HEAD"]))
        .unwrap_or_else(|| "unknown".to_string());
    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "git_branch",
        "Git branch",
        branch,
        "git branch --show-current",
        created_at,
    ));

    let head = git_output(&repository.path, &["rev-parse", "--short", "HEAD"])
        .unwrap_or_else(|| "unknown".to_string());
    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "git_head",
        "Git HEAD",
        head,
        "git rev-parse --short HEAD",
        created_at,
    ));

    let tracked_files = git_lines(&repository.path, &["ls-files"]);
    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "tracked_file_count",
        "Tracked files",
        tracked_files.len().to_string(),
        "git ls-files",
        created_at,
    ));

    let markdown_file_count = tracked_files
        .iter()
        .filter(|path| path.to_ascii_lowercase().ends_with(".md"))
        .count();
    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "markdown_file_count",
        "Markdown files",
        markdown_file_count.to_string(),
        "git ls-files",
        created_at,
    ));

    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "detected_manifests",
        "Detected manifests",
        detected_manifests_summary(&tracked_files),
        "git ls-files",
        created_at,
    ));

    let test_file_count = tracked_files
        .iter()
        .filter(|path| is_likely_test_file(path))
        .count();
    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "test_file_count",
        "Test files",
        test_file_count.to_string(),
        "git ls-files",
        created_at,
    ));

    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "likely_entry_points",
        "Likely entry points",
        likely_entry_points_summary(&tracked_files),
        "git ls-files",
        created_at,
    ));

    facts.push(build_initialization_fact(
        initialization_id,
        repository,
        "recent_churn",
        "Recent churn",
        recent_churn_summary(&repository.path),
        "git log --name-only --max-count=30",
        created_at,
    ));

    facts
}

fn detected_manifests_summary(tracked_files: &[String]) -> String {
    let manifest_names = [
        "package.json",
        "Cargo.toml",
        "pyproject.toml",
        "requirements.txt",
        "go.mod",
        "pom.xml",
        "build.gradle",
        "Makefile",
    ];
    let manifests = tracked_files
        .iter()
        .filter(|path| manifest_names.iter().any(|name| path.ends_with(name)))
        .take(8)
        .cloned()
        .collect::<Vec<_>>();
    if manifests.is_empty() {
        "none".to_string()
    } else {
        manifests.join(", ")
    }
}

fn is_likely_test_file(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    lower.contains("/test/")
        || lower.contains("/tests/")
        || lower.ends_with("_test.rs")
        || lower.ends_with(".test.ts")
        || lower.ends_with(".test.tsx")
        || lower.ends_with(".spec.ts")
        || lower.ends_with(".spec.tsx")
}

fn likely_entry_points_summary(tracked_files: &[String]) -> String {
    let entry_names = [
        "src/main.rs",
        "src/lib.rs",
        "src/main.ts",
        "src/main.tsx",
        "src/App.tsx",
        "main.py",
        "app.py",
        "index.ts",
        "index.tsx",
    ];
    let entry_points = tracked_files
        .iter()
        .filter(|path| entry_names.iter().any(|name| path.ends_with(name)))
        .take(8)
        .cloned()
        .collect::<Vec<_>>();
    if entry_points.is_empty() {
        "none".to_string()
    } else {
        entry_points.join(", ")
    }
}

fn build_initialization_fact(
    initialization_id: &str,
    repository: &ProjectRepositoryInfo,
    kind: &str,
    label: &str,
    value: impl Into<String>,
    source: &str,
    created_at: i64,
) -> ProjectInitializationFactInfo {
    ProjectInitializationFactInfo {
        id: Uuid::new_v4().to_string(),
        initialization_id: initialization_id.to_string(),
        repository_id: repository.id.clone(),
        repository_name: repository.name.clone(),
        repository_path: repository.path.clone(),
        kind: kind.to_string(),
        label: label.to_string(),
        value: value.into(),
        source: source.to_string(),
        created_at,
    }
}

fn git_output(repository_path: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repository_path)
        .args(args)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn git_lines(repository_path: &Path, args: &[&str]) -> Vec<String> {
    git_output(repository_path, args)
        .map(|output| {
            output
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn recent_churn_summary(repository_path: &Path) -> String {
    let mut counts = HashMap::<String, usize>::new();
    for line in git_lines(
        repository_path,
        &["log", "--name-only", "--pretty=format:", "--max-count=30"],
    ) {
        *counts.entry(line).or_default() += 1;
    }

    let mut entries = counts.into_iter().collect::<Vec<_>>();
    entries.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));

    let summary = entries
        .into_iter()
        .take(5)
        .map(|(path, count)| format!("{path} ({count})"))
        .collect::<Vec<_>>()
        .join(", ");

    if summary.is_empty() {
        "none".to_string()
    } else {
        summary
    }
}

fn require_knowledge_available_for_session(
    connection: &Connection,
    session_id: &str,
    knowledge_item_id: &str,
) -> AppResult<()> {
    let available: i64 = connection
        .query_row(
            "SELECT COUNT(*)
             FROM transcript_sessions s, knowledge_items k
             WHERE s.id = ?1
               AND k.id = ?2
               AND (k.project_id IS NULL OR k.project_id = s.project_id)",
            params![session_id, knowledge_item_id],
            |row| row.get(0),
        )
        .map_err(storage_error)?;
    if available == 0 {
        return Err(AppError::InvalidInput(
            "knowledge item is not available for this transcript session".to_string(),
        ));
    }
    Ok(())
}

fn list_attached_knowledge_items(
    connection: &Connection,
    session_id: &str,
) -> AppResult<Vec<KnowledgeItemInfo>> {
    let mut statement = connection
        .prepare(
            "SELECT k.id, k.project_id, k.title, k.body, k.kind, k.scope,
                    k.source_transcript_session_id, k.created_at, k.updated_at
             FROM transcript_knowledge_links l
             JOIN knowledge_items k ON k.id = l.knowledge_item_id
             WHERE l.transcript_session_id = ?1
             ORDER BY l.created_at ASC, k.title ASC",
        )
        .map_err(storage_error)?;
    let items = statement
        .query_map(params![session_id], knowledge_item_from_row)
        .map_err(storage_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage_error)?;

    Ok(items)
}

fn insert_project_repository(
    connection: &Connection,
    repository: ProjectRepositoryInfo,
) -> AppResult<()> {
    let path_text = repository.path.to_string_lossy().to_string();
    connection
        .execute(
            "INSERT INTO project_repositories
             (id, project_id, name, path, is_default, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                &repository.id,
                &repository.project_id,
                &repository.name,
                path_text,
                if repository.is_default { 1 } else { 0 },
                repository.created_at,
                repository.updated_at
            ],
        )
        .map_err(|err| {
            if is_unique_constraint(&err) {
                AppError::InvalidInput("repository path already exists".to_string())
            } else {
                storage_error(err)
            }
        })?;
    Ok(())
}

fn resolve_project_path(path: &Path) -> AppResult<PathBuf> {
    if !path.is_dir() {
        return Err(AppError::InvalidInput(format!(
            "project path is not a directory: {}",
            path.display()
        )));
    }
    Ok(path.canonicalize()?)
}

fn unix_timestamp() -> AppResult<i64> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| AppError::Storage(err.to_string()))?;
    Ok(duration.as_secs() as i64)
}

fn is_unique_constraint(err: &rusqlite::Error) -> bool {
    matches!(
        err,
        rusqlite::Error::SqliteFailure(error, _)
            if error.code == rusqlite::ErrorCode::ConstraintViolation
    )
}

fn storage_error(err: rusqlite::Error) -> AppError {
    AppError::Storage(err.to_string())
}

fn json_string_list_from_row(
    row: &rusqlite::Row<'_>,
    index: usize,
) -> rusqlite::Result<Vec<String>> {
    let json: String = row.get(index)?;
    serde_json::from_str(&json).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(index, Type::Text, Box::new(error))
    })
}

fn json_string_list(values: &[String]) -> AppResult<String> {
    serde_json::to_string(values).map_err(|error| AppError::Storage(error.to_string()))
}

fn path_matches_step_scope(path: &str, expected_paths: &[String]) -> bool {
    let path = path.trim().trim_start_matches("./").trim_start_matches('/');
    expected_paths.iter().any(|expected| {
        let expected = expected
            .trim()
            .trim_start_matches("./")
            .trim_start_matches('/')
            .trim_end_matches('/');
        !expected.is_empty()
            && (path == expected
                || path
                    .strip_prefix(expected)
                    .is_some_and(|suffix| suffix.starts_with('/')))
    })
}

fn normalized_non_empty(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    values
        .into_iter()
        .filter_map(|value| {
            let value = value.trim().to_string();
            (!value.is_empty() && seen.insert(value.clone())).then_some(value)
        })
        .collect()
}

struct TaskComplexityChangeInput<'a> {
    task_id: &'a str,
    sequence: i64,
    profile: &'a str,
    reasons_json: &'a str,
    confidence: Option<i64>,
    source: &'a str,
    assessment_version: &'a str,
    created_at: i64,
}

fn insert_task_complexity_change(
    connection: &Connection,
    input: TaskComplexityChangeInput<'_>,
) -> AppResult<()> {
    connection
        .execute(
            "INSERT INTO task_complexity_changes
             (id, task_id, sequence, profile, reasons_json, confidence, source,
              assessment_version, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                Uuid::new_v4().to_string(),
                input.task_id,
                input.sequence,
                input.profile,
                input.reasons_json,
                input.confidence,
                input.source,
                input.assessment_version,
                input.created_at,
            ],
        )
        .map_err(storage_error)?;
    Ok(())
}

fn ensure_table_column(
    connection: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> AppResult<()> {
    let mut statement = connection
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(storage_error)?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(storage_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage_error)?;
    drop(statement);

    if columns.iter().any(|candidate| candidate == column) {
        return Ok(());
    }

    connection
        .execute(
            &format!("ALTER TABLE {table} ADD COLUMN {column} {definition}"),
            [],
        )
        .map_err(storage_error)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::DEFAULT_SYNTHESIS_MODEL_PROFILE_ID;
    use crate::synthesis::OPENAI_RESPONSES_GENERATION_ENGINE;

    fn test_knowledge_draft() -> ProjectInitializationKnowledgeDraft {
        ProjectInitializationKnowledgeDraft {
            project_purpose: "AIadne controls coding-agent workflows [source: README.md#aiadne]"
                .to_string(),
            repository_map:
                "- AIadne: selected application repository [source: project_repositories.path]"
                    .to_string(),
            repository_roles: "- AIadne: agent control application [source: README.md#aiadne]"
                .to_string(),
            build_test_matrix: "- Run Commands checks [source: README.md#commands]".to_string(),
            fragile_areas: "- Do not edit generated files [source: README.md#important]"
                .to_string(),
            do_not_touch_rules: "- src/generated/** is protected [source: user_interview]"
                .to_string(),
            agent_working_rules: "- Ask before schema changes [source: user_interview]".to_string(),
            open_questions: "- Needs confirmation: Confirm repository role with the user."
                .to_string(),
        }
    }

    fn review_summary_for_approval(
        store: &ProjectStore,
        summary: &ProjectInitializationSummaryInfo,
    ) -> ProjectInitializationSummaryInfo {
        let mut reviewed = summary.clone();
        for claim in &summary.claims {
            reviewed = store
                .review_project_initialization_summary_claim(
                    ReviewProjectInitializationSummaryClaimRequest {
                        summary_id: summary.id.clone(),
                        claim_id: claim.id.clone(),
                        status: if claim.section == "open_questions" {
                            "deferred"
                        } else {
                            "accepted"
                        }
                        .to_string(),
                        content: claim.content.clone(),
                        rejection_reason: None,
                    },
                )
                .expect("claim reviewed");
        }
        reviewed
    }

    #[test]
    fn recognizes_only_atx_markdown_headings_as_structure() {
        for heading in ["# Purpose", "## Needs confirmation", "   ###### Rules", "#"] {
            assert!(is_markdown_heading(heading), "expected heading: {heading}");
        }
        for claim in [
            "#include <stdio.h>",
            "####### Too deep",
            "- # tagged claim",
            "Purpose",
        ] {
            assert!(!is_markdown_heading(claim), "expected claim: {claim}");
        }
    }

    #[test]
    fn creates_lists_and_deletes_projects() {
        let store = ProjectStore::in_memory().expect("store opens");
        let path = std::env::current_dir().expect("current dir exists");

        let project = store
            .create_project(CreateProjectRequest {
                name: "  AIadne  ".to_string(),
                path: path.clone(),
            })
            .expect("project created");
        let projects = store.list_projects().expect("projects list");

        assert_eq!(projects, vec![project.clone()]);
        assert_eq!(project.name, "AIadne");
        assert_eq!(
            project.path,
            path.canonicalize().expect("path canonicalizes")
        );

        store.delete_project(&project.id).expect("project deleted");
        assert!(store.list_projects().expect("projects list").is_empty());
    }

    #[test]
    fn rejects_invalid_project_input() {
        let store = ProjectStore::in_memory().expect("store opens");

        let empty_name = store
            .create_project(CreateProjectRequest {
                name: " ".to_string(),
                path: std::env::current_dir().expect("current dir exists"),
            })
            .expect_err("empty name rejected");
        assert!(matches!(empty_name, AppError::InvalidInput(_)));

        let missing_path = store
            .create_project(CreateProjectRequest {
                name: "Missing".to_string(),
                path: PathBuf::from("/definitely/not/a/project"),
            })
            .expect_err("missing path rejected");
        assert!(matches!(missing_path, AppError::InvalidInput(_)));
    }

    #[test]
    fn rejects_duplicate_project_paths() {
        let store = ProjectStore::in_memory().expect("store opens");
        let path = std::env::current_dir().expect("current dir exists");

        store
            .create_project(CreateProjectRequest {
                name: "One".to_string(),
                path: path.clone(),
            })
            .expect("project created");
        let duplicate = store
            .create_project(CreateProjectRequest {
                name: "Two".to_string(),
                path,
            })
            .expect_err("duplicate rejected");

        assert!(matches!(duplicate, AppError::InvalidInput(_)));
        assert!(duplicate.to_string().contains("already exists"));
    }

    #[test]
    fn creates_lists_and_deletes_project_repositories() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project_path = temp_project_path("project-root");
        let extra_path = temp_project_path("project-api");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: project_path.clone(),
            })
            .expect("project created");

        let initial_repositories = store
            .list_project_repositories(&project.id)
            .expect("repositories listed");
        assert_eq!(initial_repositories.len(), 1);
        assert_eq!(initial_repositories[0].project_id, project.id);
        assert_eq!(initial_repositories[0].name, "AIadne");
        assert_eq!(
            initial_repositories[0].path,
            project_path.canonicalize().expect("path canonicalizes")
        );
        assert!(initial_repositories[0].is_default);

        let extra = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: project.id.clone(),
                name: "  API  ".to_string(),
                path: extra_path.clone(),
            })
            .expect("repository created");
        assert_eq!(extra.name, "API");
        assert_eq!(extra.project_id, project.id);
        assert_eq!(
            extra.path,
            extra_path.canonicalize().expect("path canonicalizes")
        );
        assert!(!extra.is_default);

        let repositories = store
            .list_project_repositories(&project.id)
            .expect("repositories listed");
        assert_eq!(repositories.len(), 2);
        assert_eq!(repositories[0].name, "AIadne");
        assert_eq!(repositories[1].name, "API");

        store
            .delete_project_repository(&extra.id)
            .expect("repository deleted");
        let remaining = store
            .list_project_repositories(&project.id)
            .expect("repositories listed");
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].name, "AIadne");

        store.delete_project(&project.id).expect("project deleted");
        let missing_project = store
            .list_project_repositories(&project.id)
            .expect_err("deleted project rejected");
        assert!(matches!(missing_project, AppError::InvalidInput(_)));
    }

    #[test]
    fn rejects_invalid_project_repository_input() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project_path = temp_project_path("repo-project");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: project_path.clone(),
            })
            .expect("project created");

        let missing_project = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: "missing-project".to_string(),
                name: "Repo".to_string(),
                path: temp_project_path("missing-project-repo"),
            })
            .expect_err("missing project rejected");
        assert!(matches!(missing_project, AppError::InvalidInput(_)));

        let empty_name = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: project.id.clone(),
                name: " ".to_string(),
                path: temp_project_path("empty-name-repo"),
            })
            .expect_err("empty name rejected");
        assert!(matches!(empty_name, AppError::InvalidInput(_)));

        let missing_path = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: project.id.clone(),
                name: "Missing path".to_string(),
                path: PathBuf::from("/definitely/not/a/repository"),
            })
            .expect_err("missing path rejected");
        assert!(matches!(missing_path, AppError::InvalidInput(_)));

        let duplicate = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: project.id,
                name: "Duplicate".to_string(),
                path: project_path,
            })
            .expect_err("duplicate path rejected");
        assert!(matches!(duplicate, AppError::InvalidInput(_)));
        assert!(duplicate.to_string().contains("already exists"));
    }

    #[test]
    fn creates_project_initialization_with_selected_repositories() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("init-project"),
            })
            .expect("project created");
        let default_repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .remove(0);
        let api_repository = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: project.id.clone(),
                name: "API".to_string(),
                path: temp_project_path("init-api"),
            })
            .expect("repository created");

        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id.clone(),
                repository_ids: vec![default_repository.id, api_repository.id],
            })
            .expect("initialization created");

        assert_eq!(initialization.project_id, project.id);
        assert_eq!(initialization.status, "preflight");
        assert_eq!(initialization.repository_count, 2);

        let listed = store
            .list_project_initializations(&project.id)
            .expect("initializations listed");
        assert_eq!(listed, vec![initialization]);
    }

    #[test]
    fn collects_non_git_project_initialization_facts() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("facts-non-git"),
            })
            .expect("project created");
        let repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .remove(0);
        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id.clone(),
                repository_ids: vec![repository.id.clone()],
            })
            .expect("initialization created");

        let facts = store
            .collect_project_initialization_facts(&initialization.id)
            .expect("facts collected");

        assert_eq!(facts.len(), 2);
        assert!(facts.iter().all(|fact| fact.repository_id == repository.id));
        assert!(facts.iter().any(|fact| {
            fact.kind == "repository_path" && fact.value == repository.path.to_string_lossy()
        }));
        assert!(facts
            .iter()
            .any(|fact| fact.kind == "git_repository" && fact.value == "no"));
        assert!(!facts.iter().any(|fact| fact.kind == "git_branch"));

        let listed_facts = store
            .list_project_initialization_facts(&initialization.id)
            .expect("facts listed");
        assert_eq!(listed_facts.len(), facts.len());
        let listed_initialization = store
            .list_project_initializations(&project.id)
            .expect("initializations listed")
            .remove(0);
        assert_eq!(listed_initialization.status, "facts");
    }

    #[test]
    fn collects_git_project_initialization_facts_for_selected_repositories() {
        if !git_available_for_tests() {
            return;
        }

        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("facts-project-root"),
            })
            .expect("project created");
        let git_repository_path = temp_project_path("facts-git-repo");
        initialize_git_repository_for_tests(&git_repository_path);
        let selected_repository = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: project.id.clone(),
                name: "Git repo".to_string(),
                path: git_repository_path,
            })
            .expect("git repository created");
        let unselected_repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .into_iter()
            .find(|repository| repository.is_default)
            .expect("default repository exists");
        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id.clone(),
                repository_ids: vec![selected_repository.id.clone()],
            })
            .expect("initialization created");

        let facts = store
            .collect_project_initialization_facts(&initialization.id)
            .expect("facts collected");

        assert!(facts
            .iter()
            .all(|fact| fact.repository_id == selected_repository.id));
        assert!(!facts
            .iter()
            .any(|fact| fact.repository_id == unselected_repository.id));
        assert!(facts
            .iter()
            .any(|fact| fact.kind == "git_repository" && fact.value == "yes"));
        assert!(facts
            .iter()
            .any(|fact| fact.kind == "tracked_file_count" && fact.value == "2"));
        assert!(facts
            .iter()
            .any(|fact| fact.kind == "markdown_file_count" && fact.value == "1"));
        assert!(facts
            .iter()
            .any(|fact| fact.kind == "likely_entry_points" && fact.value.contains("src/lib.rs")));
        assert!(facts
            .iter()
            .any(|fact| fact.kind == "recent_churn" && fact.value.contains("README.md")));
    }

    #[test]
    fn analyzes_git_tracked_markdown_for_selected_repositories() {
        if !git_available_for_tests() {
            return;
        }

        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("markdown-project-root"),
            })
            .expect("project created");
        let git_repository_path = temp_project_path("markdown-git-repo");
        initialize_git_repository_for_tests(&git_repository_path);
        fs::write(
            git_repository_path.join("README.md"),
            "# AIadne\n\n## Setup\nRun npm install before starting.\n\n## Commands\nUse npm test for checks.\n\n## Architecture\nThe frontend calls Tauri commands.\n",
        )
        .expect("README updated");
        run_git_for_tests(&git_repository_path, &["add", "README.md"]);
        run_git_for_tests(
            &git_repository_path,
            &[
                "-c",
                "user.email=test@example.com",
                "-c",
                "user.name=AIadne Test",
                "commit",
                "-m",
                "add docs",
            ],
        );
        let selected_repository = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: project.id.clone(),
                name: "Docs repo".to_string(),
                path: git_repository_path,
            })
            .expect("repository created");
        let unselected_repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .into_iter()
            .find(|repository| repository.is_default)
            .expect("default repository exists");
        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id.clone(),
                repository_ids: vec![selected_repository.id.clone()],
            })
            .expect("initialization created");

        let findings = store
            .analyze_project_initialization_markdown(&initialization.id)
            .expect("markdown analyzed");

        assert!(findings
            .iter()
            .all(|finding| finding.repository_id == selected_repository.id));
        assert!(!findings
            .iter()
            .any(|finding| finding.repository_id == unselected_repository.id));
        assert!(findings.iter().any(|finding| {
            finding.file_path == "README.md"
                && finding.category == "setup"
                && finding.excerpt.contains("npm install")
                && finding.source == "README.md#setup"
        }));
        assert!(findings
            .iter()
            .any(|finding| finding.category == "architecture"));
        let listed_findings = store
            .list_project_initialization_markdown_findings(&initialization.id)
            .expect("markdown findings listed");
        assert_eq!(listed_findings.len(), findings.len());
        let listed_initialization = store
            .list_project_initializations(&project.id)
            .expect("initializations listed")
            .remove(0);
        assert_eq!(listed_initialization.status, "markdown");
    }

    #[test]
    fn analyzes_non_git_markdown_with_bounded_skip_rules() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project_path = temp_project_path("markdown-non-git");
        fs::write(
            project_path.join("README.md"),
            "# Non Git\n\n## Important\nDo not edit generated files.\n",
        )
        .expect("README written");
        fs::create_dir_all(project_path.join("node_modules")).expect("node_modules dir created");
        fs::write(
            project_path.join("node_modules").join("README.md"),
            "# Vendor\n\n## Setup\nIgnore me.\n",
        )
        .expect("vendor README written");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: project_path,
            })
            .expect("project created");
        let repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .remove(0);
        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id,
                repository_ids: vec![repository.id],
            })
            .expect("initialization created");

        let findings = store
            .analyze_project_initialization_markdown(&initialization.id)
            .expect("markdown analyzed");

        assert!(findings
            .iter()
            .any(|finding| finding.file_path == "README.md" && finding.category == "warnings"));
        assert!(!findings
            .iter()
            .any(|finding| finding.file_path.contains("node_modules")));
    }

    #[test]
    fn saves_project_initialization_guardrails() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("guardrails-project"),
            })
            .expect("project created");
        let default_repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .remove(0);
        let ui_repository = store
            .create_project_repository(CreateProjectRepositoryRequest {
                project_id: project.id.clone(),
                name: "UI".to_string(),
                path: temp_project_path("guardrails-ui"),
            })
            .expect("repository created");
        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id.clone(),
                repository_ids: vec![default_repository.id.clone(), ui_repository.id.clone()],
            })
            .expect("initialization created");

        let guardrails = store
            .save_project_initialization_guardrails(SaveProjectInitializationGuardrailsRequest {
                initialization_id: initialization.id.clone(),
                guardrails: vec![
                    ProjectInitializationGuardrailInput {
                        repository_id: None,
                        kind: "agent_rule".to_string(),
                        path_pattern: None,
                        content: "Always ask before schema changes.".to_string(),
                    },
                    ProjectInitializationGuardrailInput {
                        repository_id: Some(ui_repository.id.clone()),
                        kind: "do_not_touch".to_string(),
                        path_pattern: Some("src/generated/**".to_string()),
                        content: "Generated UI files are overwritten by tooling.".to_string(),
                    },
                ],
            })
            .expect("guardrails saved");

        assert_eq!(guardrails.len(), 2);
        assert_eq!(guardrails[0].scope, "project");
        assert_eq!(guardrails[0].kind, "agent_rule");
        assert_eq!(guardrails[0].source, "user_interview");
        assert_eq!(guardrails[1].scope, "repository");
        assert_eq!(
            guardrails[1].repository_id.as_deref(),
            Some(ui_repository.id.as_str())
        );
        assert_eq!(guardrails[1].repository_name.as_deref(), Some("UI"));
        assert_eq!(
            guardrails[1].path_pattern.as_deref(),
            Some("src/generated/**")
        );

        let listed_guardrails = store
            .list_project_initialization_guardrails(&initialization.id)
            .expect("guardrails listed");
        assert_eq!(listed_guardrails, guardrails);
        let listed_initialization = store
            .list_project_initializations(&project.id)
            .expect("initializations listed")
            .remove(0);
        assert_eq!(listed_initialization.status, "interview");
    }

    #[test]
    fn rejects_invalid_project_initialization_guardrails() {
        let store = ProjectStore::in_memory().expect("store opens");
        let first_project = store
            .create_project(CreateProjectRequest {
                name: "One".to_string(),
                path: temp_project_path("guardrails-one"),
            })
            .expect("first project created");
        let second_project = store
            .create_project(CreateProjectRequest {
                name: "Two".to_string(),
                path: temp_project_path("guardrails-two"),
            })
            .expect("second project created");
        let first_repository = store
            .list_project_repositories(&first_project.id)
            .expect("first repositories listed")
            .remove(0);
        let second_repository = store
            .list_project_repositories(&second_project.id)
            .expect("second repositories listed")
            .remove(0);
        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: first_project.id,
                repository_ids: vec![first_repository.id],
            })
            .expect("initialization created");

        let empty = store
            .save_project_initialization_guardrails(SaveProjectInitializationGuardrailsRequest {
                initialization_id: initialization.id.clone(),
                guardrails: vec![],
            })
            .expect_err("empty guardrails rejected");
        assert!(matches!(empty, AppError::InvalidInput(_)));

        let unsupported_kind = store
            .save_project_initialization_guardrails(SaveProjectInitializationGuardrailsRequest {
                initialization_id: initialization.id.clone(),
                guardrails: vec![ProjectInitializationGuardrailInput {
                    repository_id: None,
                    kind: "generated_fact".to_string(),
                    path_pattern: None,
                    content: "Wrong source.".to_string(),
                }],
            })
            .expect_err("unsupported kind rejected");
        assert!(matches!(unsupported_kind, AppError::InvalidInput(_)));

        let blank_content = store
            .save_project_initialization_guardrails(SaveProjectInitializationGuardrailsRequest {
                initialization_id: initialization.id.clone(),
                guardrails: vec![ProjectInitializationGuardrailInput {
                    repository_id: None,
                    kind: "agent_rule".to_string(),
                    path_pattern: None,
                    content: " ".to_string(),
                }],
            })
            .expect_err("blank content rejected");
        assert!(matches!(blank_content, AppError::InvalidInput(_)));

        let unselected_repository = store
            .save_project_initialization_guardrails(SaveProjectInitializationGuardrailsRequest {
                initialization_id: initialization.id,
                guardrails: vec![ProjectInitializationGuardrailInput {
                    repository_id: Some(second_repository.id),
                    kind: "do_not_touch".to_string(),
                    path_pattern: Some("src/**".to_string()),
                    content: "Wrong project.".to_string(),
                }],
            })
            .expect_err("unselected repository rejected");
        assert!(matches!(unselected_repository, AppError::InvalidInput(_)));
    }

    #[test]
    fn generates_project_initialization_summary_draft() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project_path = temp_project_path("summary-draft-project");
        fs::write(
            project_path.join("README.md"),
            "# AIadne\n\nProject controls CLI agents.\n\n## Commands\nRun npm test for checks.\n\n## Important\nDo not edit generated files.\n",
        )
        .expect("README written");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: project_path,
            })
            .expect("project created");
        let repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .remove(0);
        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id.clone(),
                repository_ids: vec![repository.id.clone()],
            })
            .expect("initialization created");
        store
            .collect_project_initialization_facts(&initialization.id)
            .expect("facts collected");
        store
            .analyze_project_initialization_markdown(&initialization.id)
            .expect("markdown analyzed");
        store
            .save_project_initialization_guardrails(SaveProjectInitializationGuardrailsRequest {
                initialization_id: initialization.id.clone(),
                guardrails: vec![
                    ProjectInitializationGuardrailInput {
                        repository_id: None,
                        kind: "agent_rule".to_string(),
                        path_pattern: None,
                        content: "Always ask before schema changes.".to_string(),
                    },
                    ProjectInitializationGuardrailInput {
                        repository_id: Some(repository.id.clone()),
                        kind: "do_not_touch".to_string(),
                        path_pattern: Some("src/generated/**".to_string()),
                        content: "Generated files are overwritten by tooling.".to_string(),
                    },
                ],
            })
            .expect("guardrails saved");

        let context = store
            .prepare_project_initialization_synthesis(GenerateProjectInitializationSummaryRequest {
                initialization_id: initialization.id.clone(),
                model_profile_id: DEFAULT_SYNTHESIS_MODEL_PROFILE_ID.to_string(),
            })
            .expect("synthesis prepared");
        let summary = store
            .persist_project_initialization_summary(
                &context,
                test_knowledge_draft(),
                OPENAI_RESPONSES_GENERATION_ENGINE,
            )
            .expect("summary persisted");
        assert_eq!(summary.status, "draft");
        assert!(summary.project_purpose.contains("AIadne"));
        assert!(summary.repository_map.contains("AIadne"));
        assert!(summary.build_test_matrix.contains("Commands"));
        assert!(summary
            .fragile_areas
            .contains("Do not edit generated files"));
        assert!(summary.do_not_touch_rules.contains("src/generated/**"));
        assert!(summary.agent_working_rules.contains("schema changes"));
        assert!(summary.open_questions.contains("Confirm repository role"));
        assert_eq!(summary.fact_count, 2);
        assert_eq!(summary.guardrail_count, 2);
        assert!(summary.markdown_finding_count >= 3);
        assert_eq!(
            summary.requested_model_profile_id.as_deref(),
            Some(DEFAULT_SYNTHESIS_MODEL_PROFILE_ID)
        );
        assert_eq!(
            summary.requested_model_provider_id.as_deref(),
            Some("openai")
        );
        assert_eq!(summary.requested_model_id.as_deref(), Some("gpt-5.6-terra"));
        assert_eq!(summary.requested_model_tier.as_deref(), Some("mid"));
        assert_eq!(
            summary.requested_model_parameters,
            vec![ModelParameterInfo {
                name: "reasoning.effort".to_string(),
                value: "medium".to_string(),
            }]
        );
        assert_eq!(
            summary.model_catalog_schema_version,
            Some(MODEL_CATALOG_SCHEMA_VERSION)
        );
        assert_eq!(
            summary.knowledge_schema_version,
            PROJECT_KNOWLEDGE_SCHEMA_VERSION
        );
        assert_eq!(
            summary.generation_engine,
            OPENAI_RESPONSES_GENERATION_ENGINE
        );
        assert_eq!(summary.approved_at, None);

        let listed_summary = store
            .list_project_initialization_summary(&initialization.id)
            .expect("summary listed")
            .expect("summary exists");
        assert_eq!(listed_summary, summary);
        let listed_initialization = store
            .list_project_initializations(&project.id)
            .expect("initializations listed")
            .remove(0);
        assert_eq!(listed_initialization.status, "summary");
    }

    #[test]
    fn autopilot_approves_and_publishes_project_initialization_summary_atomically() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("autopilot-summary-approval"),
            })
            .expect("project created");
        let repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .remove(0);
        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id,
                repository_ids: vec![repository.id],
            })
            .expect("initialization created");
        let context = store
            .prepare_project_initialization_synthesis(GenerateProjectInitializationSummaryRequest {
                initialization_id: initialization.id.clone(),
                model_profile_id: DEFAULT_SYNTHESIS_MODEL_PROFILE_ID.to_string(),
            })
            .expect("synthesis prepared");
        let summary = store
            .persist_project_initialization_summary(
                &context,
                test_knowledge_draft(),
                OPENAI_RESPONSES_GENERATION_ENGINE,
            )
            .expect("summary persisted");

        let approved = store
            .approve_project_initialization_summary_autopilot(&summary.id)
            .expect("autopilot approves summary");
        assert_eq!(approved.status, "approved");
        assert!(approved.approved_at.is_some());
        assert!(approved.claims.iter().all(|claim| claim.status
            == if claim.section == "open_questions" {
                "deferred"
            } else {
                "accepted"
            }));
        let units = store
            .list_project_initialization_knowledge_units(&initialization.id)
            .expect("knowledge units listed");
        assert_eq!(units.len(), 7);
        assert!(units.iter().all(|unit| unit.status == "active"));
        let repeated = store
            .approve_project_initialization_summary_autopilot(&summary.id)
            .expect_err("approved summary remains immutable");
        assert!(matches!(repeated, AppError::InvalidInput(_)));
    }

    #[test]
    fn approves_project_initialization_summary() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("summary-approval-project"),
            })
            .expect("project created");
        let repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .remove(0);
        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id,
                repository_ids: vec![repository.id],
            })
            .expect("initialization created");
        let context = store
            .prepare_project_initialization_synthesis(GenerateProjectInitializationSummaryRequest {
                initialization_id: initialization.id.clone(),
                model_profile_id: "openai-gpt-5.6-sol-high".to_string(),
            })
            .expect("synthesis prepared");
        let mut draft = test_knowledge_draft();
        draft.project_purpose = format!("## Project purpose\n{}", draft.project_purpose);
        draft.open_questions = format!("## Needs confirmation\n{}", draft.open_questions);
        let summary = store
            .persist_project_initialization_summary(
                &context,
                draft,
                OPENAI_RESPONSES_GENERATION_ENGINE,
            )
            .expect("summary persisted");
        let pending_error = store
            .approve_project_initialization_summary(&summary.id)
            .expect_err("pending claims block approval");
        assert!(matches!(pending_error, AppError::InvalidInput(_)));
        let first_claim = summary.claims.first().expect("summary has claims");
        let rejection_error = store
            .review_project_initialization_summary_claim(
                ReviewProjectInitializationSummaryClaimRequest {
                    summary_id: summary.id.clone(),
                    claim_id: first_claim.id.clone(),
                    status: "rejected".to_string(),
                    content: first_claim.content.clone(),
                    rejection_reason: None,
                },
            )
            .expect_err("rejection reason required");
        assert!(matches!(rejection_error, AppError::InvalidInput(_)));
        let reviewed = store
            .prepare_project_initialization_summary_autopilot(&summary.id)
            .expect("autopilot prepares summary");
        assert!(reviewed.claims.iter().all(|claim| {
            claim.status
                == if claim.section == "open_questions" {
                    "deferred"
                } else {
                    "accepted"
                }
        }));
        let purpose_claim = reviewed
            .claims
            .iter()
            .find(|claim| claim.section == "project_purpose")
            .expect("purpose claim")
            .clone();
        let mut regenerated_draft = test_knowledge_draft();
        regenerated_draft.repository_map =
            "- AIadne: regenerated repository map [source: project_repositories.path]".to_string();
        let regenerated = store
            .persist_project_initialization_summary_section(
                &context,
                &reviewed,
                "repository_map",
                regenerated_draft,
                OPENAI_RESPONSES_GENERATION_ENGINE,
            )
            .expect("section regenerated");
        assert_eq!(regenerated.project_purpose, reviewed.project_purpose);
        assert!(regenerated
            .claims
            .iter()
            .any(|claim| claim.id == purpose_claim.id && claim.status == "accepted"));
        assert!(regenerated
            .claims
            .iter()
            .filter(|claim| claim.section == "repository_map")
            .all(|claim| claim.status == "pending"));
        let summary = review_summary_for_approval(&store, &regenerated);

        let approved = store
            .approve_project_initialization_summary(&summary.id)
            .expect("summary approved");

        assert_eq!(approved.id, summary.id);
        assert_eq!(approved.status, "approved");
        assert!(approved.approved_at.is_some());
        let autopilot_error = store
            .prepare_project_initialization_summary_autopilot(&summary.id)
            .expect_err("approved summary remains immutable");
        assert!(matches!(autopilot_error, AppError::InvalidInput(_)));
        store
            .connection()
            .expect("connection")
            .execute(
                "UPDATE project_initialization_summaries SET claims_json = '[]' WHERE id = ?1",
                params![summary.id],
            )
            .expect("legacy approved claims simulated");
        let listed_summary = store
            .list_project_initialization_summary(&initialization.id)
            .expect("summary listed")
            .expect("summary exists");
        assert_eq!(listed_summary.status, "approved");
        assert!(listed_summary.claims.iter().all(|claim| {
            claim.status
                == if claim.section == "open_questions" {
                    "deferred"
                } else {
                    "accepted"
                }
        }));
        assert_eq!(
            listed_summary.requested_model_profile_id.as_deref(),
            Some("openai-gpt-5.6-sol-high")
        );
        assert_eq!(listed_summary.requested_model_tier.as_deref(), Some("high"));

        let units = store
            .list_project_initialization_knowledge_units(&initialization.id)
            .expect("knowledge units listed");
        assert_eq!(units.len(), 7);
        assert!(units.iter().all(|unit| !unit.content.starts_with('#')));
        assert!(units.iter().all(|unit| {
            unit.derived_from_summary_id == summary.id
                && unit.schema_version == PROJECT_KNOWLEDGE_SCHEMA_VERSION
        }));
        let purpose = units
            .iter()
            .find(|unit| unit.topic == "project_purpose")
            .expect("purpose unit exists");
        assert_eq!(purpose.kind, "purpose");
        assert_eq!(purpose.status, "active");
        assert_eq!(purpose.confidence, 100);
        assert_eq!(purpose.content, "AIadne controls coding-agent workflows");
        assert_eq!(
            purpose.sources,
            vec![KnowledgeUnitSourceInfo {
                source_key: "README.md#aiadne".to_string(),
                repository_id: None,
                path: None,
            }]
        );
        assert!(units.iter().all(|unit| unit.topic != "open_questions"));

        let initial_ids = units.iter().map(|unit| unit.id.clone()).collect::<Vec<_>>();
        store
            .approve_project_initialization_summary(&summary.id)
            .expect("reapproval succeeds");
        let repeated_ids = store
            .list_project_initialization_knowledge_units(&initialization.id)
            .expect("knowledge units relisted")
            .into_iter()
            .map(|unit| unit.id)
            .collect::<Vec<_>>();
        assert_eq!(repeated_ids, initial_ids);

        let missing = store
            .approve_project_initialization_summary("missing-summary")
            .expect_err("missing summary rejected");
        assert!(matches!(missing, AppError::InvalidInput(_)));
    }

    #[test]
    fn rejects_uncited_claim_during_summary_approval_without_publishing_units() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("summary-unit-validation"),
            })
            .expect("project created");
        let repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .remove(0);
        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id,
                repository_ids: vec![repository.id],
            })
            .expect("initialization created");
        let context = store
            .prepare_project_initialization_synthesis(GenerateProjectInitializationSummaryRequest {
                initialization_id: initialization.id.clone(),
                model_profile_id: DEFAULT_SYNTHESIS_MODEL_PROFILE_ID.to_string(),
            })
            .expect("synthesis prepared");
        let mut draft = test_knowledge_draft();
        draft
            .project_purpose
            .push_str("\n- This second claim has no source");
        let summary = store
            .persist_project_initialization_summary(
                &context,
                draft,
                OPENAI_RESPONSES_GENERATION_ENGINE,
            )
            .expect("section-valid summary persisted");
        let summary = review_summary_for_approval(&store, &summary);

        let error = store
            .approve_project_initialization_summary(&summary.id)
            .expect_err("uncited unit rejected");
        assert!(matches!(error, AppError::InvalidInput(_)));
        assert_eq!(
            store
                .list_project_initialization_summary(&initialization.id)
                .expect("summary listed")
                .expect("summary exists")
                .status,
            "draft"
        );
        assert!(store
            .list_project_initialization_knowledge_units(&initialization.id)
            .expect("knowledge units listed")
            .is_empty());
    }

    #[test]
    fn rejects_unknown_or_empty_summary_model_profiles() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("summary-model-validation"),
            })
            .expect("project created");
        let repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .remove(0);
        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id,
                repository_ids: vec![repository.id],
            })
            .expect("initialization created");

        for model_profile_id in ["", "unknown-profile"] {
            let error = store
                .prepare_project_initialization_synthesis(
                    GenerateProjectInitializationSummaryRequest {
                        initialization_id: initialization.id.clone(),
                        model_profile_id: model_profile_id.to_string(),
                    },
                )
                .expect_err("invalid model profile rejected");
            assert!(matches!(error, AppError::InvalidInput(_)));
        }

        assert!(store
            .list_project_initialization_summary(&initialization.id)
            .expect("summary checked")
            .is_none());
    }

    #[test]
    fn invalid_synthesis_output_preserves_previous_summary() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("summary-atomic-replacement"),
            })
            .expect("project created");
        let repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .remove(0);
        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id,
                repository_ids: vec![repository.id],
            })
            .expect("initialization created");
        let context = store
            .prepare_project_initialization_synthesis(GenerateProjectInitializationSummaryRequest {
                initialization_id: initialization.id.clone(),
                model_profile_id: DEFAULT_SYNTHESIS_MODEL_PROFILE_ID.to_string(),
            })
            .expect("synthesis prepared");
        let original = store
            .persist_project_initialization_summary(
                &context,
                test_knowledge_draft(),
                OPENAI_RESPONSES_GENERATION_ENGINE,
            )
            .expect("initial summary persisted");
        let mut invalid = test_knowledge_draft();
        invalid.project_purpose = " ".to_string();

        let error = store
            .persist_project_initialization_summary(
                &context,
                invalid,
                OPENAI_RESPONSES_GENERATION_ENGINE,
            )
            .expect_err("invalid model output rejected");
        assert!(matches!(error, AppError::Synthesis(_)));
        assert_eq!(
            store
                .list_project_initialization_summary(&initialization.id)
                .expect("summary listed")
                .expect("summary remains"),
            original
        );
    }

    #[test]
    fn stale_synthesis_output_preserves_previous_summary() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("summary-stale-evidence"),
            })
            .expect("project created");
        let repository = store
            .list_project_repositories(&project.id)
            .expect("repositories listed")
            .remove(0);
        let initialization = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: project.id,
                repository_ids: vec![repository.id],
            })
            .expect("initialization created");
        let original_context = store
            .prepare_project_initialization_synthesis(GenerateProjectInitializationSummaryRequest {
                initialization_id: initialization.id.clone(),
                model_profile_id: DEFAULT_SYNTHESIS_MODEL_PROFILE_ID.to_string(),
            })
            .expect("initial synthesis prepared");
        let original = store
            .persist_project_initialization_summary(
                &original_context,
                test_knowledge_draft(),
                OPENAI_RESPONSES_GENERATION_ENGINE,
            )
            .expect("initial summary persisted");
        store
            .save_project_initialization_guardrails(SaveProjectInitializationGuardrailsRequest {
                initialization_id: initialization.id.clone(),
                guardrails: vec![ProjectInitializationGuardrailInput {
                    repository_id: None,
                    kind: "agent_rule".to_string(),
                    path_pattern: None,
                    content: "Review schema changes.".to_string(),
                }],
            })
            .expect("evidence changed");

        let error = store
            .persist_project_initialization_summary(
                &original_context,
                test_knowledge_draft(),
                OPENAI_RESPONSES_GENERATION_ENGINE,
            )
            .expect_err("stale synthesis rejected");
        assert!(matches!(
            error,
            AppError::Synthesis(message) if message.contains("evidence changed")
        ));
        assert_eq!(
            store
                .list_project_initialization_summary(&initialization.id)
                .expect("summary listed")
                .expect("summary remains"),
            original
        );
    }

    #[test]
    fn migrates_existing_summary_table_without_losing_drafts() {
        let database_directory = temp_project_path("summary-model-migration");
        let database_path = database_directory.join("legacy.sqlite");
        let legacy_connection = Connection::open(&database_path).expect("legacy database opens");
        legacy_connection
            .execute_batch(
                "PRAGMA foreign_keys = ON;
                 CREATE TABLE projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    path TEXT NOT NULL UNIQUE,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                 );
                 CREATE TABLE project_initialization_runs (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    status TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                 );
                 CREATE TABLE project_initialization_summaries (
                    id TEXT PRIMARY KEY,
                    initialization_id TEXT NOT NULL UNIQUE REFERENCES project_initialization_runs(id) ON DELETE CASCADE,
                    status TEXT NOT NULL,
                    project_purpose TEXT NOT NULL,
                    repository_map TEXT NOT NULL,
                    repository_roles TEXT NOT NULL,
                    build_test_matrix TEXT NOT NULL,
                    fragile_areas TEXT NOT NULL,
                    do_not_touch_rules TEXT NOT NULL,
                    agent_working_rules TEXT NOT NULL,
                    open_questions TEXT NOT NULL,
                    fact_count INTEGER NOT NULL,
                    markdown_finding_count INTEGER NOT NULL,
                    guardrail_count INTEGER NOT NULL,
                    created_at INTEGER NOT NULL,
                    approved_at INTEGER
                 );
                 INSERT INTO projects VALUES ('project-1', 'Legacy', '/tmp/legacy', 1, 1);
                 INSERT INTO project_initialization_runs VALUES ('init-1', 'project-1', 'summary', 1, 1);
                 INSERT INTO project_initialization_summaries VALUES (
                    'summary-1', 'init-1', 'draft', 'purpose', 'map', 'roles', 'tests',
                    'fragile', 'do-not-touch', 'rules', 'questions', 2, 3, 4, 1, NULL
                 );",
            )
            .expect("legacy schema created");
        drop(legacy_connection);

        let store = ProjectStore::open(&database_path).expect("store migrates");
        let summary = store
            .list_project_initialization_summary("init-1")
            .expect("legacy summary listed")
            .expect("legacy summary preserved");

        assert_eq!(summary.id, "summary-1");
        assert_eq!(summary.project_purpose, "purpose");
        assert_eq!(summary.requested_model_profile_id, None);
        assert!(summary.requested_model_parameters.is_empty());
        assert_eq!(summary.knowledge_schema_version, 1);
        assert_eq!(summary.generation_engine, "deterministic_v1");

        drop(store);
        fs::remove_dir_all(database_directory).expect("temporary database removed");
    }

    #[test]
    fn rejects_invalid_project_initialization_input() {
        let store = ProjectStore::in_memory().expect("store opens");
        let first_project = store
            .create_project(CreateProjectRequest {
                name: "One".to_string(),
                path: temp_project_path("init-one"),
            })
            .expect("first project created");
        let second_project = store
            .create_project(CreateProjectRequest {
                name: "Two".to_string(),
                path: temp_project_path("init-two"),
            })
            .expect("second project created");
        let first_repository = store
            .list_project_repositories(&first_project.id)
            .expect("first repositories listed")
            .remove(0);
        let second_repository = store
            .list_project_repositories(&second_project.id)
            .expect("second repositories listed")
            .remove(0);

        let empty = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: first_project.id.clone(),
                repository_ids: vec![],
            })
            .expect_err("empty repository selection rejected");
        assert!(matches!(empty, AppError::InvalidInput(_)));

        let duplicate = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: first_project.id.clone(),
                repository_ids: vec![first_repository.id.clone(), first_repository.id],
            })
            .expect_err("duplicate repository selection rejected");
        assert!(matches!(duplicate, AppError::InvalidInput(_)));

        let wrong_project = store
            .create_project_initialization(CreateProjectInitializationRequest {
                project_id: first_project.id,
                repository_ids: vec![second_repository.id],
            })
            .expect_err("repository from another project rejected");
        assert!(matches!(wrong_project, AppError::InvalidInput(_)));
    }

    #[test]
    fn creates_lists_and_records_transcript_events() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: std::env::current_dir().expect("current dir exists"),
            })
            .expect("project created");

        let session = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(project.id.clone()),
                runtime: " acp ".to_string(),
                source: " Codex ".to_string(),
                title: Some(" Morning run ".to_string()),
            })
            .expect("transcript session created");

        assert_eq!(session.project_id.as_deref(), Some(project.id.as_str()));
        assert_eq!(session.runtime, "acp");
        assert_eq!(session.source, "Codex");
        assert_eq!(session.title, "Morning run");
        assert_eq!(session.event_count, 0);

        let inserted = store
            .append_transcript_events(
                &session.id,
                vec![
                    TranscriptEventInput {
                        kind: " user_message ".to_string(),
                        content: "hello".to_string(),
                    },
                    TranscriptEventInput {
                        kind: "agent_message".to_string(),
                        content: "Hi there".to_string(),
                    },
                ],
            )
            .expect("events appended");

        assert_eq!(inserted.len(), 2);
        assert_eq!(inserted[0].sequence, 0);
        assert_eq!(inserted[0].kind, "user_message");
        assert_eq!(inserted[0].content, "hello");
        assert_eq!(inserted[1].sequence, 1);

        let sessions = store
            .list_transcript_sessions(Some(&project.id))
            .expect("sessions list");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, session.id);
        assert_eq!(sessions[0].event_count, 2);

        let events = store
            .list_transcript_events(&session.id)
            .expect("events list");
        assert_eq!(events, inserted);
    }

    #[test]
    fn gates_task_work_on_approved_project_knowledge_for_the_same_project() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "Task project".into(),
                path: temp_project_path("task-readiness"),
            })
            .expect("project created");
        let other = store
            .create_project(CreateProjectRequest {
                name: "Other project".into(),
                path: temp_project_path("other-readiness"),
            })
            .expect("other project created");
        store.seed_ready_project_knowledge(&other.id);
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
                project_id: project.id.clone(),
                transcript_session_id: transcript.id.clone(),
                original_prompt: "Do gated work".into(),
            })
            .expect("task created");
        let error = store
            .transition_task_phase(TransitionTaskPhaseRequest {
                task_id: task.id.clone(),
                action: "start".into(),
            })
            .expect_err("another project's knowledge cannot start the Task");
        assert!(matches!(error, AppError::InvalidInput(message)
            if message.contains("Project Knowledge")));

        store.connection().expect("connection").execute(
            "UPDATE task_phases SET status = 'in_progress' WHERE task_id = ?1 AND phase = 'analysis'",
            [&task.id],
        ).expect("legacy in-progress fixture");
        let run_error = store
            .begin_task_phase_run(CreateTaskPhaseRunRequest {
                task_id: task.id.clone(),
                transcript_session_id: transcript.id,
                phase: "analysis".into(),
                acp_session_id: "acp".into(),
                instruction: "Analyze".into(),
            })
            .expect_err("legacy in-progress Task remains gated");
        assert!(matches!(run_error, AppError::InvalidInput(message)
            if message.contains("Project Knowledge")));

        store.connection().expect("connection").execute(
            "UPDATE task_phases SET status = 'pending' WHERE task_id = ?1 AND phase = 'analysis'",
            [&task.id],
        ).expect("pending fixture restored");
        store.seed_ready_project_knowledge(&project.id);
        let started = store
            .transition_task_phase(TransitionTaskPhaseRequest {
                task_id: task.id,
                action: "start".into(),
            })
            .expect("same-project knowledge starts the Task");
        assert_eq!(started.phases[0].status, "in_progress");
    }

    #[test]
    fn creates_tasks_with_canonical_phases_and_lists_them_by_project() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: std::env::current_dir().expect("current dir exists"),
            })
            .expect("project created");
        let transcript = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(project.id.clone()),
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect("transcript created");

        let task = store
            .create_task(CreateTaskRequest {
                project_id: project.id.clone(),
                transcript_session_id: transcript.id.clone(),
                original_prompt: "  Implement task knowledge  ".to_string(),
            })
            .expect("task created");
        for request in [
            TransitionTaskPhaseRequest {
                task_id: task.id.clone(),
                action: "skip".to_string(),
            },
            TransitionTaskPhaseRequest {
                task_id: "missing-task".to_string(),
                action: "start".to_string(),
            },
        ] {
            let invalid = store
                .transition_task_phase(request)
                .expect_err("invalid transition rejected");
            assert!(matches!(invalid, AppError::InvalidInput(_)));
        }

        assert_eq!(task.project_id, project.id);
        assert_eq!(task.transcript_session_id, transcript.id);
        assert_eq!(task.original_prompt, "  Implement task knowledge  ");
        assert_eq!(task.status, "pending");
        assert_eq!(task.current_phase, "analysis");
        assert_eq!(task.initial_complexity_profile, "standard");
        assert_eq!(task.complexity_profile, "standard");
        assert_eq!(task.complexity_source, "system");
        assert_eq!(task.complexity_confidence, Some(55));
        assert_eq!(task.complexity_assessment_version, "deterministic_v1");
        assert_eq!(task.initial_complexity_reasons, task.complexity_reasons);
        assert_eq!(task.complexity_changes.len(), 1);
        assert_eq!(task.complexity_changes[0].sequence, 0);
        assert_eq!(task.complexity_changes[0].source, "system");
        assert_eq!(task.phases.len(), TASK_PHASES.len());
        for (index, phase) in task.phases.iter().enumerate() {
            assert_eq!(phase.task_id, task.id);
            assert_eq!(phase.phase, TASK_PHASES[index]);
            assert_eq!(phase.phase_index, index as i64);
            assert_eq!(phase.status, "pending");
            assert_eq!(phase.started_at, None);
            assert_eq!(phase.completed_at, None);
        }

        let listed = store
            .list_project_tasks(&task.project_id)
            .expect("tasks listed");
        assert_eq!(listed, vec![task]);
    }

    #[test]
    fn versions_and_approves_structured_plans_before_planning_can_complete() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "Structured planning".into(),
                path: temp_project_path("structured-planning"),
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
        let event = store
            .append_transcript_events(
                &transcript.id,
                vec![TranscriptEventInput {
                    kind: "agent_message".into(),
                    content: "Evidence".into(),
                }],
            )
            .expect("event created")
            .remove(0);
        let mut task = store
            .create_task(CreateTaskRequest {
                project_id: project.id,
                transcript_session_id: transcript.id,
                original_prompt: "Implement a versioned plan".into(),
            })
            .expect("task created");
        task = store
            .transition_task_phase(TransitionTaskPhaseRequest {
                task_id: task.id,
                action: "start".into(),
            })
            .expect("analysis started");
        store
            .create_task_phase_artifact(CreateTaskPhaseArtifactRequest {
                task_id: task.id.clone(),
                phase: "analysis".into(),
                kind: "summary".into(),
                content: "Boundaries understood".into(),
                source_transcript_event_ids: vec![event.id.clone()],
            })
            .expect("analysis evidence");
        task = store
            .transition_task_phase(TransitionTaskPhaseRequest {
                task_id: task.id,
                action: "complete".into(),
            })
            .expect("analysis completed");
        task = store
            .transition_task_phase(TransitionTaskPhaseRequest {
                task_id: task.id,
                action: "start".into(),
            })
            .expect("planning started");
        let artifact = store
            .create_task_phase_artifact(CreateTaskPhaseArtifactRequest {
                task_id: task.id.clone(),
                phase: "planning".into(),
                kind: "plan".into(),
                content: "REQ-1 is implemented by one bounded step".into(),
                source_transcript_event_ids: vec![event.id],
            })
            .expect("planning evidence");
        let request = CreateTaskPlanVersionRequest {
            task_id: task.id.clone(),
            source_artifact_id: artifact.id.clone(),
            requirements: vec![
                TaskPlanRequirementInput {
                    id: " req-1 ".into(),
                    text: "The behavior is implemented".into(),
                    kind: "functional".into(),
                },
                TaskPlanRequirementInput {
                    id: "REQ-2".into(),
                    text: "The behavior is documented".into(),
                    kind: "constraint".into(),
                },
            ],
            steps: vec![TaskPlanStepInput {
                title: "Implement behavior".into(),
                description: "Change the bounded module".into(),
                kind: "implementation".into(),
                complexity: 2,
                acceptance_criteria: vec!["Focused tests pass".into()],
                expected_paths: vec!["src/**".into()],
                satisfies: vec!["req-1".into()],
                depends_on: vec![],
            }],
        };
        let first = store
            .create_task_plan_version(request)
            .expect("first version created");
        let second = store
            .create_task_plan_version(CreateTaskPlanVersionRequest {
                task_id: task.id.clone(),
                source_artifact_id: artifact.id.clone(),
                requirements: vec![TaskPlanRequirementInput {
                    id: "REQ-1".into(),
                    text: "The behavior is implemented safely".into(),
                    kind: "functional".into(),
                }],
                steps: vec![
                    TaskPlanStepInput {
                        title: "Implement and verify behavior".into(),
                        description: "Change only the module".into(),
                        kind: "implementation".into(),
                        complexity: 3,
                        acceptance_criteria: vec![
                            "Focused tests pass".into(),
                            "No unrelated diff".into(),
                        ],
                        expected_paths: vec!["src/**".into()],
                        satisfies: vec!["REQ-1".into()],
                        depends_on: vec![],
                    },
                    TaskPlanStepInput {
                        title: "Verify behavior".into(),
                        description: "Run focused checks".into(),
                        kind: "infrastructure".into(),
                        complexity: 1,
                        acceptance_criteria: vec!["Checks pass".into()],
                        expected_paths: vec![],
                        satisfies: vec![],
                        depends_on: vec!["STEP-1".into()],
                    },
                ],
            })
            .expect("second version created");
        let invalid_dependency = store
            .create_task_plan_version(CreateTaskPlanVersionRequest {
                task_id: task.id.clone(),
                source_artifact_id: artifact.id,
                requirements: vec![TaskPlanRequirementInput {
                    id: "REQ-1".into(),
                    text: "The behavior is implemented safely".into(),
                    kind: "functional".into(),
                }],
                steps: vec![TaskPlanStepInput {
                    title: "Invalid first step".into(),
                    description: "Cannot depend on itself".into(),
                    kind: "implementation".into(),
                    complexity: 1,
                    acceptance_criteria: vec!["Rejected atomically".into()],
                    expected_paths: vec![],
                    satisfies: vec!["REQ-1".into()],
                    depends_on: vec!["STEP-1".into()],
                }],
            })
            .expect_err("self and forward dependencies rejected");
        assert!(matches!(invalid_dependency, AppError::InvalidInput(_)));
        assert_eq!(first.version, 1);
        assert_eq!(second.version, 2);
        assert_eq!(first.requirements[0].id, "REQ-1");
        assert_eq!(second.steps[1].depends_on, vec!["STEP-1"]);
        assert_eq!(second.steps[0].complexity, 3);
        let blocked_evaluation = store
            .evaluate_task_plan(EvaluateTaskPlanRequest {
                task_id: task.id.clone(),
                plan_version_id: first.id.clone(),
            })
            .expect("gap evaluated");
        assert_eq!(blocked_evaluation.verdict, "blocked");
        assert!(
            store
                .create_task_plan_critique(CreateTaskPlanCritiqueRequest {
                    task_id: task.id.clone(),
                    plan_version_id: first.id.clone(),
                    evaluation_id: blocked_evaluation.id.clone(),
                    source: "fake-small-model".into(),
                    response: r#"{"issues":[{"findingIds":["INVENTED"],"explanation":"Claim",
                        "proposedRepair":"Repair","repairs":[{"kind":"add_step",
                        "title":"Invent","description":"Unsupported","complexity":2,
                        "acceptanceCriteria":["Pass"],"expectedPaths":["src/**"],
                        "satisfies":["REQ-1"]}]}]}"#
                        .into(),
                })
                .is_err(),
            "unsupported critique is not persisted"
        );
        let critique = store
            .create_task_plan_critique(CreateTaskPlanCritiqueRequest {
                task_id: task.id.clone(),
                plan_version_id: first.id.clone(),
                evaluation_id: blocked_evaluation.id.clone(),
                source: "fake-small-model".into(),
                response: r#"{"issues":[{"findingIds":["GAP:REQ-2"],
                    "explanation":"Documentation has no implementing step.",
                    "proposedRepair":"Add a documentation step satisfying REQ-2.",
                    "repairs":[{"kind":"add_step","title":"Document behavior",
                    "description":"Add bounded documentation","complexity":1,
                    "acceptanceCriteria":["Documentation describes the behavior"],
                    "expectedPaths":["docs/**"],"satisfies":["REQ-2"]}]}]}"#
                    .into(),
            })
            .expect("grounded critique persisted");
        assert_eq!(critique.issues[0].finding_ids, ["GAP:REQ-2"]);
        assert_eq!(
            store
                .create_task_plan_critique(CreateTaskPlanCritiqueRequest {
                    task_id: task.id.clone(),
                    plan_version_id: first.id.clone(),
                    evaluation_id: blocked_evaluation.id.clone(),
                    source: "another-model".into(),
                    response: "not json".into(),
                })
                .expect("unchanged evaluation reuses critique")
                .id,
            critique.id
        );
        let repaired = store
            .apply_task_plan_critique(ApplyTaskPlanCritiqueRequest {
                task_id: task.id.clone(),
                critique_id: critique.id.clone(),
            })
            .expect("critique repairs create a new version");
        assert_eq!(repaired.version, 3);
        assert_eq!(repaired.steps.len(), 2);
        assert_eq!(repaired.steps[1].satisfies, ["REQ-2"]);
        assert_eq!(first.steps.len(), 1, "source version remains immutable");
        assert!(
            store
                .apply_task_plan_critique(ApplyTaskPlanCritiqueRequest {
                    task_id: task.id.clone(),
                    critique_id: critique.id.clone(),
                })
                .is_err(),
            "one critique cannot create multiple repair versions"
        );
        let connection = store.connection().expect("connection opens");
        let attribution: (String, String, String) = connection
            .query_row(
                "SELECT critique_id, source_plan_version_id, repaired_plan_version_id
                 FROM task_plan_repair_applications WHERE critique_id = ?1",
                [&critique.id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("repair attribution persisted");
        assert_eq!(
            attribution,
            (critique.id.clone(), first.id.clone(), repaired.id)
        );
        drop(connection);
        assert!(
            store
                .approve_task_plan_version(ApproveTaskPlanVersionRequest {
                    task_id: task.id.clone(),
                    plan_version_id: first.id.clone(),
                })
                .is_err(),
            "blocking findings prevent approval"
        );
        assert!(
            store
                .transition_task_phase(TransitionTaskPhaseRequest {
                    task_id: task.id.clone(),
                    action: "complete".into(),
                })
                .is_err(),
            "planning is blocked before approval"
        );

        assert!(
            store
                .approve_task_plan_version(ApproveTaskPlanVersionRequest {
                    task_id: task.id.clone(),
                    plan_version_id: second.id.clone(),
                })
                .is_err(),
            "approval requires deterministic evaluation"
        );
        let evaluation = store
            .evaluate_task_plan(EvaluateTaskPlanRequest {
                task_id: task.id.clone(),
                plan_version_id: second.id.clone(),
            })
            .expect("plan evaluated");
        assert_eq!(evaluation.verdict, "clean");
        assert_eq!(
            store
                .evaluate_task_plan(EvaluateTaskPlanRequest {
                    task_id: task.id.clone(),
                    plan_version_id: second.id.clone(),
                })
                .expect("cached evaluation returned")
                .id,
            evaluation.id,
        );
        let approved = store
            .approve_task_plan_version(ApproveTaskPlanVersionRequest {
                task_id: task.id.clone(),
                plan_version_id: second.id.clone(),
            })
            .expect("plan approved");
        assert_eq!(approved.status, "approved");
        assert!(approved.approved_at.is_some());
        assert!(
            store
                .approve_task_plan_version(ApproveTaskPlanVersionRequest {
                    task_id: task.id.clone(),
                    plan_version_id: first.id,
                })
                .is_err(),
            "only one version can be approved"
        );
        assert!(
            store
                .create_task_plan_version(CreateTaskPlanVersionRequest {
                    task_id: task.id.clone(),
                    source_artifact_id: approved.source_artifact_id.clone(),
                    requirements: vec![TaskPlanRequirementInput {
                        id: "REQ-1".into(),
                        text: "Mutation after approval".into(),
                        kind: "functional".into(),
                    }],
                    steps: vec![TaskPlanStepInput {
                        title: "Mutate".into(),
                        description: "Not allowed".into(),
                        kind: "implementation".into(),
                        complexity: 1,
                        acceptance_criteria: vec!["Done".into()],
                        expected_paths: vec![],
                        satisfies: vec!["REQ-1".into()],
                        depends_on: vec![],
                    }],
                })
                .is_err(),
            "approved content is immutable"
        );
        assert_eq!(
            store
                .list_task_plan_versions(&task.id)
                .expect("versions listed")
                .len(),
            3
        );
        let advanced = store
            .transition_task_phase(TransitionTaskPhaseRequest {
                task_id: task.id,
                action: "complete".into(),
            })
            .expect("approved plan completes planning");
        assert_eq!(advanced.current_phase, "execution");
    }

    #[test]
    fn rejects_invalid_structured_plan_links_atomically() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "Invalid plan".into(),
                path: temp_project_path("invalid-structured-plan"),
            })
            .expect("project created");
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
                transcript_session_id: transcript.id,
                original_prompt: "Reject invalid plan".into(),
            })
            .expect("task created");
        let invalid = store.create_task_plan_version(CreateTaskPlanVersionRequest {
            task_id: task.id.clone(),
            source_artifact_id: "missing".into(),
            requirements: vec![TaskPlanRequirementInput {
                id: "REQ-1".into(),
                text: "Known requirement".into(),
                kind: "functional".into(),
            }],
            steps: vec![TaskPlanStepInput {
                title: "Invalid".into(),
                description: "References missing requirement".into(),
                kind: "implementation".into(),
                complexity: 2,
                acceptance_criteria: vec!["Done".into()],
                expected_paths: vec![],
                satisfies: vec!["REQ-2".into()],
                depends_on: vec![],
            }],
        });
        assert!(matches!(invalid, Err(AppError::InvalidInput(_))));
        assert!(store
            .list_task_plan_versions(&task.id)
            .expect("versions listed")
            .is_empty());
    }

    #[test]
    fn persists_read_only_task_agent_reports_with_exact_secondary_provenance() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".into(),
                path: temp_project_path("task-agent-reports"),
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
            .expect("executor transcript created");
        let task = store
            .create_task(CreateTaskRequest {
                project_id: project.id.clone(),
                transcript_session_id: executor.id.clone(),
                original_prompt: "Review this safely".into(),
            })
            .expect("task created");
        let task = store
            .transition_task_phase(TransitionTaskPhaseRequest {
                task_id: task.id,
                action: "start".into(),
            })
            .expect("analysis started");
        let advisor = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(project.id.clone()),
                runtime: "acp".into(),
                source: "Claude".into(),
                title: None,
            })
            .expect("advisor transcript created");
        let events = store
            .append_transcript_events(
                &advisor.id,
                vec![
                    TranscriptEventInput {
                        kind: "user_message".into(),
                        content: "Inspect only".into(),
                    },
                    TranscriptEventInput {
                        kind: "agent_thought".into(),
                        content: "Risk found".into(),
                    },
                    TranscriptEventInput {
                        kind: "agent_message".into(),
                        content: "Add a guard".into(),
                    },
                ],
            )
            .expect("advisor events created");

        let first = store
            .create_task_agent_report(CreateTaskAgentReportRequest {
                task_id: task.id.clone(),
                phase: "analysis".into(),
                role: "advisor".into(),
                transcript_session_id: advisor.id.clone(),
                content: "  Check the boundary  ".into(),
                source_transcript_event_ids: vec![events[2].id.clone(), events[1].id.clone()],
            })
            .expect("advisor report created");
        let second = store
            .create_task_agent_report(CreateTaskAgentReportRequest {
                task_id: task.id.clone(),
                phase: "analysis".into(),
                role: "reviewer".into(),
                transcript_session_id: advisor.id.clone(),
                content: "No mutation approved".into(),
                source_transcript_event_ids: vec![events[2].id.clone()],
            })
            .expect("reviewer report created");
        assert_eq!(first.sequence, 0);
        assert_eq!(first.content, "Check the boundary");
        assert_eq!(
            first.source_transcript_event_ids,
            vec![events[1].id.clone(), events[2].id.clone()]
        );
        assert_eq!(second.sequence, 1);
        assert_eq!(
            store
                .list_task_agent_reports(&task.id)
                .expect("reports listed"),
            vec![first, second]
        );
        assert_eq!(
            store
                .list_project_tasks(&project.id)
                .expect("task remains unchanged"),
            vec![task.clone()]
        );

        let other_project = store
            .create_project(CreateProjectRequest {
                name: "Other".into(),
                path: temp_project_path("task-agent-reports-other"),
            })
            .expect("other project created");
        let wrong_project = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(other_project.id),
                runtime: "acp".into(),
                source: "Codex".into(),
                title: None,
            })
            .expect("wrong-project transcript created");
        let pty = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(project.id.clone()),
                runtime: "pty".into(),
                source: "Shell".into(),
                title: None,
            })
            .expect("pty transcript created");
        let other_executor = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(project.id.clone()),
                runtime: "acp".into(),
                source: "Gemini".into(),
                title: None,
            })
            .expect("other executor transcript created");
        let pending_task = store
            .create_task(CreateTaskRequest {
                project_id: project.id.clone(),
                transcript_session_id: other_executor.id.clone(),
                original_prompt: "Other work".into(),
            })
            .expect("other task created");
        assert!(store
            .create_task_agent_report(CreateTaskAgentReportRequest {
                task_id: pending_task.id,
                phase: "analysis".into(),
                role: "advisor".into(),
                transcript_session_id: advisor.id.clone(),
                content: "Too early".into(),
                source_transcript_event_ids: vec![events[2].id.clone()],
            })
            .is_err());
        for (role, phase, transcript_session_id, source_ids) in [
            (
                "executor",
                "analysis",
                advisor.id.as_str(),
                vec![events[2].id.clone()],
            ),
            (
                "advisor",
                "planning",
                advisor.id.as_str(),
                vec![events[2].id.clone()],
            ),
            (
                "advisor",
                "analysis",
                executor.id.as_str(),
                vec![events[2].id.clone()],
            ),
            (
                "advisor",
                "analysis",
                wrong_project.id.as_str(),
                vec![events[2].id.clone()],
            ),
            (
                "advisor",
                "analysis",
                pty.id.as_str(),
                vec![events[2].id.clone()],
            ),
            (
                "advisor",
                "analysis",
                other_executor.id.as_str(),
                vec![events[2].id.clone()],
            ),
            (
                "advisor",
                "analysis",
                advisor.id.as_str(),
                vec![events[0].id.clone()],
            ),
        ] {
            let error = store
                .create_task_agent_report(CreateTaskAgentReportRequest {
                    task_id: task.id.clone(),
                    phase: phase.into(),
                    role: role.into(),
                    transcript_session_id: transcript_session_id.into(),
                    content: "Invalid".into(),
                    source_transcript_event_ids: source_ids,
                })
                .expect_err("invalid report rejected");
            assert!(matches!(error, AppError::InvalidInput(_)));
        }
        assert_eq!(
            store
                .list_task_agent_reports(&task.id)
                .expect("no partial reports")
                .len(),
            2
        );
    }

    #[test]
    fn atomically_creates_secondary_transcript_and_task_agent_report() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".into(),
                path: temp_project_path("task-agent-report-transcript"),
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
            .expect("executor transcript created");
        let task = store
            .create_task(CreateTaskRequest {
                project_id: project.id.clone(),
                transcript_session_id: executor.id,
                original_prompt: "Investigate this change".into(),
            })
            .expect("task created");
        let task = store
            .transition_task_phase(TransitionTaskPhaseRequest {
                task_id: task.id,
                action: "start".into(),
            })
            .expect("analysis started");

        let created = store
            .create_task_agent_report_transcript(CreateTaskAgentReportTranscriptRequest {
                task_id: task.id.clone(),
                phase: "analysis".into(),
                role: "advisor".into(),
                transcript_source: "Codex advisor".into(),
                transcript_title: Some("Advisor run".into()),
                candidate_id: "codex-acp".into(),
                agent_session_id: "agent-session-1".into(),
                events: vec![
                    TranscriptEventInput {
                        kind: "user_message".into(),
                        content: "Review only".into(),
                    },
                    TranscriptEventInput {
                        kind: "agent_thought".into(),
                        content: "Boundary risk".into(),
                    },
                    TranscriptEventInput {
                        kind: "agent_message".into(),
                        content: "Add cleanup coverage".into(),
                    },
                ],
                content: "Boundary risk\n\nAdd cleanup coverage".into(),
            })
            .expect("secondary transcript report created");

        assert_eq!(
            created.transcript_session.project_id,
            Some(project.id.clone())
        );
        assert_eq!(created.transcript_session.runtime, "acp");
        assert_eq!(created.transcript_session.event_count, 3);
        assert_eq!(created.report.role, "advisor");
        assert_eq!(created.report.sequence, 0);
        assert_eq!(created.report.source_transcript_event_ids.len(), 2);
        assert_eq!(
            store
                .transcript_acp_identity(&created.transcript_session.id)
                .expect("identity loads")
                .expect("identity exists")
                .agent_session_id,
            "agent-session-1"
        );
        assert_eq!(
            store
                .list_transcript_events(&created.transcript_session.id)
                .expect("events listed")
                .len(),
            3
        );
        assert_eq!(
            store
                .list_task_agent_reports(&task.id)
                .expect("reports listed"),
            vec![created.report]
        );

        let before_sessions = store
            .list_transcript_sessions(Some(&project.id))
            .expect("sessions listed")
            .len();
        let error = store
            .create_task_agent_report_transcript(CreateTaskAgentReportTranscriptRequest {
                task_id: task.id.clone(),
                phase: "analysis".into(),
                role: "reviewer".into(),
                transcript_source: "Reviewer".into(),
                transcript_title: None,
                candidate_id: "codex-acp".into(),
                agent_session_id: "agent-session-2".into(),
                events: vec![TranscriptEventInput {
                    kind: "tool_call".into(),
                    content: "No reportable output".into(),
                }],
                content: "No reportable output".into(),
            })
            .expect_err("agent output is required");
        assert!(matches!(error, AppError::InvalidInput(_)));
        assert_eq!(
            store
                .list_transcript_sessions(Some(&project.id))
                .expect("no partial transcript")
                .len(),
            before_sessions
        );
    }

    #[test]
    fn persists_ordered_task_phase_artifacts_with_same_transcript_provenance() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("task-phase-artifacts"),
            })
            .expect("project created");
        store.seed_ready_project_knowledge(&project.id);
        let transcript = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(project.id.clone()),
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect("transcript created");
        let task = store
            .create_task(CreateTaskRequest {
                project_id: project.id.clone(),
                transcript_session_id: transcript.id.clone(),
                original_prompt: "Analyze the change".to_string(),
            })
            .expect("task created");
        let events = store
            .append_transcript_events(
                &transcript.id,
                vec![
                    TranscriptEventInput {
                        kind: "user_message".to_string(),
                        content: "Analyze".to_string(),
                    },
                    TranscriptEventInput {
                        kind: "agent_message".to_string(),
                        content: "Repository analysis".to_string(),
                    },
                ],
            )
            .expect("event appended");

        let not_started = store
            .create_task_phase_artifact(CreateTaskPhaseArtifactRequest {
                task_id: task.id.clone(),
                phase: "analysis".to_string(),
                kind: "summary".to_string(),
                content: "Too early".to_string(),
                source_transcript_event_ids: vec![events[0].id.clone()],
            })
            .expect_err("pending phase artifact rejected");
        assert!(matches!(not_started, AppError::InvalidInput(_)));
        let started = store
            .transition_task_phase(TransitionTaskPhaseRequest {
                task_id: task.id.clone(),
                action: "start".to_string(),
            })
            .expect("analysis started");
        assert_eq!(started.status, "in_progress");
        assert_eq!(started.phases[0].status, "in_progress");
        let duplicate_start = store
            .transition_task_phase(TransitionTaskPhaseRequest {
                task_id: task.id.clone(),
                action: "start".to_string(),
            })
            .expect_err("duplicate start rejected");
        assert!(matches!(duplicate_start, AppError::InvalidInput(_)));
        let missing_evidence = store
            .transition_task_phase(TransitionTaskPhaseRequest {
                task_id: task.id.clone(),
                action: "complete".to_string(),
            })
            .expect_err("completion without artifact rejected");
        assert!(matches!(missing_evidence, AppError::InvalidInput(_)));

        let first = store
            .create_task_phase_artifact(CreateTaskPhaseArtifactRequest {
                task_id: task.id.clone(),
                phase: " analysis ".to_string(),
                kind: " summary ".to_string(),
                content: " Evidence-backed analysis ".to_string(),
                source_transcript_event_ids: vec![
                    events[1].id.clone(),
                    events[0].id.clone(),
                    events[1].id.clone(),
                ],
            })
            .expect("artifact created");
        let second = store
            .create_task_phase_artifact(CreateTaskPhaseArtifactRequest {
                task_id: task.id.clone(),
                phase: "analysis".to_string(),
                kind: "risk".to_string(),
                content: "One risk".to_string(),
                source_transcript_event_ids: vec![events[0].id.clone()],
            })
            .expect("second artifact created");
        assert_eq!(first.sequence, 0);
        assert_eq!(first.phase, "analysis");
        assert_eq!(first.kind, "summary");
        assert_eq!(first.content, "Evidence-backed analysis");
        assert_eq!(
            first.source_transcript_event_ids,
            vec![events[0].id.clone(), events[1].id.clone()]
        );
        assert_eq!(second.sequence, 1);
        assert_eq!(
            store
                .list_task_phase_artifacts(&task.id)
                .expect("artifacts listed"),
            vec![first, second]
        );
        let advanced = store
            .transition_task_phase(TransitionTaskPhaseRequest {
                task_id: task.id.clone(),
                action: "complete".to_string(),
            })
            .expect("analysis completed");
        assert_eq!(advanced.current_phase, "planning");
        assert_eq!(advanced.phases[0].status, "completed");
        assert_eq!(advanced.phases[1].status, "pending");

        store
            .transition_task_phase(TransitionTaskPhaseRequest {
                task_id: task.id.clone(),
                action: "start".to_string(),
            })
            .expect("planning started");

        let other_transcript = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(project.id),
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect("other transcript created");
        let other_event = store
            .append_transcript_events(
                &other_transcript.id,
                vec![TranscriptEventInput {
                    kind: "agent_message".to_string(),
                    content: "Wrong source".to_string(),
                }],
            )
            .expect("other event appended");
        let wrong_source = store
            .create_task_phase_artifact(CreateTaskPhaseArtifactRequest {
                task_id: task.id.clone(),
                phase: "planning".to_string(),
                kind: "plan".to_string(),
                content: "Plan".to_string(),
                source_transcript_event_ids: vec![other_event[0].id.clone()],
            })
            .expect_err("cross-transcript provenance rejected");
        assert!(matches!(wrong_source, AppError::InvalidInput(_)));

        let mut transitioned = advanced;
        for phase in ["planning", "execution", "review"] {
            if phase != "planning" {
                transitioned = store
                    .transition_task_phase(TransitionTaskPhaseRequest {
                        task_id: task.id.clone(),
                        action: "start".to_string(),
                    })
                    .expect("next phase started");
            }
            assert_eq!(transitioned.current_phase, phase);
            let phase_artifact = store
                .create_task_phase_artifact(CreateTaskPhaseArtifactRequest {
                    task_id: task.id.clone(),
                    phase: phase.to_string(),
                    kind: "summary".to_string(),
                    content: format!("{phase} evidence"),
                    source_transcript_event_ids: vec![events[1].id.clone()],
                })
                .expect("phase artifact created");
            if phase == "planning" {
                let plan = store
                    .create_task_plan_version(CreateTaskPlanVersionRequest {
                        task_id: task.id.clone(),
                        source_artifact_id: phase_artifact.id,
                        requirements: vec![TaskPlanRequirementInput {
                            id: "REQ-1".into(),
                            text: "The requested behavior is implemented".into(),
                            kind: "functional".into(),
                        }],
                        steps: vec![TaskPlanStepInput {
                            title: "Implement requested behavior".into(),
                            description: "Make the bounded implementation change".into(),
                            kind: "implementation".into(),
                            complexity: 2,
                            acceptance_criteria: vec!["Focused verification passes".into()],
                            expected_paths: vec![],
                            satisfies: vec!["REQ-1".into()],
                            depends_on: vec![],
                        }],
                    })
                    .expect("structured plan created");
                store
                    .evaluate_task_plan(EvaluateTaskPlanRequest {
                        task_id: task.id.clone(),
                        plan_version_id: plan.id.clone(),
                    })
                    .expect("structured plan evaluated");
                store
                    .approve_task_plan_version(ApproveTaskPlanVersionRequest {
                        task_id: task.id.clone(),
                        plan_version_id: plan.id,
                    })
                    .expect("structured plan approved");
            }
            if phase == "execution" {
                let plan = store
                    .list_task_plan_versions(&task.id)
                    .expect("plans listed")
                    .into_iter()
                    .find(|plan| plan.status == "approved")
                    .expect("approved plan exists");
                let run = store
                    .begin_task_plan_step_run(CreateTaskPlanStepRunRequest {
                        task_id: task.id.clone(),
                        plan_version_id: plan.id,
                        plan_step_id: plan.steps[0].id.clone(),
                        acp_session_id: "acp-execution".into(),
                        instruction: "Implement only the plan".into(),
                    })
                    .expect("execution run started");
                store
                    .finalize_task_plan_step_run(&run.id, "sent", Some("end_turn"), None)
                    .expect("execution run finalized");
                store
                    .record_task_plan_step_run_verification(
                        &run.id,
                        "unchanged",
                        "/workspace/repo",
                        "[]",
                        None,
                    )
                    .expect("unchanged verification persisted");
                let blocked = store
                    .transition_task_phase(TransitionTaskPhaseRequest {
                        task_id: task.id.clone(),
                        action: "complete".to_string(),
                    })
                    .expect_err("unverified execution rejected");
                assert!(blocked.to_string().contains("every approved plan step"));
                store
                    .review_task_plan_step_run(ReviewTaskPlanStepRunRequest {
                        task_id: task.id.clone(),
                        run_id: run.id,
                        decision: "accept".into(),
                        note: "Execution step is verified".into(),
                    })
                    .expect("execution step accepted");
            }
            transitioned = store
                .transition_task_phase(TransitionTaskPhaseRequest {
                    task_id: task.id.clone(),
                    action: "complete".to_string(),
                })
                .expect("phase completed");
        }
        assert_eq!(transitioned.status, "completed");
        assert_eq!(transitioned.current_phase, "review");
        assert!(transitioned
            .phases
            .iter()
            .all(|phase| phase.status == "completed"));
        let after_completion = store
            .transition_task_phase(TransitionTaskPhaseRequest {
                task_id: task.id,
                action: "start".to_string(),
            })
            .expect_err("completed task transition rejected");
        assert!(matches!(after_completion, AppError::InvalidInput(_)));
    }

    #[test]
    fn persists_and_finalizes_task_phase_run_receipts() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".into(),
                path: temp_project_path("phase-run"),
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
                original_prompt: "Audit it".into(),
            })
            .expect("task created");
        let pending = store
            .begin_task_phase_run(CreateTaskPhaseRunRequest {
                task_id: task.id.clone(),
                transcript_session_id: transcript.id.clone(),
                phase: "analysis".into(),
                acp_session_id: "acp-1".into(),
                instruction: "Analyze only".into(),
            })
            .expect_err("pending phase rejected");
        assert!(matches!(pending, AppError::InvalidInput(_)));
        store
            .transition_task_phase(TransitionTaskPhaseRequest {
                task_id: task.id.clone(),
                action: "start".into(),
            })
            .expect("analysis started");
        let first = store
            .begin_task_phase_run(CreateTaskPhaseRunRequest {
                task_id: task.id.clone(),
                transcript_session_id: transcript.id.clone(),
                phase: "analysis".into(),
                acp_session_id: "acp-1".into(),
                instruction: "Analyze only".into(),
            })
            .expect("run intent persisted");
        assert_eq!(first.sequence, 0);
        assert_eq!(first.status, "pending");
        let sent = store
            .finalize_task_phase_run(&first.id, "sent", Some("end_turn"), None)
            .expect("run finalized");
        assert_eq!(sent.status, "sent");
        assert_eq!(sent.stop_reason.as_deref(), Some("end_turn"));
        let verified = store
            .record_task_phase_run_verification(
                &first.id,
                "changed",
                "/workspace/repo",
                r#"[{"status":"M","path":"src/lib.rs"}]"#,
                None,
            )
            .expect("verification persisted");
        assert_eq!(verified.verification_status.as_deref(), Some("changed"));
        assert_eq!(
            verified.verification_workspace_path.as_deref(),
            Some("/workspace/repo")
        );
        let response_events = store
            .append_transcript_events(
                &transcript.id,
                vec![
                    TranscriptEventInput {
                        kind: "agent_message".into(),
                        content: "Analysis result".into(),
                    },
                    TranscriptEventInput {
                        kind: "user_message".into(),
                        content: "Follow-up".into(),
                    },
                ],
            )
            .expect("response events persisted");
        store
            .link_task_phase_run_events(LinkTaskPhaseRunEventsRequest {
                task_id: task.id.clone(),
                receipt_id: first.id.clone(),
                transcript_event_ids: vec![response_events[0].id.clone()],
            })
            .expect("agent response linked");
        store
            .link_task_phase_run_events(LinkTaskPhaseRunEventsRequest {
                task_id: task.id.clone(),
                receipt_id: first.id.clone(),
                transcript_event_ids: vec![response_events[0].id.clone()],
            })
            .expect("duplicate link is idempotent");
        let linked = store
            .latest_task_phase_run_response_events(&task.id)
            .expect("latest linked response listed");
        assert_eq!(
            linked
                .iter()
                .map(|event| event.id.as_str())
                .collect::<Vec<_>>(),
            vec![response_events[0].id.as_str()]
        );
        let user_link = store
            .link_task_phase_run_events(LinkTaskPhaseRunEventsRequest {
                task_id: task.id.clone(),
                receipt_id: first.id.clone(),
                transcript_event_ids: vec![response_events[1].id.clone()],
            })
            .expect_err("user response provenance rejected");
        assert!(matches!(user_link, AppError::InvalidInput(_)));
        let second = store
            .begin_task_phase_run(CreateTaskPhaseRunRequest {
                task_id: task.id.clone(),
                transcript_session_id: transcript.id.clone(),
                phase: "analysis".into(),
                acp_session_id: "acp-1".into(),
                instruction: "Analyze retry".into(),
            })
            .expect("retry intent persisted");
        store
            .finalize_task_phase_run(&second.id, "failed", None, Some("offline"))
            .expect("retry failed");
        let third = store
            .begin_task_phase_run(CreateTaskPhaseRunRequest {
                task_id: task.id.clone(),
                transcript_session_id: transcript.id,
                phase: "analysis".into(),
                acp_session_id: "acp-1".into(),
                instruction: "Analyze after restart".into(),
            })
            .expect("uncertain run persisted");
        let resolved = store
            .resolve_pending_task_phase_run(ResolveTaskPhaseRunRequest {
                task_id: task.id.clone(),
                receipt_id: third.id,
                reason: "Agent process was stopped".into(),
            })
            .expect("pending run resolved");
        assert_eq!(resolved.status, "failed");
        assert_eq!(
            resolved.error.as_deref(),
            Some("manually resolved as failed: Agent process was stopped")
        );
        assert!(store
            .resolve_pending_task_phase_run(ResolveTaskPhaseRunRequest {
                task_id: task.id.clone(),
                receipt_id: first.id.clone(),
                reason: "rewrite".into(),
            })
            .is_err());
        let listed = store
            .list_task_phase_run_receipts(&task.id)
            .expect("runs listed");
        assert_eq!(listed.len(), 3);
        assert_eq!(listed[0].instruction, "Analyze only");
        assert_eq!(listed[1].sequence, 1);
        assert_eq!(listed[1].error.as_deref(), Some("offline"));
        assert!(store
            .finalize_task_phase_run(&first.id, "failed", None, Some("late"))
            .is_err());
    }

    #[test]
    fn isolates_ordered_retryable_runs_for_approved_plan_steps() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".into(),
                path: temp_project_path("plan-step-runs"),
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
                transcript_session_id: transcript.id,
                original_prompt: "Implement an approved plan".into(),
            })
            .expect("task created");
        let artifact_id = Uuid::new_v4().to_string();
        let plan_id = Uuid::new_v4().to_string();
        let first_step_id = Uuid::new_v4().to_string();
        let second_step_id = Uuid::new_v4().to_string();
        let now = unix_timestamp().expect("timestamp");
        let connection = store.connection().expect("connection");
        connection
            .execute(
                "UPDATE tasks SET current_phase = 'execution', status = 'in_progress'
                 WHERE id = ?1",
                [&task.id],
            )
            .expect("task moved to execution fixture");
        connection
            .execute(
                "UPDATE task_phases SET status = CASE
                   WHEN phase IN ('analysis', 'planning') THEN 'completed'
                   WHEN phase = 'execution' THEN 'in_progress'
                   ELSE 'pending' END
                 WHERE task_id = ?1",
                [&task.id],
            )
            .expect("phase fixture prepared");
        connection
            .execute(
                "INSERT INTO task_phase_artifacts
                 (id, task_id, phase, sequence, kind, content, created_at)
                 VALUES (?1, ?2, 'planning', 0, 'summary', 'Approved plan', ?3)",
                params![artifact_id, task.id, now],
            )
            .expect("artifact fixture inserted");
        connection
            .execute(
                "INSERT INTO task_plan_versions
                 (id, task_id, version, status, source_artifact_id, created_at, approved_at)
                 VALUES (?1, ?2, 1, 'approved', ?3, ?4, ?4)",
                params![plan_id, task.id, artifact_id, now],
            )
            .expect("plan fixture inserted");
        for (id, order, complexity, paths) in [
            (
                &first_step_id,
                0_i64,
                2_i64,
                r#"["src/first.rs","src/shared.rs"]"#,
            ),
            (&second_step_id, 1_i64, 4_i64, r#"["src/second.rs"]"#),
        ] {
            connection
                .execute(
                    "INSERT INTO task_plan_steps
                     (id, plan_version_id, order_index, title, description, kind, complexity,
                      acceptance_criteria_json, expected_paths_json, satisfies_json)
                     VALUES (?1, ?2, ?3, ?4, 'Bounded change', 'implementation', ?5,
                             '[\"passes\"]', ?6, '[\"REQ-1\"]')",
                    params![
                        id,
                        plan_id,
                        order,
                        format!("Step {}", order + 1),
                        complexity,
                        paths
                    ],
                )
                .expect("step fixture inserted");
        }
        drop(connection);

        let first = store
            .begin_task_plan_step_run(CreateTaskPlanStepRunRequest {
                task_id: task.id.clone(),
                plan_version_id: plan_id.clone(),
                plan_step_id: first_step_id.clone(),
                acp_session_id: "acp-1".into(),
                instruction: "Run only step one".into(),
            })
            .expect("first step run begins");
        assert_eq!(first.attempt, 1);
        assert_eq!(first.model_tier, "small");
        assert_eq!(first.expected_paths, vec!["src/first.rs", "src/shared.rs"]);
        assert!(store
            .begin_task_plan_step_run(CreateTaskPlanStepRunRequest {
                task_id: task.id.clone(),
                plan_version_id: plan_id.clone(),
                plan_step_id: first_step_id.clone(),
                acp_session_id: "acp-2".into(),
                instruction: "Duplicate open run".into(),
            })
            .is_err());
        let parallel_second = store
            .begin_task_plan_step_run(CreateTaskPlanStepRunRequest {
                task_id: task.id.clone(),
                plan_version_id: plan_id.clone(),
                plan_step_id: second_step_id.clone(),
                acp_session_id: "acp-2".into(),
                instruction: "Run independent step in the same wave".into(),
            })
            .expect("independent same-wave step begins");
        assert_eq!(parallel_second.attempt, 1);
        store
            .finalize_task_plan_step_run(
                &parallel_second.id,
                "failed",
                None,
                Some("parallel worker offline"),
            )
            .expect("parallel failure remains retryable");
        store
            .finalize_task_plan_step_run(&first.id, "failed", None, Some("offline"))
            .expect("failure remains retryable");
        let retry = store
            .begin_task_plan_step_run(CreateTaskPlanStepRunRequest {
                task_id: task.id.clone(),
                plan_version_id: plan_id.clone(),
                plan_step_id: first_step_id,
                acp_session_id: "acp-3".into(),
                instruction: "Retry only step one".into(),
            })
            .expect("retry begins");
        assert_eq!(retry.attempt, 2);
        assert!(retry.isolation_id.is_none());
        let invalid_isolation = TaskStepWorktreeInfo {
            isolation_id: "invalid".into(),
            repository_path: PathBuf::from("relative/source"),
            worktree_path: PathBuf::from("relative/worktree"),
            branch: "not-aiadne".into(),
            base_sha: "not-a-sha".into(),
        };
        assert!(store
            .record_task_plan_step_run_isolation(&retry.id, &invalid_isolation)
            .is_err());
        let isolation = TaskStepWorktreeInfo {
            isolation_id: "isolation-1".into(),
            repository_path: PathBuf::from("/workspace/source"),
            worktree_path: PathBuf::from("/workspace/repo"),
            branch: "aiadne/task-1/step-1/attempt-2-isolation-1".into(),
            base_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".into(),
        };
        let isolated = store
            .record_task_plan_step_run_isolation(&retry.id, &isolation)
            .expect("isolation recorded");
        assert_eq!(isolated.isolation_id.as_deref(), Some("isolation-1"));
        assert_eq!(
            isolated.isolation_worktree_path.as_deref(),
            Some("/workspace/repo")
        );
        assert!(store
            .record_task_plan_step_run_isolation(&retry.id, &isolation)
            .is_err());
        store
            .finalize_task_plan_step_run(&retry.id, "sent", Some("end_turn"), None)
            .expect("retry sent");
        assert!(store
            .review_task_plan_step_run(ReviewTaskPlanStepRunRequest {
                task_id: task.id.clone(),
                run_id: retry.id.clone(),
                decision: "accept".into(),
                note: "No repository verification yet".into(),
            })
            .is_err());
        assert!(store
            .record_task_plan_step_run_verification(
                &retry.id,
                "changed",
                "/workspace/wrong",
                r#"[{"status":"M","path":"src/first.rs"}]"#,
                None,
            )
            .is_err());
        store
            .record_task_plan_step_run_verification(
                &retry.id,
                "changed",
                "/workspace/repo",
                r#"[{"status":"M","path":"src/first.rs"}]"#,
                None,
            )
            .expect("retry verification saved");
        let accepted = store
            .review_task_plan_step_run(ReviewTaskPlanStepRunRequest {
                task_id: task.id.clone(),
                run_id: retry.id.clone(),
                decision: "accept".into(),
                note: "Repository change matches the approved step".into(),
            })
            .expect("first step accepted");
        assert_eq!(accepted.status, "accepted");
        assert!(accepted.integration_status.is_none());
        {
            let connection = store.connection().expect("connection");
            connection
                .execute(
                    "UPDATE task_plan_step_runs
                     SET verification_status = 'unchanged',
                         integration_status = 'conflicted',
                         integration_error = 'isolated integration requires repository changes'
                     WHERE id = ?1",
                    [&accepted.id],
                )
                .expect("legacy no-change conflict prepared");
        }
        let no_change = store
            .finalize_task_plan_step_run_no_change(&task.id, &accepted.id)
            .expect("no-change completion succeeds")
            .expect("accepted unchanged isolation matched");
        assert_eq!(no_change.integration_status.as_deref(), Some("integrated"));
        assert!(no_change.integration_error.is_none());
        {
            let connection = store.connection().expect("connection");
            connection
                .execute(
                    "UPDATE task_plan_step_runs SET verification_status = 'changed',
                         integration_status = NULL
                     WHERE id = ?1",
                    [&accepted.id],
                )
                .expect("changed integration fixture restored");
        }
        assert!(store
            .begin_task_plan_step_run_integration("another-task", &accepted.id)
            .is_err());
        let integration = store
            .begin_task_plan_step_run_integration(&task.id, &accepted.id)
            .expect("accepted isolated run begins integration");
        assert_eq!(integration.integration_status.as_deref(), Some("pending"));
        assert!(store
            .begin_task_plan_step_run_integration(&task.id, &accepted.id)
            .is_err());
        assert!(store
            .finalize_task_plan_step_run_integration(
                &accepted.id,
                "integrated",
                None,
                Some("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
                None,
            )
            .is_err());
        let integrated = store
            .finalize_task_plan_step_run_integration(
                &accepted.id,
                "integrated",
                Some("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
                Some("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
                None,
            )
            .expect("integration result persists");
        assert_eq!(integrated.integration_status.as_deref(), Some("integrated"));
        assert_eq!(
            integrated.isolated_commit_sha.as_deref(),
            Some("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        );
        assert_eq!(
            integrated.integrated_commit_sha.as_deref(),
            Some("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
        );
        assert!(store
            .finalize_task_plan_step_run_integration(
                &accepted.id,
                "conflicted",
                None,
                None,
                Some("late conflict"),
            )
            .is_err());
        let still_execution = store.task(&task.id).expect("task remains readable");
        assert_eq!(still_execution.current_phase, "execution");
        assert_eq!(still_execution.status, "in_progress");

        let second = store
            .begin_task_plan_step_run(CreateTaskPlanStepRunRequest {
                task_id: task.id.clone(),
                plan_version_id: plan_id.clone(),
                plan_step_id: second_step_id,
                acp_session_id: "acp-4".into(),
                instruction: "Run only step two".into(),
            })
            .expect("second step now begins");
        assert_eq!(second.attempt, 2);
        assert_eq!(second.step_order_index, 1);
        assert_eq!(second.model_tier, "high");
        assert!(store
            .begin_task_plan_step_run(CreateTaskPlanStepRunRequest {
                task_id: task.id.clone(),
                plan_version_id: "another-plan".into(),
                plan_step_id: second.plan_step_id.clone(),
                acp_session_id: "acp-5".into(),
                instruction: "Cross plan run".into(),
            })
            .is_err());
        store
            .finalize_task_plan_step_run(&second.id, "sent", Some("end_turn"), None)
            .expect("second step sent");
        let scoped = store
            .record_task_plan_step_run_verification(
                &second.id,
                "changed",
                "/workspace/repo",
                r#"[{"status":"M","path":"src/unexpected.rs"}]"#,
                None,
            )
            .expect("out of scope verification saved");
        assert_eq!(scoped.scope_status.as_deref(), Some("out_of_scope"));
        assert_eq!(scoped.scope_violations, vec!["src/unexpected.rs"]);
        assert!(store
            .record_task_plan_step_run_verification(
                &second.id,
                "changed",
                "/workspace/repo",
                r#"[{"status":"M","path":"src/second.rs"}]"#,
                None,
            )
            .is_err());
        assert!(store
            .review_task_plan_step_run(ReviewTaskPlanStepRunRequest {
                task_id: task.id.clone(),
                run_id: second.id.clone(),
                decision: "accept".into(),
                note: "Attempt to accept an unexpected write".into(),
            })
            .is_err());
        let rejected = store
            .review_task_plan_step_run(ReviewTaskPlanStepRunRequest {
                task_id: task.id.clone(),
                run_id: second.id,
                decision: "reject".into(),
                note: "Changed a file outside the approved step scope".into(),
            })
            .expect("out of scope run rejected");
        assert_eq!(rejected.status, "failed");
        assert_eq!(rejected.review_status.as_deref(), Some("rejected"));
        let second_retry = store
            .begin_task_plan_step_run(CreateTaskPlanStepRunRequest {
                task_id: task.id.clone(),
                plan_version_id: plan_id,
                plan_step_id: rejected.plan_step_id,
                acp_session_id: "acp-6".into(),
                instruction: "Retry only step two within scope".into(),
            })
            .expect("rejected run is retryable");
        assert_eq!(second_retry.attempt, 3);
        let runs = store
            .list_task_plan_step_runs(&task.id)
            .expect("step runs listed");
        assert_eq!(runs.len(), 5);
        assert_eq!(
            runs.iter().map(|run| run.attempt).collect::<Vec<_>>(),
            vec![1, 2, 1, 2, 3]
        );
    }

    #[test]
    fn persists_and_finalizes_ordered_task_context_dispatch_receipts() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".into(),
                path: temp_project_path("context-dispatch"),
            })
            .expect("project created");
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
                original_prompt: "Original task".into(),
            })
            .expect("task created");
        let source = TaskContextDispatchSourceInput {
            source_id: "artifact-1".into(),
            source_type: "task_artifact".into(),
            reason: "task_phase_artifact".into(),
            score: 1500,
        };
        let request = CreateTaskContextDispatchRequest {
            task_id: task.id.clone(),
            transcript_session_id: transcript.id.clone(),
            acp_session_id: "acp-1".into(),
            user_prompt: " Continue implementation ".into(),
            rendered_context: "- Verified plan".into(),
            sources: vec![source.clone()],
        };
        let first = store
            .begin_task_context_dispatch(request.clone())
            .expect("intent persisted");
        assert_eq!(first.sequence, 0);
        assert_eq!(first.status, "pending");
        assert_eq!(first.user_prompt, " Continue implementation ");
        assert_eq!(
            first.wire_prompt,
            "Selected task context:\n- Verified plan\n\nUser prompt:\n Continue implementation "
        );
        assert_eq!(first.sources, vec![source]);
        let sent = store
            .finalize_task_context_dispatch(&first.id, "sent", Some("end_turn"), None)
            .expect("receipt finalized");
        assert_eq!(sent.status, "sent");
        assert_eq!(sent.stop_reason.as_deref(), Some("end_turn"));
        assert!(store
            .finalize_task_context_dispatch(&first.id, "failed", None, Some("late"))
            .is_err());
        let second = store
            .begin_task_context_dispatch(request)
            .expect("second intent persisted");
        assert_eq!(second.sequence, 1);
        let failed = store
            .finalize_task_context_dispatch(&second.id, "failed", None, Some("offline"))
            .expect("failure finalized");
        assert_eq!(failed.error.as_deref(), Some("offline"));
        let third = store
            .begin_task_context_dispatch(CreateTaskContextDispatchRequest {
                task_id: task.id.clone(),
                transcript_session_id: transcript.id.clone(),
                acp_session_id: "acp-1".into(),
                user_prompt: "Retry".into(),
                rendered_context: "- Verified plan".into(),
                sources: vec![TaskContextDispatchSourceInput {
                    source_id: "artifact-1".into(),
                    source_type: "task_artifact".into(),
                    reason: "task_phase_artifact".into(),
                    score: 1500,
                }],
            })
            .expect("third intent persisted");
        let resolved = store
            .resolve_pending_task_context_dispatch(ResolveTaskContextDispatchRequest {
                task_id: task.id.clone(),
                receipt_id: third.id,
                reason: "No ACP result after restart".into(),
            })
            .expect("pending receipt resolved");
        assert_eq!(resolved.status, "failed");
        assert_eq!(
            resolved.error.as_deref(),
            Some("manually resolved as failed: No ACP result after restart")
        );
        assert!(store
            .resolve_pending_task_context_dispatch(ResolveTaskContextDispatchRequest {
                task_id: task.id.clone(),
                receipt_id: first.id.clone(),
                reason: "Cannot rewrite sent".into(),
            })
            .is_err());
        assert_eq!(
            store
                .list_task_context_dispatch_receipts(&task.id)
                .expect("receipts listed"),
            vec![sent, failed, resolved]
        );
    }

    #[test]
    fn rejects_cross_transcript_or_incomplete_context_dispatch_intents() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".into(),
                path: temp_project_path("context-dispatch-invalid"),
            })
            .expect("project created");
        let transcript = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(project.id.clone()),
                runtime: "acp".into(),
                source: "Codex".into(),
                title: None,
            })
            .expect("transcript created");
        let other = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(project.id.clone()),
                runtime: "acp".into(),
                source: "Codex".into(),
                title: None,
            })
            .expect("other transcript created");
        let task = store
            .create_task(CreateTaskRequest {
                project_id: project.id,
                transcript_session_id: transcript.id.clone(),
                original_prompt: "Original".into(),
            })
            .expect("task created");
        let source = TaskContextDispatchSourceInput {
            source_id: "unit".into(),
            source_type: "project_knowledge".into(),
            reason: "mandatory_kind".into(),
            score: 1000,
        };
        let cross_transcript = store
            .begin_task_context_dispatch(CreateTaskContextDispatchRequest {
                task_id: task.id.clone(),
                transcript_session_id: other.id,
                acp_session_id: "acp".into(),
                user_prompt: "Continue".into(),
                rendered_context: "context".into(),
                sources: vec![source.clone()],
            })
            .expect_err("cross-transcript intent rejected");
        assert!(matches!(cross_transcript, AppError::InvalidInput(_)));
        let incomplete = store
            .begin_task_context_dispatch(CreateTaskContextDispatchRequest {
                task_id: task.id.clone(),
                transcript_session_id: transcript.id.clone(),
                acp_session_id: "acp".into(),
                user_prompt: " ".into(),
                rendered_context: "context".into(),
                sources: vec![source.clone()],
            })
            .expect_err("incomplete intent rejected");
        assert!(matches!(incomplete, AppError::InvalidInput(_)));
        let duplicate = store
            .begin_task_context_dispatch(CreateTaskContextDispatchRequest {
                task_id: task.id,
                transcript_session_id: transcript.id,
                acp_session_id: "acp".into(),
                user_prompt: "Continue".into(),
                rendered_context: "context".into(),
                sources: vec![source.clone(), source],
            })
            .expect_err("duplicate sources rejected");
        assert!(matches!(duplicate, AppError::InvalidInput(_)));
    }

    #[test]
    fn overrides_effective_task_complexity_without_rewriting_initial_assessment() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: temp_project_path("task-complexity-override"),
            })
            .expect("project created");
        let transcript = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(project.id.clone()),
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect("transcript created");
        let task = store
            .create_task(CreateTaskRequest {
                project_id: project.id,
                transcript_session_id: transcript.id,
                original_prompt: "Dodaj dugme".to_string(),
            })
            .expect("task created");
        assert_eq!(task.initial_complexity_profile, "quick");

        let overridden = store
            .update_task_complexity(UpdateTaskComplexityRequest {
                task_id: task.id.clone(),
                profile: " COMPLEX ".to_string(),
                reason: " Analysis found backend and schema changes. ".to_string(),
            })
            .expect("complexity overridden");

        assert_eq!(overridden.initial_complexity_profile, "quick");
        assert_eq!(
            overridden.initial_complexity_reasons,
            task.initial_complexity_reasons
        );
        assert_eq!(overridden.initial_complexity_confidence, 82);
        assert_eq!(overridden.complexity_profile, "complex");
        assert_eq!(
            overridden.complexity_reasons,
            vec!["Analysis found backend and schema changes."]
        );
        assert_eq!(overridden.complexity_confidence, None);
        assert_eq!(overridden.complexity_source, "user");
        assert_eq!(overridden.complexity_assessment_version, "deterministic_v1");
        assert_eq!(overridden.complexity_changes.len(), 2);
        assert_eq!(overridden.complexity_changes[1].sequence, 1);
        assert_eq!(overridden.complexity_changes[1].source, "user");

        let overridden_again = store
            .update_task_complexity(UpdateTaskComplexityRequest {
                task_id: task.id.clone(),
                profile: "standard".to_string(),
                reason: "User chose the balanced workflow.".to_string(),
            })
            .expect("complexity overridden again");
        assert_eq!(overridden_again.complexity_profile, "standard");
        assert_eq!(overridden_again.complexity_changes.len(), 3);
        assert_eq!(overridden_again.complexity_changes[2].sequence, 2);
        assert_eq!(overridden_again.complexity_changes[2].profile, "standard");

        for request in [
            UpdateTaskComplexityRequest {
                task_id: task.id.clone(),
                profile: "tiny".to_string(),
                reason: "Preference".to_string(),
            },
            UpdateTaskComplexityRequest {
                task_id: task.id.clone(),
                profile: "standard".to_string(),
                reason: " ".to_string(),
            },
            UpdateTaskComplexityRequest {
                task_id: "missing-task".to_string(),
                profile: "standard".to_string(),
                reason: "Preference".to_string(),
            },
        ] {
            let error = store
                .update_task_complexity(request)
                .expect_err("invalid override rejected");
            assert!(matches!(error, AppError::InvalidInput(_)));
        }
    }

    #[test]
    fn migrates_legacy_tasks_with_auditable_standard_defaults() {
        let database_directory = temp_project_path("task-complexity-migration");
        let database_path = database_directory.join("legacy.sqlite");
        let legacy_connection = Connection::open(&database_path).expect("legacy database opens");
        legacy_connection
            .execute_batch(
                "PRAGMA foreign_keys = ON;
                 CREATE TABLE projects (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL UNIQUE,
                    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
                 );
                 CREATE TABLE transcript_sessions (
                    id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
                    runtime TEXT NOT NULL, source TEXT NOT NULL, title TEXT NOT NULL,
                    started_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
                 );
                 CREATE TABLE tasks (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    transcript_session_id TEXT NOT NULL UNIQUE REFERENCES transcript_sessions(id) ON DELETE CASCADE,
                    original_prompt TEXT NOT NULL, status TEXT NOT NULL, current_phase TEXT NOT NULL,
                    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
                 );
                 CREATE TABLE task_phases (
                    id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    phase TEXT NOT NULL, phase_index INTEGER NOT NULL, status TEXT NOT NULL,
                    started_at INTEGER, completed_at INTEGER,
                    UNIQUE(task_id, phase), UNIQUE(task_id, phase_index)
                 );
                 INSERT INTO projects VALUES ('project-1', 'Legacy', '/tmp/legacy-task', 1, 1);
                 INSERT INTO transcript_sessions VALUES ('transcript-1', 'project-1', 'acp', 'Codex', 'Legacy', 1, 1);
                 INSERT INTO tasks VALUES ('task-1', 'project-1', 'transcript-1', 'Legacy task', 'pending', 'analysis', 1, 1);",
            )
            .expect("legacy task schema created");
        drop(legacy_connection);

        let store = ProjectStore::open(&database_path).expect("store migrates");
        let task = store
            .list_project_tasks("project-1")
            .expect("legacy tasks listed")
            .remove(0);
        assert_eq!(task.initial_complexity_profile, "standard");
        assert_eq!(task.complexity_profile, "standard");
        assert_eq!(
            task.complexity_reasons,
            vec!["legacy task without assessment"]
        );
        assert_eq!(task.complexity_confidence, None);
        assert_eq!(task.complexity_assessment_version, "legacy_v0");
        assert_eq!(task.complexity_changes.len(), 1);
        assert_eq!(task.complexity_changes[0].assessment_version, "legacy_v0");
        assert_eq!(
            store
                .transcript_acp_identity("transcript-1")
                .expect("recovery table migrated"),
            None
        );
        assert!(store
            .list_task_agent_reports("task-1")
            .expect("task agent report tables migrated")
            .is_empty());

        drop(store);
        fs::remove_dir_all(database_directory).expect("temporary database removed");
    }

    #[test]
    fn rejects_invalid_or_duplicate_task_relationships() {
        let store = ProjectStore::in_memory().expect("store opens");
        let first_project = store
            .create_project(CreateProjectRequest {
                name: "First".to_string(),
                path: std::env::current_dir().expect("current dir exists"),
            })
            .expect("first project created");
        let second_project = store
            .create_project(CreateProjectRequest {
                name: "Second".to_string(),
                path: std::env::temp_dir(),
            })
            .expect("second project created");
        let transcript = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(first_project.id.clone()),
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect("transcript created");

        for request in [
            CreateTaskRequest {
                project_id: "missing-project".to_string(),
                transcript_session_id: transcript.id.clone(),
                original_prompt: "Prompt".to_string(),
            },
            CreateTaskRequest {
                project_id: first_project.id.clone(),
                transcript_session_id: "missing-transcript".to_string(),
                original_prompt: "Prompt".to_string(),
            },
            CreateTaskRequest {
                project_id: second_project.id,
                transcript_session_id: transcript.id.clone(),
                original_prompt: "Prompt".to_string(),
            },
            CreateTaskRequest {
                project_id: first_project.id.clone(),
                transcript_session_id: transcript.id.clone(),
                original_prompt: " ".to_string(),
            },
        ] {
            let error = store
                .create_task(request)
                .expect_err("invalid task rejected");
            assert!(matches!(error, AppError::InvalidInput(_)));
        }

        let request = CreateTaskRequest {
            project_id: first_project.id,
            transcript_session_id: transcript.id,
            original_prompt: "Prompt".to_string(),
        };
        store.create_task(request.clone()).expect("task created");
        let duplicate = store
            .create_task(request)
            .expect_err("duplicate transcript task rejected");
        assert!(matches!(duplicate, AppError::InvalidInput(_)));
    }

    #[test]
    fn rejects_invalid_transcript_input() {
        let store = ProjectStore::in_memory().expect("store opens");

        let missing_runtime = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: None,
                runtime: " ".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect_err("missing runtime rejected");
        assert!(matches!(missing_runtime, AppError::InvalidInput(_)));

        let missing_project = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some("missing-project".to_string()),
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect_err("missing project rejected");
        assert!(matches!(missing_project, AppError::InvalidInput(_)));

        let session = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: None,
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect("transcript session created");

        let empty_batch = store
            .append_transcript_events(&session.id, Vec::new())
            .expect_err("empty event batch rejected");
        assert!(matches!(empty_batch, AppError::InvalidInput(_)));

        let empty_kind = store
            .append_transcript_events(
                &session.id,
                vec![TranscriptEventInput {
                    kind: " ".to_string(),
                    content: "content".to_string(),
                }],
            )
            .expect_err("empty kind rejected");
        assert!(matches!(empty_kind, AppError::InvalidInput(_)));

        let empty_content = store
            .append_transcript_events(
                &session.id,
                vec![TranscriptEventInput {
                    kind: "agent_message".to_string(),
                    content: " ".to_string(),
                }],
            )
            .expect_err("empty content rejected");
        assert!(matches!(empty_content, AppError::InvalidInput(_)));
    }

    #[test]
    fn keeps_transcript_history_when_project_is_deleted() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: std::env::current_dir().expect("current dir exists"),
            })
            .expect("project created");
        let session = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(project.id.clone()),
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect("transcript session created");

        store.delete_project(&project.id).expect("project deleted");

        let sessions = store
            .list_transcript_sessions(None)
            .expect("transcript sessions listed");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, session.id);
        assert_eq!(sessions[0].project_id, None);
    }

    #[test]
    fn renames_transcript_session_titles() {
        let store = ProjectStore::in_memory().expect("store opens");
        let session = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: None,
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: Some("Codex ACP".to_string()),
            })
            .expect("transcript session created");

        let renamed = store
            .rename_transcript_session(RenameTranscriptSessionRequest {
                session_id: session.id.clone(),
                title: "  Bug bash with Codex  ".to_string(),
            })
            .expect("transcript session renamed");
        assert_eq!(renamed.title, "Bug bash with Codex");
        assert_eq!(renamed.event_count, 0);

        let listed = store.list_transcript_sessions(None).expect("sessions list");
        assert_eq!(listed[0].title, "Bug bash with Codex");

        let empty_title = store
            .rename_transcript_session(RenameTranscriptSessionRequest {
                session_id: session.id,
                title: " ".to_string(),
            })
            .expect_err("empty title rejected");
        assert!(matches!(empty_title, AppError::InvalidInput(_)));
    }

    #[test]
    fn creates_lists_and_attaches_knowledge_items() {
        let store = ProjectStore::in_memory().expect("store opens");
        let project = store
            .create_project(CreateProjectRequest {
                name: "AIadne".to_string(),
                path: std::env::current_dir().expect("current dir exists"),
            })
            .expect("project created");
        let session = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(project.id.clone()),
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect("transcript session created");

        let global_item = store
            .create_knowledge_item(CreateKnowledgeItemRequest {
                project_id: None,
                title: "  UI palette  ".to_string(),
                body: "Use earth tones.".to_string(),
                kind: " decision ".to_string(),
                scope: " global ".to_string(),
                source_transcript_session_id: None,
            })
            .expect("global knowledge created");
        let project_item = store
            .create_knowledge_item(CreateKnowledgeItemRequest {
                project_id: Some(project.id.clone()),
                title: "Project rule".to_string(),
                body: "Prefer ACP for structured sessions.".to_string(),
                kind: "constraint".to_string(),
                scope: "project".to_string(),
                source_transcript_session_id: Some(session.id.clone()),
            })
            .expect("project knowledge created");

        assert_eq!(global_item.title, "UI palette");
        assert_eq!(global_item.kind, "decision");
        assert_eq!(global_item.scope, "global");
        assert_eq!(
            project_item.source_transcript_session_id,
            Some(session.id.clone())
        );

        let items = store
            .list_knowledge_items(Some(&project.id))
            .expect("knowledge list");
        assert_eq!(items.len(), 2);
        assert!(items.iter().any(|item| item.id == global_item.id));
        assert!(items.iter().any(|item| item.id == project_item.id));

        store
            .attach_knowledge_to_transcript_session(&session.id, &global_item.id)
            .expect("global knowledge attached");
        let attached = store
            .attach_knowledge_to_transcript_session(&session.id, &project_item.id)
            .expect("project knowledge attached");
        assert_eq!(attached.len(), 2);

        let attached_again = store
            .attach_knowledge_to_transcript_session(&session.id, &project_item.id)
            .expect("duplicate attach ignored");
        assert_eq!(attached_again.len(), 2);

        let listed = store
            .list_attached_knowledge(&session.id)
            .expect("attached knowledge listed");
        assert_eq!(listed, attached_again);
    }

    #[test]
    fn rejects_invalid_knowledge_input_and_cross_project_attach() {
        let store = ProjectStore::in_memory().expect("store opens");
        let first_path = temp_project_path("first");
        let second_path = temp_project_path("second");
        let first_project = store
            .create_project(CreateProjectRequest {
                name: "One".to_string(),
                path: first_path,
            })
            .expect("first project created");
        let second_project = store
            .create_project(CreateProjectRequest {
                name: "Two".to_string(),
                path: second_path,
            })
            .expect("second project created");
        let first_session = store
            .create_transcript_session(CreateTranscriptSessionRequest {
                project_id: Some(first_project.id.clone()),
                runtime: "acp".to_string(),
                source: "Codex".to_string(),
                title: None,
            })
            .expect("first transcript session created");

        let empty_title = store
            .create_knowledge_item(CreateKnowledgeItemRequest {
                project_id: None,
                title: " ".to_string(),
                body: "body".to_string(),
                kind: "decision".to_string(),
                scope: "global".to_string(),
                source_transcript_session_id: None,
            })
            .expect_err("empty title rejected");
        assert!(matches!(empty_title, AppError::InvalidInput(_)));

        let missing_project = store
            .create_knowledge_item(CreateKnowledgeItemRequest {
                project_id: Some("missing-project".to_string()),
                title: "Rule".to_string(),
                body: "body".to_string(),
                kind: "decision".to_string(),
                scope: "project".to_string(),
                source_transcript_session_id: None,
            })
            .expect_err("missing project rejected");
        assert!(matches!(missing_project, AppError::InvalidInput(_)));

        let second_project_item = store
            .create_knowledge_item(CreateKnowledgeItemRequest {
                project_id: Some(second_project.id),
                title: "Other project".to_string(),
                body: "Do not leak into another project.".to_string(),
                kind: "constraint".to_string(),
                scope: "project".to_string(),
                source_transcript_session_id: None,
            })
            .expect("second project knowledge created");
        let cross_project = store
            .attach_knowledge_to_transcript_session(&first_session.id, &second_project_item.id)
            .expect_err("cross-project attach rejected");
        assert!(matches!(cross_project, AppError::InvalidInput(_)));
    }

    fn temp_project_path(label: &str) -> PathBuf {
        let path = std::env::temp_dir()
            .join("aiadne-storage-tests")
            .join(format!("{label}-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&path).expect("temp project dir created");
        path
    }

    fn git_available_for_tests() -> bool {
        Command::new("git")
            .arg("--version")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }

    fn initialize_git_repository_for_tests(path: &Path) {
        run_git_for_tests(path, &["init"]);
        std::fs::write(path.join("README.md"), "# Test\n").expect("README written");
        std::fs::create_dir_all(path.join("src")).expect("src dir created");
        std::fs::write(path.join("src").join("lib.rs"), "pub fn demo() {}\n")
            .expect("lib.rs written");
        run_git_for_tests(path, &["add", "."]);
        run_git_for_tests(
            path,
            &[
                "-c",
                "user.email=test@example.com",
                "-c",
                "user.name=AIadne Test",
                "commit",
                "-m",
                "initial",
            ],
        );
        std::fs::write(path.join("README.md"), "# Test\n\nUpdated.\n").expect("README updated");
        run_git_for_tests(path, &["add", "README.md"]);
        run_git_for_tests(
            path,
            &[
                "-c",
                "user.email=test@example.com",
                "-c",
                "user.name=AIadne Test",
                "commit",
                "-m",
                "update readme",
            ],
        );
    }

    fn run_git_for_tests(path: &Path, args: &[&str]) {
        let output = Command::new("git")
            .arg("-C")
            .arg(path)
            .args(args)
            .output()
            .expect("git command runs");
        assert!(
            output.status.success(),
            "git command failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    #[test]
    fn creates_acp_transcript_with_recovery_identity_atomically() {
        let store = ProjectStore::in_memory().expect("store opens");
        let session = store
            .create_acp_transcript_session(CreateAcpTranscriptSessionRequest {
                project_id: None,
                source: "Codex".to_string(),
                title: Some("Recovery".to_string()),
                candidate_id: "codex-acp".to_string(),
                agent_session_id: "agent-123".to_string(),
            })
            .expect("ACP transcript created");
        assert_eq!(session.runtime, "acp");
        assert_eq!(
            store
                .transcript_acp_identity(&session.id)
                .expect("identity queried"),
            Some(TranscriptAcpIdentityInfo {
                transcript_session_id: session.id,
                candidate_id: "codex-acp".to_string(),
                agent_session_id: "agent-123".to_string(),
                created_at: session.started_at
            })
        );
    }

    #[test]
    fn rejects_incomplete_acp_recovery_identity_without_creating_transcript() {
        let store = ProjectStore::in_memory().expect("store opens");
        let error = store
            .create_acp_transcript_session(CreateAcpTranscriptSessionRequest {
                project_id: None,
                source: "Codex".to_string(),
                title: None,
                candidate_id: "codex-acp".to_string(),
                agent_session_id: " ".to_string(),
            })
            .expect_err("empty agent session rejected");
        assert!(matches!(error, AppError::InvalidInput(_)));
        assert!(store
            .list_transcript_sessions(None)
            .expect("sessions listed")
            .is_empty());
    }
}
