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

const acpEventKinds = new Set<string>([
  "agent_message",
  "user_message",
  "plan",
  "tool_call",
  "usage",
  "notice",
  "error",
]);

type AcpPromptResult = {
  sessionId: string;
  stopReason: string;
};

type ProjectInfo = {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  updatedAt: number;
};

type TranscriptSessionInfo = {
  id: string;
  projectId: string | null;
  runtime: string;
  source: string;
  title: string;
  startedAt: number;
  updatedAt: number;
  eventCount: number;
};

type TranscriptEventInfo = {
  id: string;
  sessionId: string;
  sequence: number;
  kind: string;
  content: string;
  createdAt: number;
};

type RuntimeMode = "pty" | "acp";

const initialSize = {
  cols: 80,
  rows: 24,
};

function App() {
  const terminalElement = useRef<HTMLDivElement | null>(null);
  const acpEventsList = useRef<HTMLUListElement | null>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const sessionRef = useRef<SessionInfo | null>(null);
  const transcriptOpenRequest = useRef(0);
  const transcriptSessionRef = useRef<TranscriptSessionInfo | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionKind, setSessionKind] = useState<"fake" | "codex" | null>(null);
  const [terminalSize, setTerminalSize] = useState(initialSize);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [doctorReports, setDoctorReports] = useState<AgentDoctorReport[]>([]);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [transcriptSession, setTranscriptSession] = useState<TranscriptSessionInfo | null>(null);
  const [transcriptSessions, setTranscriptSessions] = useState<TranscriptSessionInfo[]>([]);
  const [openedTranscriptSession, setOpenedTranscriptSession] =
    useState<TranscriptSessionInfo | null>(null);
  const [openedTranscriptEvents, setOpenedTranscriptEvents] = useState<AcpSessionEvent[]>([]);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
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
  const [acpPromptBusy, setAcpPromptBusy] = useState(false);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("acp");

  const canUseSession = session?.state === "running";
  const canUseAcpSession = acpSession?.state === "running";
  const codexReport = doctorReports.find((report) => report.adapter.id === "codex") ?? null;
  const canStartCodex = codexReport?.status === "installed";
  const selectedAcpCandidate = useMemo(
    () =>
      acpRegistryCandidates.find((candidate) => candidate.id === selectedAcpCandidateId) ?? null,
    [acpRegistryCandidates, selectedAcpCandidateId],
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const selectedHistorySessionId = openedTranscriptSession?.id ?? transcriptSession?.id ?? null;
  const displayAcpEvents = useMemo(
    () =>
      openedTranscriptSession
        ? coalesceTranscriptEvents(openedTranscriptEvents)
        : coalesceAcpEvents(acpEvents),
    [acpEvents, openedTranscriptEvents, openedTranscriptSession],
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
    transcriptSessionRef.current = transcriptSession;
  }, [transcriptSession]);

  useEffect(() => {
    if (runtimeMode !== "acp" || displayAcpEvents.length === 0) {
      return;
    }

    acpEventsList.current?.scrollTo?.({
      top: acpEventsList.current.scrollHeight,
    });
  }, [displayAcpEvents, runtimeMode]);

  useEffect(() => {
    void refreshProjects();
    void refreshAgentDoctor();
    void refreshAcpRegistryCandidates();
  }, []);

  useEffect(() => {
    void refreshTranscriptSessions(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (runtimeMode !== "pty") {
      return;
    }

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
    if (output.length > 0) {
      nextTerminal.write(output);
    } else {
      nextTerminal.writeln("No session yet.");
    }

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
  }, [runtimeMode]);

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
  }, [acpSession?.id, canUseAcpSession, transcriptSession?.id]);

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

  async function refreshProjects() {
    setProjectLoading(true);
    setProjectError(null);
    try {
      const nextProjects = await invoke<ProjectInfo[]>("list_projects");
      setProjects(nextProjects);
      setSelectedProjectId((current) => {
        if (current && nextProjects.some((project) => project.id === current)) {
          return current;
        }

        return nextProjects[0]?.id ?? null;
      });
    } catch (err) {
      setProjectError(errorText(err));
    } finally {
      setProjectLoading(false);
    }
  }

  async function createProject() {
    await runAction(async () => {
      const project = await invoke<ProjectInfo>("create_project", {
        request: {
          name: projectName,
          path: projectPath,
        },
      });
      setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
      setSelectedProjectId(project.id);
      setProjectName("");
      setProjectPath("");
    });
  }

  async function deleteProject(projectId: string) {
    await runAction(async () => {
      await invoke("delete_project", { projectId });
      setProjects((current) => current.filter((project) => project.id !== projectId));
      setSelectedProjectId((current) => (current === projectId ? null : current));
    });
  }

  async function refreshTranscriptSessions(projectId = selectedProjectId) {
    setTranscriptLoading(true);
    setTranscriptError(null);
    try {
      const nextSessions =
        (await invoke<TranscriptSessionInfo[]>("list_transcript_sessions", {
          projectId: projectId ?? null,
        })) ?? [];
      setTranscriptSessions(nextSessions);
      if (
        openedTranscriptSession &&
        !nextSessions.some((session) => session.id === openedTranscriptSession.id)
      ) {
        setOpenedTranscriptSession(null);
        setOpenedTranscriptEvents([]);
      }
    } catch (err) {
      setTranscriptError(errorText(err));
    } finally {
      setTranscriptLoading(false);
    }
  }

  async function createTranscriptSession(runtime: string, source: string, title: string) {
    setTranscriptError(null);
    try {
      const nextSession = await invoke<TranscriptSessionInfo | null>("create_transcript_session", {
        request: {
          projectId: selectedProject?.id ?? null,
          runtime,
          source,
          title,
        },
      });
      if (!nextSession) {
        transcriptSessionRef.current = null;
        setTranscriptSession(null);
        return null;
      }

      transcriptSessionRef.current = nextSession;
      setTranscriptSession(nextSession);
      setOpenedTranscriptSession(null);
      setOpenedTranscriptEvents([]);
      setTranscriptSessions((current) => [
        nextSession,
        ...current.filter((session) => session.id !== nextSession.id),
      ]);
      return nextSession;
    } catch (err) {
      transcriptSessionRef.current = null;
      setTranscriptSession(null);
      setTranscriptError(errorText(err));
      return null;
    }
  }

  async function openTranscriptSession(session: TranscriptSessionInfo) {
    const requestId = transcriptOpenRequest.current + 1;
    transcriptOpenRequest.current = requestId;
    setRuntimeMode("acp");
    setOpenedTranscriptSession(session);
    setOpenedTranscriptEvents([]);
    setTranscriptLoading(true);
    setTranscriptError(null);
    try {
      const events =
        (await invoke<TranscriptEventInfo[]>("list_transcript_events", {
          sessionId: session.id,
        })) ?? [];
      if (transcriptOpenRequest.current !== requestId) {
        return;
      }
      setOpenedTranscriptSession(session);
      setOpenedTranscriptEvents(events.map(transcriptEventToAcpEvent));
    } catch (err) {
      if (transcriptOpenRequest.current !== requestId) {
        return;
      }
      setTranscriptError(errorText(err));
    } finally {
      if (transcriptOpenRequest.current === requestId) {
        setTranscriptLoading(false);
      }
    }
  }

  function showLiveAcpEvents() {
    transcriptOpenRequest.current += 1;
    setRuntimeMode("acp");
    setOpenedTranscriptSession(null);
    setOpenedTranscriptEvents([]);
  }

  async function recordTranscriptEvents(
    transcriptId: string | null | undefined,
    events: AcpSessionEvent[],
  ) {
    if (!transcriptId) {
      return;
    }

    const cleanEvents = coalesceTranscriptEvents(
      events
        .map((event) => ({
          kind: event.kind,
          content: event.content,
        }))
        .filter((event) => event.content.trim().length > 0),
    );
    if (cleanEvents.length === 0) {
      return;
    }

    setTranscriptError(null);
    try {
      const inserted = await invoke<TranscriptEventInfo[]>("append_transcript_events", {
        sessionId: transcriptId,
        events: cleanEvents,
      });
      touchTranscriptSession(transcriptId, inserted);
    } catch (err) {
      setTranscriptError(errorText(err));
    }
  }

  function touchTranscriptSession(transcriptId: string, insertedEvents: TranscriptEventInfo[]) {
    if (insertedEvents.length === 0) {
      return;
    }

    const updatedAt = insertedEvents[insertedEvents.length - 1].createdAt;
    setTranscriptSessions((current) =>
      current.map((session) =>
        session.id === transcriptId
          ? {
              ...session,
              updatedAt,
              eventCount: session.eventCount + insertedEvents.length,
            }
          : session,
      ),
    );
    setTranscriptSession((current) =>
      current?.id === transcriptId
        ? {
            ...current,
            updatedAt,
            eventCount: current.eventCount + insertedEvents.length,
          }
        : current,
    );
    if (openedTranscriptSession?.id === transcriptId) {
      setOpenedTranscriptEvents((current) => [
        ...current,
        ...insertedEvents.map(transcriptEventToAcpEvent),
      ]);
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
        request: {
          cols: size.cols,
          rows: size.rows,
          ...selectedProjectCwd(selectedProject),
        },
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
        request: {
          ...selectedProjectCwd(selectedProject),
        },
      });
      setAcpSession(nextSession);
      setAcpSessionSource("fake");
      setAcpEvents([]);
      setAcpPromptResult(null);
      const transcript = await createTranscriptSession("acp", "fake", "Fake ACP");
      await drainAcpEvents(nextSession.id, transcript?.id ?? null);
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
          ...selectedProjectCwd(selectedProject),
        },
      });
      setAcpSession(nextSession);
      setAcpSessionSource(selectedAcpCandidate.name);
      setAcpEvents([]);
      setAcpPromptResult(null);
      const transcript = await createTranscriptSession(
        "acp",
        selectedAcpCandidate.name,
        `${selectedAcpCandidate.name} ACP`,
      );
      await drainAcpEvents(nextSession.id, transcript?.id ?? null);
    });
  }

  async function sendAcpPrompt() {
    if (!canUseAcpSession || !acpSession) {
      return;
    }

    setAcpPromptBusy(true);
    setError(null);
    try {
      showLiveAcpEvents();
      const activeTranscriptId = transcriptSessionRef.current?.id ?? transcriptSession?.id ?? null;
      const userEvent: AcpSessionEvent = {
        kind: "user_message",
        content: acpPrompt,
      };
      setAcpEvents((current) => [...current, userEvent]);
      await recordTranscriptEvents(activeTranscriptId, [userEvent]);

      const result = await invoke<AcpPromptResult>("send_acp_prompt", {
        sessionId: acpSession.id,
        prompt: acpPrompt,
      });
      setAcpPromptResult(result);
      await drainAcpEvents(acpSession.id, activeTranscriptId);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setAcpPromptBusy(false);
    }
  }

  async function drainAcpEvents(
    sessionId = acpSession?.id,
    transcriptId = transcriptSessionRef.current?.id ?? null,
  ) {
    if (!sessionId) {
      return;
    }

    const events = await invoke<AcpSessionEvent[]>("drain_acp_events", { sessionId });
    if (events.length > 0) {
      setAcpEvents((current) => [...current, ...events]);
      await recordTranscriptEvents(transcriptId, events);
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
      <section className="intro-panel" aria-labelledby="runtime-sidebar-title">
        <div className="sidebar-brand">
          <p className="eyebrow">AIadne</p>
          <h1 id="runtime-sidebar-title">Runtime</h1>
        </div>

        <div className="runtime-switch" role="group" aria-label="Runtime mode">
          <button
            type="button"
            aria-pressed={runtimeMode === "pty"}
            onClick={() => setRuntimeMode("pty")}
          >
            Terminal PTY
          </button>
          <button
            type="button"
            aria-pressed={runtimeMode === "acp"}
            onClick={() => setRuntimeMode("acp")}
          >
            Structured ACP
          </button>
        </div>

        <div className="sidebar-scroll">
          {runtimeMode === "pty" ? (
            <details className="agent-accordion sidebar-agent">
              <summary>
                <span>PTY Agents</span>
                <strong>{canStartCodex ? "Codex ready" : "Check CLIs"}</strong>
              </summary>

              <div className="accordion-body">
                <div className="doctor-heading">
                  <h3 id="sidebar-doctor-title">Agent Doctor</h3>
                  <button
                    type="button"
                    onClick={() => void refreshAgentDoctor()}
                    disabled={doctorLoading}
                  >
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
              </div>
            </details>
          ) : null}

          {runtimeMode === "acp" ? (
            <details className="agent-accordion sidebar-agent">
              <summary>
                <span>ACP Agents</span>
                <strong>{selectedAcpCandidate ? selectedAcpCandidate.name : "none selected"}</strong>
              </summary>

              <div className="accordion-body">
                <div className="doctor-heading">
                  <h3 id="sidebar-acp-registry-title">ACP Registry</h3>
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
                          disabled={busy || canUseAcpSession}
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
              </div>
            </details>
          ) : null}

          <details className="agent-accordion sidebar-history" open>
            <summary>
              <span>Session History</span>
              <strong>{transcriptSessions.length} saved</strong>
            </summary>

            <div className="accordion-body">
              <div className="doctor-heading">
                <h3 id="history-title">Session History</h3>
                <span>{transcriptSession ? transcriptSession.title : "none active"}</span>
                <button
                  type="button"
                  onClick={() => void refreshTranscriptSessions()}
                  disabled={transcriptLoading}
                >
                  Refresh
                </button>
              </div>

              {transcriptError ? (
                <p className="error-message" role="alert">
                  {transcriptError}
                </p>
              ) : null}

              <ul className="history-list" aria-label="Session history">
                {transcriptSessions.length === 0 ? (
                  <li>No saved sessions yet.</li>
                ) : (
                  transcriptSessions.map((historySession) => (
                    <li
                      data-selected={historySession.id === selectedHistorySessionId}
                      key={historySession.id}
                    >
                      <button
                        type="button"
                        aria-label={`Open ${historySession.title} transcript`}
                        aria-pressed={historySession.id === selectedHistorySessionId}
                        onClick={() => void openTranscriptSession(historySession)}
                        disabled={transcriptLoading}
                      >
                        <strong>{historySession.title}</strong>
                        <span>
                          {historySession.source} · {historySession.runtime} ·{" "}
                          {historySession.eventCount} events
                        </span>
                        <small>
                          {formatTimestamp(historySession.updatedAt)} · {shortId(historySession.id)}
                        </small>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </details>
        </div>

        <dl className="status-list sidebar-status">
          <div>
            <dt>Status</dt>
            <dd>{runtimeMode === "acp" ? acpStatusLabel : statusLabel}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>
              {runtimeMode === "acp"
                ? acpSession?.id.slice(0, 8) ?? "none"
                : session?.id.slice(0, 8) ?? "none"}
            </dd>
          </div>
          <div>
            <dt>PID</dt>
            <dd>{runtimeMode === "acp" ? acpSession?.pid ?? "none" : session?.pid ?? "none"}</dd>
          </div>
          <div>
            <dt>Workspace</dt>
            <dd>{selectedProject?.name ?? "none"}</dd>
          </div>
        </dl>
      </section>

      <section className="control-panel" aria-labelledby="controls-title">
        <div className="section-heading">
          <p className="eyebrow">Runtime</p>
          <h2 id="controls-title">Runtime Controls</h2>
        </div>

        <section className="workspace-panel" aria-labelledby="workspace-title">
          <div className="doctor-heading">
            <h3 id="workspace-title">Workspace</h3>
            <span>{selectedProject ? selectedProject.name : "none selected"}</span>
            <button type="button" onClick={() => void refreshProjects()} disabled={projectLoading}>
              Refresh
            </button>
          </div>

          {projectError ? (
            <p className="error-message" role="alert">
              {projectError}
            </p>
          ) : null}

          <div className="workspace-form">
            <label>
              <span>Name</span>
              <input
                aria-label="Project name"
                onChange={(event) => setProjectName(event.target.value)}
                value={projectName}
              />
            </label>
            <label>
              <span>Path</span>
              <input
                aria-label="Project path"
                onChange={(event) => setProjectPath(event.target.value)}
                value={projectPath}
              />
            </label>
            <button
              type="button"
              onClick={() => void createProject()}
              disabled={busy || !projectName.trim() || !projectPath.trim()}
            >
              Add Project
            </button>
          </div>

          <ul className="project-list" aria-label="Projects">
            {projects.length === 0 ? (
              <li>No projects yet.</li>
            ) : (
              projects.map((project) => (
                <li data-selected={project.id === selectedProject?.id} key={project.id}>
                  <div>
                    <strong>{project.name}</strong>
                    <span>{project.path}</span>
                  </div>
                  <div className="project-actions">
                    <button
                      aria-label={`Select ${project.name} project`}
                      aria-pressed={project.id === selectedProject?.id}
                      type="button"
                      onClick={() => setSelectedProjectId(project.id)}
                      disabled={busy || canUseSession || canUseAcpSession}
                    >
                      {project.id === selectedProject?.id ? "Selected" : "Select"}
                    </button>
                    <button
                      aria-label={`Delete ${project.name} project`}
                      type="button"
                      onClick={() => void deleteProject(project.id)}
                      disabled={busy || canUseSession || canUseAcpSession}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        {runtimeMode === "pty" ? (
          <section className="runtime-panel" aria-labelledby="pty-controls-title">
            <div className="doctor-heading">
              <h3 id="pty-controls-title">PTY Controls</h3>
              <span>{statusLabel}</span>
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
          </section>
        ) : null}

        {runtimeMode === "acp" ? (
          <section className="runtime-panel" aria-labelledby="acp-title">
            <div className="doctor-heading">
              <h3 id="acp-title">ACP Controls</h3>
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
              <button
                type="button"
                onClick={() => void sendAcpPrompt()}
                disabled={busy || acpPromptBusy || !canUseAcpSession}
              >
                Send ACP
              </button>
              <button type="button" onClick={() => void drainAcpEvents()} disabled={!acpSession}>
                Drain ACP
              </button>
              <button type="button" onClick={() => void stopAcpSession(false)} disabled={!acpSession}>
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
        ) : null}

        {error ? (
          <p className="error-message" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="output-panel" aria-labelledby="output-title">
        <div className="section-heading">
          <p className="eyebrow">Output</p>
          <h2 id="output-title">Session Output</h2>
        </div>
        <div className="output-body">
          {runtimeMode === "pty" ? (
            <section className="terminal-output" aria-labelledby="terminal-output-title">
              <h3 id="terminal-output-title">PTY Stream</h3>
              <div
                className="terminal-frame"
                aria-label="Interactive PTY terminal"
                onClick={() => terminal.current?.focus()}
                ref={terminalElement}
              />
              <span className="sr-only">{output || "No output yet."}</span>
            </section>
          ) : null}

          {runtimeMode === "acp" ? (
            <section className="acp-events-panel" aria-labelledby="acp-events-title">
              <div className="output-heading">
                <div>
                  <h3 id="acp-events-title">
                    {openedTranscriptSession ? "Saved Transcript" : "ACP Events"}
                  </h3>
                  {openedTranscriptSession ? (
                    <p>
                      {openedTranscriptSession.title} ·{" "}
                      {openedTranscriptSession.eventCount} events ·{" "}
                      {shortId(openedTranscriptSession.id)}
                    </p>
                  ) : null}
                </div>
                {openedTranscriptSession ? (
                  <button type="button" onClick={showLiveAcpEvents}>
                    View Live ACP
                  </button>
                ) : null}
              </div>
              <ul aria-label="ACP events" ref={acpEventsList}>
                {displayAcpEvents.length === 0 ? (
                  <li>
                    {openedTranscriptSession
                      ? "No saved events in this transcript yet."
                      : "No ACP events yet."}
                  </li>
                ) : (
                  displayAcpEvents.map((event, index) => (
                    <li data-kind={event.kind} key={`${event.kind}-${index}`}>
                      <strong>
                        {openedTranscriptSession
                          ? transcriptEventLabel(event.kind)
                          : acpEventLabel(event.kind)}
                      </strong>
                      <span>{event.content}</span>
                    </li>
                  ))
                )}
              </ul>
            </section>
          ) : null}
        </div>
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

function selectedProjectCwd(project: ProjectInfo | null) {
  return project ? { cwd: project.path } : {};
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp * 1_000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function coalesceAcpEvents(events: AcpSessionEvent[]) {
  return coalesceEvents(events, (kind) => kind === "agent_message" || kind === "plan");
}

function coalesceTranscriptEvents(events: AcpSessionEvent[]) {
  return coalesceEvents(events, (kind) => kind === "agent_message" || kind === "plan");
}

function coalesceEvents(
  events: AcpSessionEvent[],
  shouldMergeKind: (kind: AcpEventKind) => boolean,
) {
  const coalesced: AcpSessionEvent[] = [];

  for (const event of events) {
    const previous = coalesced[coalesced.length - 1];
    if (
      previous &&
      previous.kind === event.kind &&
      shouldMergeKind(event.kind)
    ) {
      previous.content = joinAcpText(previous.content, event.content);
    } else {
      coalesced.push({ ...event });
    }
  }

  return coalesced;
}

function joinAcpText(left: string, right: string) {
  if (!left.trim()) {
    return right;
  }

  if (!right.trim()) {
    return left;
  }

  if (left.endsWith("\n") || right.startsWith("\n")) {
    return `${left}${right}`;
  }

  return `${left} ${right}`;
}

function transcriptEventToAcpEvent(event: TranscriptEventInfo): AcpSessionEvent {
  return {
    kind: isAcpEventKind(event.kind) ? event.kind : "notice",
    content: event.content,
  };
}

function isAcpEventKind(kind: string): kind is AcpEventKind {
  return acpEventKinds.has(kind);
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

  if (kind === "plan") {
    return "Plan";
  }

  if (kind === "notice") {
    return "Notice";
  }

  if (kind === "usage") {
    return "Usage";
  }

  if (kind === "error") {
    return "Error";
  }
}

function transcriptEventLabel(kind: AcpEventKind) {
  if (kind === "user_message") {
    return "Question";
  }

  if (kind === "agent_message") {
    return "Answer";
  }

  return acpEventLabel(kind);
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
