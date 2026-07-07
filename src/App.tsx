import { invoke } from "@tauri-apps/api/core";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

type SessionState = "running" | "exited" | "killed" | "errored";

type SessionInfo = {
  id: string;
  state: SessionState;
  pid: number | null;
  cols: number;
  rows: number;
  exitCode: number | null;
};

const initialSize = {
  cols: 80,
  rows: 24,
};

function App() {
  const terminalElement = useRef<HTMLDivElement | null>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const sessionRef = useRef<SessionInfo | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionKind, setSessionKind] = useState<"fake" | "codex" | null>(null);
  const [terminalSize, setTerminalSize] = useState(initialSize);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canUseSession = session?.state === "running";
  const statusLabel = useMemo(() => {
    if (!session) {
      return "not started";
    }

    return `${sessionKind ?? "session"} · ${session.state} · ${session.cols}x${session.rows}`;
  }, [session, sessionKind]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!terminalElement.current) {
      return;
    }

    const nextTerminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      scrollback: 1_000,
      theme: {
        background: "#111c18",
        foreground: "#d7ede3",
        cursor: "#d7ede3",
        selectionBackground: "#31584d",
      },
    });
    const nextFitAddon = new FitAddon();

    nextTerminal.loadAddon(nextFitAddon);
    nextTerminal.open(terminalElement.current);
    nextFitAddon.fit();
    setTerminalSize(readTerminalSize(nextTerminal));
    nextTerminal.writeln("No session yet.");

    terminal.current = nextTerminal;
    fitAddon.current = nextFitAddon;

    const inputDisposable = nextTerminal.onData((text) => {
      const activeSession = sessionRef.current;
      if (!activeSession || activeSession.state !== "running") {
        return;
      }

      void invoke("write_session_input", {
        sessionId: activeSession.id,
        text,
      }).catch((err) => setError(errorText(err)));
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.current?.fit();
      const nextSize = readTerminalSize(nextTerminal);
      setTerminalSize(nextSize);

      const activeSession = sessionRef.current;
      if (
        activeSession?.state === "running" &&
        (activeSession.cols !== nextSize.cols || activeSession.rows !== nextSize.rows)
      ) {
        void resizeSessionTo(activeSession.id, nextSize);
      }
    });
    resizeObserver.observe(terminalElement.current);

    return () => {
      inputDisposable.dispose();
      resizeObserver.disconnect();
      nextTerminal.dispose();
      terminal.current = null;
      fitAddon.current = null;
    };
  }, []);

  useEffect(() => {
    if (!canUseSession || !session) {
      return;
    }

    const timer = window.setInterval(() => {
      void drainOutput(session.id);
    }, 400);

    return () => window.clearInterval(timer);
  }, [canUseSession, session?.id]);

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function startSession(kind: "fake" | "codex") {
    await runAction(async () => {
      const command = kind === "fake" ? "start_fake_session" : "start_codex_session";
      const size = fitTerminal();
      const nextSession = await invoke<SessionInfo>(command, {
        request: { cols: size.cols, rows: size.rows },
      });
      setSession(nextSession);
      setSessionKind(kind);
      setOutput("");
      terminal.current?.reset();
      terminal.current?.focus();
      await drainOutput(nextSession.id);
    });
  }

  async function resizeSession() {
    if (!canUseSession || !session) {
      return;
    }

    await runAction(async () => {
      const size = fitTerminal();
      await resizeSessionTo(session.id, size);
    });
  }

  async function stopSession(force: boolean) {
    if (!session) {
      return;
    }

    await runAction(async () => {
      const nextSession = await invoke<SessionInfo>("stop_session", {
        sessionId: session.id,
        force,
      });
      setSession(nextSession);
      await drainOutput(session.id);
    });
  }

  async function drainOutput(sessionId = session?.id) {
    if (!sessionId) {
      return;
    }

    const chunk = await invoke<string>("drain_session_output", { sessionId });
    if (chunk.length > 0) {
      setOutput((current) => `${current}${chunk}`);
      terminal.current?.write(chunk);
    }
  }

  function fitTerminal() {
    fitAddon.current?.fit();
    const size = readTerminalSize(terminal.current);
    setTerminalSize(size);
    return size;
  }

  async function resizeSessionTo(sessionId: string, size: typeof initialSize) {
    const nextSession = await invoke<SessionInfo>("resize_session", {
      sessionId,
      cols: size.cols,
      rows: size.rows,
    });
    setSession(nextSession);
  }

  return (
    <main className="app-shell" aria-label="AIadne PTY test">
      <section className="intro-panel" aria-labelledby="app-title">
        <p className="eyebrow">AIadne</p>
        <h1 id="app-title">PTY Test</h1>
        <dl className="status-list">
          <div>
            <dt>Status</dt>
            <dd>{statusLabel}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>{session?.id.slice(0, 8) ?? "none"}</dd>
          </div>
          <div>
            <dt>PID</dt>
            <dd>{session?.pid ?? "none"}</dd>
          </div>
        </dl>
      </section>

      <section className="control-panel" aria-labelledby="controls-title">
        <div className="section-heading">
          <p className="eyebrow">AIA-002</p>
          <h2 id="controls-title">PTY Controls</h2>
        </div>

        <div className="button-row">
          <button
            type="button"
            onClick={() => void startSession("fake")}
            disabled={busy || canUseSession}
          >
            Start Fake
          </button>
          <button
            type="button"
            onClick={() => void startSession("codex")}
            disabled={busy || canUseSession}
          >
            Start Codex
          </button>
          <button type="button" onClick={() => void drainOutput()} disabled={busy || !session}>
            Drain
          </button>
          <button type="button" onClick={resizeSession} disabled={busy || !canUseSession}>
            Resize
          </button>
          <button type="button" onClick={() => void stopSession(false)} disabled={busy || !session}>
            Stop
          </button>
          <button type="button" onClick={() => void stopSession(true)} disabled={busy || !session}>
            Kill
          </button>
        </div>

        <dl className="terminal-meta" aria-label="Terminal state">
          <div>
            <dt>Terminal</dt>
            <dd>{terminalSize.cols}x{terminalSize.rows}</dd>
          </div>
        </dl>

        {error ? (
          <p className="error-message" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="output-panel" aria-labelledby="output-title">
        <div className="section-heading">
          <p className="eyebrow">Output</p>
          <h2 id="output-title">PTY Stream</h2>
        </div>
        <div
          className="terminal-frame"
          aria-label="Interactive PTY terminal"
          onClick={() => terminal.current?.focus()}
          ref={terminalElement}
        />
        <span className="sr-only">{output || "No output yet."}</span>
      </section>
    </main>
  );
}

function readTerminalSize(activeTerminal: Terminal | null) {
  return {
    cols: Math.max(1, activeTerminal?.cols ?? initialSize.cols),
    rows: Math.max(1, activeTerminal?.rows ?? initialSize.rows),
  };
}

function errorText(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return JSON.stringify(error);
}

export default App;
