import type { GitDeliveryChangedFileInfo, GitWorkspaceVerificationInfo, TaskInfo,
  TaskPhaseInfo, TaskPhaseRunReceiptInfo } from "../../types/domain";

const phaseBoundaries: Record<TaskPhaseInfo["phase"], string> = {
  analysis: "Investigate the request, constraints, affected code, risks, and unknowns. Do not implement changes.",
  planning: "Produce a concrete implementation plan from the available evidence. Do not implement changes.",
  execution: "Implement only the approved plan. Report changed files, verification, and any deviations.",
  review: "Review the implementation adversarially for correctness, regressions, safety, and missing evidence. Do not expand scope.",
};

const planningOutputContract = `End the planning result with exactly one \`\`\`json fenced object:
{"requirements":[{"id":"REQ-1","text":"one testable assertion","kind":"functional|constraint|non_functional|out_of_scope"}],"steps":[{"title":"verb-first title","description":"what changes","kind":"implementation|infrastructure","complexity":1,"acceptanceCriteria":["observable result"],"expectedPaths":["relative/path"],"satisfies":["REQ-1"]}]}
Use complexity integers 1-5. Every implementation step must satisfy at least one declared requirement. Do not omit arrays.`;

export function buildTaskPhaseExecutionPrompt(task: TaskInfo) {
  return [
    `Run only the ${task.currentPhase} phase for this Task.`,
    `Original Task: ${task.originalPrompt}`,
    `Phase boundary: ${phaseBoundaries[task.currentPhase]}`,
    ...(task.currentPhase === "planning" ? [planningOutputContract] : []),
    "Use the existing conversation and reviewed context. Return a focused phase result in the transcript.",
    "Do not complete the phase, advance the Task, or claim evidence was persisted; AIadne keeps those as explicit user-controlled gates.",
  ].join("\n\n");
}

export function executionVerificationForTask(
  task: TaskInfo,
  receipts: TaskPhaseRunReceiptInfo[],
  live: GitWorkspaceVerificationInfo | null,
) {
  if (live?.taskId === task.id && live.phase === "execution") return live;
  const receipt = [...receipts].reverse().find(({ phase, status }) =>
    phase === "execution" && status === "sent");
  if (!receipt?.verificationStatus || !receipt.verificationWorkspacePath) return null;
  return {
    taskId: task.id,
    phase: "execution",
    workspacePath: receipt.verificationWorkspacePath,
    status: receipt.verificationStatus,
    changedFiles: parseChangedFiles(receipt.verificationChangedFilesJson),
    touchedFiles: [],
    error: receipt.verificationError,
  } satisfies GitWorkspaceVerificationInfo;
}

function parseChangedFiles(value: string | null): GitDeliveryChangedFileInfo[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is GitDeliveryChangedFileInfo =>
      !!item && typeof item === "object"
      && "status" in item && typeof item.status === "string"
      && "path" in item && typeof item.path === "string") : [];
  } catch {
    return [];
  }
}
