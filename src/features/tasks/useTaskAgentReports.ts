import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type {
  RunTaskAgentReportResultInfo,
  TaskAgentReportInfo,
  TaskAgentRole,
  TaskInfo,
} from "../../types/domain";

interface Options {
  candidateId?: string | null;
  cwd?: string | null;
}

export function useTaskAgentReports(task: TaskInfo | null, options: Options = {}) {
  const [reports, setReports] = useState<TaskAgentReportInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningRole, setRunningRole] = useState<TaskAgentRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const taskIdRef = useRef(task?.id ?? null);

  useEffect(() => {
    taskIdRef.current = task?.id ?? null;
    setReports([]);
    setError(null);
    setRunningRole(null);
    void refresh(task?.id ?? null);
  }, [task?.id]);

  const runDisabledReason = taskAgentRunDisabledReason(task, options);

  async function refresh(taskId = taskIdRef.current) {
    const request = ++requestId.current;
    if (!taskId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const value = await invokeCommand<TaskAgentReportInfo[]>("list_task_agent_reports", { taskId });
      if (request === requestId.current && taskIdRef.current === taskId) setReports(value ?? []);
    } catch (reason) {
      if (request === requestId.current && taskIdRef.current === taskId) setError(errorText(reason));
    } finally {
      if (request === requestId.current && taskIdRef.current === taskId) setLoading(false);
    }
  }

  async function run(role: TaskAgentRole) {
    const candidateId = options.candidateId?.trim();
    const cwd = options.cwd?.trim();
    if (!task || !candidateId || !cwd || runDisabledReason) {
      setError(runDisabledReason ?? "Task agent report cannot run right now.");
      return;
    }
    const taskId = task.id;
    const phase = task.currentPhase;
    setRunningRole(role); setError(null);
    try {
      await invokeCommand<RunTaskAgentReportResultInfo>("run_task_agent_report", {
        request: { taskId, phase, role, candidateId, cwd },
      });
      if (taskIdRef.current === taskId) await refresh(taskId);
    } catch (reason) {
      if (taskIdRef.current === taskId) setError(errorText(reason));
    } finally {
      if (taskIdRef.current === taskId) setRunningRole(null);
    }
  }

  return { reports, loading, runningRole, error, runDisabledReason, refresh, run };
}

function taskAgentRunDisabledReason(task: TaskInfo | null, options: Options) {
  if (!task) return "No active task.";
  if (task.status !== "in_progress") return "Task is not in progress.";
  const current = task.phases.find(({ phase }) => phase === task.currentPhase);
  if (current?.status !== "in_progress") return "Current phase is not in progress.";
  if (!options.candidateId?.trim()) return "Select an ACP agent first.";
  if (!options.cwd?.trim()) return "Select a repository first.";
  return null;
}
