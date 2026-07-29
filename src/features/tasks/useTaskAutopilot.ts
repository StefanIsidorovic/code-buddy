import { useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { IntegrateTaskPlanStepRunResultInfo, TaskAgentReportInfo, TaskInfo,
  TaskPlanStepRunInfo } from "../../types/domain";
import { deriveGuardedAutopilotDecision } from "./taskAutopilotPolicy";
import { deriveTaskWaveReviewQueue } from "./taskWaveReviewQueue";

interface Options {
  task: TaskInfo | null;
  taskIdRef: MutableRefObject<string | null>;
  refresh: () => Promise<TaskPlanStepRunInfo[]>;
  setRuns: Dispatch<SetStateAction<TaskPlanStepRunInfo[]>>;
  setCleanupWarnings: Dispatch<SetStateAction<Record<string, string>>>;
}

export function useTaskAutopilot({
  task, taskIdRef, refresh, setRuns, setCleanupWarnings,
}: Options) {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<"idle" | "running" | "completed" | "stopped">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(false);
    setState("idle");
    setMessage(null);
  }, [task?.id]);

  function resetForWave() {
    setState("idle");
    setMessage(null);
  }

  async function apply(report: TaskAgentReportInfo, durableRuns: TaskPlanStepRunInfo[]) {
    if (!task) return;
    const taskId = task.id;
    const queue = deriveTaskWaveReviewQueue(report.content, durableRuns);
    if (!queue) {
      setState("stopped");
      setMessage("Autopilot stopped: evaluator output has no grounded review queue.");
      return;
    }
    const decision = deriveGuardedAutopilotDecision(queue, durableRuns);
    if (!decision.eligibleRunIds.length) {
      setState("completed");
      setMessage("Autopilot made no changes. Every run requires manual review.");
      return;
    }
    setState("running");
    setMessage(`Applying ${decision.eligibleRunIds.length} grounded pass decision(s)…`);
    try {
      for (const runId of decision.eligibleRunIds) {
        if (taskIdRef.current !== taskId) return;
        const reviewed = await invokeCommand<TaskPlanStepRunInfo>("review_task_plan_step_run", {
          request: {
            taskId,
            runId,
            decision: "accept",
            note: `Guarded autopilot accepted grounded pass from evaluator report ${report.id}.`,
          },
        });
        if (taskIdRef.current !== taskId) return;
        setRuns((current) => current.map((run) => run.id === reviewed.id ? reviewed : run));
        if (reviewed.isolationId) {
          const integrated = await invokeCommand<IntegrateTaskPlanStepRunResultInfo>(
            "integrate_task_plan_step_run",
            { request: { taskId, runId } },
          );
          if (taskIdRef.current !== taskId) return;
          setRuns((current) => current.map((run) =>
            run.id === integrated.receipt.id ? integrated.receipt : run));
          const cleanupError = integrated.cleanupError;
          if (cleanupError) {
            setCleanupWarnings((current) => ({ ...current, [runId]: cleanupError }));
          }
        }
      }
      if (taskIdRef.current === taskId) {
        setState("completed");
        setMessage(
          `Autopilot completed ${decision.eligibleRunIds.length} safe run(s). `
          + `${decision.blocked.length} run(s) remain for manual review.`,
        );
      }
    } catch (reason) {
      if (taskIdRef.current === taskId) {
        setState("stopped");
        setMessage(`Autopilot stopped: ${errorText(reason)}. Remaining runs are manual.`);
        await refresh();
      }
    }
  }

  return { enabled, setEnabled, state, message, resetForWave, apply };
}
