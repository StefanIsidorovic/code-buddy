import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { TaskInfo, TaskPlanDraft, TaskPlanEvaluationInfo,
  TaskPlanVersionInfo } from "../../types/domain";

export function useTaskPlanWorkflow(task: TaskInfo | null) {
  const [versions, setVersions] = useState<TaskPlanVersionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<TaskPlanEvaluationInfo | null>(null);
  const requestId = useRef(0);
  const taskIdRef = useRef(task?.id ?? null);
  taskIdRef.current = task?.id ?? null;

  async function refresh() {
    if (!task) return;
    const request = ++requestId.current;
    setLoading(true);
    try {
      const value = await invokeCommand<TaskPlanVersionInfo[]>("list_task_plan_versions", {
        taskId: task.id,
      });
      const next = value ?? [];
      const latest = next[next.length - 1];
      const nextEvaluation = latest
        ? await invokeCommand<TaskPlanEvaluationInfo | null>("get_task_plan_evaluation", {
          planVersionId: latest.id,
        }) : null;
      if (request === requestId.current) {
        setVersions(next);
        setEvaluation(nextEvaluation ?? null);
      }
    } catch (reason) {
      if (request === requestId.current) setError(errorText(reason));
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    setVersions([]);
    setEvaluation(null);
    setError(null);
    if (task) void refresh();
    else requestId.current += 1;
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create(sourceArtifactId: string, draft: TaskPlanDraft) {
    if (!task) return;
    setLoading(true);
    setError(null);
    try {
      const taskId = task.id;
      const version = await invokeCommand<TaskPlanVersionInfo>("create_task_plan_version", {
        request: { taskId, sourceArtifactId, ...draft },
      });
      if (taskIdRef.current !== taskId) return;
      setVersions((current) => [...current, version]);
      setEvaluation(null);
    } catch (reason) {
      if (taskIdRef.current === task.id) setError(errorText(reason));
    } finally {
      if (taskIdRef.current === task.id) setLoading(false);
    }
  }

  async function approve(planVersionId: string) {
    if (!task) return;
    setLoading(true);
    setError(null);
    try {
      const taskId = task.id;
      const approved = await invokeCommand<TaskPlanVersionInfo>("approve_task_plan_version", {
        request: { taskId, planVersionId },
      });
      if (taskIdRef.current !== taskId) return;
      setVersions((current) => current.map((version) =>
        version.id === approved.id ? approved : version));
    } catch (reason) {
      if (taskIdRef.current === task.id) setError(errorText(reason));
    } finally {
      if (taskIdRef.current === task.id) setLoading(false);
    }
  }

  async function evaluate(planVersionId: string) {
    if (!task) return;
    const taskId = task.id;
    setLoading(true);
    setError(null);
    try {
      const value = await invokeCommand<TaskPlanEvaluationInfo>("evaluate_task_plan", {
        request: { taskId, planVersionId },
      });
      if (taskIdRef.current === taskId) setEvaluation(value);
    } catch (reason) {
      if (taskIdRef.current === taskId) setError(errorText(reason));
    } finally {
      if (taskIdRef.current === taskId) setLoading(false);
    }
  }

  return { versions, loading, error, approved: versions.find(({ status }) => status === "approved") ?? null,
    evaluation, create, evaluate, approve, refresh };
}
