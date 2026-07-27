import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { TaskInfo, TaskPhaseArtifactInfo, TranscriptEventInfo } from "../../types/domain";

interface Options { task: TaskInfo | null; sourceEvents: TranscriptEventInfo[]; upsertTask: (task: TaskInfo) => void;
  runAgent: (taskId: string, instruction: string) => Promise<boolean>; onRunSettled: (taskId: string) => Promise<void> }

export function useTaskPhaseWorkflow({ task, sourceEvents, upsertTask, runAgent, onRunSettled }: Options) {
  const [artifacts, setArtifacts] = useState<TaskPhaseArtifactInfo[]>([]);
  const [kind, setKind] = useState("summary"); const [content, setContent] = useState("");
  const [sourceIds, setSourceIds] = useState<string[]>([]); const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); const requestId = useRef(0);
  const [evidenceReviewed, setEvidenceReviewed] = useState(false);
  const taskIdRef = useRef(task?.id ?? null);
  const currentPhase = task?.phases.find(({ phase }) => phase === task.currentPhase) ?? null;
  useEffect(() => { taskIdRef.current = task?.id ?? null; const request = ++requestId.current;
    setArtifacts([]); setSourceIds([]); setError(null); setEvidenceReviewed(false);
    if (!task) return; setLoading(true); void invokeCommand<TaskPhaseArtifactInfo[]>("list_task_phase_artifacts", { taskId: task.id })
      .then((value) => { if (request === requestId.current) setArtifacts(value ?? []); })
      .catch((reason) => { if (request === requestId.current) setError(errorText(reason)); })
      .finally(() => { if (request === requestId.current) setLoading(false); }); }, [task?.id]);
  function toggleSource(id: string, selected: boolean) { setSourceIds((current) => selected
    ? current.includes(id) ? current : [...current, id] : current.filter((value) => value !== id)); }
  function toggleAllSources(selected: boolean) {
    setSourceIds(selected ? sourceEvents.map(({ id }) => id) : []);
  }
  async function prepareCompletion() { if (!task) return; const taskId = task.id; setLoading(true); setError(null);
    try { const events = await invokeCommand<TranscriptEventInfo[]>("latest_task_phase_run_response_events", { taskId });
      if (taskIdRef.current !== taskId) return; if (events.length === 0) {
        setError("Run the current phase first; no persisted linked response is available."); return; }
      setContent(events.map(({ content: value }) => value.trim()).filter(Boolean).join("\n\n"));
      setSourceIds(events.map(({ id }) => id)); setEvidenceReviewed(false); }
    catch (reason) { if (taskIdRef.current === taskId) setError(errorText(reason)); }
    finally { if (taskIdRef.current === taskId) setLoading(false); } }
  async function runAndPrepare(instruction: string) { if (!task) return; const taskId = task.id;
    const sent = await runAgent(taskId, instruction); await onRunSettled(taskId);
    if (sent && taskIdRef.current === taskId) await prepareCompletion(); }
  async function transition(action: "start" | "complete") { if (!task || action === "complete" && !evidenceReviewed) return; setLoading(true); setError(null);
    try { const value = await invokeCommand<TaskInfo>("transition_task_phase", { request: { taskId: task.id, action } });
      if (taskIdRef.current === task.id) { upsertTask(value); setEvidenceReviewed(false); } }
    catch (reason) { if (taskIdRef.current === task.id) setError(errorText(reason)); }
    finally { if (taskIdRef.current === task.id) setLoading(false); } }
  async function createArtifact() { if (!task || !content.trim() || !kind.trim() || sourceIds.length === 0) return;
    setLoading(true); setError(null); try { const artifact = await invokeCommand<TaskPhaseArtifactInfo>(
      "create_task_phase_artifact", { request: { taskId: task.id, phase: task.currentPhase, kind, content,
        sourceTranscriptEventIds: sourceIds } }); if (taskIdRef.current !== task.id) return;
      setArtifacts((current) => [...current, artifact]); setContent(""); setSourceIds([]); setEvidenceReviewed(false); }
    catch (reason) { if (taskIdRef.current === task.id) setError(errorText(reason)); }
    finally { if (taskIdRef.current === task.id) setLoading(false); } }
  return { artifacts, kind, content, sourceIds, sourceEvents, error, loading, currentPhase, evidenceReviewed,
    changeKind: setKind, changeContent: setContent, toggleSource, toggleAllSources,
    prepareCompletion, runAndPrepare, createArtifact,
    acknowledgeEvidenceReview: setEvidenceReviewed, start: () => transition("start"), complete: () => transition("complete") };
}
