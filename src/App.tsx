import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
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
  cwd: string;
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
  cwd: string;
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

type ProjectRepositoryInfo = {
  id: string;
  projectId: string;
  name: string;
  path: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
};

type ProjectInitializationInfo = {
  id: string;
  projectId: string;
  status: string;
  repositoryCount: number;
  createdAt: number;
  updatedAt: number;
};

type ProjectInitializationFactInfo = {
  id: string;
  initializationId: string;
  repositoryId: string;
  repositoryName: string;
  repositoryPath: string;
  kind: string;
  label: string;
  value: string;
  source: string;
  createdAt: number;
};

type ProjectInitializationMarkdownFindingInfo = {
  id: string;
  initializationId: string;
  repositoryId: string;
  repositoryName: string;
  repositoryPath: string;
  filePath: string;
  category: string;
  title: string;
  excerpt: string;
  source: string;
  createdAt: number;
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

type KnowledgeItemInfo = {
  id: string;
  projectId: string | null;
  title: string;
  body: string;
  kind: string;
  scope: string;
  sourceTranscriptSessionId: string | null;
  createdAt: number;
  updatedAt: number;
};

type RuntimeMode = "pty" | "acp";
type ToastKind = "success" | "error";

type ToastMessage = {
  id: string;
  kind: ToastKind;
  text: string;
};

const toastDismissMs = 4_000;

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
  const toastSequence = useRef(0);
  const toastTimers = useRef<number[]>([]);
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
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectFolderPicking, setProjectFolderPicking] = useState(false);
  const [projectDeleteCandidate, setProjectDeleteCandidate] = useState<ProjectInfo | null>(null);
  const [projectDeleteError, setProjectDeleteError] = useState<string | null>(null);
  const [projectRepositories, setProjectRepositories] = useState<ProjectRepositoryInfo[]>([]);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string | null>(null);
  const [repositoryName, setRepositoryName] = useState("");
  const [repositoryPath, setRepositoryPath] = useState("");
  const [repositoryLoading, setRepositoryLoading] = useState(false);
  const [initializeDialogOpen, setInitializeDialogOpen] = useState(false);
  const [initializeRepositoryIds, setInitializeRepositoryIds] = useState<string[]>([]);
  const [initializeLoading, setInitializeLoading] = useState(false);
  const [initializeError, setInitializeError] = useState<string | null>(null);
  const [projectInitializationsByProjectId, setProjectInitializationsByProjectId] = useState<
    Record<string, ProjectInitializationInfo>
  >({});
  const [initializationFactsByInitializationId, setInitializationFactsByInitializationId] =
    useState<Record<string, ProjectInitializationFactInfo[]>>({});
  const [
    initializationMarkdownFindingsByInitializationId,
    setInitializationMarkdownFindingsByInitializationId,
  ] = useState<Record<string, ProjectInitializationMarkdownFindingInfo[]>>({});
  const [transcriptSession, setTranscriptSession] = useState<TranscriptSessionInfo | null>(null);
  const [transcriptSessions, setTranscriptSessions] = useState<TranscriptSessionInfo[]>([]);
  const [openedTranscriptSession, setOpenedTranscriptSession] =
    useState<TranscriptSessionInfo | null>(null);
  const [openedTranscriptEvents, setOpenedTranscriptEvents] = useState<AcpSessionEvent[]>([]);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");
  const [historyRenameTitle, setHistoryRenameTitle] = useState("");
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItemInfo[]>([]);
  const [attachedKnowledgeIds, setAttachedKnowledgeIds] = useState<string[]>([]);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeBody, setKnowledgeBody] = useState("");
  const [knowledgeKind, setKnowledgeKind] = useState("decision");
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeDialogOpen, setKnowledgeDialogOpen] = useState(false);
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
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
  const projectInitialization = selectedProjectId
    ? projectInitializationsByProjectId[selectedProjectId] ?? null
    : null;
  const projectInitializationFacts = projectInitialization
    ? initializationFactsByInitializationId[projectInitialization.id] ?? []
    : [];
  const projectInitializationMarkdownFindings = projectInitialization
    ? initializationMarkdownFindingsByInitializationId[projectInitialization.id] ?? []
    : [];
  const selectedRepository = useMemo(
    () =>
      projectRepositories.find((repository) => repository.id === selectedRepositoryId) ?? null,
    [projectRepositories, selectedRepositoryId],
  );
  const selectedHistorySessionId = openedTranscriptSession?.id ?? transcriptSession?.id ?? null;
  const selectedHistorySession = useMemo(
    () => transcriptSessions.find((session) => session.id === selectedHistorySessionId) ?? null,
    [selectedHistorySessionId, transcriptSessions],
  );
  const filteredTranscriptSessions = useMemo(
    () => filterTranscriptSessions(transcriptSessions, historyFilter),
    [historyFilter, transcriptSessions],
  );
  const visibleTranscriptSessions = useMemo(
    () => filteredTranscriptSessions.slice(0, 3),
    [filteredTranscriptSessions],
  );
  const attachedKnowledgeItems = useMemo(
    () => knowledgeItems.filter((item) => attachedKnowledgeIds.includes(item.id)),
    [attachedKnowledgeIds, knowledgeItems],
  );
  const displayAcpEvents = useMemo(
    () =>
      openedTranscriptSession
        ? coalesceTranscriptEvents(openedTranscriptEvents)
        : coalesceAcpEvents(acpEvents),
    [acpEvents, openedTranscriptEvents, openedTranscriptSession],
  );
  const showAcpWaiting = acpPromptBusy && !openedTranscriptSession;
  const canStartSelectedAcpCandidate =
    !!selectedAcpCandidate &&
    isLaunchableAcpCandidate(selectedAcpCandidate) &&
    !canUseAcpSession;
  const acpStatusLabel = acpSession
    ? `${acpSessionSource ?? acpSession.agentName ?? "acp"} · ${acpSession.state} · ${
        acpSession.agentSessionId ?? "no agent session"
      }`
    : "not started";
  const activeRuntimeCwd = runtimeMode === "acp" ? acpSession?.cwd : session?.cwd;
  const statusLabel = useMemo(() => {
    if (!session) {
      return "not started";
    }

    return `${sessionKind ?? "session"} · ${session.state} · ${session.cols}x${session.rows}`;
  }, [session, sessionKind]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(
    () => () => {
      toastTimers.current.forEach((timerId) => window.clearTimeout(timerId));
    },
    [],
  );

  useEffect(() => {
    transcriptSessionRef.current = transcriptSession;
  }, [transcriptSession]);

  useEffect(() => {
    setHistoryRenameTitle(selectedHistorySession?.title ?? "");
  }, [selectedHistorySession?.id, selectedHistorySession?.title]);

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
    void refreshKnowledgeItems(selectedProjectId);
    void refreshProjectRepositories(selectedProjectId);
    void refreshProjectInitializations(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    void refreshProjectInitializationFacts(projectInitialization?.id ?? null);
    void refreshProjectInitializationMarkdownFindings(projectInitialization?.id ?? null);
  }, [projectInitialization?.id]);

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

  function pushToast(kind: ToastKind, text: string) {
    const id = `toast-${Date.now()}-${toastSequence.current}`;
    toastSequence.current += 1;
    setToasts((current) => [...current, { id, kind, text }].slice(-4));
    const timerId = window.setTimeout(() => dismissToast(id), toastDismissMs);
    toastTimers.current.push(timerId);
  }

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  async function refreshProjects() {
    setProjectLoading(true);
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
      pushToast("error", errorText(err));
    } finally {
      setProjectLoading(false);
    }
  }

  async function createProject() {
    setBusy(true);
    setError(null);
    try {
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
      pushToast("success", `${project.name} added.`);
      await refreshProjectRepositories(project.id);
    } catch (err) {
      pushToast("error", errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function chooseProjectFolder() {
    setProjectFolderPicking(true);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Choose project folder",
      });
      if (!selected || Array.isArray(selected)) {
        return;
      }

      setProjectPath(selected);
      setProjectName((current) => current.trim() || folderNameFromPath(selected));
    } catch (err) {
      pushToast("error", errorText(err));
    } finally {
      setProjectFolderPicking(false);
    }
  }

  function openProjectDeleteDialog(project: ProjectInfo) {
    setProjectDeleteCandidate(project);
    setProjectDeleteError(null);
  }

  function closeProjectDeleteDialog() {
    if (busy) {
      return;
    }
    setProjectDeleteCandidate(null);
    setProjectDeleteError(null);
  }

  async function confirmDeleteProject() {
    if (!projectDeleteCandidate) {
      return;
    }

    const projectId = projectDeleteCandidate.id;
    const projectName = projectDeleteCandidate.name;
    setBusy(true);
    setProjectDeleteError(null);
    try {
      const stoppedAcpSessionCount = await stopRunningAcpSessionsForProjectDelete();
      await invoke("delete_project", { projectId });
      setProjects((current) => current.filter((project) => project.id !== projectId));
      setProjectInitializationsByProjectId((current) => {
        const next = { ...current };
        delete next[projectId];
        return next;
      });
      setSelectedProjectId((current) => {
        if (current === projectId) {
          setProjectRepositories([]);
          setSelectedRepositoryId(null);
          return null;
        }

        return current;
      });
      setProjectDeleteCandidate(null);
      pushToast(
        "success",
        stoppedAcpSessionCount > 0
          ? `${projectName} deleted. Stopped ${stoppedAcpSessionCount} ACP session${
              stoppedAcpSessionCount === 1 ? "" : "s"
            }.`
          : `${projectName} deleted.`,
      );
    } catch (err) {
      setProjectDeleteError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function stopRunningAcpSessionsForProjectDelete() {
    const acpSessions = (await invoke<AcpSessionInfo[]>("list_acp_sessions")) ?? [];
    const runningAcpSessions = acpSessions.filter((candidate) => candidate.state === "running");
    for (const runningSession of runningAcpSessions) {
      await invoke<AcpSessionInfo>("stop_acp_session", {
        sessionId: runningSession.id,
        force: false,
      });
    }

    if (runningAcpSessions.length > 0) {
      setAcpSession(null);
      setAcpSessionSource(null);
      setAcpEvents([]);
      setAcpPromptBusy(false);
      setAcpPromptResult(null);
    }

    return runningAcpSessions.length;
  }

  async function refreshProjectRepositories(projectId = selectedProjectId) {
    if (!projectId) {
      setProjectRepositories([]);
      setSelectedRepositoryId(null);
      return;
    }

    if (selectedRepository && selectedRepository.projectId !== projectId) {
      setProjectRepositories([]);
      setSelectedRepositoryId(null);
    }

    setRepositoryLoading(true);
    try {
      const repositories =
        (await invoke<ProjectRepositoryInfo[]>("list_project_repositories", {
          projectId,
        })) ?? [];
      setProjectRepositories(repositories);
      setSelectedRepositoryId((current) => {
        if (current && repositories.some((repository) => repository.id === current)) {
          return current;
        }

        return repositories[0]?.id ?? null;
      });
    } catch (err) {
      pushToast("error", errorText(err));
    } finally {
      setRepositoryLoading(false);
    }
  }

  async function createProjectRepository() {
    if (!selectedProject) {
      pushToast("error", "Select a project before adding a repository.");
      return;
    }

    setRepositoryLoading(true);
    try {
      const repository = await invoke<ProjectRepositoryInfo>("create_project_repository", {
        request: {
          projectId: selectedProject.id,
          name: repositoryName,
          path: repositoryPath,
        },
      });
      setProjectRepositories((current) => [
        repository,
        ...current.filter((item) => item.id !== repository.id),
      ]);
      setSelectedRepositoryId(repository.id);
      setRepositoryName("");
      setRepositoryPath("");
    } catch (err) {
      pushToast("error", errorText(err));
    } finally {
      setRepositoryLoading(false);
    }
  }

  async function deleteProjectRepository(repositoryId: string) {
    setRepositoryLoading(true);
    try {
      await invoke("delete_project_repository", { repositoryId });
      const nextRepositories = projectRepositories.filter(
        (repository) => repository.id !== repositoryId,
      );
      setProjectRepositories(nextRepositories);
      setSelectedRepositoryId((currentSelected) => {
        if (currentSelected === repositoryId) {
          return nextRepositories[0]?.id ?? null;
        }

        return currentSelected;
      });
    } catch (err) {
      pushToast("error", errorText(err));
    } finally {
      setRepositoryLoading(false);
    }
  }

  function openProjectInitializeDialog() {
    if (!selectedProject) {
      setInitializeError("Select a project before initializing it.");
      return;
    }
    setInitializeError(null);
    setInitializeRepositoryIds(projectRepositories.map((repository) => repository.id));
    setInitializeDialogOpen(true);
  }

  function closeProjectInitializeDialog() {
    if (initializeLoading) {
      return;
    }
    setInitializeDialogOpen(false);
    setInitializeError(null);
  }

  function toggleInitializeRepository(repositoryId: string, selected: boolean) {
    setInitializeRepositoryIds((current) =>
      selected
        ? uniqueIds([...current, repositoryId])
        : current.filter((candidate) => candidate !== repositoryId),
    );
  }

  async function createProjectInitialization() {
    if (!selectedProject) {
      setInitializeError("Select a project before initializing it.");
      return;
    }
    if (initializeRepositoryIds.length === 0) {
      setInitializeError("Select at least one repository.");
      return;
    }

    setInitializeLoading(true);
    setInitializeError(null);
    try {
      const initialization = await invoke<ProjectInitializationInfo>(
        "create_project_initialization",
        {
          request: {
            projectId: selectedProject.id,
            repositoryIds: initializeRepositoryIds,
          },
        },
      );
      setProjectInitializationsByProjectId((current) => ({
        ...current,
        [initialization.projectId]: initialization,
      }));
      setInitializeDialogOpen(false);
    } catch (err) {
      setInitializeError(errorText(err));
    } finally {
      setInitializeLoading(false);
    }
  }

  async function refreshProjectInitializations(projectId = selectedProjectId) {
    if (!projectId) {
      return;
    }

    try {
      const initializations =
        (await invoke<ProjectInitializationInfo[]>("list_project_initializations", {
          projectId,
        })) ?? [];
      setProjectInitializationsByProjectId((current) => {
        const next = { ...current };
        if (initializations[0]) {
          next[projectId] = initializations[0];
        } else {
          delete next[projectId];
        }
        return next;
      });
    } catch (err) {
      pushToast("error", errorText(err));
    }
  }

  async function refreshProjectInitializationFacts(initializationId: string | null) {
    if (!initializationId) {
      return;
    }

    try {
      const facts =
        (await invoke<ProjectInitializationFactInfo[]>("list_project_initialization_facts", {
          initializationId,
        })) ?? [];
      setInitializationFactsByInitializationId((current) => ({
        ...current,
        [initializationId]: facts,
      }));
    } catch (err) {
      pushToast("error", errorText(err));
    }
  }

  async function collectProjectInitializationFacts() {
    if (!projectInitialization) {
      pushToast("error", "Start Project Initialize before collecting facts.");
      return;
    }

    setInitializeLoading(true);
    try {
      const facts = await invoke<ProjectInitializationFactInfo[]>(
        "collect_project_initialization_facts",
        {
          initializationId: projectInitialization.id,
        },
      );
      setInitializationFactsByInitializationId((current) => ({
        ...current,
        [projectInitialization.id]: facts,
      }));
      setProjectInitializationsByProjectId((current) => {
        const existing = current[projectInitialization.projectId];
        if (!existing || existing.id !== projectInitialization.id) {
          return current;
        }

        return {
          ...current,
          [projectInitialization.projectId]: {
            ...existing,
            status: "facts",
          },
        };
      });
      pushToast("success", `Facts collected for ${projectInitialization.repositoryCount} repositories.`);
    } catch (err) {
      pushToast("error", errorText(err));
    } finally {
      setInitializeLoading(false);
    }
  }

  async function refreshProjectInitializationMarkdownFindings(initializationId: string | null) {
    if (!initializationId) {
      return;
    }

    try {
      const findings =
        (await invoke<ProjectInitializationMarkdownFindingInfo[]>(
          "list_project_initialization_markdown_findings",
          {
            initializationId,
          },
        )) ?? [];
      setInitializationMarkdownFindingsByInitializationId((current) => ({
        ...current,
        [initializationId]: findings,
      }));
    } catch (err) {
      pushToast("error", errorText(err));
    }
  }

  async function analyzeProjectInitializationMarkdown() {
    if (!projectInitialization) {
      pushToast("error", "Start Project Initialize before analyzing markdown.");
      return;
    }

    setInitializeLoading(true);
    try {
      const findings = await invoke<ProjectInitializationMarkdownFindingInfo[]>(
        "analyze_project_initialization_markdown",
        {
          initializationId: projectInitialization.id,
        },
      );
      setInitializationMarkdownFindingsByInitializationId((current) => ({
        ...current,
        [projectInitialization.id]: findings,
      }));
      setProjectInitializationsByProjectId((current) => {
        const existing = current[projectInitialization.projectId];
        if (!existing || existing.id !== projectInitialization.id) {
          return current;
        }

        return {
          ...current,
          [projectInitialization.projectId]: {
            ...existing,
            status: "markdown",
          },
        };
      });
      pushToast(
        "success",
        `Markdown analyzed with ${findings.length} findings.`,
      );
    } catch (err) {
      pushToast("error", errorText(err));
    } finally {
      setInitializeLoading(false);
    }
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

  async function refreshKnowledgeItems(projectId = selectedProjectId) {
    setKnowledgeLoading(true);
    setKnowledgeError(null);
    try {
      const result =
        (await invoke<KnowledgeItemInfo[]>("list_knowledge_items", {
          projectId: projectId ?? null,
        })) ?? [];
      const items = Array.isArray(result) ? result : [];
      setKnowledgeItems(items);
      setAttachedKnowledgeIds((current) =>
        current.filter((id) => items.some((item) => item.id === id)),
      );
    } catch (err) {
      setKnowledgeError(errorText(err));
    } finally {
      setKnowledgeLoading(false);
    }
  }

  async function createKnowledgeItem() {
    setKnowledgeLoading(true);
    setKnowledgeError(null);
    try {
      const item = await invoke<KnowledgeItemInfo>("create_knowledge_item", {
        request: {
          projectId: selectedProject?.id ?? null,
          title: knowledgeTitle,
          body: knowledgeBody,
          kind: knowledgeKind,
          scope: selectedProject ? "project" : "global",
          sourceTranscriptSessionId:
            openedTranscriptSession?.id ?? transcriptSessionRef.current?.id ?? null,
        },
      });
      setKnowledgeItems((current) => [item, ...current.filter((candidate) => candidate.id !== item.id)]);
      setAttachedKnowledgeIds((current) => uniqueIds([...current, item.id]));
      setKnowledgeTitle("");
      setKnowledgeBody("");
      setKnowledgeKind("decision");
      setKnowledgeDialogOpen(false);
      await attachKnowledgeToActiveTranscript(item.id);
    } catch (err) {
      setKnowledgeError(errorText(err));
    } finally {
      setKnowledgeLoading(false);
    }
  }

  function closeKnowledgeDialog() {
    if (knowledgeLoading) {
      return;
    }
    setKnowledgeDialogOpen(false);
    setKnowledgeError(null);
    setKnowledgeTitle("");
    setKnowledgeBody("");
    setKnowledgeKind("decision");
  }

  function openKnowledgeDialog() {
    setKnowledgeError(null);
    setKnowledgeDialogOpen(true);
  }

  async function toggleKnowledgeAttachment(item: KnowledgeItemInfo, attached: boolean) {
    setKnowledgeError(null);
    setAttachedKnowledgeIds((current) =>
      attached ? uniqueIds([...current, item.id]) : current.filter((id) => id !== item.id),
    );

    if (!attached) {
      return;
    }

    await attachKnowledgeToActiveTranscript(item.id);
  }

  async function attachKnowledgeToActiveTranscript(knowledgeItemId: string) {
    const activeTranscriptId = transcriptSessionRef.current?.id ?? transcriptSession?.id ?? null;
    if (!activeTranscriptId) {
      return;
    }

    try {
      await invoke<KnowledgeItemInfo[]>("attach_knowledge_to_transcript_session", {
        sessionId: activeTranscriptId,
        knowledgeItemId,
      });
    } catch (err) {
      setKnowledgeError(errorText(err));
    }
  }

  async function attachSelectedKnowledgeToTranscript(sessionId: string) {
    if (attachedKnowledgeIds.length === 0) {
      return;
    }

    try {
      for (const knowledgeItemId of attachedKnowledgeIds) {
        await invoke<KnowledgeItemInfo[]>("attach_knowledge_to_transcript_session", {
          sessionId,
          knowledgeItemId,
        });
      }
    } catch (err) {
      setKnowledgeError(errorText(err));
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

  async function renameSelectedTranscriptSession() {
    if (!selectedHistorySession || !historyRenameTitle.trim()) {
      return;
    }

    setTranscriptLoading(true);
    setTranscriptError(null);
    try {
      const renamed = await invoke<TranscriptSessionInfo>("rename_transcript_session", {
        request: {
          sessionId: selectedHistorySession.id,
          title: historyRenameTitle,
        },
      });
      upsertTranscriptSession(renamed);
    } catch (err) {
      setTranscriptError(errorText(err));
    } finally {
      setTranscriptLoading(false);
    }
  }

  function upsertTranscriptSession(nextSession: TranscriptSessionInfo) {
    setTranscriptSessions((current) =>
      current.map((session) => (session.id === nextSession.id ? nextSession : session)),
    );
    setTranscriptSession((current) => (current?.id === nextSession.id ? nextSession : current));
    setOpenedTranscriptSession((current) =>
      current?.id === nextSession.id ? nextSession : current,
    );
    if (transcriptSessionRef.current?.id === nextSession.id) {
      transcriptSessionRef.current = nextSession;
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
          ...selectedProjectCwd(selectedProject, selectedRepository),
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
          ...selectedProjectCwd(selectedProject, selectedRepository),
        },
      });
      setAcpSession(nextSession);
      setAcpSessionSource("fake");
      setAcpEvents([]);
      setAcpPromptResult(null);
      const transcript = await createTranscriptSession("acp", "fake", "Fake ACP");
      if (transcript) {
        await attachSelectedKnowledgeToTranscript(transcript.id);
      }
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
          ...selectedProjectCwd(selectedProject, selectedRepository),
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
      if (transcript) {
        await attachSelectedKnowledgeToTranscript(transcript.id);
      }
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
        prompt: formatPromptWithKnowledge(attachedKnowledgeItems, acpPrompt),
      });
      setAcpPromptResult(result);
      setAcpPromptBusy(false);
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
          <span className="app-mark" aria-hidden="true">A</span>
          <div>
            <p className="eyebrow">Workspace</p>
            <h1 id="runtime-sidebar-title">AIadne</h1>
          </div>
        </div>

        <div className="sidebar-scroll">
          <details className="agent-accordion sidebar-agent" open>
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

          <details className="agent-accordion sidebar-history" open>
            <summary>
              <span>Session History</span>
              <strong>
                {filteredTranscriptSessions.length}/{transcriptSessions.length} saved
              </strong>
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

              <label className="history-filter">
                <span>Filter</span>
                <input
                  aria-label="Filter session history"
                  onChange={(event) => setHistoryFilter(event.target.value)}
                  placeholder="Search title, agent, id..."
                  value={historyFilter}
                />
              </label>

              <div className="history-rename" aria-label="Rename selected session">
                <label>
                  <span>Selected name</span>
                  <input
                    aria-label="Selected session name"
                    disabled={!selectedHistorySession}
                    onChange={(event) => setHistoryRenameTitle(event.target.value)}
                    value={historyRenameTitle}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void renameSelectedTranscriptSession()}
                  disabled={
                    transcriptLoading ||
                    !selectedHistorySession ||
                    !historyRenameTitle.trim() ||
                    historyRenameTitle.trim() === selectedHistorySession.title
                  }
                >
                  Rename
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
                ) : filteredTranscriptSessions.length === 0 ? (
                  <li>No sessions match this filter.</li>
                ) : (
                  visibleTranscriptSessions.map((historySession) => (
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

          <details className="agent-accordion sidebar-knowledge">
            <summary>
              <span>Knowledge Cards</span>
              <strong>{attachedKnowledgeItems.length} attached</strong>
            </summary>

            <div className="accordion-body">
              <div className="knowledge-toolbar">
                <div>
                  <h3 id="knowledge-title">Knowledge Cards</h3>
                  <span>{knowledgeItems.length} available</span>
                </div>
                <button
                  aria-label="Add knowledge card"
                  className="icon-button"
                  type="button"
                  onClick={openKnowledgeDialog}
                  disabled={knowledgeLoading}
                >
                  +
                </button>
              </div>

              {knowledgeError && !knowledgeDialogOpen ? (
                <p className="error-message" role="alert">
                  {knowledgeError}
                </p>
              ) : null}

              <ul className="knowledge-list" aria-label="Knowledge cards">
                {knowledgeItems.length === 0 ? (
                  <li>No knowledge cards yet.</li>
                ) : (
                  knowledgeItems.map((item) => {
                    const attached = attachedKnowledgeIds.includes(item.id);
                    return (
                      <li data-selected={attached} key={item.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={attached}
                            onChange={(event) =>
                              void toggleKnowledgeAttachment(item, event.currentTarget.checked)
                            }
                          />
                          <span>
                            <strong>{item.title}</strong>
                            <small>
                              {item.kind} · {item.scope} · {item.projectId ? "project" : "global"}
                            </small>
                            <em>{item.body}</em>
                          </span>
                        </label>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </details>

          <details className="agent-accordion sidebar-agent sidebar-fallback">
            <summary>
              <span>Terminal PTY</span>
              <strong>{runtimeMode === "pty" ? "active" : "fallback"}</strong>
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

              <div className="fallback-actions">
                <button
                  type="button"
                  onClick={() => setRuntimeMode(runtimeMode === "pty" ? "acp" : "pty")}
                  disabled={canUseSession}
                >
                  {runtimeMode === "pty" ? "Use ACP" : "Open PTY"}
                </button>
              </div>

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
        </div>

        <dl className="runtime-info-card sidebar-runtime-info" aria-label="Runtime info">
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
          <div>
            <dt>Repository</dt>
            <dd>{selectedRepository?.name ?? (selectedProject ? "default path" : "none")}</dd>
          </div>
          <div>
            <dt>Active Folder</dt>
            <dd>{activeRuntimeCwd ?? "none"}</dd>
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
            <div className="project-actions">
              <button type="button" onClick={() => void refreshProjects()} disabled={projectLoading}>
                Refresh
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => selectedProject && openProjectDeleteDialog(selectedProject)}
                disabled={!selectedProject || busy || canUseSession || canUseAcpSession}
              >
                Delete Project
              </button>
            </div>
          </div>

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
              onClick={() => void chooseProjectFolder()}
              disabled={busy || projectFolderPicking}
            >
              Choose Folder
            </button>
            <button
              type="button"
              onClick={() => void createProject()}
              disabled={busy || projectFolderPicking || !projectName.trim() || !projectPath.trim()}
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
                    <span>Default repository: {project.path}</span>
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
                      className="danger-button"
                      type="button"
                      onClick={() => openProjectDeleteDialog(project)}
                      disabled={busy || canUseSession || canUseAcpSession}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>

          <div className="repository-section project-initialize-section">
            <div className="doctor-heading">
              <h3 id="project-initialize-title">Project Initialize</h3>
              <span>
                {projectInitialization
                  ? `${projectInitialization.status} · ${projectInitialization.repositoryCount} repositories`
                  : selectedProject
                    ? "not started"
                    : "select project"}
              </span>
              <button
                type="button"
                onClick={openProjectInitializeDialog}
                disabled={!selectedProject || projectRepositories.length === 0 || initializeLoading}
              >
                Initialize Project
              </button>
            </div>
            {projectInitialization ? (
              <div className="initialize-facts">
                <div className="facts-heading">
                  <div>
                    <h4>Facts</h4>
                    <span>
                      {projectInitializationFacts.length > 0
                        ? `${projectInitializationFacts.length} collected`
                        : "not collected"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void collectProjectInitializationFacts()}
                    disabled={initializeLoading}
                  >
                    Collect Facts
                  </button>
                </div>
                {projectInitializationFacts.length > 0 ? (
                  <ul className="fact-list" aria-label="Project initialization facts">
                    {projectInitializationFacts.map((fact) => (
                      <li key={fact.id}>
                        <strong>{fact.repositoryName}</strong>
                        <span>
                          {fact.label}: {fact.value}
                        </span>
                        <small>{fact.source}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-state">Facts have not been collected yet.</p>
                )}
                <div className="facts-heading">
                  <div>
                    <h4>Markdown</h4>
                    <span>
                      {projectInitializationMarkdownFindings.length > 0
                        ? `${projectInitializationMarkdownFindings.length} findings`
                        : "not analyzed"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void analyzeProjectInitializationMarkdown()}
                    disabled={initializeLoading}
                  >
                    Analyze Markdown
                  </button>
                </div>
                {projectInitializationMarkdownFindings.length > 0 ? (
                  <ul
                    className="markdown-finding-list"
                    aria-label="Project initialization markdown findings"
                  >
                    {projectInitializationMarkdownFindings.map((finding) => (
                      <li key={finding.id}>
                        <strong>
                          {finding.repositoryName} · {finding.category}
                        </strong>
                        <span>{finding.title}</span>
                        <p>{finding.excerpt}</p>
                        <small>
                          {finding.filePath} · {finding.source}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-state">Markdown has not been analyzed yet.</p>
                )}
              </div>
            ) : null}
          </div>

          <div className="repository-section">
            <div className="doctor-heading">
              <h3 id="repositories-title">Repositories</h3>
              <span>
                {selectedRepository
                  ? selectedRepository.name
                  : selectedProject
                    ? "default path"
                    : "select project"}
              </span>
              <button
                type="button"
                onClick={() => void refreshProjectRepositories()}
                disabled={!selectedProject || repositoryLoading}
              >
                Refresh
              </button>
            </div>

            <div className="workspace-form repository-form">
              <label>
                <span>Name</span>
                <input
                  aria-label="Repository name"
                  onChange={(event) => setRepositoryName(event.target.value)}
                  value={repositoryName}
                />
              </label>
              <label>
                <span>Path</span>
                <input
                  aria-label="Repository path"
                  onChange={(event) => setRepositoryPath(event.target.value)}
                  value={repositoryPath}
                />
              </label>
              <button
                type="button"
                onClick={() => void createProjectRepository()}
                disabled={
                  busy ||
                  repositoryLoading ||
                  !selectedProject ||
                  !repositoryName.trim() ||
                  !repositoryPath.trim()
                }
              >
                Add Repository
              </button>
            </div>

            {!selectedProject ? (
              <p className="empty-state">Select a project to manage repositories.</p>
            ) : (
              <ul className="project-list repository-list" aria-label="Project repositories">
                {projectRepositories.length === 0 ? (
                  <li>No repositories yet.</li>
                ) : (
                  projectRepositories.map((repository) => (
                    <li
                      data-selected={repository.id === selectedRepository?.id}
                      key={repository.id}
                    >
                      <div>
                        <strong>{repository.name}</strong>
                        <span>{repository.path}</span>
                        {repository.isDefault ? <small>Default</small> : null}
                      </div>
                      <div className="project-actions">
                        <button
                          aria-label={`Select ${repository.name} repository`}
                          aria-pressed={repository.id === selectedRepository?.id}
                          type="button"
                          onClick={() => setSelectedRepositoryId(repository.id)}
                          disabled={busy || canUseSession || canUseAcpSession}
                        >
                          {repository.id === selectedRepository?.id ? "Selected" : "Select"}
                        </button>
                        <button
                          aria-label={`Delete ${repository.name} repository`}
                          type="button"
                          onClick={() => void deleteProjectRepository(repository.id)}
                          disabled={
                            busy ||
                            repositoryLoading ||
                            canUseSession ||
                            canUseAcpSession ||
                            repository.isDefault
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
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
                onClick={() => setRuntimeMode("acp")}
                disabled={canUseSession}
              >
                Use ACP
              </button>
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

            {showAcpWaiting ? (
              <p className="acp-result acp-waiting-status" role="status">
                Waiting for agent response...
              </p>
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
                {displayAcpEvents.length === 0 && !showAcpWaiting ? (
                  <li>
                    {openedTranscriptSession
                      ? "No saved events in this transcript yet."
                      : "No ACP events yet."}
                  </li>
                ) : (
                  <>
                    {displayAcpEvents.map((event, index) => (
                    <li data-kind={event.kind} key={`${event.kind}-${index}`}>
                      <strong>
                        {openedTranscriptSession
                          ? transcriptEventLabel(event.kind)
                          : acpEventLabel(event.kind)}
                      </strong>
                      <span>{event.content}</span>
                    </li>
                    ))}
                    {showAcpWaiting ? (
                      <li data-kind="pending" aria-live="polite">
                        <strong>Waiting</strong>
                        <span className="waiting-message">
                          <span className="waiting-dots" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                          </span>
                          Agent is preparing a response
                        </span>
                      </li>
                    ) : null}
                  </>
                )}
              </ul>
            </section>
          ) : null}
        </div>
      </section>

      {initializeDialogOpen ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeProjectInitializeDialog();
            }
          }}
        >
          <section
            aria-labelledby="project-initialize-dialog-title"
            aria-modal="true"
            className="knowledge-modal project-initialize-modal"
            role="dialog"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Project</p>
                <h2 id="project-initialize-dialog-title">Project Initialize</h2>
              </div>
              <button
                aria-label="Close project initialize dialog"
                className="icon-button"
                type="button"
                onClick={closeProjectInitializeDialog}
                disabled={initializeLoading}
              >
                x
              </button>
            </div>

            {initializeError ? (
              <p className="error-message" role="alert">
                {initializeError}
              </p>
            ) : null}

            <div className="initialize-section">
              <h3>Repositories</h3>
              <ul className="initialize-repository-list" aria-label="Repositories to initialize">
                {projectRepositories.map((repository) => (
                  <li key={repository.id}>
                    <label>
                      <input
                        aria-label={`Include ${repository.name} repository`}
                        checked={initializeRepositoryIds.includes(repository.id)}
                        type="checkbox"
                        onChange={(event) =>
                          toggleInitializeRepository(repository.id, event.currentTarget.checked)
                        }
                      />
                      <span>
                        <strong>{repository.name}</strong>
                        <small>{repository.path}</small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="initialize-section">
              <h3>Phases</h3>
              <ol className="initialize-phase-list">
                <li>Facts</li>
                <li>Markdown analysis</li>
                <li>Interview</li>
                <li>Knowledge summary</li>
              </ol>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={closeProjectInitializeDialog}
                disabled={initializeLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createProjectInitialization()}
                disabled={initializeLoading || initializeRepositoryIds.length === 0}
              >
                Start Initialize
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {projectDeleteCandidate ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeProjectDeleteDialog();
            }
          }}
        >
          <section
            aria-labelledby="project-delete-dialog-title"
            aria-modal="true"
            className="knowledge-modal project-delete-modal"
            role="dialog"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Workspace</p>
                <h2 id="project-delete-dialog-title">Delete Project</h2>
              </div>
              <button
                aria-label="Close delete project dialog"
                className="icon-button"
                type="button"
                onClick={closeProjectDeleteDialog}
                disabled={busy}
              >
                x
              </button>
            </div>

            {projectDeleteError ? (
              <p className="error-message" role="alert">
                {projectDeleteError}
              </p>
            ) : null}

            <p className="delete-modal-copy">
              Delete <strong>{projectDeleteCandidate.name}</strong> from AIadne? This removes the
              saved project, its repository list, and its initialization runs. Saved transcripts are
              kept without the project link. Running ACP sessions will be stopped first.
            </p>

            <div className="modal-actions">
              <button type="button" onClick={closeProjectDeleteDialog} disabled={busy}>
                Cancel
              </button>
              <button
                aria-label="Confirm delete project"
                className="danger-button"
                type="button"
                onClick={() => void confirmDeleteProject()}
                disabled={busy}
              >
                Delete Project
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {knowledgeDialogOpen ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeKnowledgeDialog();
            }
          }}
        >
          <section
            aria-labelledby="knowledge-dialog-title"
            aria-modal="true"
            className="knowledge-modal"
            role="dialog"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Knowledge</p>
                <h2 id="knowledge-dialog-title">New Knowledge Card</h2>
              </div>
              <button
                aria-label="Close knowledge card dialog"
                className="icon-button"
                type="button"
                onClick={closeKnowledgeDialog}
                disabled={knowledgeLoading}
              >
                x
              </button>
            </div>

            {knowledgeError ? (
              <p className="error-message" role="alert">
                {knowledgeError}
              </p>
            ) : null}

            <div className="knowledge-form knowledge-modal-form">
              <label>
                <span>Title</span>
                <input
                  aria-label="Knowledge title"
                  onChange={(event) => setKnowledgeTitle(event.target.value)}
                  value={knowledgeTitle}
                />
              </label>
              <label>
                <span>Kind</span>
                <select
                  aria-label="Knowledge kind"
                  onChange={(event) => setKnowledgeKind(event.target.value)}
                  value={knowledgeKind}
                >
                  <option value="decision">Decision</option>
                  <option value="constraint">Constraint</option>
                  <option value="preference">Preference</option>
                  <option value="fact">Fact</option>
                  <option value="todo">Todo</option>
                </select>
              </label>
              <label>
                <span>Text</span>
                <textarea
                  aria-label="Knowledge body"
                  onChange={(event) => setKnowledgeBody(event.target.value)}
                  rows={5}
                  value={knowledgeBody}
                />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={closeKnowledgeDialog} disabled={knowledgeLoading}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void createKnowledgeItem()}
                  disabled={knowledgeLoading || !knowledgeTitle.trim() || !knowledgeBody.trim()}
                >
                  Create Card
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <div className="toast-stack" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => (
          <div
            className="toast-message"
            data-kind={toast.kind}
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
          >
            <span>{toast.text}</span>
            <button
              aria-label={`Dismiss notification: ${toast.text}`}
              className="toast-close"
              type="button"
              onClick={() => dismissToast(toast.id)}
            >
              x
            </button>
          </div>
        ))}
      </div>
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

function selectedProjectCwd(
  project: ProjectInfo | null,
  repository: ProjectRepositoryInfo | null,
) {
  if (repository) {
    return { cwd: repository.path };
  }

  return project ? { cwd: project.path } : {};
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

function formatPromptWithKnowledge(items: KnowledgeItemInfo[], prompt: string) {
  if (items.length === 0) {
    return prompt;
  }

  const context = items
    .map(
      (item, index) =>
        `${index + 1}. ${item.title} (${item.kind}, ${item.scope})\n${item.body}`,
    )
    .join("\n\n");

  return `Attached session knowledge:\n${context}\n\nUser prompt:\n${prompt}`;
}

function filterTranscriptSessions(sessions: TranscriptSessionInfo[], filter: string) {
  const query = filter.trim().toLowerCase();
  if (!query) {
    return sessions;
  }

  return sessions.filter((session) =>
    [
      session.title,
      session.source,
      session.runtime,
      session.id,
      session.projectId ?? "",
      shortId(session.id),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
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

function folderNameFromPath(path: string) {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? "Project";
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
