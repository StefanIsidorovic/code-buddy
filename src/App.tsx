import { useEffect, useMemo, useRef, useState } from "react";
import aiadneMark from "./assets/aiadne-mark.svg";
import { StateNotice } from "./components/ui/StateNotice";
import { NotificationViewport } from "./features/notifications/NotificationViewport";
import { ProjectInitializeDialog } from "./features/initialization/ProjectInitializeDialog";
import { InterviewGuardrailsDialog } from "./features/initialization/InterviewGuardrailsDialog";
import { InitializationDetailsDialog } from "./features/initialization/InitializationDetailsDialog";
import { ProjectInitializationPanel } from "./features/initialization/ProjectInitializationPanel";
import { useInitializationEvidence } from "./features/initialization/useInitializationEvidence";
import { useProjectInitializationWorkflow } from "./features/initialization/useProjectInitializationWorkflow";
import { AcpRuntimePanel } from "./features/runtime/AcpRuntimePanel";
import { PtyRuntimePanel } from "./features/runtime/PtyRuntimePanel";
import { SessionOutputPanel } from "./features/runtime/SessionOutputPanel";
import { usePtyTerminal, type TerminalSize } from "./features/runtime/usePtyTerminal";
import {
  WorkspaceContextSelector,
  WorkspaceContextSummary,
} from "./features/workspace/WorkspaceContextSelector";
import { RepositoryDialog } from "./features/workspace/RepositoryDialog";
import { WorkspaceDialog } from "./features/workspace/WorkspaceDialog";
import { ProjectDeleteDialog } from "./features/workspace/ProjectDeleteDialog";
import { useProjectCatalog } from "./features/workspace/useProjectCatalog";
import { TaskContextPreviewDialog } from "./features/knowledge/TaskContextPreviewDialog";
import { KnowledgeCardDialog } from "./features/knowledge/KnowledgeCardDialog";
import { KnowledgeCardsPanel } from "./features/knowledge/KnowledgeCardsPanel";
import { SessionHistoryPanel } from "./features/transcripts/SessionHistoryPanel";
import { AcpRegistryPanel } from "./features/agents/AcpRegistryPanel";
import { TerminalFallbackPanel } from "./features/agents/TerminalFallbackPanel";
import {
  boundToastMessages,
  useNotificationStore,
} from "./features/notifications/notificationStore";
import {
  coalesceAcpEvents,
  coalesceTranscriptEvents,
  errorText,
  formatPromptWithKnowledge,
  transcriptEventToAcpEvent,
  uniqueIds,
} from "./lib/presentation";
import { invokeCommand as invoke } from "./lib/tauriGateway";
import type {
  AcpPromptResult,
  AcpRegistryCandidate,
  AcpSessionEvent,
  AcpSessionInfo,
  AgentDoctorReport,
  KnowledgeItemInfo,
  ModelCatalogInfo,
  ModelTier,
  ProjectInfo,
  ProjectInitializationFactInfo,
  ProjectRepositoryInfo,
  RuntimeMode,
  SessionInfo,
  TaskContextSelectionInfo,
  TaskInfo,
  TranscriptEventInfo,
  TranscriptSessionInfo,
} from "./types/domain";
import "./App.css";

const defaultSynthesisModelProfileId = "openai-gpt-5.6-terra-medium";

export { StateNotice, boundToastMessages };

function App() {
  const acpEventsList = useRef<HTMLUListElement | null>(null);
  const transcriptOpenRequest = useRef(0);
  const taskLoadRequest = useRef(0);
  const transcriptSessionRef = useRef<TranscriptSessionInfo | null>(null);
  const tasksByTranscriptIdRef = useRef<Record<string, TaskInfo>>({});
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionKind, setSessionKind] = useState<"fake" | "codex" | null>(null);
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
  const [projectDeleteCandidate, setProjectDeleteCandidate] = useState<ProjectInfo | null>(null);
  const [projectDeleteError, setProjectDeleteError] = useState<string | null>(null);
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
  const { projects, selectedProjectId, selectedProject, repositories: projectRepositories,
    selectedRepository, workspaceDialogOpen, projectName, projectPath, projectLoading,
    projectFolderPicking, repositoryDialogOpen, repositoryName, repositoryPath, repositoryLoading,
    openWorkspaceDialog, closeWorkspaceDialog, changeProjectName: setProjectName,
    changeProjectPath: setProjectPath, chooseProjectFolder, createProject, refreshProjects,
    selectProject, openRepositoryDialog, closeRepositoryDialog,
    changeRepositoryName: setRepositoryName, changeRepositoryPath: setRepositoryPath,
    createRepository: createProjectRepository, deleteRepository: deleteProjectRepository,
    refreshRepositories: refreshProjectRepositories, selectRepository, removeProject } =
    useProjectCatalog({ onBusyChange: setBusy, notify: pushToast });
  const initializationEvidence = useInitializationEvidence({ projectId: selectedProjectId,
    notifyError: (message) => pushToast("error", message) });
  const { elementRef: terminalElement, size: terminalSize, fit: fitTerminal,
    focus: focusTerminal, reset: resetTerminal, write: writeTerminal } = usePtyTerminal({
      mode: runtimeMode, output, session, onError: setError,
      onResizeSession: (sessionId, size) => { void resizeSessionTo(sessionId, size); },
    });

  const canUseSession = session?.state === "running";
  const canUseAcpSession = acpSession?.state === "running";
  const codexReport = doctorReports.find((report) => report.adapter.id === "codex") ?? null;
  const canStartCodex = codexReport?.status === "installed";
  const selectedAcpCandidate = useMemo(
    () =>
      acpRegistryCandidates.find((candidate) => candidate.id === selectedAcpCandidateId) ?? null,
    [acpRegistryCandidates, selectedAcpCandidateId],
  );
  const projectInitialization = initializationEvidence.initialization;
  const projectInitializationFacts = initializationEvidence.facts;
  const projectInitializationMarkdownFindings = initializationEvidence.markdown;
  const projectInitializationGuardrails = initializationEvidence.guardrails;
  const projectInitializationSummary = initializationEvidence.summary;
  const projectInitializationKnowledgeUnits = initializationEvidence.units;
  const knowledgeUnitsLoading = initializationEvidence.unitsLoading;
  const knowledgeUnitsError = initializationEvidence.unitsError;
  const selectedSynthesisModelProfile = useMemo(
    () =>
      modelCatalog?.profiles.find((profile) => profile.id === synthesisModelProfileId) ?? null,
    [modelCatalog, synthesisModelProfileId],
  );
  const { dialogOpen: initializeDialogOpen, repositoryIds: initializeRepositoryIds,
    loading: initializeLoading, error: initializeError, detailsView: initializeDetailsView,
    interviewOpen: interviewDialogOpen, interviewError, scope: interviewScope,
    repositoryId: interviewRepositoryId, kind: interviewKind, pathPattern: interviewPathPattern,
    content: interviewContent, drafts: interviewDraftGuardrails,
    openDialog: openProjectInitializeDialog, closeDialog: closeProjectInitializeDialog,
    toggleRepository: toggleInitializeRepository, createInitialization: createProjectInitialization,
    collectFacts: collectProjectInitializationFacts, analyzeMarkdown: analyzeProjectInitializationMarkdown,
    openInterview: openInterviewDialog, closeInterview: closeInterviewDialog,
    addGuardrail: addInterviewGuardrail, removeGuardrail: removeInterviewGuardrail,
    saveGuardrails: saveProjectInitializationGuardrails,
    generateSummary: generateProjectInitializationSummary,
    approveSummary: approveProjectInitializationSummary, setDetailsView: setInitializeDetailsView,
    changeScope: setInterviewScope, changeRepositoryId: setInterviewRepositoryId,
    changeKind: setInterviewKind, changePathPattern: setInterviewPathPattern,
    changeContent: setInterviewContent } = useProjectInitializationWorkflow({
      project: selectedProject, repositories: projectRepositories,
      selectedRepositoryId: selectedRepository?.id ?? null, initialization: projectInitialization,
      guardrails: projectInitializationGuardrails, summary: projectInitializationSummary,
      modelProfile: selectedSynthesisModelProfile, evidence: initializationEvidence, notify: pushToast,
    });
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
  const selectedHistorySessionId = openedTranscriptSession?.id ?? transcriptSession?.id ?? null;
  const activeTask = transcriptSession ? tasksByTranscriptId[transcriptSession.id] ?? null : null;
  const selectedHistorySession = useMemo(
    () => transcriptSessions.find((session) => session.id === selectedHistorySessionId) ?? null,
    [selectedHistorySessionId, transcriptSessions],
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
    void refreshAgentDoctor();
    void refreshAcpRegistryCandidates();
    void refreshModelCatalog();
  }, []);

  useEffect(() => {
    void refreshTranscriptSessions(selectedProjectId);
    void refreshProjectTasks(selectedProjectId);
    void refreshKnowledgeItems(selectedProjectId);
  }, [selectedProjectId]);

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
      removeProject(projectId);
      initializationEvidence.removeProject(projectId);
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
      resetTerminal();
      focusTerminal();
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
      writeTerminal(chunk);
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

  async function resizeSessionTo(sessionId: string, size: TerminalSize) {
    const nextSession = await invoke<SessionInfo>("resize_session", {
      sessionId,
      cols: size.cols,
      rows: size.rows,
    });
    setActiveSession(nextSession);
  }

  function setActiveSession(nextSession: SessionInfo) {
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

        <WorkspaceContextSummary project={selectedProject} repository={selectedRepository} />

        <div className="mobile-sidebar-content" id="mobile-sidebar-navigation">
        <WorkspaceContextSelector
          project={selectedProject}
          repository={selectedRepository}
          onOpenRepository={openRepositoryDialog}
          onOpenWorkspace={openWorkspaceDialog}
        />

        <div className="sidebar-scroll">
          <AcpRegistryPanel busy={busy} candidates={acpRegistryCandidates} error={acpRegistryError}
            loading={acpRegistryLoading} selectedCandidateId={selectedAcpCandidateId}
            sessionLocked={canUseAcpSession} onRefresh={() => void refreshAcpRegistryCandidates()}
            onSelect={setSelectedAcpCandidateId} />

          <SessionHistoryPanel activeSessionTitle={transcriptSession?.title ?? null}
            error={transcriptError} filter={historyFilter} loading={transcriptLoading}
            renameTitle={historyRenameTitle} selectedSessionId={selectedHistorySessionId}
            sessions={transcriptSessions} onChangeFilter={setHistoryFilter}
            onChangeRenameTitle={setHistoryRenameTitle}
            onOpen={(session) => void openTranscriptSession(session)}
            onRefresh={() => void refreshTranscriptSessions()}
            onRename={() => void renameSelectedTranscriptSession()} />

          <KnowledgeCardsPanel attachedCount={attachedKnowledgeItems.length}
            attachedIds={attachedKnowledgeIds} error={knowledgeDialogOpen ? null : knowledgeError}
            items={knowledgeItems} loading={knowledgeLoading} onAdd={openKnowledgeDialog}
            onToggle={(item, attached) => void toggleKnowledgeAttachment(item, attached)} />

          <TerminalFallbackPanel error={doctorError} loading={doctorLoading} reports={doctorReports}
            runtimeMode={runtimeMode} sessionLocked={canUseSession}
            onRefresh={() => void refreshAgentDoctor()}
            onToggleMode={() => setRuntimeMode(runtimeMode === "pty" ? "acp" : "pty")} />
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

      <ProjectInitializationPanel factGroupsCount={projectInitializationFactGroups.length}
        factPreviews={projectInitializationFactPreviewGroups} facts={projectInitializationFacts}
        guardrails={projectInitializationGuardrails} initialization={projectInitialization}
        loading={initializeLoading} markdownFindings={projectInitializationMarkdownFindings}
        markdownPreviews={projectInitializationMarkdownPreview} project={selectedProject}
        repositoryCount={projectRepositories.length} onAnalyzeMarkdown={() => void analyzeProjectInitializationMarkdown()}
        onCollectFacts={() => void collectProjectInitializationFacts()} onInitialize={openProjectInitializeDialog}
        onOpenInterview={openInterviewDialog} onViewFacts={() => setInitializeDetailsView("facts")}
        onViewMarkdown={() => setInitializeDetailsView("markdown")} summaryProps={{
          catalog: modelCatalog, loading: initializeLoading, profileId: synthesisModelProfileId,
          selectedProfile: selectedSynthesisModelProfile, summary: projectInitializationSummary,
          tier: synthesisTier, onChangeProfile: setSynthesisModelProfileId,
          onChangeTier: selectSynthesisTier, onGenerate: () => void generateProjectInitializationSummary(),
          onView: () => setInitializeDetailsView("summary"),
        }} />

      <section className="runtime-lane" aria-label="Runtime lane">
        {runtimeMode === "pty" ? (
          <PtyRuntimePanel busy={busy} canStartCodex={canStartCodex} hasSession={!!session}
            sessionUsable={canUseSession} statusLabel={statusLabel} terminalSize={terminalSize}
            onDrain={() => void drainOutput()} onResize={resizeSession}
            onStartCodex={() => void startSession("codex")} onStartFake={() => void startSession("fake")}
            onStop={(force) => void stopSession(force)} onUseAcp={() => setRuntimeMode("acp")} />
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
          onFocusTerminal={focusTerminal}
          onShowLiveEvents={showLiveAcpEvents}
        />
      </section>


      {repositoryDialogOpen ? (
        <RepositoryDialog
          busy={busy}
          loading={repositoryLoading}
          name={repositoryName}
          path={repositoryPath}
          project={selectedProject}
          repositories={projectRepositories}
          selectedRepositoryId={selectedRepository?.id ?? null}
          sessionLocked={canUseSession || canUseAcpSession}
          onAdd={() => void createProjectRepository()}
          onChangeName={setRepositoryName}
          onChangePath={setRepositoryPath}
          onClose={closeRepositoryDialog}
          onDelete={(repositoryId) => void deleteProjectRepository(repositoryId)}
          onRefresh={() => void refreshProjectRepositories()}
          onSelect={selectRepository}
        />
      ) : null}

      {workspaceDialogOpen ? (
        <WorkspaceDialog
          busy={busy}
          folderPicking={projectFolderPicking}
          loading={projectLoading}
          name={projectName}
          path={projectPath}
          projects={projects}
          selectedProjectId={selectedProject?.id ?? null}
          sessionLocked={canUseSession || canUseAcpSession}
          onAdd={() => void createProject()}
          onChangeName={setProjectName}
          onChangePath={setProjectPath}
          onChooseFolder={() => void chooseProjectFolder()}
          onClose={closeWorkspaceDialog}
          onDelete={(project) => { closeWorkspaceDialog(); openProjectDeleteDialog(project); }}
          onRefresh={() => void refreshProjects()}
          onSelect={selectProject}
        />
      ) : null}

      {initializeDialogOpen ? (
        <ProjectInitializeDialog
          error={initializeError}
          loading={initializeLoading}
          repositories={projectRepositories}
          selectedRepositoryIds={initializeRepositoryIds}
          onClose={closeProjectInitializeDialog}
          onStart={() => void createProjectInitialization()}
          onToggleRepository={toggleInitializeRepository}
        />
      ) : null}

      {initializeDetailsView ? (
        <InitializationDetailsDialog
          factGroups={projectInitializationFactGroups}
          initializeLoading={initializeLoading}
          knowledgeUnits={projectInitializationKnowledgeUnits}
          knowledgeUnitsError={knowledgeUnitsError}
          knowledgeUnitsLoading={knowledgeUnitsLoading}
          markdownFindings={projectInitializationMarkdownFindings}
          summary={projectInitializationSummary}
          view={initializeDetailsView}
          onApproveSummary={() => void approveProjectInitializationSummary()}
          onClose={() => setInitializeDetailsView(null)}
        />
      ) : null}

      {interviewDialogOpen ? (
        <InterviewGuardrailsDialog
          content={interviewContent}
          drafts={interviewDraftGuardrails}
          error={interviewError}
          kind={interviewKind}
          loading={initializeLoading}
          pathPattern={interviewPathPattern}
          repositories={projectRepositories}
          repositoryId={interviewRepositoryId}
          scope={interviewScope}
          onAdd={addInterviewGuardrail}
          onChangeContent={setInterviewContent}
          onChangeKind={setInterviewKind}
          onChangePathPattern={setInterviewPathPattern}
          onChangeRepositoryId={setInterviewRepositoryId}
          onChangeScope={setInterviewScope}
          onClose={closeInterviewDialog}
          onRemove={removeInterviewGuardrail}
          onSave={() => void saveProjectInitializationGuardrails()}
        />
      ) : null}

      {projectDeleteCandidate ? (
        <ProjectDeleteDialog busy={busy} error={projectDeleteError} project={projectDeleteCandidate}
          onClose={closeProjectDeleteDialog} onConfirm={() => void confirmDeleteProject()} />
      ) : null}

      {taskContextPreviewOpen ? (
        <TaskContextPreviewDialog error={taskContextPreviewError} loading={taskContextPreviewLoading}
          preview={taskContextPreview} onClose={() => setTaskContextPreviewOpen(false)} />
      ) : null}

      {knowledgeDialogOpen ? (
        <KnowledgeCardDialog body={knowledgeBody} error={knowledgeError} kind={knowledgeKind}
          loading={knowledgeLoading} title={knowledgeTitle} onChangeBody={setKnowledgeBody}
          onChangeKind={setKnowledgeKind} onChangeTitle={setKnowledgeTitle}
          onClose={closeKnowledgeDialog} onCreate={() => void createKnowledgeItem()} />
      ) : null}

      <NotificationViewport />
    </main>
  );
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

export default App;
