import type { TaskPlanStepInfo, TaskPlanStepRunInfo } from "../../types/domain";

export type TaskExecutionWave = {
  number: number;
  steps: TaskPlanStepInfo[];
  parallel: boolean;
  reason: string;
};

const stepKey = (step: TaskPlanStepInfo) => `STEP-${step.orderIndex + 1}`;
const scopePrefix = (value: string) => value.trim().replace(/^\.\//, "")
  .replace(/[*?[{].*$/, "").replace(/\/+$/, "");

function scopesOverlap(left: string[], right: string[]) {
  return left.some((leftPath) => right.some((rightPath) => {
    const leftPrefix = scopePrefix(leftPath);
    const rightPrefix = scopePrefix(rightPath);
    return !leftPrefix || !rightPrefix || leftPrefix === rightPrefix
      || leftPrefix.startsWith(`${rightPrefix}/`) || rightPrefix.startsWith(`${leftPrefix}/`);
  }));
}

export function deriveTaskExecutionWaves(steps: TaskPlanStepInfo[]): TaskExecutionWave[] {
  const pending = [...steps].sort((left, right) => left.orderIndex - right.orderIndex);
  const completed = new Set<string>();
  const waves: TaskExecutionWave[] = [];

  while (pending.length) {
    const ready = pending.filter((step) =>
      (step.dependsOn ?? []).every((dependency) => completed.has(dependency)));
    const candidates = ready.length ? ready : [pending[0]];
    const selected: TaskPlanStepInfo[] = [];

    for (const candidate of candidates) {
      const hasDeclaredScope = candidate.expectedPaths.length > 0;
      const compatible = hasDeclaredScope && selected.every((step) =>
        step.expectedPaths.length > 0
        && !scopesOverlap(step.expectedPaths, candidate.expectedPaths));
      if (!selected.length || compatible) selected.push(candidate);
      if (!hasDeclaredScope && selected.length === 1) break;
    }

    const ambiguousScope = selected.some((step) => step.expectedPaths.length === 0);
    waves.push({
      number: waves.length + 1,
      steps: selected,
      parallel: selected.length > 1,
      reason: selected.length > 1
        ? "Dependencies are satisfied and declared write scopes do not overlap."
        : ambiguousScope
          ? "Serialized because this step has no declared write scope."
          : "Serialized by dependencies or overlapping declared write scope.",
    });
    for (const step of selected) {
      completed.add(stepKey(step));
      pending.splice(pending.indexOf(step), 1);
    }
  }

  return waves;
}

export function currentTaskExecutionWave(
  steps: TaskPlanStepInfo[],
  runs: TaskPlanStepRunInfo[],
): TaskExecutionWave | null {
  const completed = new Set(runs.filter((run) => run.status === "accepted"
    && (!run.isolationId || run.integrationStatus === "integrated"))
    .map((run) => run.planStepId));
  return deriveTaskExecutionWaves(steps)
    .find((wave) => wave.steps.some((step) => !completed.has(step.id))) ?? null;
}

export function dispatchableWaveSteps(
  wave: TaskExecutionWave | null,
  runs: TaskPlanStepRunInfo[],
): TaskPlanStepInfo[] {
  if (!wave) return [];
  return wave.steps.filter((step) => {
    const attempts = runs.filter((run) => run.planStepId === step.id);
    const latest = attempts[attempts.length - 1];
    return !latest || latest.status === "failed";
  });
}
