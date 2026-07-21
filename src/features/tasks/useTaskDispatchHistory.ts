import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { TaskContextDispatchReceiptInfo, TaskInfo } from "../../types/domain";

export function useTaskDispatchHistory(task: TaskInfo | null) {
  const [receipts, setReceipts] = useState<TaskContextDispatchReceiptInfo[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const [resolutionReceiptId, setResolutionReceiptId] = useState<string | null>(null);
  const [resolutionReason, setResolutionReason] = useState(""); const requestId = useRef(0);
  const taskIdRef = useRef(task?.id ?? null);
  useEffect(() => { taskIdRef.current = task?.id ?? null; setReceipts([]); setError(null);
    setResolutionReceiptId(null); setResolutionReason(""); void refresh(task?.id ?? null); }, [task?.id]);
  async function refresh(taskId = taskIdRef.current) { const request = ++requestId.current;
    if (!taskId) { setLoading(false); return; } setLoading(true); setError(null);
    try { const value = await invokeCommand<TaskContextDispatchReceiptInfo[]>(
      "list_task_context_dispatch_receipts", { taskId });
      if (request === requestId.current && taskIdRef.current === taskId) setReceipts(value ?? []); }
    catch (reason) { if (request === requestId.current && taskIdRef.current === taskId) setError(errorText(reason)); }
    finally { if (request === requestId.current && taskIdRef.current === taskId) setLoading(false); } }
  async function resolve() { const taskId = taskIdRef.current; const receiptId = resolutionReceiptId;
    if (!taskId || !receiptId || !resolutionReason.trim()) return; setLoading(true); setError(null);
    try { const value = await invokeCommand<TaskContextDispatchReceiptInfo>(
      "resolve_pending_task_context_dispatch", { request: { taskId, receiptId, reason: resolutionReason } });
      if (taskIdRef.current !== taskId) return;
      setReceipts((current) => current.map((receipt) => receipt.id === value.id ? value : receipt));
      setResolutionReceiptId(null); setResolutionReason(""); }
    catch (reason) { if (taskIdRef.current === taskId) setError(errorText(reason)); }
    finally { if (taskIdRef.current === taskId) setLoading(false); } }
  return { receipts, loading, error, resolutionReceiptId, resolutionReason, refresh,
    openResolution: setResolutionReceiptId, changeResolutionReason: setResolutionReason,
    cancelResolution: () => { if (!loading) { setResolutionReceiptId(null); setResolutionReason(""); } },
    resolve };
}
