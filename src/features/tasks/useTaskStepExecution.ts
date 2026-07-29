import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { IntegrateTaskPlanStepRunResultInfo, TaskInfo, TaskPlanStepRunInfo, TaskPlanStepRunResultInfo,
  TaskPlanVersionInfo } from "../../types/domain";

interface Options {
  task: TaskInfo | null;
  plan: TaskPlanVersionInfo | null;
  acpSessionId: string | null;
  onDispatchSettled: () => Promise<void>;
}

export function useTaskStepExecution({ task, plan, acpSessionId, onDispatchSettled }: Options) {
  const [runs, setRuns] = useState<TaskPlanStepRunInfo[]>([]);
  const [loading, setLoading] = useState(false);
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
    setCleanupWarnings({});
    if (task) void refresh();
    else requestId.current += 1;
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextStep = plan?.steps.find((step) =>
    !runs.some((run) => run.planStepId === step.id && run.status === "accepted"
      && (!run.isolationId || run.integrationStatus === "integrated"))) ?? null;
  const allAccepted = !!plan && plan.steps.length > 0 && !nextStep;

  async function dispatch() {
    if (!task || !plan || !nextStep || !acpSessionId) return;
    const taskId = task.id;
    setLoading(true);
    setError(null);
    try {
      const result = await invokeCommand<TaskPlanStepRunResultInfo>("send_task_plan_step_prompt", {
        request: { taskId, planVersionId: plan.id, planStepId: nextStep.id, acpSessionId },
      });
      if (taskIdRef.current === taskId) {
        setRuns((current) => [...current, result.receipt]);
      }
      await onDispatchSettled();
    } catch (reason) {
      if (taskIdRef.current === taskId) {
        setError(errorText(reason));
        await refresh();
      }
    } finally {
      if (taskIdRef.current === taskId) setLoading(false);
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

  return { runs, nextStep, allAccepted, loading, actionRunId, cleanupWarnings, error,
    dispatch, review, integrate, refresh };
}
