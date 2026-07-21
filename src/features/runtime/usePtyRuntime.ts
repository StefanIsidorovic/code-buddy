import { useEffect, useMemo, useState } from "react";
import { invokeCommand } from "../../lib/tauriGateway";
import type { RuntimeMode, SessionInfo } from "../../types/domain";
import { usePtyTerminal, type TerminalSize } from "./usePtyTerminal";

interface Options {
  mode: RuntimeMode;
  cwd?: string;
  canStartCodex: boolean;
  runAction: (action: () => Promise<void>) => Promise<void>;
  reportError: (message: string) => void;
}

export function usePtyRuntime({ mode, cwd, canStartCodex, runAction, reportError }: Options) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionKind, setSessionKind] = useState<"fake" | "codex" | null>(null);
  const [output, setOutput] = useState("");
  const terminal = usePtyTerminal({
    mode,
    output,
    session,
    onError: reportError,
    onResizeSession: (sessionId, size) => {
      void resizeTo(sessionId, size);
    },
  });
  const usable = session?.state === "running";
  const statusLabel = useMemo(
    () => session
      ? `${sessionKind ?? "session"} · ${session.state} · ${session.cols}x${session.rows}`
      : "not started",
    [session, sessionKind],
  );

  useEffect(() => {
    if (!usable || !session) return;
    const timer = window.setInterval(() => void drain(session.id), 400);
    return () => window.clearInterval(timer);
  }, [session?.id, usable]);

  async function start(kind: "fake" | "codex") {
    if (kind === "codex" && !canStartCodex) {
      reportError("Codex CLI is not ready. Check Agent Doctor.");
      return;
    }
    await runAction(async () => {
      const command = kind === "fake" ? "start_fake_session" : "start_codex_session";
      const size = terminal.fit();
      const next = await invokeCommand<SessionInfo>(command, {
        request: { cols: size.cols, rows: size.rows, ...(cwd ? { cwd } : {}) },
      });
      setSession(next);
      setSessionKind(kind);
      setOutput("");
      terminal.reset();
      terminal.focus();
      await drain(next.id);
    });
  }

  async function resize() {
    if (!usable || !session) return;
    await runAction(async () => resizeTo(session.id, terminal.fit()));
  }

  async function resizeTo(sessionId: string, size: TerminalSize) {
    setSession(await invokeCommand<SessionInfo>("resize_session", {
      sessionId,
      cols: size.cols,
      rows: size.rows,
    }));
  }

  async function stop(force: boolean) {
    if (!session) return;
    await runAction(async () => {
      setSession(await invokeCommand<SessionInfo>("stop_session", { sessionId: session.id, force }));
      await drain(session.id);
    });
  }

  async function drain(sessionId = session?.id) {
    if (!sessionId) return;
    const chunk = await invokeCommand<string>("drain_session_output", { sessionId });
    if (chunk.length > 0) {
      setOutput((current) => `${current}${chunk}`);
      terminal.write(chunk);
    }
  }

  return {
    session,
    output,
    usable,
    statusLabel,
    terminalElement: terminal.elementRef,
    terminalSize: terminal.size,
    focusTerminal: terminal.focus,
    start,
    resize,
    stop,
    drain,
  };
}
