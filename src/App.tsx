import { invoke } from "@tauri-apps/api/core";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [prompt, setPrompt] = useState("hello from frontend");
  const [cols, setCols] = useState(initialSize.cols);
  const [rows, setRows] = useState(initialSize.rows);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canUseSession = session?.state === "running";
  const statusLabel = useMemo(() => {
    if (!session) {
      return "not started";
    }

    return `${session.state} · ${session.cols}x${session.rows}`;
  }, [session]);

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

  async function startSession() {
    await runAction(async () => {
      const nextSession = await invoke<SessionInfo>("start_fake_session", {
        request: { cols, rows },
      });
      setSession(nextSession);
      setOutput("");
      await drainOutput(nextSession.id);
    });
  }

  async function sendInput(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUseSession || !session) {
      return;
    }

    await runAction(async () => {
      await invoke("write_session_input", {
        sessionId: session.id,
        text: `${prompt}\n`,
      });
      await drainOutput(session.id);
    });
  }

  async function resizeSession() {
    if (!canUseSession || !session) {
      return;
    }

    await runAction(async () => {
      const nextSession = await invoke<SessionInfo>("resize_session", {
        sessionId: session.id,
        cols,
        rows,
      });
      setSession(nextSession);
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
    }
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
          <h2 id="controls-title">Fake CLI Controls</h2>
        </div>

        <div className="button-row">
          <button type="button" onClick={startSession} disabled={busy || canUseSession}>
            Start
          </button>
          <button type="button" onClick={() => void drainOutput()} disabled={busy || !session}>
            Drain
          </button>
          <button type="button" onClick={() => void stopSession(false)} disabled={busy || !session}>
            Stop
          </button>
          <button type="button" onClick={() => void stopSession(true)} disabled={busy || !session}>
            Kill
          </button>
        </div>

        <form className="prompt-form" onSubmit={(event) => void sendInput(event)}>
          <label htmlFor="prompt">Input</label>
          <div className="inline-controls">
            <input
              id="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={!canUseSession || busy}
            />
            <button type="submit" disabled={!canUseSession || busy}>
              Send
            </button>
          </div>
        </form>

        <div className="size-grid" aria-label="PTY size">
          <label htmlFor="cols">Cols</label>
          <input
            id="cols"
            type="number"
            min="1"
            value={cols}
            onChange={(event) => setCols(Number(event.target.value))}
          />
          <label htmlFor="rows">Rows</label>
          <input
            id="rows"
            type="number"
            min="1"
            value={rows}
            onChange={(event) => setRows(Number(event.target.value))}
          />
          <button type="button" onClick={resizeSession} disabled={!canUseSession || busy}>
            Resize
          </button>
        </div>

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
        <pre aria-label="PTY output">{output || "No output yet."}</pre>
      </section>
    </main>
  );
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
