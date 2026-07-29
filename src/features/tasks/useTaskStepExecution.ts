import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { IntegrateTaskPlanStepRunResultInfo, IsolatedTaskPlanStepRunResultInfo,
  RunTaskAgentReportResultInfo, TaskAgentReportInfo, TaskInfo, TaskPlanStepRunInfo,
  TaskPlanVersionInfo } from "../../types/domain";
import { currentTaskExecutionWave, dispatchableWaveSteps, isCompletedTaskPlanStepRun }
  from "./taskExecutionWaves";
import { useTaskAutopilot } from "./useTaskAutopilot";

interface Options {
  task: TaskInfo | null;
  plan: TaskPlanVersionInfo | null;
  candidateId: string | null;
  repositoryPath: string | null;
}

export type WaveEvaluationState =
  | { status: "running"; waveNumber: number; report: null; error: null }
  | { status: "ready"; waveNumber: number; report: TaskAgentReportInfo; error: null }
  | { status: "unavailable"; waveNumber: number; report: null; error: string };

export function useTaskStepExecution({ task, plan, candidateId, repositoryPath }: Options) {
  const [runs, setRuns] = useState<TaskPlanStepRunInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [dispatchStates, setDispatchStates] = useState<Record<string, "queued" | "running">>({});
  const [actionRunId, setActionRunId] = useState<string | null>(null);
  const [cleanupWarnings, setCleanupWarnings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [waveEvaluation, setWaveEvaluation] = useState<WaveEvaluationState | null>(null);
  const requestId = useRef(0);
  const continuedWaveKey = useRef<string | null>(null);
  const taskIdRef = useRef(task?.id ?? null);
  taskIdRef.current = task?.id ?? null;
  const autopilot = useTaskAutopilot({
    task, taskIdRef, refresh, setRuns, setCleanupWarnings,
  });

  async function refresh() {
    if (!task) return [];
    const taskId = task.id;
    const request = ++requestId.current;
    setLoading(true);
    try {
      const value = await invokeCommand<TaskPlanStepRunInfo[]>("list_task_plan_step_runs", { taskId });
      if (request === requestId.current && taskIdRef.current === taskId) setRuns(value ?? []);
      return value ?? [];
    } catch (reason) {
      if (request === requestId.current && taskIdRef.current === taskId) setError(errorText(reason));
      return [];
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
    setWaveEvaluation(null);
    continuedWaveKey.current = null;
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

  async function evaluateWave(waveNumber = currentWave?.number ?? null) {
    if (!task || !plan || !candidateId || !repositoryPath || waveNumber === null) return null;
    const taskId = task.id;
    setWaveEvaluation({ status: "running", waveNumber, report: null, error: null });
    try {
      const result = await invokeCommand<RunTaskAgentReportResultInfo>(
        "run_task_wave_evaluation",
        { request: { taskId, planVersionId: plan.id, candidateId, cwd: repositoryPath } },
      );
      if (taskIdRef.current === taskId) {
        setWaveEvaluation({ status: "ready", waveNumber, report: result.report, error: null });
      }
      return taskIdRef.current === taskId ? result.report : null;
    } catch (reason) {
      if (taskIdRef.current === taskId) {
        setWaveEvaluation({
          status: "unavailable", waveNumber, report: null, error: errorText(reason),
        });
      }
      return null;
    }
  }

  async function dispatchWave() {
    if (!task || !plan || !waveSteps.length || !candidateId || !repositoryPath) return;
    const taskId = task.id;
    const planId = plan.id;
    const waveNumber = currentWave?.number ?? 1;
    setLoading(true);
    setError(null);
    autopilot.resetForWave();
    const queued: Record<string, "queued" | "running"> = {};
    for (const step of waveSteps) queued[step.id] = "queued";
    setDispatchStates(queued);
    const failures: string[] = [];
    const settledReceipts: TaskPlanStepRunInfo[] = [];
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
            settledReceipts.push(result.receipt);
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
      }
    }
    let durableRuns = settledReceipts;
    if (failures.length && taskIdRef.current === taskId) durableRuns = await refresh();
    const report = taskIdRef.current === taskId ? await evaluateWave(waveNumber) : null;
    if (report && autopilot.enabled && taskIdRef.current === taskId) {
      await autopilot.apply(report, durableRuns);
    }
    if (taskIdRef.current === taskId) {
      setLoading(false);
      setDispatchStates({});
    }
  }

  useEffect(() => {
    if (!task || !plan || !autopilot.enabled || autopilot.state !== "completed"
      || loading || !currentWave || !waveSteps.length || runBlockedReason) return;
    const key = `${task.id}:${plan.id}:${currentWave.number}`;
    if (continuedWaveKey.current === key) return;
    continuedWaveKey.current = key;
    void dispatchWave();
  }, [autopilot.enabled, autopilot.state, currentWave?.number, loading, plan?.id,
    runBlockedReason, task?.id, waveSteps.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
    dispatchStates, actionRunId, cleanupWarnings, error, waveEvaluation, dispatch: dispatchWave,
    retryWaveEvaluation: evaluateWave, review, integrate, refresh,
    autopilotEnabled: autopilot.enabled, setAutopilotEnabled: autopilot.setEnabled,
    autopilotState: autopilot.state, autopilotMessage: autopilot.message };
}
