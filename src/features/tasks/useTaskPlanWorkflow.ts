import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { RunTaskPlanCritiqueResultInfo, TaskInfo, TaskPlanCritiqueInfo, TaskPlanDraft,
  TaskPlanEvaluationInfo, TaskPlanVersionInfo } from "../../types/domain";

interface Options {
  candidateId?: string | null;
  cwd?: string | null;
}

export function useTaskPlanWorkflow(task: TaskInfo | null, options: Options = {}) {
  const [versions, setVersions] = useState<TaskPlanVersionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<TaskPlanEvaluationInfo | null>(null);
  const [critique, setCritique] = useState<TaskPlanCritiqueInfo | null>(null);
  const requestId = useRef(0);
  const taskIdRef = useRef(task?.id ?? null);
  const evaluationIdRef = useRef(evaluation?.id ?? null);
  taskIdRef.current = task?.id ?? null;
  evaluationIdRef.current = evaluation?.id ?? null;

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
      const nextCritique = nextEvaluation
        ? await invokeCommand<TaskPlanCritiqueInfo | null>("get_task_plan_critique", {
          evaluationId: nextEvaluation.id,
        }) : null;
      if (request === requestId.current) {
        setVersions(next);
        setEvaluation(nextEvaluation ?? null);
        setCritique(nextCritique ?? null);
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
    setCritique(null);
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
      setCritique(null);
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
      if (taskIdRef.current === taskId) setCritique(null);
    } catch (reason) {
      if (taskIdRef.current === taskId) setError(errorText(reason));
    } finally {
      if (taskIdRef.current === taskId) setLoading(false);
    }
  }

  async function runCritique() {
    const candidateId = options.candidateId?.trim();
    const cwd = options.cwd?.trim();
    if (!task || !evaluation || !candidateId || !cwd) {
      setError(!candidateId ? "Select an ACP agent before running critique."
        : "Select a repository before running critique.");
      return;
    }
    const taskId = task.id;
    const planVersionId = evaluation.planVersionId;
    setLoading(true);
    setError(null);
    try {
      const result = await invokeCommand<RunTaskPlanCritiqueResultInfo>("run_task_plan_critique", {
        request: { taskId, planVersionId, evaluationId: evaluation.id, candidateId, cwd },
      });
      if (taskIdRef.current === taskId && evaluationIdRef.current === evaluation.id) {
        setCritique(result.critique);
      }
    } catch (reason) {
      if (taskIdRef.current === taskId) setError(errorText(reason));
    } finally {
      if (taskIdRef.current === taskId) setLoading(false);
    }
  }

  return { versions, loading, error, approved: versions.find(({ status }) => status === "approved") ?? null,
    evaluation, critique, create, evaluate, runCritique, approve, refresh };
}
