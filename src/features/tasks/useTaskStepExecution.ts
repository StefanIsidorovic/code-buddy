import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { IntegrateTaskPlanStepRunResultInfo, IsolatedTaskPlanStepRunResultInfo, TaskInfo, TaskPlanStepRunInfo,
  TaskPlanVersionInfo } from "../../types/domain";
import { currentTaskExecutionWave, dispatchableWaveSteps, isCompletedTaskPlanStepRun }
  from "./taskExecutionWaves";

interface Options {
  task: TaskInfo | null;
  plan: TaskPlanVersionInfo | null;
  candidateId: string | null;
  repositoryPath: string | null;
}

export function useTaskStepExecution({ task, plan, candidateId, repositoryPath }: Options) {
  const [runs, setRuns] = useState<TaskPlanStepRunInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [dispatchStates, setDispatchStates] = useState<Record<string, "queued" | "running">>({});
  const [actionRunId, setActionRunId] = useState<string | null>(null);
  const [cleanupWarnings, setCleanupWarnings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const taskIdRef = useRef(task?.id ?? null);
  taskIdRef.current = task?.id ?? null;

  async function refresh() {
    if (!task) return;
    const taskId = task.id;
    const request = ++requestId.current;
    setLoading(true);
    try {
      const value = await invokeCommand<TaskPlanStepRunInfo[]>("list_task_plan_step_runs", { taskId });
      if (request === requestId.current && taskIdRef.current === taskId) setRuns(value ?? []);
    } catch (reason) {
      if (request === requestId.current && taskIdRef.current === taskId) setError(errorText(reason));
    } finally {
      if (request === requestId.current && taskIdRef.current === taskId) setLoading(false);
    }
  }

  useEffect(() => {
    setRuns([]);
    setError(null);
    setActionRunId(null);
    setDispatchStates({});
    setCleanupWarnings({});
    if (task) void refresh();
    else requestId.current += 1;
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentWave = plan ? currentTaskExecutionWave(plan.steps, runs) : null;
  const waveSteps = dispatchableWaveSteps(currentWave, runs);
  const nextStep = currentWave?.steps.find((step) =>
    !runs.some((run) => run.planStepId === step.id && isCompletedTaskPlanStepRun(run))) ?? null;
  const allAccepted = !!plan && plan.steps.length > 0 && !currentWave;
  const runBlockedReason = !candidateId
    ? "Select an available ACP coding agent to run the next isolated step."
    : !repositoryPath
      ? "Select a registered project repository to run the next isolated step."
      : null;

  async function dispatchWave() {
    if (!task || !plan || !waveSteps.length || !candidateId || !repositoryPath) return;
    const taskId = task.id;
    const planId = plan.id;
    setLoading(true);
    setError(null);
    const queued: Record<string, "queued" | "running"> = {};
    for (const step of waveSteps) queued[step.id] = "queued";
    setDispatchStates(queued);
    const failures: string[] = [];
    let cursor = 0;
    async function worker() {
      while (cursor < waveSteps.length) {
        const step = waveSteps[cursor++];
        if (taskIdRef.current === taskId) {
          setDispatchStates((current) => ({ ...current, [step.id]: "running" }));
        }
        try {
          const result = await invokeCommand<IsolatedTaskPlanStepRunResultInfo>(
            "send_isolated_task_plan_step_prompt",
            { request: { taskId, planVersionId: planId, planStepId: step.id,
              candidateId, repositoryPath } },
          );
          if (taskIdRef.current === taskId) {
            setRuns((current) => [...current.filter((run) => run.id !== result.receipt.id),
              result.receipt]);
          }
        } catch (reason) {
          failures.push(`Step ${step.orderIndex + 1}: ${errorText(reason)}`);
        } finally {
          if (taskIdRef.current === taskId) {
            setDispatchStates((current) => {
              const next = { ...current };
              delete next[step.id];
              return next;
            });
          }
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, waveSteps.length) }, () => worker()));
    if (taskIdRef.current === taskId) {
      if (failures.length) {
        setError(`Wave started with ${failures.length} failure(s). ${failures.join(" ")}`);
        await refresh();
      }
    }
    if (taskIdRef.current === taskId) {
      setLoading(false);
      setDispatchStates({});
    }
  }

  async function review(runId: string, decision: "accept" | "reject", note: string) {
    if (!task || !note.trim()) return;
    const taskId = task.id;
    setActionRunId(runId);
    setError(null);
    try {
      const reviewed = await invokeCommand<TaskPlanStepRunInfo>("review_task_plan_step_run", {
        request: { taskId, runId, decision, note },
      });
      if (taskIdRef.current === taskId) {
        setRuns((current) => current.map((run) => run.id === reviewed.id ? reviewed : run));
      }
    } catch (reason) {
      if (taskIdRef.current === taskId) setError(errorText(reason));
    } finally {
      if (taskIdRef.current === taskId) setActionRunId(null);
    }
  }

  async function integrate(runId: string) {
    if (!task || actionRunId) return;
    const taskId = task.id;
    setActionRunId(runId);
    setError(null);
    setCleanupWarnings((current) => {
      const next = { ...current };
      delete next[runId];
      return next;
    });
    try {
      const result = await invokeCommand<IntegrateTaskPlanStepRunResultInfo>(
        "integrate_task_plan_step_run",
        { request: { taskId, runId } },
      );
      if (taskIdRef.current === taskId) {
        setRuns((current) => current.map((run) =>
          run.id === result.receipt.id ? result.receipt : run));
        const cleanupError = result.cleanupError;
        if (cleanupError) {
          setCleanupWarnings((current) => ({ ...current, [runId]: cleanupError }));
        }
      }
    } catch (reason) {
      if (taskIdRef.current === taskId) {
        setError(errorText(reason));
        await refresh();
      }
    } finally {
      if (taskIdRef.current === taskId) setActionRunId(null);
    }
  }

  return { runs, currentWave, waveSteps, nextStep, allAccepted, runBlockedReason, loading,
    dispatchStates, actionRunId, cleanupWarnings, error, dispatch: dispatchWave,
    review, integrate, refresh };
}
