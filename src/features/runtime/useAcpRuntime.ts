import { useEffect, useMemo, useState } from "react";
import { errorText, formatPromptWithKnowledge } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type {
  AcpPromptResult,
  AcpRegistryCandidate,
  AcpSessionEvent,
  AcpSessionInfo,
  KnowledgeItemInfo,
  TaskInfo,
  TranscriptSessionInfo,
} from "../../types/domain";

interface TranscriptApi {
  create: (runtime: string, source: string, title: string) => Promise<TranscriptSessionInfo | null>;
  attachKnowledge: (sessionId: string) => Promise<void>;
  showLive: () => void;
  getActiveId: () => string | null;
  getTask: (id: string) => TaskInfo | null;
  upsertTask: (task: TaskInfo) => void;
  record: (id: string | null | undefined, events: AcpSessionEvent[]) => Promise<void>;
}
interface Options {
  projectId: string | null;
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
  const [promptBusy, setPromptBusy] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const selectedCandidate = useMemo(
    () => candidates.find(({ id }) => id === selectedCandidateId) ?? null,
    [candidates, selectedCandidateId],
  );
  const usable = session?.state === "running";
  const canStartSelected = !!selectedCandidate && isLaunchable(selectedCandidate) && !usable;
  const statusLabel = session
    ? `${source ?? session.agentName ?? "acp"} · ${session.state} · ${session.agentSessionId ?? "no agent session"}`
    : "not started";

  useEffect(() => {
    void refreshRegistry();
  }, []);
  useEffect(() => {
    if (!usable || !session) return;
    const timer = window.setInterval(() => void drain(session.id), 400);
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
  async function startSelected() {
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
      const transcriptSession = await transcript.create("acp", selectedCandidate.name, `${selectedCandidate.name} ACP`);
      if (transcriptSession) {
        await transcript.attachKnowledge(transcriptSession.id);
      }
      await drain(next.id, transcriptSession?.id ?? null);
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
  async function sendPrompt() {
    if (!usable || !session) return;
    setPromptBusy(true);
    reportError(null);
    try {
      transcript.showLive();
      const transcriptId = transcript.getActiveId();
      if (projectId && !transcriptId) throw new Error("A project Task requires an active transcript session.");
      if (projectId && transcriptId && !transcript.getTask(transcriptId)) {
        transcript.upsertTask(
          await invokeCommand<TaskInfo>("create_task", {
            request: { projectId, transcriptSessionId: transcriptId, originalPrompt: prompt },
          }),
        );
      }
      const userEvent: AcpSessionEvent = { kind: "user_message", content: prompt };
      setEvents((current) => [...current, userEvent]);
      await transcript.record(transcriptId, [userEvent]);
      setPromptResult(
        await invokeCommand<AcpPromptResult>("send_acp_prompt", {
          sessionId: session.id,
          prompt: formatPromptWithKnowledge(attachedKnowledge, prompt),
        }),
      );
      setPromptBusy(false);
      await drain(session.id, transcriptId);
    } catch (reason) {
      reportError(errorText(reason));
    } finally {
      setPromptBusy(false);
    }
  }
  async function drain(sessionId = session?.id, transcriptId = transcript.getActiveId()) {
    if (!sessionId) return;
    const next = await invokeCommand<AcpSessionEvent[]>("drain_acp_events", { sessionId });
    if (next.length > 0) {
      setEvents((current) => [...current, ...next]);
      await transcript.record(transcriptId, next);
    }
  }
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
      await invokeCommand<AcpSessionInfo>("stop_acp_session", {
        sessionId: value.id,
        force: false,
      });
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
    promptResult, promptBusy, expanded, usable, canStartSelected, statusLabel, refreshRegistry,
    startSelected, changeModel, sendPrompt, drain, stop, stopAllForDelete,
    selectCandidate: setSelectedCandidateId,
    changePrompt: onPromptChange,
    toggleExpanded: () => setExpanded((value) => !value),
  };
}

function isLaunchable(candidate: AcpRegistryCandidate) {
  return candidate.status === "ready" || candidate.status === "installable";
}
