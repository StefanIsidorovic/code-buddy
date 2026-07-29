import type { TaskPlanStepRunInfo } from "../../types/domain";
import type { TaskWaveReviewQueue } from "./taskWaveReviewQueue";

export interface TaskAutopilotDecision {
  eligibleRunIds: string[];
  blocked: { runId: string; reason: string }[];
}

export function deriveGuardedAutopilotDecision(
  queue: TaskWaveReviewQueue,
  runs: TaskPlanStepRunInfo[],
): TaskAutopilotDecision {
  const byId = new Map(runs.map((run) => [run.id, run]));
  const eligibleRunIds: string[] = [];
  const blocked: { runId: string; reason: string }[] = [];
  for (const item of queue.items) {
    const run = byId.get(item.runId);
    const reason = blockedReason(item.verdict, run);
    if (reason) blocked.push({ runId: item.runId, reason });
    else eligibleRunIds.push(item.runId);
  }
  return { eligibleRunIds, blocked };
}

function blockedReason(
  verdict: TaskWaveReviewQueue["items"][number]["verdict"],
  run: TaskPlanStepRunInfo | undefined,
) {
  if (!run) return "Persisted run is missing.";
  if (verdict !== "pass") return "Evaluator marked this run as needing attention.";
  if (run.status !== "sent") return `Run status is ${run.status}, not sent.`;
  if (run.error) return "Run recorded an error.";
  if (run.scopeStatus !== "within_scope") return "Repository scope is not verified within scope.";
  if (!run.verificationStatus || run.verificationStatus === "unavailable") {
    return "Repository verification is unavailable.";
  }
  return null;
}
