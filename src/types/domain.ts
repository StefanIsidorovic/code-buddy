export type SessionState = "running" | "exited" | "killed" | "errored";

export type SessionInfo = {
  id: string;
  state: SessionState;
  pid: number | null;
  cwd: string;
  cols: number;
  rows: number;
  exitCode: number | null;
};

export type AgentDoctorStatus = "installed" | "missing" | "error";
export type CapabilityStatus = "supported" | "unsupported" | "unknown";
export type ModelTier = "fast" | "mid" | "high" | "max";
export type ModelProfileStatus = "selectable" | "unavailable";
export type AcpRegistryCandidateStatus = "ready" | "installable" | "missing_runner" | "missing_binary";
export type AcpRegistryDistributionKind = "npx" | "binary";

export type AgentDoctorReport = {
  adapter: {
    id: string;
    displayName: string;
    executable: string;
    transports: {
      pty: CapabilityStatus;
      acpStdio: CapabilityStatus;
    };
  };
  status: AgentDoctorStatus;
  path: string | null;
  version: string | null;
  error: string | null;
  installHint: string;
};

export type AcpRegistryCandidate = {
  id: string;
  name: string;
  version: string;
  description: string;
  distribution: AcpRegistryDistributionKind;
  status: AcpRegistryCandidateStatus;
  command: string[];
  runnerPath: string | null;
  installHint: string;
  sourceUrl: string;
};

export type ModelProviderInfo = {
  id: string;
  displayName: string;
};

export type ModelParameterInfo = {
  name: string;
  value: string;
};

export type ModelCapabilityInfo = {
  structuredOutput: CapabilityStatus;
  reasoningControl: CapabilityStatus;
  backgroundMode: CapabilityStatus;
  api: CapabilityStatus;
  cli: CapabilityStatus;
  acp: CapabilityStatus;
};

export type ModelProfileInfo = {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  tier: ModelTier;
  parameters: ModelParameterInfo[];
  capabilities: ModelCapabilityInfo;
  status: ModelProfileStatus;
  unavailableReason: string | null;
};

export type ModelCatalogInfo = {
  schemaVersion: number;
  providers: ModelProviderInfo[];
  profiles: ModelProfileInfo[];
};

export type AcpSessionInfo = {
  id: string;
  state: SessionState;
  pid: number | null;
  cwd: string;
  protocolVersion: number | null;
  agentSessionId: string | null;
  agentName: string | null;
  agentVersion: string | null;
  exitCode: number | null;
  codingModel?: AcpModelState | null;
};

export type AcpModelOption = {
  value: string;
  name: string;
  description: string | null;
};

export type AcpModelState = {
  currentValue: string;
  options: AcpModelOption[];
};

export type AcpEventKind =
  | "agent_message"
  | "user_message"
  | "plan"
  | "tool_call"
  | "usage"
  | "notice"
  | "error";

export type AcpSessionEvent = {
  kind: AcpEventKind;
  content: string;
};

export type AcpPromptResult = {
  sessionId: string;
  stopReason: string;
};

export type AcpPermissionOption = { optionId: string; name: string; kind: string };
export type AcpPermissionRequest = { id: string; title: string; options: AcpPermissionOption[] };

export type ProjectInfo = {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  updatedAt: number;
};

export type ProjectRepositoryInfo = {
  id: string;
  projectId: string;
  name: string;
  path: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ProjectInitializationInfo = {
  id: string;
  projectId: string;
  status: string;
  repositoryCount: number;
  createdAt: number;
  updatedAt: number;
};

export type ProjectInitializationFactInfo = {
  id: string;
  initializationId: string;
  repositoryId: string;
  repositoryName: string;
  repositoryPath: string;
  kind: string;
  label: string;
  value: string;
  source: string;
  createdAt: number;
};

export type ProjectInitializationMarkdownFindingInfo = {
  id: string;
  initializationId: string;
  repositoryId: string;
  repositoryName: string;
  repositoryPath: string;
  filePath: string;
  category: string;
  title: string;
  excerpt: string;
  source: string;
  createdAt: number;
};

export type InitializeDetailsView = "facts" | "markdown" | "summary";
export type InterviewScope = "project" | "repository";
export type ProjectInitializationGuardrailKind =
  | "fragile"
  | "do_not_touch"
  | "requires_review"
  | "agent_rule";

export type ProjectInitializationGuardrailInput = {
  repositoryId: string | null;
  kind: ProjectInitializationGuardrailKind;
  pathPattern: string | null;
  content: string;
};

export type ProjectInitializationGuardrailInfo = ProjectInitializationGuardrailInput & {
  id: string;
  initializationId: string;
  repositoryName: string | null;
  repositoryPath: string | null;
  guardrailIndex: number;
  scope: InterviewScope;
  source: string;
  createdAt: number;
};

export type ProjectInitializationSummaryInfo = {
  id: string;
  initializationId: string;
  status: "draft" | "approved";
  projectPurpose: string;
  repositoryMap: string;
  repositoryRoles: string;
  buildTestMatrix: string;
  fragileAreas: string;
  doNotTouchRules: string;
  agentWorkingRules: string;
  openQuestions: string;
  claims: ProjectInitializationSummaryClaimInfo[];
  factCount: number;
  markdownFindingCount: number;
  guardrailCount: number;
  requestedModelProfileId: string | null;
  requestedModelProviderId: string | null;
  requestedModelId: string | null;
  requestedModelTier: ModelTier | null;
  requestedModelParameters: ModelParameterInfo[];
  modelCatalogSchemaVersion: number | null;
  knowledgeSchemaVersion: number;
  generationEngine: string;
  createdAt: number;
  approvedAt: number | null;
};

export type ProjectInitializationSummaryClaimInfo = {
  id: string;
  section: string;
  claimIndex: number;
  originalContent: string;
  content: string;
  status: "pending" | "accepted" | "rejected" | "deferred";
  rejectionReason: string | null;
};

export type KnowledgeUnitSourceInfo = {
  sourceKey: string;
  repositoryId: string | null;
  path: string | null;
};

export type KnowledgeUnitInfo = {
  id: string;
  projectId: string;
  initializationId: string;
  derivedFromSummaryId: string;
  kind: string;
  topic: string;
  content: string;
  scope: string;
  status: "active" | "needs_confirmation";
  confidence: number;
  schemaVersion: number;
  sources: KnowledgeUnitSourceInfo[];
  createdAt: number;
};

export type TaskContextSelectionEntryInfo = {
  unit: KnowledgeUnitInfo;
  score: number;
  reason: string;
  characterCount: number;
};

export type TaskContextSelectionInfo = {
  initializationId: string;
  characterBudget: number;
  usedCharacters: number;
  remainingCharacters: number;
  renderedContext: string;
  included: TaskContextSelectionEntryInfo[];
  excluded: TaskContextSelectionEntryInfo[];
};

export type UnifiedTaskContextSourceInfo = {
  id: string;
  sourceType: "project_knowledge" | "knowledge_card" | "task_artifact";
  kind: string;
  title: string;
  content: string;
};

export type UnifiedTaskContextSelectionEntryInfo = {
  source: UnifiedTaskContextSourceInfo;
  score: number;
  reason: string;
  characterCount: number;
};

export type UnifiedTaskContextSelectionInfo = {
  initializationId: string;
  characterBudget: number;
  usedCharacters: number;
  remainingCharacters: number;
  renderedContext: string;
  included: UnifiedTaskContextSelectionEntryInfo[];
  excluded: UnifiedTaskContextSelectionEntryInfo[];
};

export type TaskContextDispatchSourceInfo = {
  sourceId: string;
  sourceType: UnifiedTaskContextSourceInfo["sourceType"];
  reason: string;
  score: number;
};

export type TaskContextDispatchReceiptInfo = {
  id: string;
  taskId: string;
  transcriptSessionId: string;
  sequence: number;
  acpSessionId: string;
  userPrompt: string;
  renderedContext: string;
  wirePrompt: string;
  sources: TaskContextDispatchSourceInfo[];
  status: "pending" | "sent" | "failed";
  stopReason: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
};

export type TaskContextDispatchResultInfo = {
  promptResult: AcpPromptResult;
  receipt: TaskContextDispatchReceiptInfo;
};

export type TranscriptSessionInfo = {
  id: string;
  projectId: string | null;
  runtime: string;
  source: string;
  title: string;
  startedAt: number;
  updatedAt: number;
  eventCount: number;
};

export type TranscriptAcpIdentityInfo = {
  transcriptSessionId: string;
  candidateId: string;
  agentSessionId: string;
  createdAt: number;
};

export type TranscriptEventInfo = {
  id: string;
  sessionId: string;
  sequence: number;
  kind: string;
  content: string;
  createdAt: number;
};

export type TaskPhaseInfo = {
  id: string;
  taskId: string;
  phase: "analysis" | "planning" | "execution" | "review";
  phaseIndex: number;
  status: string;
  startedAt: number | null;
  completedAt: number | null;
};

export type TaskInfo = {
  id: string;
  projectId: string;
  transcriptSessionId: string;
  originalPrompt: string;
  status: string;
  currentPhase: TaskPhaseInfo["phase"];
  initialComplexityProfile: "quick" | "standard" | "complex";
  initialComplexityReasons: string[];
  initialComplexityConfidence: number;
  complexityProfile: "quick" | "standard" | "complex";
  complexityReasons: string[];
  complexityConfidence: number | null;
  complexitySource: "system" | "user" | "analysis";
  complexityAssessmentVersion: string;
  phases: TaskPhaseInfo[];
  createdAt: number;
  updatedAt: number;
};

export type TaskPhaseArtifactInfo = {
  id: string;
  taskId: string;
  phase: TaskPhaseInfo["phase"];
  sequence: number;
  kind: string;
  content: string;
  sourceTranscriptEventIds: string[];
  createdAt: number;
};

export type TaskPlanRequirementInfo = {
  id: string;
  text: string;
  kind: "functional" | "constraint" | "non_functional" | "out_of_scope";
  orderIndex: number;
};

export type TaskPlanStepInfo = {
  id: string;
  orderIndex: number;
  title: string;
  description: string;
  kind: "implementation" | "infrastructure";
  complexity: number;
  acceptanceCriteria: string[];
  expectedPaths: string[];
  satisfies: string[];
  dependsOn: string[];
};

export type TaskPlanVersionInfo = {
  id: string;
  taskId: string;
  version: number;
  status: "draft" | "approved";
  sourceArtifactId: string;
  requirements: TaskPlanRequirementInfo[];
  steps: TaskPlanStepInfo[];
  createdAt: number;
  approvedAt: number | null;
};

export type TaskPlanDraft = {
  requirements: Array<{ id: string; text: string; kind: string }>;
  steps: Array<{ title: string; description: string; kind: string; complexity: number;
    acceptanceCriteria: string[]; expectedPaths: string[]; satisfies: string[];
    dependsOn?: string[] }>;
};

export type TaskPlanFindingInfo = {
  id: string;
  code: "GAP" | "OUT_OF_SCOPE" | "MISSING_PATHS" | "PATH_COLLISION";
  severity: "blocking" | "warning";
  message: string;
  requirementId: string | null;
  stepIds: string[];
};

export type TaskPlanEvaluationInfo = {
  id: string;
  taskId: string;
  planVersionId: string;
  planVersion: number;
  verdict: "clean" | "flags" | "blocked";
  findings: TaskPlanFindingInfo[];
  createdAt: number;
};

export type TaskPlanCritiqueIssue = {
  findingIds: string[];
  explanation: string;
  proposedRepair: string;
  repairs: TaskPlanRepair[];
};

export type TaskPlanRepair =
  | { kind: "add_step"; title: string; description: string; complexity: number;
    acceptanceCriteria: string[]; expectedPaths: string[]; satisfies: string[] }
  | { kind: "set_step_expected_paths"; stepId: string; expectedPaths: string[] }
  | { kind: "set_step_requirements"; stepId: string; satisfies: string[] };

export type TaskPlanCritiqueInfo = {
  id: string;
  taskId: string;
  planVersionId: string;
  evaluationId: string;
  source: string;
  issues: TaskPlanCritiqueIssue[];
  createdAt: number;
};

export type RunTaskPlanCritiqueResultInfo = {
  critique: TaskPlanCritiqueInfo;
  cached: boolean;
  promptResult: AcpPromptResult | null;
};

export type TaskAgentRole = "advisor" | "reviewer";

export type TaskAgentReportInfo = {
  id: string;
  taskId: string;
  phase: TaskPhaseInfo["phase"];
  sequence: number;
  role: TaskAgentRole;
  transcriptSessionId: string;
  content: string;
  sourceTranscriptEventIds: string[];
  createdAt: number;
};

export type RunTaskAgentReportResultInfo = {
  promptResult: AcpPromptResult;
  transcriptSession: TranscriptSessionInfo;
  report: TaskAgentReportInfo;
};

export type TaskPhaseTransitionAction = "start" | "complete";

export type TaskPhaseRunReceiptInfo = {
  id: string; taskId: string; transcriptSessionId: string; sequence: number;
  phase: TaskPhaseInfo["phase"]; acpSessionId: string; instruction: string;
  status: "pending" | "sent" | "failed"; stopReason: string | null; error: string | null;
  verificationStatus: "changed" | "unchanged" | "unavailable" | null;
  verificationWorkspacePath: string | null;
  verificationChangedFilesJson: string | null;
  verificationError: string | null;
  createdAt: number; updatedAt: number;
};

export type GitWorkspaceVerificationInfo = {
  taskId: string;
  phase: TaskPhaseInfo["phase"];
  workspacePath: string;
  status: "changed" | "unchanged" | "unavailable";
  changedFiles: GitDeliveryChangedFileInfo[];
  touchedFiles: GitDeliveryChangedFileInfo[];
  error: string | null;
};

export type TaskPlanStepRunInfo = {
  id: string;
  taskId: string;
  planVersionId: string;
  planStepId: string;
  stepOrderIndex: number;
  attempt: number;
  acpSessionId: string;
  instruction: string;
  modelTier: "small" | "mid" | "high";
  modelTierRationale: string;
  expectedPaths: string[];
  isolationId: string | null;
  isolationRepositoryPath: string | null;
  isolationWorktreePath: string | null;
  isolationBranch: string | null;
  isolationBaseSha: string | null;
  integrationStatus: "pending" | "integrated" | "conflicted" | null;
  isolatedCommitSha: string | null;
  integratedCommitSha: string | null;
  integrationError: string | null;
  status: "pending" | "sent" | "failed" | "accepted";
  stopReason: string | null;
  error: string | null;
  verificationStatus: "changed" | "unchanged" | "unavailable" | null;
  verificationWorkspacePath: string | null;
  verificationChangedFiles: string[];
  verificationError: string | null;
  scopeStatus: "within_scope" | "out_of_scope" | "unavailable" | null;
  scopeViolations: string[];
  reviewStatus: "accepted" | "rejected" | null;
  reviewNote: string | null;
  createdAt: number;
  updatedAt: number;
};

export type TaskPlanStepRunResultInfo = {
  promptResult: AcpPromptResult;
  receipt: TaskPlanStepRunInfo;
  workspaceVerification: GitWorkspaceVerificationInfo;
};

export type IsolatedTaskPlanStepRunResultInfo = {
  executorSession: AcpSessionInfo;
  promptResult: AcpPromptResult;
  receipt: TaskPlanStepRunInfo;
  workspaceVerification: GitWorkspaceVerificationInfo;
};

export type IntegrateTaskPlanStepRunResultInfo = {
  receipt: TaskPlanStepRunInfo;
  cleanupError: string | null;
};

export type TaskPhaseRunResultInfo = {
  promptResult: AcpPromptResult;
  receipt: TaskPhaseRunReceiptInfo;
  workspaceVerification: GitWorkspaceVerificationInfo | null;
};

export type GitDeliveryChangedFileInfo = {
  status: string;
  path: string;
};

export type GitDeliveryProvenanceInfo = {
  present: boolean;
  refName: string;
  planStepId: string | null;
  notePreview: string | null;
};

export type GitDeliveryReadinessInfo = {
  repositoryPath: string;
  branch: string | null;
  headSha: string | null;
  headSubject: string | null;
  worktreeClean: boolean;
  changedFileCount: number;
  changedFiles: GitDeliveryChangedFileInfo[];
  headProvenance: GitDeliveryProvenanceInfo;
};

export type GitDeliveryProvenanceHistoryEntry = {
  commitSha: string;
  shortSha: string;
  subject: string;
  hasProvenance: boolean;
  planStepId: string | null;
  severity: number | null;
  rationale: string | null;
  notePreview: string | null;
};

export type KnowledgeItemInfo = {
  id: string;
  projectId: string | null;
  title: string;
  body: string;
  kind: string;
  scope: string;
  sourceTranscriptSessionId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type RuntimeMode = "pty" | "acp";
