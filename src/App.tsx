import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useMemo, useRef, useState } from "react";
import aiadneMark from "./assets/aiadne-mark.svg";
import { StateNotice } from "./components/ui/StateNotice";
import { CloseIcon } from "./components/ui/icons";
import { NotificationViewport } from "./features/notifications/NotificationViewport";
import { AcpRuntimePanel } from "./features/runtime/AcpRuntimePanel";
import { SessionOutputPanel } from "./features/runtime/SessionOutputPanel";
import {
  boundToastMessages,
  useNotificationStore,
} from "./features/notifications/notificationStore";
import {
  coalesceAcpEvents,
  coalesceTranscriptEvents,
  errorText,
  filterTranscriptSessions,
  folderNameFromPath,
  formatCommand,
  formatPromptWithKnowledge,
  shortId,
  transcriptEventToAcpEvent,
  uniqueIds,
} from "./lib/presentation";
import type {
  AcpPromptResult,
  AcpRegistryCandidate,
  AcpRegistryCandidateStatus,
  AcpSessionEvent,
  AcpSessionInfo,
  AgentDoctorReport,
  AgentDoctorStatus,
  CapabilityStatus,
  InitializeDetailsView,
  InterviewScope,
  KnowledgeItemInfo,
  KnowledgeUnitInfo,
  ModelCatalogInfo,
  ModelProfileInfo,
  ModelTier,
  ProjectInfo,
  ProjectInitializationFactInfo,
  ProjectInitializationGuardrailInfo,
  ProjectInitializationGuardrailInput,
  ProjectInitializationGuardrailKind,
  ProjectInitializationInfo,
  ProjectInitializationMarkdownFindingInfo,
  ProjectInitializationSummaryInfo,
  ProjectRepositoryInfo,
  RuntimeMode,
  SessionInfo,
  TaskContextSelectionInfo,
  TaskInfo,
  TranscriptEventInfo,
  TranscriptSessionInfo,
} from "./types/domain";
import "./App.css";

const initialSize = {
  cols: 80,
  rows: 24,
};

const modelTiers: ModelTier[] = ["fast", "mid", "high", "max"];
const defaultSynthesisModelProfileId = "openai-gpt-5.6-terra-medium";

export { StateNotice, boundToastMessages };

function App() {
  const terminalElement = useRef<HTMLDivElement | null>(null);
  const acpEventsList = useRef<HTMLUListElement | null>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const sessionRef = useRef<SessionInfo | null>(null);
  const transcriptOpenRequest = useRef(0);
  const taskLoadRequest = useRef(0);
  const transcriptSessionRef = useRef<TranscriptSessionInfo | null>(null);
  const tasksByTranscriptIdRef = useRef<Record<string, TaskInfo>>({});
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionKind, setSessionKind] = useState<"fake" | "codex" | null>(null);
  const [terminalSize, setTerminalSize] = useState(initialSize);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [doctorReports, setDoctorReports] = useState<AgentDoctorReport[]>([]);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [modelCatalog, setModelCatalog] = useState<ModelCatalogInfo | null>(null);
  const [synthesisTier, setSynthesisTier] = useState<ModelTier>("mid");
  const [synthesisModelProfileId, setSynthesisModelProfileId] = useState(
    defaultSynthesisModelProfileId,
  );
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectFolderPicking, setProjectFolderPicking] = useState(false);
  const [projectDeleteCandidate, setProjectDeleteCandidate] = useState<ProjectInfo | null>(null);
  const [projectDeleteError, setProjectDeleteError] = useState<string | null>(null);
  const [projectRepositories, setProjectRepositories] = useState<ProjectRepositoryInfo[]>([]);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string | null>(null);
  const [repositoryDialogOpen, setRepositoryDialogOpen] = useState(false);
  const [repositoryName, setRepositoryName] = useState("");
  const [repositoryPath, setRepositoryPath] = useState("");
  const [repositoryLoading, setRepositoryLoading] = useState(false);
  const [initializeDialogOpen, setInitializeDialogOpen] = useState(false);
  const [initializeRepositoryIds, setInitializeRepositoryIds] = useState<string[]>([]);
  const [initializeLoading, setInitializeLoading] = useState(false);
  const [initializeError, setInitializeError] = useState<string | null>(null);
  const [initializeDetailsView, setInitializeDetailsView] =
    useState<InitializeDetailsView | null>(null);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [interviewError, setInterviewError] = useState<string | null>(null);
  const [interviewScope, setInterviewScope] = useState<InterviewScope>("project");
  const [interviewRepositoryId, setInterviewRepositoryId] = useState("");
  const [interviewKind, setInterviewKind] =
    useState<ProjectInitializationGuardrailKind>("fragile");
  const [interviewPathPattern, setInterviewPathPattern] = useState("");
  const [interviewContent, setInterviewContent] = useState("");
  const [interviewDraftGuardrails, setInterviewDraftGuardrails] = useState<
    ProjectInitializationGuardrailInput[]
  >([]);
  const [projectInitializationsByProjectId, setProjectInitializationsByProjectId] = useState<
    Record<string, ProjectInitializationInfo>
  >({});
  const [initializationFactsByInitializationId, setInitializationFactsByInitializationId] =
    useState<Record<string, ProjectInitializationFactInfo[]>>({});
  const [
    initializationMarkdownFindingsByInitializationId,
    setInitializationMarkdownFindingsByInitializationId,
  ] = useState<Record<string, ProjectInitializationMarkdownFindingInfo[]>>({});
  const [
    initializationGuardrailsByInitializationId,
    setInitializationGuardrailsByInitializationId,
  ] = useState<Record<string, ProjectInitializationGuardrailInfo[]>>({});
  const [
    initializationSummariesByInitializationId,
    setInitializationSummariesByInitializationId,
  ] = useState<Record<string, ProjectInitializationSummaryInfo | null>>({});
  const [knowledgeUnitsByInitializationId, setKnowledgeUnitsByInitializationId] = useState<
    Record<string, KnowledgeUnitInfo[]>
  >({});
  const [knowledgeUnitsLoading, setKnowledgeUnitsLoading] = useState(false);
  const [knowledgeUnitsError, setKnowledgeUnitsError] = useState<string | null>(null);
  const [taskContextPreview, setTaskContextPreview] =
    useState<TaskContextSelectionInfo | null>(null);
  const [taskContextPreviewOpen, setTaskContextPreviewOpen] = useState(false);
  const [taskContextPreviewLoading, setTaskContextPreviewLoading] = useState(false);
  const [taskContextPreviewError, setTaskContextPreviewError] = useState<string | null>(null);
  const [transcriptSession, setTranscriptSession] = useState<TranscriptSessionInfo | null>(null);
  const [transcriptSessions, setTranscriptSessions] = useState<TranscriptSessionInfo[]>([]);
  const [tasksByTranscriptId, setTasksByTranscriptId] = useState<Record<string, TaskInfo>>({});
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
  const [acpControlsExpanded, setAcpControlsExpanded] = useState(true);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("acp");
  const pushToast = useNotificationStore((state) => state.push);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

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
  const projectInitializationGuardrails = projectInitialization
    ? initializationGuardrailsByInitializationId[projectInitialization.id] ?? []
    : [];
  const projectInitializationSummary = projectInitialization
    ? initializationSummariesByInitializationId[projectInitialization.id] ?? null
    : null;
  const projectInitializationKnowledgeUnits = projectInitialization
    ? knowledgeUnitsByInitializationId[projectInitialization.id] ?? []
    : [];
  const synthesisTierProfiles = useMemo(
    () => (modelCatalog?.profiles ?? []).filter((profile) => profile.tier === synthesisTier),
    [modelCatalog, synthesisTier],
  );
  const selectedSynthesisModelProfile = useMemo(
    () =>
      modelCatalog?.profiles.find((profile) => profile.id === synthesisModelProfileId) ?? null,
    [modelCatalog, synthesisModelProfileId],
  );
  const selectedSynthesisModelProvider = useMemo(
    () =>
      modelCatalog?.providers.find(
        (provider) => provider.id === selectedSynthesisModelProfile?.providerId,
      ) ?? null,
    [modelCatalog, selectedSynthesisModelProfile?.providerId],
  );
  const projectInitializationPhases = useMemo(
    () => projectInitializationPhaseItems(projectInitialization?.status ?? null),
    [projectInitialization?.status],
  );
  const projectInitializationFactGroups = useMemo(
    () => groupInitializationFacts(projectInitializationFacts),
    [projectInitializationFacts],
  );
  const projectInitializationFactPreviewGroups = useMemo(
    () =>
      projectInitializationFactGroups.slice(0, 2).map((group) => ({
        ...group,
        totalFacts: group.facts.length,
        facts: group.facts.slice(0, 3),
      })),
    [projectInitializationFactGroups],
  );
  const projectInitializationMarkdownPreview = useMemo(
    () => projectInitializationMarkdownFindings.slice(0, 3),
    [projectInitializationMarkdownFindings],
  );
  const projectInitializationGuardrailPreview = useMemo(
    () => projectInitializationGuardrails.slice(0, 3),
    [projectInitializationGuardrails],
  );
  const selectedRepository = useMemo(
    () =>
      projectRepositories.find((repository) => repository.id === selectedRepositoryId) ?? null,
    [projectRepositories, selectedRepositoryId],
  );
  const selectedHistorySessionId = openedTranscriptSession?.id ?? transcriptSession?.id ?? null;
  const activeTask = transcriptSession ? tasksByTranscriptId[transcriptSession.id] ?? null : null;
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
    void refreshModelCatalog();
  }, []);

  useEffect(() => {
    void refreshTranscriptSessions(selectedProjectId);
    void refreshProjectTasks(selectedProjectId);
    void refreshKnowledgeItems(selectedProjectId);
    void refreshProjectRepositories(selectedProjectId);
    void refreshProjectInitializations(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    void refreshProjectInitializationFacts(projectInitialization?.id ?? null);
    void refreshProjectInitializationMarkdownFindings(projectInitialization?.id ?? null);
    void refreshProjectInitializationGuardrails(projectInitialization?.id ?? null);
    void refreshProjectInitializationSummary(projectInitialization?.id ?? null);
    void refreshProjectInitializationKnowledgeUnits(projectInitialization?.id ?? null);
  }, [projectInitialization?.id]);

  useEffect(() => {
    if (
      projectInitializationSummary?.requestedModelProfileId &&
      projectInitializationSummary.requestedModelTier
    ) {
      setSynthesisModelProfileId(projectInitializationSummary.requestedModelProfileId);
      setSynthesisTier(projectInitializationSummary.requestedModelTier);
    } else if (!projectInitializationSummary) {
      setSynthesisModelProfileId(defaultSynthesisModelProfileId);
      setSynthesisTier("mid");
    }
  }, [
    projectInitializationSummary?.requestedModelProfileId,
    projectInitializationSummary?.requestedModelTier,
  ]);

  useEffect(() => {
    if (selectedSynthesisModelProfile) {
      setSynthesisTier(selectedSynthesisModelProfile.tier);
    }
  }, [selectedSynthesisModelProfile]);

  useEffect(() => {
    if (!projectInitialization) {
      setInitializeDetailsView(null);
      setInterviewDialogOpen(false);
    }
  }, [projectInitialization]);

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

  async function refreshProjectInitializationGuardrails(initializationId: string | null) {
    if (!initializationId) {
      return;
    }

    try {
      const guardrails =
        (await invoke<ProjectInitializationGuardrailInfo[]>(
          "list_project_initialization_guardrails",
          {
            initializationId,
          },
        )) ?? [];
      setInitializationGuardrailsByInitializationId((current) => ({
        ...current,
        [initializationId]: guardrails,
      }));
    } catch (err) {
      pushToast("error", errorText(err));
    }
  }

  function openInterviewDialog() {
    if (!projectInitialization) {
      pushToast("error", "Start Project Initialize before the interview.");
      return;
    }

    setInterviewDraftGuardrails(projectInitializationGuardrails.map(guardrailToInput));
    setInterviewScope("project");
    setInterviewRepositoryId(selectedRepositoryId ?? projectRepositories[0]?.id ?? "");
    setInterviewKind("fragile");
    setInterviewPathPattern("");
    setInterviewContent("");
    setInterviewError(null);
    setInterviewDialogOpen(true);
  }

  function closeInterviewDialog() {
    if (initializeLoading) {
      return;
    }

    setInterviewDialogOpen(false);
    setInterviewError(null);
  }

  function addInterviewGuardrail() {
    const content = interviewContent.trim();
    if (!content) {
      setInterviewError("Describe the guardrail before adding it.");
      return;
    }

    const repositoryId = interviewScope === "repository" ? interviewRepositoryId : null;
    if (interviewScope === "repository" && !repositoryId) {
      setInterviewError("Choose a repository for this guardrail.");
      return;
    }

    setInterviewDraftGuardrails((current) => [
      ...current,
      {
        repositoryId,
        kind: interviewKind,
        pathPattern: interviewPathPattern.trim() || null,
        content,
      },
    ]);
    setInterviewPathPattern("");
    setInterviewContent("");
    setInterviewError(null);
  }

  function removeInterviewGuardrail(index: number) {
    setInterviewDraftGuardrails((current) =>
      current.filter((_, candidateIndex) => candidateIndex !== index),
    );
  }

  async function saveProjectInitializationGuardrails() {
    if (!projectInitialization) {
      setInterviewError("Start Project Initialize before saving interview guardrails.");
      return;
    }
    if (interviewDraftGuardrails.length === 0) {
      setInterviewError("Add at least one guardrail before saving.");
      return;
    }

    setInitializeLoading(true);
    setInterviewError(null);
    try {
      const guardrails = await invoke<ProjectInitializationGuardrailInfo[]>(
        "save_project_initialization_guardrails",
        {
          request: {
            initializationId: projectInitialization.id,
            guardrails: interviewDraftGuardrails,
          },
        },
      );
      setInitializationGuardrailsByInitializationId((current) => ({
        ...current,
        [projectInitialization.id]: guardrails,
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
            status: "interview",
          },
        };
      });
      setInterviewDialogOpen(false);
      pushToast("success", `Interview saved with ${guardrails.length} guardrails.`);
    } catch (err) {
      setInterviewError(errorText(err));
    } finally {
      setInitializeLoading(false);
    }
  }

  async function refreshProjectInitializationSummary(initializationId: string | null) {
    if (!initializationId) {
      return;
    }

    try {
      const summary =
        (await invoke<ProjectInitializationSummaryInfo | null>(
          "list_project_initialization_summary",
          {
            initializationId,
          },
        )) ?? null;
      setInitializationSummariesByInitializationId((current) => ({
        ...current,
        [initializationId]: summary,
      }));
    } catch (err) {
      pushToast("error", errorText(err));
    }
  }

  async function generateProjectInitializationSummary() {
    if (!projectInitialization) {
      pushToast("error", "Start Project Initialize before generating a summary.");
      return;
    }
    if (!selectedSynthesisModelProfile || selectedSynthesisModelProfile.status !== "selectable") {
      pushToast("error", "Choose an available synthesis model before generating a summary.");
      return;
    }

    setInitializeLoading(true);
    try {
      const summary = await invoke<ProjectInitializationSummaryInfo>(
        "generate_project_initialization_summary",
        {
          request: {
            initializationId: projectInitialization.id,
            modelProfileId: selectedSynthesisModelProfile.id,
          },
        },
      );
      setInitializationSummariesByInitializationId((current) => ({
        ...current,
        [projectInitialization.id]: summary,
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
            status: "summary",
          },
        };
      });
      pushToast("success", "Summary draft generated.");
    } catch (err) {
      pushToast("error", errorText(err));
    } finally {
      setInitializeLoading(false);
    }
  }

  async function refreshProjectInitializationKnowledgeUnits(initializationId: string | null) {
    if (!initializationId) {
      setKnowledgeUnitsError(null);
      return;
    }

    setKnowledgeUnitsLoading(true);
    setKnowledgeUnitsError(null);
    try {
      const units =
        (await invoke<KnowledgeUnitInfo[]>("list_project_initialization_knowledge_units", {
          initializationId,
        })) ?? [];
      setKnowledgeUnitsByInitializationId((current) => ({
        ...current,
        [initializationId]: units,
      }));
    } catch (err) {
      setKnowledgeUnitsError(errorText(err));
    } finally {
      setKnowledgeUnitsLoading(false);
    }
  }

  async function approveProjectInitializationSummary() {
    if (!projectInitializationSummary) {
      pushToast("error", "Generate a summary before approving it.");
      return;
    }

    setInitializeLoading(true);
    try {
      const summary = await invoke<ProjectInitializationSummaryInfo>(
        "approve_project_initialization_summary",
        {
          summaryId: projectInitializationSummary.id,
        },
      );
      setInitializationSummariesByInitializationId((current) => ({
        ...current,
        [summary.initializationId]: summary,
      }));
      await refreshProjectInitializationKnowledgeUnits(summary.initializationId);
      pushToast("success", "Summary approved as active project profile.");
    } catch (err) {
      pushToast("error", errorText(err));
    } finally {
      setInitializeLoading(false);
    }
  }

  async function previewTaskContext() {
    if (!projectInitialization || projectInitializationSummary?.status !== "approved") {
      setTaskContextPreviewError("Approve a Summary before previewing task context.");
      setTaskContextPreviewOpen(true);
      return;
    }
    setTaskContextPreviewOpen(true);
    setTaskContextPreviewLoading(true);
    setTaskContextPreviewError(null);
    try {
      const preview = await invoke<TaskContextSelectionInfo>("select_project_task_context", {
        request: {
          initializationId: projectInitialization.id,
          task: acpPrompt,
          repositoryId: selectedRepository?.id ?? null,
          paths: [],
          characterBudget: 6000,
        },
      });
      setTaskContextPreview(preview);
    } catch (err) {
      setTaskContextPreview(null);
      setTaskContextPreviewError(errorText(err));
    } finally {
      setTaskContextPreviewLoading(false);
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

  async function refreshProjectTasks(projectId = selectedProjectId) {
    const requestId = taskLoadRequest.current + 1;
    taskLoadRequest.current = requestId;
    tasksByTranscriptIdRef.current = {};
    setTasksByTranscriptId({});
    if (!projectId) {
      return;
    }

    try {
      const tasks =
        (await invoke<TaskInfo[]>("list_project_tasks", {
          projectId,
        })) ?? [];
      const indexedTasks = Object.fromEntries(
        tasks.map((task) => [task.transcriptSessionId, task]),
      );
      if (taskLoadRequest.current === requestId) {
        tasksByTranscriptIdRef.current = indexedTasks;
        setTasksByTranscriptId(indexedTasks);
      }
    } catch (err) {
      if (taskLoadRequest.current === requestId) {
        setTranscriptError(errorText(err));
      }
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

  async function refreshModelCatalog() {
    try {
      const catalog = await invoke<ModelCatalogInfo>("list_model_catalog");
      if (
        !catalog ||
        !Array.isArray(catalog.providers) ||
        !Array.isArray(catalog.profiles)
      ) {
        throw new Error("Invalid model catalog response.");
      }
      setModelCatalog(catalog);
      setSynthesisModelProfileId((current) => {
        const selected = catalog.profiles.find(
          (profile) => profile.id === current && profile.status === "selectable",
        );
        const fallback =
          catalog.profiles.find(
            (profile) =>
              profile.id === defaultSynthesisModelProfileId && profile.status === "selectable",
          ) ??
          catalog.profiles.find((profile) => profile.status === "selectable") ??
          catalog.profiles.find((profile) => profile.id === defaultSynthesisModelProfileId) ??
          catalog.profiles[0];
        return (selected ?? fallback)?.id ?? "";
      });
    } catch (err) {
      pushToast("error", errorText(err));
    }
  }

  function selectSynthesisTier(tier: ModelTier) {
    setSynthesisTier(tier);
    const currentProfile = modelCatalog?.profiles.find(
      (profile) => profile.id === synthesisModelProfileId,
    );
    if (currentProfile?.tier === tier && currentProfile.status === "selectable") {
      return;
    }

    const tierProfiles = modelCatalog?.profiles.filter((profile) => profile.tier === tier) ?? [];
    const nextProfile =
      tierProfiles.find((profile) => profile.status === "selectable") ?? tierProfiles[0];
    setSynthesisModelProfileId(nextProfile?.id ?? "");
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

  async function changeAcpCodingModel(modelId: string) {
    if (!acpSession || !acpSession.codingModel || modelId === acpSession.codingModel.currentValue) {
      return;
    }

    await runAction(async () => {
      const updated = await invoke<AcpSessionInfo>("set_acp_model", {
        request: {
          sessionId: acpSession.id,
          modelId,
        },
      });
      setAcpSession(updated);
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
      if (selectedProject && !activeTranscriptId) {
        throw new Error("A project Task requires an active transcript session.");
      }
      if (
        selectedProject &&
        activeTranscriptId &&
        !tasksByTranscriptIdRef.current[activeTranscriptId]
      ) {
        const task = await invoke<TaskInfo>("create_task", {
          request: {
            projectId: selectedProject.id,
            transcriptSessionId: activeTranscriptId,
            originalPrompt: acpPrompt,
          },
        });
        tasksByTranscriptIdRef.current = {
          ...tasksByTranscriptIdRef.current,
          [activeTranscriptId]: task,
        };
        setTasksByTranscriptId((current) => ({
          ...current,
          [activeTranscriptId]: task,
        }));
      }
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
    <main className="app-shell" aria-label="AIadne agent workspace">
      <section
        className="intro-panel"
        aria-labelledby="runtime-sidebar-title"
        data-mobile-navigation-open={mobileNavigationOpen}
      >
        <div className="sidebar-brand">
          <img className="app-mark" src={aiadneMark} alt="" aria-hidden="true" />
          <div>
            <p className="eyebrow">Agent workspace</p>
            <h1 id="runtime-sidebar-title">AIadne</h1>
            <span className="brand-tagline">Repository intelligence, woven together.</span>
          </div>
          <button
            aria-controls="mobile-sidebar-navigation"
            aria-expanded={mobileNavigationOpen}
            aria-label={mobileNavigationOpen ? "Close navigation" : "Open navigation"}
            className="mobile-navigation-toggle"
            type="button"
            onClick={() => setMobileNavigationOpen((current) => !current)}
          >
            {mobileNavigationOpen ? "Close" : "Menu"}
          </button>
        </div>

        <p className="mobile-context-summary" aria-live="polite">
          <span>{selectedProject?.name ?? "No workspace"}</span>
          <span aria-hidden="true">/</span>
          <span>{selectedRepository?.name ?? (selectedProject ? "Default repository" : "No repository")}</span>
        </p>

        <div className="mobile-sidebar-content" id="mobile-sidebar-navigation">
        <button
          aria-haspopup="dialog"
          className="workspace-picker"
          type="button"
          onClick={() => setWorkspaceDialogOpen(true)}
        >
          <span className="workspace-picker-label">Current workspace</span>
          <strong>{selectedProject?.name ?? "Choose a workspace"}</strong>
          <small>{selectedProject?.path ?? "Add or select a project"}</small>
          <span className="workspace-picker-action" aria-hidden="true">
            Switch
          </span>
        </button>

        <button
          aria-haspopup="dialog"
          className="workspace-picker repository-picker"
          type="button"
          onClick={() => setRepositoryDialogOpen(true)}
          disabled={!selectedProject}
        >
          <span className="workspace-picker-label">Current repository</span>
          <strong>{selectedRepository?.name ?? (selectedProject ? "Choose a repository" : "No workspace")}</strong>
          <small>{selectedRepository?.path ?? "Select a workspace first"}</small>
          <span className="workspace-picker-action" aria-hidden="true">
            Manage
          </span>
        </button>

        <div className="sidebar-scroll">
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

          <details className="agent-accordion sidebar-history">
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
        </div>
      </section>

      <section className="initialize-lane" aria-labelledby="project-initialize-lane-title">
        <div className="section-heading">
          <p className="eyebrow">Project knowledge</p>
          <h2 id="project-initialize-lane-title">Project Initialization</h2>
          <p className="section-description">
            Turn repository evidence and working rules into reviewable agent context.
          </p>
        </div>

        <div className="project-initialize-section">
          <div className="project-initialize-hero">
            <div className="project-initialize-copy">
              <span className="section-kicker">Evidence workflow</span>
              <h3 id="project-initialize-title">Build agent-ready context</h3>
              <p>
                Choose repository scope, collect evidence, add guardrails, and approve the result.
              </p>
            </div>
            <span className="initialize-run-status">
              {projectInitialization
                ? `${projectInitializationStatusLabel(projectInitialization.status)} · ${projectInitialization.repositoryCount} ${projectInitialization.repositoryCount === 1 ? "repository" : "repositories"}`
                : selectedProject
                  ? "Ready to start"
                  : "Select workspace"}
            </span>
            <button
              className="primary-action"
              type="button"
              onClick={openProjectInitializeDialog}
              disabled={!selectedProject || projectRepositories.length === 0 || initializeLoading}
            >
              Initialize Project
            </button>
          </div>
          <ol className="initialize-progress-list" aria-label="Project initialization phases">
            {projectInitializationPhases.map((phase) => (
              <li data-state={phase.state} key={phase.id}>
                <span>{phase.index}</span>
                <strong>{phase.label}</strong>
              </li>
            ))}
          </ol>
          {projectInitialization ? (
            <>
              <section
                className="initialize-preflight-summary"
                data-state={projectInitializationPhases[0]?.state}
                aria-labelledby="initialize-preflight-title"
              >
                <span className="initialize-phase-index">01</span>
                <div>
                  <span>Phase 1</span>
                  <h4 id="initialize-preflight-title">Preflight scope</h4>
                  <p>
                    {projectInitialization.repositoryCount}{" "}
                    {projectInitialization.repositoryCount === 1 ? "repository" : "repositories"}{" "}
                    selected for this initialization run.
                  </p>
                </div>
                <strong>
                  {projectInitializationPhases[0]?.state === "complete" ? "complete" : "scope saved"}
                </strong>
              </section>
              <div className="initialize-results">
                <section className="initialize-result-card" aria-labelledby="initialize-facts-title">
                <div className="initialize-card-topline">
                  <span className="initialize-phase-index">02</span>
                  <div>
                    <span>Phase 2</span>
                    <h4 id="initialize-facts-title">Facts</h4>
                  </div>
                  <strong data-state={projectInitializationFacts.length > 0 ? "success" : "pending"}>
                    {projectInitializationFacts.length > 0
                      ? `${projectInitializationFacts.length} collected`
                      : "not collected"}
                  </strong>
                </div>
                <div className="initialize-card-actions">
                  <button
                    className="primary-action"
                    type="button"
                    onClick={() => void collectProjectInitializationFacts()}
                    disabled={initializeLoading}
                  >
                    Collect Facts
                  </button>
                  <button
                    type="button"
                    onClick={() => setInitializeDetailsView("facts")}
                    disabled={projectInitializationFacts.length === 0}
                  >
                    View Facts
                  </button>
                </div>
                {projectInitializationFactPreviewGroups.length > 0 ? (
                  <>
                    <div className="initialize-metric-grid" aria-label="Facts summary">
                      <div>
                        <span>Repositories</span>
                        <strong>{projectInitializationFactGroups.length}</strong>
                      </div>
                      <div>
                        <span>Facts</span>
                        <strong>{projectInitializationFacts.length}</strong>
                      </div>
                    </div>
                    <ul className="fact-preview-list" aria-label="Project initialization facts">
                      {projectInitializationFactPreviewGroups.map((group) => (
                        <li key={group.repositoryId}>
                          <div className="fact-repository-heading">
                            <strong>{group.repositoryName}</strong>
                            <small>
                              {group.facts.length}/{group.totalFacts} shown
                            </small>
                          </div>
                          <div className="fact-preview-grid">
                            {group.facts.map((fact) => (
                              <div key={fact.id}>
                                <span>
                                  {fact.label}: {fact.value}
                                </span>
                                <small>{fact.source}</small>
                              </div>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <StateNotice
                    kind="prerequisite"
                    title="Facts are ready to collect"
                    description="Run deterministic repository inspection to populate this phase."
                  />
                )}
                </section>
              <section
                className="initialize-result-card"
                aria-labelledby="initialize-markdown-title"
              >
                <div className="initialize-card-topline">
                  <span className="initialize-phase-index">03</span>
                  <div>
                    <span>Phase 3</span>
                    <h4 id="initialize-markdown-title">Markdown</h4>
                  </div>
                  <strong
                    data-state={projectInitializationMarkdownFindings.length > 0 ? "success" : "pending"}
                  >
                    {projectInitializationMarkdownFindings.length > 0
                      ? `${projectInitializationMarkdownFindings.length} findings`
                      : "not analyzed"}
                  </strong>
                </div>
                <div className="initialize-card-actions">
                  <button
                    className="primary-action"
                    type="button"
                    onClick={() => void analyzeProjectInitializationMarkdown()}
                    disabled={initializeLoading}
                  >
                    Analyze Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => setInitializeDetailsView("markdown")}
                    disabled={projectInitializationMarkdownFindings.length === 0}
                  >
                    View Findings
                  </button>
                </div>
                {projectInitializationMarkdownPreview.length > 0 ? (
                  <ul
                    className="markdown-preview-list"
                    aria-label="Project initialization markdown findings"
                  >
                    {projectInitializationMarkdownPreview.map((finding) => (
                      <li key={finding.id}>
                        <div className="markdown-finding-heading">
                          <span className={markdownCategoryClassName(finding.category)}>
                            {formatMarkdownCategory(finding.category)}
                          </span>
                          <strong>{finding.title}</strong>
                        </div>
                        <div className="markdown-finding-meta">
                          <span>{finding.repositoryName}</span>
                          <small>
                            {finding.filePath} · {finding.source}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <StateNotice
                    kind="prerequisite"
                    title="Markdown is ready to analyze"
                    description="Scan repository documentation to surface sourced project findings."
                  />
                )}
              </section>
              <section
                className="initialize-result-card"
                aria-labelledby="initialize-interview-title"
              >
                <div className="initialize-card-topline">
                  <span className="initialize-phase-index">04</span>
                  <div>
                    <span>Phase 4</span>
                    <h4 id="initialize-interview-title">Interview</h4>
                  </div>
                  <strong
                    data-state={projectInitializationGuardrails.length > 0 ? "success" : "pending"}
                  >
                    {projectInitializationGuardrails.length > 0
                      ? `${projectInitializationGuardrails.length} guardrails`
                      : "not started"}
                  </strong>
                </div>
                <div className="initialize-card-actions initialize-card-actions-single">
                  <button
                    className="primary-action"
                    type="button"
                    onClick={openInterviewDialog}
                    disabled={initializeLoading}
                  >
                    Open Interview
                  </button>
                </div>
                {projectInitializationGuardrailPreview.length > 0 ? (
                  <ul
                    className="guardrail-preview-list"
                    aria-label="Project initialization guardrails"
                  >
                    {projectInitializationGuardrailPreview.map((guardrail) => (
                      <li key={guardrail.id}>
                        <div className="guardrail-heading">
                          <span className={guardrailKindClassName(guardrail.kind)}>
                            {guardrailKindLabel(guardrail.kind)}
                          </span>
                          <strong>
                            {guardrail.repositoryName ?? "Project-wide"}
                          </strong>
                        </div>
                        {guardrail.pathPattern ? <code>{guardrail.pathPattern}</code> : null}
                        <p>{guardrail.content}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <StateNotice
                    kind="prerequisite"
                    title="No guardrails captured"
                    description="Add fragile areas, do-not-touch paths, and review rules in the Interview."
                  />
                )}
              </section>
              <section
                className="initialize-result-card"
                aria-labelledby="initialize-summary-title"
              >
                <div className="initialize-card-topline">
                  <span className="initialize-phase-index">05</span>
                  <div>
                    <span>Phase 5</span>
                    <h4 id="initialize-summary-title">Summary</h4>
                  </div>
                  <strong data-state={projectInitializationSummary ? "success" : "pending"}>
                    {projectInitializationSummary
                      ? projectInitializationSummary.status
                      : "not generated"}
                  </strong>
                </div>
                <div className="synthesis-model-controls">
                  <div
                    className="model-tier-control"
                    role="group"
                    aria-label="Synthesis tier"
                  >
                    {modelTiers.map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        aria-pressed={synthesisTier === tier}
                        onClick={() => selectSynthesisTier(tier)}
                      >
                        {formatModelTier(tier)}
                      </button>
                    ))}
                  </div>
                  <label className="synthesis-model-select">
                    <span>Synthesis model</span>
                    <select
                      aria-label="Synthesis model"
                      value={synthesisModelProfileId}
                      onChange={(event) => setSynthesisModelProfileId(event.target.value)}
                      disabled={!modelCatalog || synthesisTierProfiles.length === 0}
                    >
                      {synthesisTierProfiles.length === 0 ? (
                        <option value="">No profile for this tier</option>
                      ) : null}
                      {synthesisTierProfiles.map((profile) => (
                        <option
                          key={profile.id}
                          value={profile.id}
                          disabled={profile.status !== "selectable"}
                        >
                          {profile.displayName}
                          {profile.status === "unavailable" && profile.unavailableReason
                            ? ` — ${profile.unavailableReason}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedSynthesisModelProfile ? (
                    <>
                      <div
                        className="model-capability-list"
                        aria-label="Synthesis model capabilities"
                      >
                        <span className="model-provider-badge">
                          {selectedSynthesisModelProvider?.displayName ??
                            selectedSynthesisModelProfile.providerId}
                        </span>
                        {modelCapabilityBadges(selectedSynthesisModelProfile).map((capability) => (
                          <span
                            key={capability.label}
                            className={`model-capability model-capability-${capability.status}`}
                            title={`${capability.label}: ${capability.status}`}
                          >
                            {capability.label}
                          </span>
                        ))}
                      </div>
                      {selectedSynthesisModelProfile.status === "unavailable" &&
                      selectedSynthesisModelProfile.unavailableReason ? (
                        <p className="model-availability-note" role="status">
                          {selectedSynthesisModelProfile.unavailableReason}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <div className="initialize-card-actions">
                  <button
                    className="primary-action"
                    type="button"
                    onClick={() => void generateProjectInitializationSummary()}
                    disabled={
                      initializeLoading ||
                      !selectedSynthesisModelProfile ||
                      selectedSynthesisModelProfile.status !== "selectable"
                    }
                  >
                    Generate Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => setInitializeDetailsView("summary")}
                    disabled={!projectInitializationSummary}
                  >
                    View Summary
                  </button>
                </div>
                {projectInitializationSummary ? (
                  <div
                    className="summary-preview"
                    aria-label="Project initialization summary preview"
                  >
                    <div className="initialize-metric-grid" aria-label="Summary source counts">
                      <div>
                        <span>Facts</span>
                        <strong>{projectInitializationSummary.factCount}</strong>
                      </div>
                      <div>
                        <span>Markdown</span>
                        <strong>{projectInitializationSummary.markdownFindingCount}</strong>
                      </div>
                      <div>
                        <span>Rules</span>
                        <strong>{projectInitializationSummary.guardrailCount}</strong>
                      </div>
                    </div>
                    <p className="summary-compact-note">
                      {projectInitializationSummary.status === "approved"
                        ? "Approved profile is ready for agent context."
                        : "Draft profile is ready for review."}
                    </p>
                    <p className="summary-model-provenance">
                      <strong>
                        {projectInitializationSummary.requestedModelId ??
                          "Legacy deterministic draft"}
                      </strong>
                      <span>
                        {projectInitializationSummary.requestedModelTier ?? "unversioned"} ·{" "}
                        {projectInitializationSummary.generationEngine}
                      </span>
                    </p>
                  </div>
                ) : (
                  <StateNotice
                    kind="prerequisite"
                    title="No summary draft"
                    description="Generate a reviewable profile from Facts, Markdown, and Interview evidence."
                  />
                )}
              </section>
              </div>
            </>
          ) : (
            <StateNotice
              kind="prerequisite"
              title={
                !selectedProject
                  ? "Choose a workspace to begin"
                  : projectRepositories.length === 0
                    ? "Add a repository before initialization"
                    : "Ready to initialize project knowledge"
              }
              description={
                !selectedProject
                  ? "Select or create a workspace from the navigation before starting this workflow."
                  : projectRepositories.length === 0
                    ? "Open repository management and add at least one repository to define the evidence scope."
                    : "Start Initialize to choose repository scope and create the Preflight record."
              }
            />
          )}
        </div>
      </section>

      <section className="runtime-lane" aria-label="Runtime lane">
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
          <AcpRuntimePanel
            activeTask={activeTask}
            busy={busy}
            canPreviewContext={
              !taskContextPreviewLoading &&
              !!acpPrompt.trim() &&
              projectInitializationSummary?.status === "approved"
            }
            canStartSelectedCandidate={canStartSelectedAcpCandidate}
            canUseSession={canUseAcpSession}
            expanded={acpControlsExpanded}
            prompt={acpPrompt}
            promptBusy={acpPromptBusy}
            promptResult={acpPromptResult}
            session={acpSession}
            showWaiting={showAcpWaiting}
            statusLabel={acpStatusLabel}
            onChangeModel={(modelId) => void changeAcpCodingModel(modelId)}
            onChangePrompt={setAcpPrompt}
            onDrain={() => void drainAcpEvents()}
            onPreviewContext={() => void previewTaskContext()}
            onSendPrompt={() => void sendAcpPrompt()}
            onStartFake={() => void startFakeAcpSession()}
            onStartSelected={() => void startSelectedAcpSession()}
            onStop={() => void stopAcpSession(false)}
            onToggleExpanded={() => setAcpControlsExpanded((expanded) => !expanded)}
          />
        ) : null}

        {error ? (
          <p className="error-message" role="alert">
            {error}
          </p>
        ) : null}

        <SessionOutputPanel
          events={displayAcpEvents}
          eventsListRef={acpEventsList}
          openedTranscript={openedTranscriptSession}
          output={output}
          runtimeMode={runtimeMode}
          showWaiting={showAcpWaiting}
          terminalElementRef={terminalElement}
          onFocusTerminal={() => terminal.current?.focus()}
          onShowLiveEvents={showLiveAcpEvents}
        />
      </section>

      {repositoryDialogOpen ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setRepositoryDialogOpen(false);
            }
          }}
        >
          <section
            aria-labelledby="repository-dialog-title"
            aria-modal="true"
            className="knowledge-modal workspace-modal repository-modal"
            role="dialog"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">{selectedProject?.name ?? "Workspace"}</p>
                <h2 id="repository-dialog-title">Choose Repository</h2>
                <span>Select which repository agents should use, or add another folder.</span>
              </div>
              <button
                aria-label="Close repository picker"
                className="icon-button"
                type="button"
                onClick={() => setRepositoryDialogOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="workspace-modal-toolbar">
              <strong>{projectRepositories.length} repositories</strong>
              <button
                type="button"
                onClick={() => void refreshProjectRepositories()}
                disabled={!selectedProject || repositoryLoading}
              >
                Refresh
              </button>
            </div>

            <ul className="project-list workspace-project-list" aria-label="Project repositories">
              {projectRepositories.length === 0 ? (
                <StateNotice
                  as="li"
                  kind="empty"
                  title="No repositories yet"
                  description="Add the first repository for this workspace below."
                />
              ) : (
                projectRepositories.map((repository) => (
                  <li data-selected={repository.id === selectedRepository?.id} key={repository.id}>
                    <div>
                      <strong>{repository.name}</strong>
                      <span>{repository.path}</span>
                      {repository.isDefault ? <small>Default repository</small> : null}
                    </div>
                    <div className="project-actions">
                      <button
                        aria-label={`Select ${repository.name} repository`}
                        aria-pressed={repository.id === selectedRepository?.id}
                        type="button"
                        onClick={() => {
                          setSelectedRepositoryId(repository.id);
                          setRepositoryDialogOpen(false);
                        }}
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

            <div className="workspace-create-panel">
              <div>
                <span className="section-kicker">New repository</span>
                <h3>Add a repository folder</h3>
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
                  className="primary-action"
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
            </div>
          </section>
        </div>
      ) : null}

      {workspaceDialogOpen ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setWorkspaceDialogOpen(false);
            }
          }}
        >
          <section
            aria-labelledby="workspace-dialog-title"
            aria-modal="true"
            className="knowledge-modal workspace-modal"
            role="dialog"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Global context</p>
                <h2 id="workspace-dialog-title">Choose Workspace</h2>
                <span>Select the project AIadne should use across initialization and sessions.</span>
              </div>
              <button
                aria-label="Close workspace picker"
                className="icon-button"
                type="button"
                onClick={() => setWorkspaceDialogOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="workspace-modal-toolbar">
              <strong>{projects.length} workspaces</strong>
              <button type="button" onClick={() => void refreshProjects()} disabled={projectLoading}>
                Refresh
              </button>
            </div>

            <ul className="project-list workspace-project-list" aria-label="Projects">
              {projects.length === 0 ? (
                <StateNotice
                  as="li"
                  kind="empty"
                  title="No workspaces yet"
                  description="Add your first project folder below to begin."
                />
              ) : (
                projects.map((project) => (
                  <li data-selected={project.id === selectedProject?.id} key={project.id}>
                    <div>
                      <strong>{project.name}</strong>
                      <span>{project.path}</span>
                      {project.id === selectedProject?.id ? <small>Current workspace</small> : null}
                    </div>
                    <div className="project-actions">
                      <button
                        aria-label={`Select ${project.name} project`}
                        aria-pressed={project.id === selectedProject?.id}
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setWorkspaceDialogOpen(false);
                        }}
                        disabled={busy || canUseSession || canUseAcpSession}
                      >
                        {project.id === selectedProject?.id ? "Selected" : "Select"}
                      </button>
                      <button
                        aria-label={`Delete ${project.name} project`}
                        className="danger-button"
                        type="button"
                        onClick={() => {
                          setWorkspaceDialogOpen(false);
                          openProjectDeleteDialog(project);
                        }}
                        disabled={busy || canUseSession || canUseAcpSession}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>

            <div className="workspace-create-panel">
              <div>
                <span className="section-kicker">New workspace</span>
                <h3>Add a project folder</h3>
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
                  className="primary-action"
                  type="button"
                  onClick={() => void createProject()}
                  disabled={busy || projectFolderPicking || !projectName.trim() || !projectPath.trim()}
                >
                  Add Project
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

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
                <CloseIcon />
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

      {initializeDetailsView ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setInitializeDetailsView(null);
            }
          }}
        >
          <section
            aria-labelledby="initialize-details-dialog-title"
            aria-modal="true"
            className="knowledge-modal initialize-details-modal"
            role="dialog"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Initialize</p>
                <h2 id="initialize-details-dialog-title">
                  {initializeDetailsView === "facts"
                    ? "Facts Detail"
                    : initializeDetailsView === "summary"
                      ? "Summary Review"
                      : "Markdown Findings"}
                </h2>
              </div>
              <button
                aria-label="Close initialization details"
                className="icon-button"
                type="button"
                onClick={() => setInitializeDetailsView(null)}
              >
                <CloseIcon />
              </button>
            </div>

            {initializeDetailsView === "facts" ? (
              projectInitializationFactGroups.length > 0 ? (
                <ul
                  className="fact-list details-fact-list"
                  aria-label="Project initialization fact details"
                >
                  {projectInitializationFactGroups.map((group) => (
                    <li key={group.repositoryId}>
                      <div className="fact-repository-heading">
                        <strong>{group.repositoryName}</strong>
                        <small>{group.facts.length} facts</small>
                      </div>
                      <div className="fact-grid">
                        {group.facts.map((fact) => (
                          <div key={fact.id}>
                            <span>
                              {fact.label}: {fact.value}
                            </span>
                            <small>{fact.source}</small>
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <StateNotice
                  kind="prerequisite"
                  title="Facts have not been collected yet"
                  description="Return to Project Initialization and run Collect Facts first."
                />
              )
            ) : initializeDetailsView === "markdown" ? (
              projectInitializationMarkdownFindings.length > 0 ? (
                <ul
                  className="markdown-finding-list details-markdown-list"
                  aria-label="Project initialization markdown finding details"
                >
                  {projectInitializationMarkdownFindings.map((finding) => (
                    <li key={finding.id}>
                      <div className="markdown-finding-heading">
                        <span className={markdownCategoryClassName(finding.category)}>
                          {formatMarkdownCategory(finding.category)}
                        </span>
                        <strong>{finding.title}</strong>
                      </div>
                      <p>{finding.excerpt}</p>
                      <div className="markdown-finding-meta">
                        <span>{finding.repositoryName}</span>
                        <small>
                          {finding.filePath} · {finding.source}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <StateNotice
                  kind="prerequisite"
                  title="Markdown has not been analyzed yet"
                  description="Return to Project Initialization and run Analyze Markdown first."
                />
              )
            ) : projectInitializationSummary ? (
              <>
                <div
                  className="summary-details"
                  aria-label="Project initialization summary"
                >
                  <div className="initialize-metric-grid" aria-label="Summary source counts">
                    <div>
                      <span>Facts</span>
                      <strong>{projectInitializationSummary.factCount}</strong>
                    </div>
                    <div>
                      <span>Markdown</span>
                      <strong>{projectInitializationSummary.markdownFindingCount}</strong>
                    </div>
                    <div>
                      <span>Rules</span>
                      <strong>{projectInitializationSummary.guardrailCount}</strong>
                    </div>
                  </div>
                  <dl
                    className="summary-provenance-grid"
                    aria-label="Summary generation provenance"
                  >
                    <div>
                      <dt>Requested model</dt>
                      <dd>
                        {projectInitializationSummary.requestedModelProviderId &&
                        projectInitializationSummary.requestedModelId
                          ? `${projectInitializationSummary.requestedModelProviderId} / ${projectInitializationSummary.requestedModelId}`
                          : "Legacy deterministic draft"}
                      </dd>
                    </div>
                    <div>
                      <dt>Tier</dt>
                      <dd>{projectInitializationSummary.requestedModelTier ?? "unversioned"}</dd>
                    </div>
                    <div>
                      <dt>Generator</dt>
                      <dd>{projectInitializationSummary.generationEngine}</dd>
                    </div>
                    <div>
                      <dt>Schema</dt>
                      <dd>
                        knowledge {projectInitializationSummary.knowledgeSchemaVersion} · catalog{" "}
                        {projectInitializationSummary.modelCatalogSchemaVersion ?? "legacy"}
                      </dd>
                    </div>
                  </dl>
                  <dl className="summary-section-list details-summary-list">
                    <div>
                      <dt>Purpose</dt>
                      <dd>{projectInitializationSummary.projectPurpose}</dd>
                    </div>
                    <div>
                      <dt>Repositories</dt>
                      <dd>{projectInitializationSummary.repositoryMap}</dd>
                    </div>
                    <div>
                      <dt>Repository Roles</dt>
                      <dd>{projectInitializationSummary.repositoryRoles}</dd>
                    </div>
                    <div>
                      <dt>Build/Test</dt>
                      <dd>{projectInitializationSummary.buildTestMatrix}</dd>
                    </div>
                    <div>
                      <dt>Fragile Areas</dt>
                      <dd>{projectInitializationSummary.fragileAreas}</dd>
                    </div>
                    <div>
                      <dt>Do Not Touch</dt>
                      <dd>{projectInitializationSummary.doNotTouchRules}</dd>
                    </div>
                    <div>
                      <dt>Agent Rules</dt>
                      <dd>{projectInitializationSummary.agentWorkingRules}</dd>
                    </div>
                    <div>
                      <dt>Open Questions</dt>
                      <dd>{projectInitializationSummary.openQuestions}</dd>
                    </div>
                  </dl>
                  <section className="knowledge-unit-preview" aria-label="Published knowledge units">
                    <div className="knowledge-unit-preview-heading">
                      <div>
                        <span>Approved knowledge</span>
                        <h3>Published units</h3>
                      </div>
                      <strong>{projectInitializationKnowledgeUnits.length}</strong>
                    </div>
                    {projectInitializationSummary.status !== "approved" ? (
                      <StateNotice
                        kind="prerequisite"
                        title="Approval required"
                        description="Knowledge Units are published only after this Summary is approved."
                      />
                    ) : knowledgeUnitsLoading ? (
                      <StateNotice
                        kind="loading"
                        title="Loading published units…"
                        description="Retrieving approved Knowledge Units and their source provenance."
                      />
                    ) : knowledgeUnitsError ? (
                      <StateNotice
                        kind="error"
                        title="Published units could not be loaded"
                        description={knowledgeUnitsError}
                      />
                    ) : projectInitializationKnowledgeUnits.length === 0 ? (
                      <StateNotice
                        kind="empty"
                        title="No Knowledge Units were published"
                        description="The approved Summary did not produce any active or reviewable units."
                      />
                    ) : (
                      <ul className="knowledge-unit-list">
                        {projectInitializationKnowledgeUnits.map((unit) => (
                          <li key={unit.id}>
                            <div className="knowledge-unit-meta">
                              <span>{unit.kind.replace(/_/g, " ")}</span>
                              <span>{unit.topic.replace(/_/g, " ")}</span>
                              <span className={`knowledge-unit-status ${unit.status}`}>
                                {unit.status.replace(/_/g, " ")}
                              </span>
                              <span>{unit.confidence}% confidence</span>
                            </div>
                            <p>{unit.content}</p>
                            <div className="knowledge-unit-sources">
                              <span>Sources</span>
                              {unit.sources.length > 0 ? (
                                unit.sources.map((source) => (
                                  <code key={`${unit.id}-${source.sourceKey}`}>
                                    {source.sourceKey}
                                    {source.path ? ` · ${source.path}` : ""}
                                  </code>
                                ))
                              ) : (
                                <em>Needs confirmation; no evidence source.</em>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setInitializeDetailsView(null)}>
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => void approveProjectInitializationSummary()}
                    disabled={
                      initializeLoading || projectInitializationSummary.status === "approved"
                    }
                  >
                    Approve Summary
                  </button>
                </div>
              </>
            ) : (
              <StateNotice
                kind="prerequisite"
                title="No summary available for review"
                description="Generate a Summary draft before opening the detailed review."
              />
            )}
          </section>
        </div>
      ) : null}

      {interviewDialogOpen ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeInterviewDialog();
            }
          }}
        >
          <section
            aria-labelledby="interview-dialog-title"
            aria-modal="true"
            className="knowledge-modal interview-modal"
            role="dialog"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Initialize</p>
                <h2 id="interview-dialog-title">Interview Guardrails</h2>
              </div>
              <button
                aria-label="Close interview guardrails"
                className="icon-button"
                type="button"
                onClick={closeInterviewDialog}
                disabled={initializeLoading}
              >
                <CloseIcon />
              </button>
            </div>

            {interviewError ? (
              <p className="error-message" role="alert">
                {interviewError}
              </p>
            ) : null}

            <div className="interview-form">
              <label>
                <span>Scope</span>
                <select
                  aria-label="Guardrail scope"
                  value={interviewScope}
                  onChange={(event) => setInterviewScope(event.currentTarget.value as InterviewScope)}
                >
                  <option value="project">Project-wide</option>
                  <option value="repository">Repository</option>
                </select>
              </label>
              {interviewScope === "repository" ? (
                <label>
                  <span>Repository</span>
                  <select
                    aria-label="Guardrail repository"
                    value={interviewRepositoryId}
                    onChange={(event) => setInterviewRepositoryId(event.currentTarget.value)}
                  >
                    {projectRepositories.map((repository) => (
                      <option key={repository.id} value={repository.id}>
                        {repository.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                <span>Type</span>
                <select
                  aria-label="Guardrail type"
                  value={interviewKind}
                  onChange={(event) =>
                    setInterviewKind(event.currentTarget.value as ProjectInitializationGuardrailKind)
                  }
                >
                  <option value="fragile">Fragile</option>
                  <option value="do_not_touch">Do not touch</option>
                  <option value="requires_review">Needs review</option>
                  <option value="agent_rule">Agent rule</option>
                </select>
              </label>
              <label>
                <span>Path or glob</span>
                <input
                  aria-label="Guardrail path pattern"
                  value={interviewPathPattern}
                  onChange={(event) => setInterviewPathPattern(event.currentTarget.value)}
                />
              </label>
              <label className="interview-content-field">
                <span>Guardrail</span>
                <textarea
                  aria-label="Guardrail content"
                  rows={4}
                  value={interviewContent}
                  onChange={(event) => setInterviewContent(event.currentTarget.value)}
                />
              </label>
              <button type="button" onClick={addInterviewGuardrail}>
                Add Guardrail
              </button>
            </div>

            <ul className="guardrail-draft-list" aria-label="Draft interview guardrails">
              {interviewDraftGuardrails.length === 0 ? (
                <li>No guardrails yet.</li>
              ) : (
                interviewDraftGuardrails.map((guardrail, index) => (
                  <li key={`${guardrail.kind}-${index}`}>
                    <div className="guardrail-heading">
                      <span className={guardrailKindClassName(guardrail.kind)}>
                        {guardrailKindLabel(guardrail.kind)}
                      </span>
                      <strong>
                        {guardrail.repositoryId
                          ? projectRepositories.find(
                              (repository) => repository.id === guardrail.repositoryId,
                            )?.name ?? "Repository"
                          : "Project-wide"}
                      </strong>
                    </div>
                    {guardrail.pathPattern ? <code>{guardrail.pathPattern}</code> : null}
                    <p>{guardrail.content}</p>
                    <button type="button" onClick={() => removeInterviewGuardrail(index)}>
                      Remove
                    </button>
                  </li>
                ))
              )}
            </ul>

            <div className="modal-actions">
              <button type="button" onClick={closeInterviewDialog} disabled={initializeLoading}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveProjectInitializationGuardrails()}
                disabled={initializeLoading || interviewDraftGuardrails.length === 0}
              >
                Save Interview
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
                <CloseIcon />
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

      {taskContextPreviewOpen ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !taskContextPreviewLoading) {
              setTaskContextPreviewOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-context-preview-title"
            className="knowledge-modal task-context-preview-modal"
          >
            <div className="modal-heading">
              <div>
                <span>Knowledge selector</span>
                <h2 id="task-context-preview-title">Task Context Preview</h2>
              </div>
              <button
                type="button"
                aria-label="Close task context preview"
                className="icon-button"
                onClick={() => setTaskContextPreviewOpen(false)}
                disabled={taskContextPreviewLoading}
              >
                <CloseIcon />
              </button>
            </div>
            {taskContextPreviewLoading ? (
              <StateNotice
                kind="loading"
                title="Selecting minimal task context…"
                description="Ranking approved units against the current task and character budget."
              />
            ) : taskContextPreviewError ? (
              <StateNotice
                kind="error"
                title="Task context could not be selected"
                description={taskContextPreviewError}
              />
            ) : taskContextPreview ? (
              <div className="task-context-preview-body">
                <dl className="task-context-budget" aria-label="Task context budget">
                  <div><dt>Budget</dt><dd>{taskContextPreview.characterBudget}</dd></div>
                  <div><dt>Used</dt><dd>{taskContextPreview.usedCharacters}</dd></div>
                  <div><dt>Remaining</dt><dd>{taskContextPreview.remainingCharacters}</dd></div>
                </dl>
                <section aria-label="Included task context">
                  <h3>Included · {taskContextPreview.included.length}</h3>
                  {taskContextPreview.included.length > 0 ? (
                    <ol className="task-context-entry-list">
                      {taskContextPreview.included.map((entry) => (
                        <li key={entry.unit.id}>
                          <div>
                            <strong>{entry.unit.kind.replace(/_/g, " ")}</strong>
                            <span>{entry.reason.replace(/_/g, " ")} · score {entry.score}</span>
                          </div>
                          <p>{entry.unit.content}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <StateNotice
                      kind="empty"
                      title="No units matched this task"
                      description="Try a more specific task or review the approved Knowledge Units."
                    />
                  )}
                </section>
                <section aria-label="Excluded task context">
                  <h3>Excluded · {taskContextPreview.excluded.length}</h3>
                  <ul className="task-context-entry-list excluded">
                    {taskContextPreview.excluded.map((entry) => (
                      <li key={entry.unit.id}>
                        <div>
                          <strong>{entry.unit.kind.replace(/_/g, " ")}</strong>
                          <span>{entry.reason.replace(/_/g, " ")}</span>
                        </div>
                        <p>{entry.unit.content}</p>
                      </li>
                    ))}
                  </ul>
                </section>
                <label className="field">
                  <span>Exact rendered context</span>
                  <textarea readOnly value={taskContextPreview.renderedContext} rows={8} />
                </label>
              </div>
            ) : (
              <StateNotice
                kind="empty"
                title="No preview available"
                description="Run the selector again to build an auditable task-context preview."
              />
            )}
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
                <CloseIcon />
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

      <NotificationViewport />
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

const projectInitializationPhaseDefinitions = [
  { id: "preflight", label: "Preflight" },
  { id: "facts", label: "Facts" },
  { id: "markdown", label: "Markdown" },
  { id: "interview", label: "Interview" },
  { id: "summary", label: "Summary" },
];

function projectInitializationStatusLabel(status: string) {
  return status
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function projectInitializationPhaseItems(status: string | null) {
  const activeIndex = projectInitializationPhaseDefinitions.findIndex((phase) => phase.id === status);

  return projectInitializationPhaseDefinitions.map((phase, index) => {
    let state = "upcoming";
    if (activeIndex >= 0 && index < activeIndex) {
      state = "complete";
    } else if (activeIndex >= 0 && index === activeIndex) {
      state = "current";
    }

    return {
      ...phase,
      index: String(index + 1).padStart(2, "0"),
      state,
    };
  });
}

function groupInitializationFacts(facts: ProjectInitializationFactInfo[]) {
  const groups = new Map<
    string,
    {
      repositoryId: string;
      repositoryName: string;
      facts: ProjectInitializationFactInfo[];
    }
  >();

  for (const fact of facts) {
    const existing = groups.get(fact.repositoryId);
    if (existing) {
      existing.facts.push(fact);
    } else {
      groups.set(fact.repositoryId, {
        repositoryId: fact.repositoryId,
        repositoryName: fact.repositoryName,
        facts: [fact],
      });
    }
  }

  return Array.from(groups.values());
}

function markdownCategoryClassName(category: string) {
  const normalized = category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `markdown-category markdown-category-${normalized}`;
}

function formatMarkdownCategory(category: string) {
  return category.replace(/[_-]+/g, " ");
}

function formatModelTier(tier: ModelTier) {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function modelCapabilityBadges(profile: ModelProfileInfo) {
  return [
    { label: "structured", status: profile.capabilities.structuredOutput },
    { label: "reasoning", status: profile.capabilities.reasoningControl },
    { label: "background", status: profile.capabilities.backgroundMode },
    { label: "api", status: profile.capabilities.api },
    { label: "cli", status: profile.capabilities.cli },
    { label: "acp", status: profile.capabilities.acp },
  ];
}

function guardrailToInput(
  guardrail: ProjectInitializationGuardrailInfo,
): ProjectInitializationGuardrailInput {
  return {
    repositoryId: guardrail.repositoryId,
    kind: guardrail.kind,
    pathPattern: guardrail.pathPattern,
    content: guardrail.content,
  };
}

function guardrailKindClassName(kind: string) {
  const normalized = kind.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `guardrail-kind guardrail-kind-${normalized}`;
}

function guardrailKindLabel(kind: string) {
  const labels: Record<string, string> = {
    fragile: "Fragile",
    do_not_touch: "Do not touch",
    requires_review: "Needs review",
    agent_rule: "Agent rule",
  };

  return labels[kind] ?? kind.replace(/[_-]+/g, " ");
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp * 1_000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readTerminalSize(activeTerminal: Terminal | null) {
  return {
    cols: Math.max(1, activeTerminal?.cols ?? initialSize.cols),
    rows: Math.max(1, activeTerminal?.rows ?? initialSize.rows),
  };
}

export default App;
