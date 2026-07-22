import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { AcpSessionEvent, AcpSessionInfo, TranscriptAcpIdentityInfo,
  TranscriptSessionInfo } from "../../types/domain";

interface Options {
  cwd?: string;
  scopeKey: string | null;
  sessionUsable: boolean;
  reportError: (message: string | null) => void;
}

export type AcpRecoveryResult = {
  identity: TranscriptAcpIdentityInfo;
  replay: AcpSessionEvent[];
  session: AcpSessionInfo;
};

export function useAcpRecovery({ cwd, scopeKey, sessionUsable, reportError }: Options) {
  const [resumingSessionId, setResumingSessionId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const scopeVersion = useRef(0);
  useEffect(() => { scopeVersion.current += 1; }, [cwd, scopeKey]);

  async function resume(transcript: TranscriptSessionInfo): Promise<AcpRecoveryResult | null> {
    if (sessionUsable || inFlight.current || transcript.runtime !== "acp") return null;
    inFlight.current = true;
    const version = scopeVersion.current;
    setResumingSessionId(transcript.id);
    reportError(null);
    try {
      const identity = await invokeCommand<TranscriptAcpIdentityInfo | null>(
        "get_transcript_acp_identity", { transcriptSessionId: transcript.id },
      );
      if (!identity) throw new Error("This saved session predates ACP recovery and cannot be resumed.");
      if (version !== scopeVersion.current) return null;
      const session = await invokeCommand<AcpSessionInfo>("load_acp_registry_session", {
        request: { candidateId: identity.candidateId, agentSessionId: identity.agentSessionId,
          ...(cwd ? { cwd } : {}) },
      });
      if (version !== scopeVersion.current) {
        await invokeCommand<AcpSessionInfo>("stop_acp_session", { sessionId: session.id, force: true });
        return null;
      }
      let replay: AcpSessionEvent[] = [];
      try { replay = await invokeCommand<AcpSessionEvent[]>("drain_acp_events", { sessionId: session.id }) ?? []; }
      catch (reason) { reportError(`Session resumed, but replay could not be loaded: ${errorText(reason)}`); }
      return { identity, replay, session };
    } catch (reason) {
      reportError(errorText(reason));
      return null;
    } finally {
      inFlight.current = false;
      setResumingSessionId(null);
    }
  }

  return { resume, resumingSessionId };
}
