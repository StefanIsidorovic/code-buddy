import { useRef } from "react";
import type { AcpSessionEvent, TranscriptEventInfo } from "../../types/domain";
import { invokeCommand } from "../../lib/tauriGateway";

interface Options {
  append: (events: AcpSessionEvent[]) => void;
  getActiveTranscriptId: () => string | null;
  record: (transcriptId: string | null | undefined,
    events: AcpSessionEvent[]) => Promise<TranscriptEventInfo[]>;
}

export function useAcpEventDrain({ append, getActiveTranscriptId, record }: Options) {
  const activePromptTranscriptId = useRef<string | null>(null);
  const phaseEventIds = useRef<string[] | null>(null);
  const inFlight = useRef<Promise<TranscriptEventInfo[]> | null>(null);

  function beginPrompt(transcriptId: string | null, capturePhase = false) {
    activePromptTranscriptId.current = transcriptId;
    phaseEventIds.current = capturePhase ? [] : null;
  }

  function endPrompt() {
    activePromptTranscriptId.current = null;
    phaseEventIds.current = null;
  }

  async function drain(sessionId?: string | null, transcriptId?: string | null,
    flushAfterPending = false): Promise<TranscriptEventInfo[]> {
    if (!sessionId) return [];
    if (inFlight.current) {
      const pending = await inFlight.current;
      return flushAfterPending ? [...pending, ...await drain(sessionId, transcriptId)] : pending;
    }
    const targetTranscriptId = activePromptTranscriptId.current
      ?? transcriptId ?? getActiveTranscriptId();
    const operation = (async () => {
      const events = await invokeCommand<AcpSessionEvent[]>("drain_acp_events", { sessionId });
      if (events.length === 0) return [];
      append(events);
      const persisted = await record(targetTranscriptId, events);
      if (phaseEventIds.current) phaseEventIds.current.push(...persisted
        .filter(({ kind }) => kind === "agent_message" || kind === "agent_thought")
        .map(({ id }) => id));
      return persisted;
    })();
    inFlight.current = operation;
    try { return await operation; }
    finally { if (inFlight.current === operation) inFlight.current = null; }
  }

  function capturedPhaseEventIds() {
    return Array.from(new Set(phaseEventIds.current ?? []));
  }

  return { beginPrompt, endPrompt, drain, capturedPhaseEventIds };
}
