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

type AgentDoctorStatus = "installed" | "missing" | "error";
type CapabilityStatus = "supported" | "unsupported" | "unknown";
type AcpRegistryCandidateStatus = "ready" | "installable" | "missing_runner" | "missing_binary";
type AcpRegistryDistributionKind = "npx" | "binary";

type AgentDoctorReport = {
  adapter: {
    id: string;
    displayName: string;
    executable: string;
    transports: {
      pty: CapabilityStatus;
      acpStdio: CapabilityStatus;
    };
  };
  status: AgentDoctorStatus;
  path: string | null;
  version: string | null;
  error: string | null;
  installHint: string;
};

type AcpRegistryCandidate = {
  id: string;
  name: string;
  version: string;
  description: string;
  distribution: AcpRegistryDistributionKind;
  status: AcpRegistryCandidateStatus;
  command: string[];
  runnerPath: string | null;
  installHint: string;
  sourceUrl: string;
};

type AcpSessionInfo = {
  id: string;
  state: SessionState;
  pid: number | null;
  protocolVersion: number | null;
  agentSessionId: string | null;
  agentName: string | null;
  agentVersion: string | null;
  exitCode: number | null;
};

type AcpEventKind =
  | "agent_message"
  | "user_message"
  | "plan"
  | "tool_call"
  | "usage"
  | "notice"
  | "error";

type AcpSessionEvent = {
  kind: AcpEventKind;
  content: string;
};

type AcpPromptResult = {
  sessionId: string;
  stopReason: string;
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
  const [doctorReports, setDoctorReports] = useState<AgentDoctorReport[]>([]);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [acpRegistryCandidates, setAcpRegistryCandidates] = useState<AcpRegistryCandidate[]>([]);
  const [acpRegistryError, setAcpRegistryError] = useState<string | null>(null);
  const [acpRegistryLoading, setAcpRegistryLoading] = useState(false);
  const [selectedAcpCandidateId, setSelectedAcpCandidateId] = useState<string | null>(null);
  const [acpSession, setAcpSession] = useState<AcpSessionInfo | null>(null);
  const [acpSessionSource, setAcpSessionSource] = useState<string | null>(null);
  const [acpEvents, setAcpEvents] = useState<AcpSessionEvent[]>([]);
  const [acpPrompt, setAcpPrompt] = useState("Hello from AIadne");
  const [acpPromptResult, setAcpPromptResult] = useState<AcpPromptResult | null>(null);
  const [busy, setBusy] = useState(false);

  const canUseSession = session?.state === "running";
  const canUseAcpSession = acpSession?.state === "running";
  const codexReport = doctorReports.find((report) => report.adapter.id === "codex") ?? null;
  const canStartCodex = codexReport?.status === "installed";
  const selectedAcpCandidate = useMemo(
    () =>
      acpRegistryCandidates.find((candidate) => candidate.id === selectedAcpCandidateId) ?? null,
    [acpRegistryCandidates, selectedAcpCandidateId],
  );
  const canStartSelectedAcpCandidate =
    !!selectedAcpCandidate &&
    isLaunchableAcpCandidate(selectedAcpCandidate) &&
    !canUseAcpSession;
  const acpStatusLabel = acpSession
    ? `${acpSessionSource ?? acpSession.agentName ?? "acp"} · ${acpSession.state} · ${
        acpSession.agentSessionId ?? "no agent session"
      }`
    : "not started";
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
    void refreshAgentDoctor();
    void refreshAcpRegistryCandidates();
  }, []);

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

  useEffect(() => {
    if (!canUseAcpSession || !acpSession) {
      return;
    }

    const timer = window.setInterval(() => {
      void drainAcpEvents(acpSession.id);
    }, 400);

    return () => window.clearInterval(timer);
  }, [acpSession?.id, canUseAcpSession]);

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
    if (kind === "codex" && !canStartCodex) {
      setError("Codex CLI is not ready. Check Agent Doctor.");
      return;
    }

    await runAction(async () => {
      const command = kind === "fake" ? "start_fake_session" : "start_codex_session";
      const size = fitTerminal();
      const nextSession = await invoke<SessionInfo>(command, {
        request: { cols: size.cols, rows: size.rows },
      });
      setActiveSession(nextSession);
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
      setActiveSession(nextSession);
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

  async function refreshAgentDoctor() {
    setDoctorLoading(true);
    setDoctorError(null);
    try {
      const reports = await invoke<AgentDoctorReport[]>("list_agent_doctor_reports");
      setDoctorReports(reports);
    } catch (err) {
      setDoctorError(errorText(err));
    } finally {
      setDoctorLoading(false);
    }
  }

  async function refreshAcpRegistryCandidates() {
    setAcpRegistryLoading(true);
    setAcpRegistryError(null);
    try {
      const candidates = await invoke<AcpRegistryCandidate[]>("list_acp_registry_candidates");
      setAcpRegistryCandidates(candidates);
      setSelectedAcpCandidateId((current) => {
        if (current && candidates.some((candidate) => candidate.id === current)) {
          return current;
        }

        return candidates[0]?.id ?? null;
      });
    } catch (err) {
      setAcpRegistryError(errorText(err));
    } finally {
      setAcpRegistryLoading(false);
    }
  }

  async function startFakeAcpSession() {
    await runAction(async () => {
      const nextSession = await invoke<AcpSessionInfo>("start_fake_acp_session", {
        request: {},
      });
      setAcpSession(nextSession);
      setAcpSessionSource("fake");
      setAcpEvents([]);
      setAcpPromptResult(null);
      await drainAcpEvents(nextSession.id);
    });
  }

  async function startSelectedAcpSession() {
    if (!selectedAcpCandidate || !isLaunchableAcpCandidate(selectedAcpCandidate)) {
      setError(selectedAcpCandidate?.installHint ?? "Select an ACP candidate first.");
      return;
    }

    await runAction(async () => {
      const nextSession = await invoke<AcpSessionInfo>("start_acp_registry_session", {
        request: {
          candidateId: selectedAcpCandidate.id,
        },
      });
      setAcpSession(nextSession);
      setAcpSessionSource(selectedAcpCandidate.name);
      setAcpEvents([]);
      setAcpPromptResult(null);
      await drainAcpEvents(nextSession.id);
    });
  }

  async function sendAcpPrompt() {
    if (!canUseAcpSession || !acpSession) {
      return;
    }

    await runAction(async () => {
      const result = await invoke<AcpPromptResult>("send_acp_prompt", {
        sessionId: acpSession.id,
        prompt: acpPrompt,
      });
      setAcpPromptResult(result);
      await drainAcpEvents(acpSession.id);
    });
  }

  async function drainAcpEvents(sessionId = acpSession?.id) {
    if (!sessionId) {
      return;
    }

    const events = await invoke<AcpSessionEvent[]>("drain_acp_events", { sessionId });
    if (events.length > 0) {
      setAcpEvents((current) => [...current, ...events]);
    }
  }

  async function stopAcpSession(force: boolean) {
    if (!acpSession) {
      return;
    }

    await runAction(async () => {
      const nextSession = await invoke<AcpSessionInfo>("stop_acp_session", {
        sessionId: acpSession.id,
        force,
      });
      setAcpSession(nextSession);
      await drainAcpEvents(acpSession.id);
    });
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
    setActiveSession(nextSession);
  }

  function setActiveSession(nextSession: SessionInfo) {
    sessionRef.current = nextSession;
    setSession(nextSession);
  }

  return (
    <main className="app-shell" aria-label="AIadne runtime test">
      <section className="intro-panel" aria-labelledby="app-title">
        <p className="eyebrow">AIadne</p>
        <h1 id="app-title">Runtime Test</h1>
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
            disabled={busy || canUseSession || !canStartCodex}
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

        <section className="doctor-panel" aria-labelledby="doctor-title">
          <div className="doctor-heading">
            <h3 id="doctor-title">Agent Doctor</h3>
            <button type="button" onClick={() => void refreshAgentDoctor()} disabled={doctorLoading}>
              Refresh
            </button>
          </div>

          {doctorError ? (
            <p className="error-message" role="alert">
              {doctorError}
            </p>
          ) : null}

          <ul className="doctor-list" aria-label="Agent CLI status">
            {doctorReports.map((report) => (
              <li className="doctor-item" data-status={report.status} key={report.adapter.id}>
                <div>
                  <strong>{report.adapter.displayName}</strong>
                  <span>{report.adapter.executable}</span>
                </div>
                <div>
                  <span className="doctor-status">{doctorStatusLabel(report.status)}</span>
                  <span>{doctorDetail(report)}</span>
                  <span>{transportDetail(report.adapter.transports)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="registry-panel" aria-labelledby="acp-registry-title">
          <div className="doctor-heading">
            <h3 id="acp-registry-title">ACP Registry</h3>
            <span>{selectedAcpCandidate ? selectedAcpCandidate.name : "none selected"}</span>
            <button
              type="button"
              onClick={() => void refreshAcpRegistryCandidates()}
              disabled={acpRegistryLoading}
            >
              Refresh
            </button>
          </div>

          {acpRegistryError ? (
            <p className="error-message" role="alert">
              {acpRegistryError}
            </p>
          ) : null}

          <ul className="registry-list" aria-label="ACP registry candidates">
            {acpRegistryCandidates.map((candidate) => (
              <li
                className="registry-item"
                data-selected={candidate.id === selectedAcpCandidate?.id}
                data-status={candidate.status}
                key={candidate.id}
              >
                <div>
                  <strong>{candidate.name}</strong>
                  <span>{candidate.description}</span>
                </div>
                <div>
                  <span className="doctor-status">{acpCandidateStatusLabel(candidate.status)}</span>
                  <span>{candidate.version} · {candidate.distribution}</span>
                  <code>{formatCommand(candidate.command)}</code>
                  <span>{candidate.installHint}</span>
                  <button
                    aria-label={`Select ${candidate.name} ACP candidate`}
                    aria-pressed={candidate.id === selectedAcpCandidate?.id}
                    type="button"
                    onClick={() => setSelectedAcpCandidateId(candidate.id)}
                  >
                    {candidate.id === selectedAcpCandidate?.id ? "Selected" : "Select"}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {selectedAcpCandidate ? (
            <dl className="selected-candidate" aria-label="Selected ACP candidate">
              <div>
                <dt>Selected ACP</dt>
                <dd>{selectedAcpCandidate.name}</dd>
              </div>
              <div>
                <dt>Command</dt>
                <dd>
                  <code>{formatCommand(selectedAcpCandidate.command)}</code>
                </dd>
              </div>
            </dl>
          ) : null}
        </section>

        <section className="acp-panel" aria-labelledby="acp-title">
          <div className="doctor-heading">
            <h3 id="acp-title">ACP Test</h3>
            <span>{acpStatusLabel}</span>
          </div>

          <div className="button-row">
            <button
              type="button"
              onClick={() => void startSelectedAcpSession()}
              disabled={busy || !canStartSelectedAcpCandidate}
            >
              Start Selected ACP
            </button>
            <button type="button" onClick={() => void startFakeAcpSession()} disabled={busy || canUseAcpSession}>
              Start Fake ACP
            </button>
            <button type="button" onClick={() => void sendAcpPrompt()} disabled={busy || !canUseAcpSession}>
              Send ACP
            </button>
            <button type="button" onClick={() => void drainAcpEvents()} disabled={busy || !acpSession}>
              Drain ACP
            </button>
            <button type="button" onClick={() => void stopAcpSession(false)} disabled={busy || !acpSession}>
              Stop ACP
            </button>
          </div>

          {canUseAcpSession ? (
            <p className="acp-result">Active ACP: {acpStatusLabel}. Stop it before starting another ACP session.</p>
          ) : null}

          <label className="prompt-field">
            <span>Prompt</span>
            <textarea
              aria-label="ACP prompt"
              onChange={(event) => setAcpPrompt(event.target.value)}
              rows={3}
              value={acpPrompt}
            />
          </label>

          {acpPromptResult ? (
            <p className="acp-result">Stop reason: {acpPromptResult.stopReason}</p>
          ) : null}
        </section>

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
        <section className="acp-events-panel" aria-labelledby="acp-events-title">
          <h3 id="acp-events-title">ACP Events</h3>
          <ul aria-label="ACP events">
            {acpEvents.length === 0 ? (
              <li>No ACP events yet.</li>
            ) : (
              acpEvents.map((event, index) => (
                <li data-kind={event.kind} key={`${event.kind}-${index}`}>
                  <strong>{acpEventLabel(event.kind)}</strong>
                  <span>{event.content}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </section>
    </main>
  );
}

function doctorStatusLabel(status: AgentDoctorStatus) {
  if (status === "installed") {
    return "Installed";
  }

  if (status === "missing") {
    return "Missing";
  }

  return "Error";
}

function doctorDetail(report: AgentDoctorReport) {
  if (report.status === "installed") {
    return report.version ?? report.path ?? "Ready";
  }

  if (report.status === "missing") {
    return report.installHint;
  }

  return report.error ?? report.installHint;
}

function transportDetail(transports: AgentDoctorReport["adapter"]["transports"]) {
  return `PTY: ${capabilityLabel(transports.pty)} · ACP: ${capabilityLabel(transports.acpStdio)}`;
}

function capabilityLabel(status: CapabilityStatus) {
  if (status === "supported") {
    return "Supported";
  }

  if (status === "unsupported") {
    return "Unsupported";
  }

  return "Unknown";
}

function acpCandidateStatusLabel(status: AcpRegistryCandidateStatus) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "installable") {
    return "Installable";
  }

  if (status === "missing_runner") {
    return "Missing runner";
  }

  return "Missing binary";
}

function isLaunchableAcpCandidate(candidate: AcpRegistryCandidate) {
  return candidate.status === "ready" || candidate.status === "installable";
}

function formatCommand(command: string[]) {
  return command.map((part) => (part.includes(" ") ? JSON.stringify(part) : part)).join(" ");
}

function acpEventLabel(kind: AcpEventKind) {
  if (kind === "agent_message") {
    return "Agent";
  }

  if (kind === "user_message") {
    return "User";
  }

  if (kind === "tool_call") {
    return "Tool";
  }

  if (kind === "error") {
    return "Error";
  }

  return kind.replace("_", " ");
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
