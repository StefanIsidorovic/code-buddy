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

export type TaskPhaseTransitionAction = "start" | "complete";

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
