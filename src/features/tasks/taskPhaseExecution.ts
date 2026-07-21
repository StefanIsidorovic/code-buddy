import type { TaskInfo, TaskPhaseInfo } from "../../types/domain";

const phaseBoundaries: Record<TaskPhaseInfo["phase"], string> = {
  analysis: "Investigate the request, constraints, affected code, risks, and unknowns. Do not implement changes.",
  planning: "Produce a concrete implementation plan from the available evidence. Do not implement changes.",
  execution: "Implement only the approved plan. Report changed files, verification, and any deviations.",
  review: "Review the implementation adversarially for correctness, regressions, safety, and missing evidence. Do not expand scope.",
};

export function buildTaskPhaseExecutionPrompt(task: TaskInfo) {
  return [
    `Run only the ${task.currentPhase} phase for this Task.`,
    `Original Task: ${task.originalPrompt}`,
    `Phase boundary: ${phaseBoundaries[task.currentPhase]}`,
    "Use the existing conversation and reviewed context. Return a focused phase result in the transcript.",
    "Do not complete the phase, advance the Task, or claim evidence was persisted; AIadne keeps those as explicit user-controlled gates.",
  ].join("\n\n");
}
