import { useEffect, useMemo, useRef, useState } from "react";
import { errorText, formatPromptWithKnowledge } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type {
  AcpPromptResult,
  AcpRegistryCandidate,
  AcpSessionEvent,
  AcpSessionInfo,
  KnowledgeItemInfo,
  TaskContextDispatchResultInfo,
  TaskInfo,
  GitWorkspaceVerificationInfo,
  TaskPhaseRunResultInfo,
  TranscriptEventInfo,
  TranscriptSessionInfo,
  UnifiedTaskContextSelectionInfo,
} from "../../types/domain";
import { useAcpPermissions } from "./useAcpPermissions";
import { useAcpEventDrain } from "./useAcpEventDrain";
import { useAcpRecovery } from "./useAcpRecovery";
interface TranscriptApi { createAcp: (source: string, title: string, candidateId: string, agentSessionId: string) => Promise<TranscriptSessionInfo | null>;
  activateSaved: (session: TranscriptSessionInfo) => void; attachKnowledge: (sessionId: string) => Promise<void>;
  showLive: () => void;
  getActiveId: () => string | null;
  getTask: (id: string) => TaskInfo | null;
  upsertTask: (task: TaskInfo) => void;
  record: (id: string | null | undefined, events: AcpSessionEvent[]) => Promise<TranscriptEventInfo[]>;
}
interface Options { projectId: string | null;
  cwd?: string;
  prompt: string;
  onPromptChange: (value: string) => void;
  attachedKnowledge: KnowledgeItemInfo[];
  transcript: TranscriptApi;
  runAction: (action: () => Promise<void>) => Promise<void>;
  reportError: (message: string | null) => void;
}
export function useAcpRuntime({
  projectId,
  cwd,
  prompt,
  onPromptChange,
  attachedKnowledge,
  transcript,
  runAction,
  reportError,
}: Options) {
  const [candidates, setCandidates] = useState<AcpRegistryCandidate[]>([]);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [session, setSession] = useState<AcpSessionInfo | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [events, setEvents] = useState<AcpSessionEvent[]>([]);
  const [promptResult, setPromptResult] = useState<AcpPromptResult | null>(null);
  const [workspaceVerification, setWorkspaceVerification] = useState<GitWorkspaceVerificationInfo | null>(null);
  const [promptBusy, setPromptBusy] = useState(false);
  const promptInFlight = useRef(false);
  const eventDrain = useAcpEventDrain({ append: (next) => setEvents((current) => [...current, ...next]),
    getActiveTranscriptId: transcript.getActiveId, record: transcript.record });
  const [expanded, setExpanded] = useState(true);
  const selectedCandidate = useMemo(
    () => candidates.find(({ id }) => id === selectedCandidateId) ?? null,
    [candidates, selectedCandidateId],
  );
  const usable = session?.state === "running";
  const permission = useAcpPermissions(session?.id ?? null, usable, reportError);
  const recovery = useAcpRecovery({ cwd, scopeKey: projectId, sessionUsable: usable, reportError });
  const canStartSelected = !!selectedCandidate && isLaunchable(selectedCandidate) && !usable && !recovery.resumingSessionId;
  const statusLabel = session
    ? `${source ?? session.agentName ?? "acp"} · ${session.state} · ${session.agentSessionId ?? "no agent session"}`
    : "not started";
  useEffect(() => { void refreshRegistry(); }, []); useEffect(() => {
    if (!usable || !session) return;
    const timer = window.setInterval(() => void eventDrain.drain(session.id), 1000);
    return () => window.clearInterval(timer);
  }, [session?.id, usable]);
  async function refreshRegistry() {
    setRegistryLoading(true);
    setRegistryError(null);
    try {
      const value = await invokeCommand<AcpRegistryCandidate[]>("list_acp_registry_candidates");
      setCandidates(value);
      setSelectedCandidateId((current) =>
        current && value.some(({ id }) => id === current) ? current : value[0]?.id ?? null,
      );
    } catch (reason) {
      setRegistryError(errorText(reason));
    } finally {
      setRegistryLoading(false);
    }
  }
  async function startSelected() { if (recovery.resumingSessionId) return;
    if (!selectedCandidate || !isLaunchable(selectedCandidate)) {
      reportError(selectedCandidate?.installHint ?? "Select an ACP candidate first.");
      return;
    }
    await runAction(async () => {
      const next = await invokeCommand<AcpSessionInfo>("start_acp_registry_session", {
        request: { candidateId: selectedCandidate.id, ...(cwd ? { cwd } : {}) },
      });
      setSession(next);
      setSource(selectedCandidate.name);
      setEvents([]);
      setPromptResult(null);
      if (!next.agentSessionId) throw new Error("ACP agent did not return a resumable session id.");
      const transcriptSession = await transcript.createAcp(selectedCandidate.name, `${selectedCandidate.name} ACP`, selectedCandidate.id, next.agentSessionId);
      if (transcriptSession) await transcript.attachKnowledge(transcriptSession.id);
      await eventDrain.drain(next.id, transcriptSession?.id ?? null);
    });
  }
  async function changeModel(modelId: string) {
    if (!session?.codingModel || modelId === session.codingModel.currentValue) return;
    await runAction(async () => {
      setSession(
        await invokeCommand<AcpSessionInfo>("set_acp_model", {
          request: { sessionId: session.id, modelId },
        }),
      );
    });
  }
  async function resumeTranscript(value: TranscriptSessionInfo) { const recovered = await recovery.resume(value); if (!recovered) return false;
    transcript.activateSaved(value); setSelectedCandidateId(recovered.identity.candidateId); setSession(recovered.session);
    setSource(value.source); setEvents(recovered.replay); setPromptResult(null); return true;
  }
  async function sendPrompt(selectedTaskContext?: UnifiedTaskContextSelectionInfo) {
    if (!usable || !session || promptInFlight.current) return false;
    promptInFlight.current = true;
    setPromptBusy(true);
    reportError(null);
    try {
      transcript.showLive();
      const transcriptId = transcript.getActiveId();
      if (projectId && !transcriptId) throw new Error("A project Task requires an active transcript session.");
      let activeTask = transcriptId ? transcript.getTask(transcriptId) : null;
      if (projectId && transcriptId && !activeTask) {
        activeTask = await invokeCommand<TaskInfo>("create_task", {
            request: { projectId, transcriptSessionId: transcriptId, originalPrompt: prompt },
          });
        transcript.upsertTask(activeTask);
      }
      eventDrain.beginPrompt(transcriptId);
      const userEvent: AcpSessionEvent = { kind: "user_message", content: prompt };
      setEvents((current) => [...current, userEvent]);
      await transcript.record(transcriptId, [userEvent]);
      if (selectedTaskContext === undefined) {
        setPromptResult(await invokeCommand<AcpPromptResult>("send_acp_prompt", {
          sessionId: session.id, prompt: formatPromptWithKnowledge(attachedKnowledge, prompt),
        }));
      } else {
        if (!transcriptId || !activeTask) throw new Error("Reviewed Task context requires an active Task.");
        const dispatched = await invokeCommand<TaskContextDispatchResultInfo>(
          "send_acp_prompt_with_context", { request: { taskId: activeTask.id,
            transcriptSessionId: transcriptId, acpSessionId: session.id, userPrompt: prompt,
            renderedContext: selectedTaskContext.renderedContext,
            sources: selectedTaskContext.included.map(({ source, reason, score }) => ({
              sourceId: source.id, sourceType: source.sourceType, reason, score,
            })) } },
        );
        setPromptResult(dispatched.promptResult);
      }
      setPromptBusy(false);
      await eventDrain.drain(session.id, transcriptId, true);
      return true;
    } catch (reason) {
      reportError(errorText(reason));
      return false;
    } finally {
      eventDrain.endPrompt();
      promptInFlight.current = false;
      setPromptBusy(false);
    }
  }
  async function sendPhasePrompt(taskId: string, instruction: string) {
    if (!usable || !session || promptInFlight.current || !instruction.trim()) return false;
    promptInFlight.current = true;
    setPromptBusy(true);
    reportError(null);
    try {
      transcript.showLive();
      const transcriptId = transcript.getActiveId();
      const activeTask = transcriptId ? transcript.getTask(transcriptId) : null;
      if (!transcriptId || activeTask?.id !== taskId) {
        throw new Error("A controlled phase run requires the active Task transcript.");
      }
      eventDrain.beginPrompt(transcriptId, true);
      const userEvent: AcpSessionEvent = { kind: "user_message", content: instruction };
      setEvents((current) => [...current, userEvent]);
      await transcript.record(transcriptId, [userEvent]);
      const result = await invokeCommand<TaskPhaseRunResultInfo>("send_task_phase_prompt", {
        request: { taskId, transcriptSessionId: transcriptId, phase: activeTask.currentPhase,
          acpSessionId: session.id, instruction },
      });
      setPromptResult(result.promptResult);
      setWorkspaceVerification(result.workspaceVerification);
      await eventDrain.drain(session.id, transcriptId, true);
      const responseEventIds = eventDrain.capturedPhaseEventIds();
      if (responseEventIds.length > 0) await invokeCommand<void>("link_task_phase_run_events", {
        request: { taskId, receiptId: result.receipt.id, transcriptEventIds: responseEventIds },
      });
      return true;
    } catch (reason) {
      reportError(errorText(reason));
      return false;
    } finally {
      eventDrain.endPrompt();
      promptInFlight.current = false;
      setPromptBusy(false);
    }
  }
  const drain = (sessionId = session?.id, transcriptId = transcript.getActiveId()) =>
    eventDrain.drain(sessionId, transcriptId);
  async function stop(force: boolean) {
    if (!session) return;
    await runAction(async () => {
      setSession(
        await invokeCommand<AcpSessionInfo>("stop_acp_session", { sessionId: session.id, force }),
      );
      await drain(session.id);
    });
  }
  async function stopAllForDelete() {
    const all = (await invokeCommand<AcpSessionInfo[]>("list_acp_sessions")) ?? [];
    const running = all.filter(({ state }) => state === "running");
    for (const value of running) {
      await invokeCommand<AcpSessionInfo>("stop_acp_session", { sessionId: value.id, force: false });
    }
    if (running.length > 0) {
      setSession(null);
      setSource(null);
      setEvents([]);
      setPromptBusy(false);
      setPromptResult(null);
    }
    return running.length;
  }
  return {
    candidates, registryError, registryLoading, selectedCandidateId, session, events, prompt,
    promptResult, workspaceVerification, promptBusy, expanded, usable, canStartSelected, statusLabel, refreshRegistry,
    permissions: permission.permissions, respondPermission: permission.respond, startSelected,
    changeModel, sendPrompt, sendPhasePrompt, resumeTranscript, resumeError: recovery.error, resumingSessionId: recovery.resumingSessionId, drain,
    stop, stopAllForDelete,
    selectCandidate: setSelectedCandidateId,
    changePrompt: onPromptChange,
    toggleExpanded: () => setExpanded((value) => !value),
  };
}
function isLaunchable(candidate: AcpRegistryCandidate) {
  return candidate.status === "ready" || candidate.status === "installable";
}
