import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { TaskAgentReportInfo, TaskInfo } from "../../types/domain";

export function useTaskAgentReports(task: TaskInfo | null) {
  const [reports, setReports] = useState<TaskAgentReportInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const taskIdRef = useRef(task?.id ?? null);

  useEffect(() => {
    taskIdRef.current = task?.id ?? null;
    setReports([]);
    setError(null);
    void refresh(task?.id ?? null);
  }, [task?.id]);

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

  return { reports, loading, error, refresh };
}
