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
import { AcpWorkspaceViews } from "./features/runtime/AcpWorkspaceViews";
import { WorkspaceNavigation } from "./features/runtime/WorkspaceNavigation";
import { useWorkspaceNavigation } from "./features/runtime/useWorkspaceNavigation";
import { PtyRuntimePanel } from "./features/runtime/PtyRuntimePanel";
import { SessionOutputPanel } from "./features/runtime/SessionOutputPanel";
import { usePtyRuntime } from "./features/runtime/usePtyRuntime";
import { useAcpRuntime } from "./features/runtime/useAcpRuntime";
import {
  WorkspaceContextFooterActions,
  WorkspaceContextSummary,
} from "./features/workspace/WorkspaceContextSelector";
import { RepositoryDialog } from "./features/workspace/RepositoryDialog";
import { WorkspaceDialog } from "./features/workspace/WorkspaceDialog";
import { ProjectDeleteDialog } from "./features/workspace/ProjectDeleteDialog";
import { useProjectCatalog } from "./features/workspace/useProjectCatalog";
import { useProjectDeletion } from "./features/workspace/useProjectDeletion";
import { TaskContextPreviewDialog } from "./features/knowledge/TaskContextPreviewDialog";
import { KnowledgeCardDialog } from "./features/knowledge/KnowledgeCardDialog";
import { KnowledgeCardsPanel } from "./features/knowledge/KnowledgeCardsPanel";
import { useKnowledgeWorkspace } from "./features/knowledge/useKnowledgeWorkspace";
import { DeliveryReadinessPanel } from "./features/delivery/DeliveryReadinessPanel";
import { useDeliveryReadiness } from "./features/delivery/useDeliveryReadiness";
import { SessionHistoryPanel } from "./features/transcripts/SessionHistoryPanel";
import { useTranscriptWorkspace } from "./features/transcripts/useTranscriptWorkspace";
import { TaskPhasePanel } from "./features/tasks/TaskPhasePanel";
import { TaskPhaseRunHistoryPanel } from "./features/tasks/TaskPhaseRunHistoryPanel";
import { useTaskPhaseWorkflow } from "./features/tasks/useTaskPhaseWorkflow";
import { useTaskPhaseRunHistory } from "./features/tasks/useTaskPhaseRunHistory";
import { executionVerificationForTask } from "./features/tasks/taskPhaseExecution";
import { TaskDispatchHistoryPanel } from "./features/tasks/TaskDispatchHistoryPanel";
import { TaskRecoveryNotice } from "./features/tasks/TaskRecoveryNotice";
import { TaskAgentReportsPanel } from "./features/tasks/TaskAgentReportsPanel";
import { useTaskAgentReports } from "./features/tasks/useTaskAgentReports";
import { useTaskDispatchHistory } from "./features/tasks/useTaskDispatchHistory";
import { AcpRegistryPanel } from "./features/agents/AcpRegistryPanel";
import { TerminalFallbackPanel } from "./features/agents/TerminalFallbackPanel";
import { useAgentEnvironment } from "./features/agents/useAgentEnvironment";
import {
  boundToastMessages,
  useNotificationStore,
} from "./features/notifications/notificationStore";
import {
  coalesceAcpEvents,
  coalesceTranscriptEvents,
  errorText,
} from "./lib/presentation";
import type {
  ProjectInitializationFactInfo,
  RuntimeMode,
} from "./types/domain";
import "./App.css";

export { StateNotice, boundToastMessages };

function App() {
  const acpEventsList = useRef<HTMLUListElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acpPrompt, setAcpPrompt] = useState("Hello from AIadne");
  const [busy, setBusy] = useState(false);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("acp");
  const pushToast = useNotificationStore((state) => state.push);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [initializationExpanded, setInitializationExpanded] = useState(false);
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
  const { session: transcriptSession, sessions: transcriptSessions,
    openedSession: openedTranscriptSession, openedEvents: openedTranscriptEvents,
    liveEvents: liveTranscriptEvents,
    error: transcriptError, loading: transcriptLoading, filter: historyFilter,
    renameTitle: historyRenameTitle, selectedId: selectedHistorySessionId, activeTask,
    refresh: refreshTranscriptSessions, createAcp: createAcpTranscriptSession,
    openSaved: openTranscriptSession, activateSaved: activateSavedTranscript,
    renameSelected: renameSelectedTranscriptSession,
    showLive: showLiveAcpEvents, record: recordTranscriptEvents,
    changeFilter: setHistoryFilter, changeRenameTitle: setHistoryRenameTitle,
    getActiveSessionId, getTask: getTranscriptTask, upsertTask: upsertTranscriptTask } =
    useTranscriptWorkspace({ projectId: selectedProjectId, onShowAcp: () => setRuntimeMode("acp") });
  const { doctorReports, doctorError, doctorLoading, canStartCodex,
    catalog: modelCatalog, tier: synthesisTier, profileId: synthesisModelProfileId,
    selectedProfile: selectedSynthesisModelProfile, refreshDoctor: refreshAgentDoctor,
    changeTier: selectSynthesisTier, changeProfile: setSynthesisModelProfileId } =
    useAgentEnvironment({ summary: initializationEvidence.summary,
      notifyError: (message) => pushToast("error", message) });
  const { session, output, usable: canUseSession, statusLabel,
    terminalElement, terminalSize, focusTerminal, start: startSession,
    resize: resizeSession, stop: stopSession, drain: drainOutput } = usePtyRuntime({
      mode: runtimeMode, cwd: selectedRepository?.path ?? selectedProject?.path,
      canStartCodex, runAction, reportError: setError,
    });
  const projectInitialization = initializationEvidence.initialization;
  const projectInitializationFacts = initializationEvidence.facts;
  const projectInitializationMarkdownFindings = initializationEvidence.markdown;
  const projectInitializationGuardrails = initializationEvidence.guardrails;
  const projectInitializationSummary = initializationEvidence.summary;
  const projectInitializationKnowledgeUnits = initializationEvidence.units;
  const knowledgeUnitsLoading = initializationEvidence.unitsLoading;
  const knowledgeUnitsError = initializationEvidence.unitsError;
  const { dialogOpen: initializeDialogOpen, repositoryIds: initializeRepositoryIds,
    loading: initializeLoading, summaryGenerating,
    summarySectionGenerating: initializeSummarySectionGenerating,
    error: initializeError, detailsView: initializeDetailsView,
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
    approveSummary: approveProjectInitializationSummary,
    reviewSummaryClaim: reviewProjectInitializationSummaryClaim,
    prepareSummaryAutopilot: prepareProjectInitializationSummaryAutopilot,
    regenerateSummarySection: regenerateProjectInitializationSummarySection,
    setDetailsView: setInitializeDetailsView,
    changeScope: setInterviewScope, changeRepositoryId: setInterviewRepositoryId,
    changeKind: setInterviewKind, changePathPattern: setInterviewPathPattern,
    changeContent: setInterviewContent } = useProjectInitializationWorkflow({
      project: selectedProject, repositories: projectRepositories,
      selectedRepositoryId: selectedRepository?.id ?? null, initialization: projectInitialization,
      guardrails: projectInitializationGuardrails, summary: projectInitializationSummary,
      modelProfile: selectedSynthesisModelProfile, evidence: initializationEvidence, notify: pushToast,
    });
  const { items: knowledgeItems, attachedIds: attachedKnowledgeIds,
    attachedItems: attachedKnowledgeItems, title: knowledgeTitle, body: knowledgeBody,
    kind: knowledgeKind, error: knowledgeError, loading: knowledgeLoading,
    dialogOpen: knowledgeDialogOpen, preview: taskContextPreview,
    previewOpen: taskContextPreviewOpen, previewLoading: taskContextPreviewLoading,
    previewError: taskContextPreviewError,
    create: createKnowledgeItem, toggle: toggleKnowledgeAttachment,
    attachSelected: attachSelectedKnowledgeToTranscript, previewContext: previewTaskContext,
    openDialog: openKnowledgeDialog, closeDialog: closeKnowledgeDialog,
    changeTitle: setKnowledgeTitle, changeBody: setKnowledgeBody, changeKind: setKnowledgeKind,
    closePreview: closeTaskContextPreview } = useKnowledgeWorkspace({
      projectId: selectedProjectId,
      activeTranscriptId: openedTranscriptSession?.id ?? transcriptSession?.id ?? null,
      initialization: projectInitialization, summary: projectInitializationSummary,
      prompt: acpPrompt, repositoryId: selectedRepository?.id ?? null, taskId: activeTask?.id ?? null,
    });
  const { candidates: acpRegistryCandidates, registryError: acpRegistryError,
    registryLoading: acpRegistryLoading, selectedCandidateId: selectedAcpCandidateId,
    session: acpSession, events: acpEvents, promptResult: acpPromptResult,
    workspaceVerification: acpWorkspaceVerification,
    promptBusy: acpPromptBusy, expanded: acpControlsExpanded, usable: canUseAcpSession,
    canStartSelected: canStartSelectedAcpCandidate, statusLabel: acpStatusLabel,
    permissions: acpPermissions, resumeError: acpResumeError, respondPermission: respondAcpPermission,
    refreshRegistry: refreshAcpRegistryCandidates, startSelected: startSelectedAcpSession,
    resumeTranscript: resumeAcpTranscript, resumingSessionId: resumingAcpTranscriptId,
    changeModel: changeAcpCodingModel, sendPrompt: sendAcpPrompt, sendPhasePrompt: sendAcpPhasePrompt,
    drain: drainAcpEvents,
    stop: stopAcpSession, stopAllForDelete: stopRunningAcpSessionsForProjectDelete,
    selectCandidate: setSelectedAcpCandidateId, changePrompt: setAcpPromptFromRuntime,
    toggleExpanded: toggleAcpControlsExpanded } = useAcpRuntime({
      projectId: selectedProjectId, cwd: selectedRepository?.path ?? selectedProject?.path,
      prompt: acpPrompt, onPromptChange: setAcpPrompt, attachedKnowledge: attachedKnowledgeItems,
      transcript: { createAcp: createAcpTranscriptSession, activateSaved: activateSavedTranscript,
        attachKnowledge: attachSelectedKnowledgeToTranscript,
        showLive: showLiveAcpEvents, getActiveId: getActiveSessionId, getTask: getTranscriptTask,
        upsertTask: upsertTranscriptTask, record: recordTranscriptEvents },
      runAction, reportError: setError,
    });
  const { candidate: projectDeleteCandidate, error: projectDeleteError,
    open: openProjectDeleteDialog, close: closeProjectDeleteDialog,
    confirm: confirmDeleteProject } = useProjectDeletion({
      busy, onBusyChange: setBusy, stopAcpSessions: stopRunningAcpSessionsForProjectDelete,
      removeFromCatalog: removeProject, removeEvidence: initializationEvidence.removeProject,
      notifySuccess: (message) => pushToast("success", message),
    });
  const taskDispatch = useTaskDispatchHistory(activeTask);
  const taskPhaseRuns = useTaskPhaseRunHistory(activeTask);
  const deliveryReadiness = useDeliveryReadiness(selectedRepository?.path ?? null);
  const taskAgentReports = useTaskAgentReports(activeTask, {
    candidateId: selectedAcpCandidateId,
    cwd: selectedRepository?.path ?? selectedProject?.path,
  });
  const taskPhase = useTaskPhaseWorkflow({ task: activeTask, sourceEvents: liveTranscriptEvents,
    upsertTask: upsertTranscriptTask, runAgent: sendAcpPhasePrompt,
    onRunSettled: taskPhaseRuns.refresh });
  const hasCurrentPhaseRun = taskPhase.hasCompletedRun || !!activeTask &&
    taskPhaseRuns.receipts.some((receipt) =>
      receipt.phase === activeTask.currentPhase && receipt.status === "sent");
  const executionVerification = activeTask
    ? executionVerificationForTask(activeTask, taskPhaseRuns.receipts, acpWorkspaceVerification)
    : null;
  const workspaceNavigation = useWorkspaceNavigation();
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
  const displayAcpEvents = useMemo(
    () =>
      openedTranscriptSession
        ? coalesceTranscriptEvents(openedTranscriptEvents)
        : coalesceAcpEvents(acpEvents),
    [acpEvents, openedTranscriptEvents, openedTranscriptSession],
  );
  const showAcpWaiting = acpPromptBusy && !openedTranscriptSession;
  const resumeDisabledReason = busy
    ? "Finish the current action before resuming a saved ACP session."
    : canUseAcpSession ? "Stop the running ACP session before resuming saved history." : null;
  useEffect(() => {
    if (runtimeMode !== "acp" || displayAcpEvents.length === 0) {
      return;
    }

    acpEventsList.current?.scrollTo?.({
      top: acpEventsList.current.scrollHeight,
    });
  }, [displayAcpEvents, runtimeMode]);

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

  return (
    <main className="app-shell" data-initialization-expanded={initializationExpanded}
      aria-label="AIadne agent workspace">
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
        <div className="sidebar-scroll">
          <WorkspaceNavigation activeView={workspaceNavigation.activeView}
            currentPhase={activeTask?.currentPhase ?? null}
            initializationStatus={projectInitialization?.status ?? null}
            pendingPermissionCount={acpPermissions.length}
            onChangeView={(view) => {
              setRuntimeMode("acp"); workspaceNavigation.changeView(view); setMobileNavigationOpen(false);
            }} />

          <AcpRegistryPanel busy={busy} candidates={acpRegistryCandidates} error={acpRegistryError}
            loading={acpRegistryLoading} selectedCandidateId={selectedAcpCandidateId}
            sessionLocked={canUseAcpSession} onRefresh={() => void refreshAcpRegistryCandidates()}
            onSelect={setSelectedAcpCandidateId} />

          <SessionHistoryPanel activeSessionTitle={transcriptSession?.title ?? null}
            error={transcriptError} filter={historyFilter} loading={transcriptLoading}
            renameTitle={historyRenameTitle} resumeDisabled={busy || canUseAcpSession}
            resumeDisabledReason={resumeDisabledReason} resumeError={acpResumeError}
            resumingSessionId={resumingAcpTranscriptId} selectedSessionId={selectedHistorySessionId}
            sessions={transcriptSessions} onChangeFilter={setHistoryFilter}
            onChangeRenameTitle={setHistoryRenameTitle}
            onOpen={(session) => void openTranscriptSession(session)}
            onRefresh={() => void refreshTranscriptSessions()}
            onRename={() => void renameSelectedTranscriptSession()}
            onResume={(session) => void resumeAcpTranscript(session)} />

          <KnowledgeCardsPanel attachedCount={attachedKnowledgeItems.length}
            attachedIds={attachedKnowledgeIds} error={knowledgeDialogOpen ? null : knowledgeError}
            items={knowledgeItems} loading={knowledgeLoading} onAdd={openKnowledgeDialog}
            onToggle={(item, attached) => void toggleKnowledgeAttachment(item, attached)} />

          <TerminalFallbackPanel error={doctorError} loading={doctorLoading} reports={doctorReports}
            runtimeMode={runtimeMode} sessionLocked={canUseSession}
            onRefresh={() => void refreshAgentDoctor()}
            onToggleMode={() => setRuntimeMode(runtimeMode === "pty" ? "acp" : "pty")} />
        </div>

        <footer className="sidebar-footer">
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
          <WorkspaceContextFooterActions project={selectedProject} repository={selectedRepository}
            onOpenRepository={openRepositoryDialog} onOpenWorkspace={openWorkspaceDialog} />
        </dl>
        </footer>
        </div>
      </section>

      <section className="runtime-lane" aria-label="Runtime lane">
        {runtimeMode === "pty" ? (
          <PtyRuntimePanel busy={busy} canStartCodex={canStartCodex} hasSession={!!session}
            sessionUsable={canUseSession} statusLabel={statusLabel} terminalSize={terminalSize}
            onDrain={() => void drainOutput()} onResize={resizeSession}
            onStartCodex={() => void startSession("codex")} onStartFake={() => void startSession("fake")}
            onStop={(force) => void stopSession(force)} onUseAcp={() => setRuntimeMode("acp")} />
        ) : null}
        {runtimeMode === "acp" ? (
          <AcpWorkspaceViews key={acpSession?.id ?? "no-acp-session"}
            activeView={workspaceNavigation.activeView}
            agent={<AcpRuntimePanel
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
            permissions={acpPermissions}
            session={acpSession}
            showWaiting={showAcpWaiting}
            statusLabel={acpStatusLabel}
            onChangeModel={(modelId) => void changeAcpCodingModel(modelId)}
            onChangePrompt={setAcpPromptFromRuntime}
            onDrain={() => void drainAcpEvents()}
            onPreviewContext={() => void previewTaskContext()}
            onSendPrompt={() => void sendAcpPrompt()}
            onStartSelected={() => void startSelectedAcpSession()}
            onStop={() => void stopAcpSession(false)}
            onRespondPermission={(permissionId, optionId) => void respondAcpPermission(permissionId, optionId)}
            onToggleExpanded={toggleAcpControlsExpanded}
          />}
            knowledge={<ProjectInitializationPanel expanded={initializationExpanded}
            factGroupsCount={projectInitializationFactGroups.length}
            factPreviews={projectInitializationFactPreviewGroups} facts={projectInitializationFacts}
            guardrails={projectInitializationGuardrails} initialization={projectInitialization}
            loading={initializeLoading} markdownFindings={projectInitializationMarkdownFindings}
            markdownPreviews={projectInitializationMarkdownPreview} onExpandedChange={setInitializationExpanded}
            project={selectedProject} repositoryCount={projectRepositories.length}
            onAnalyzeMarkdown={() => void analyzeProjectInitializationMarkdown()}
            onCollectFacts={() => void collectProjectInitializationFacts()}
            onInitialize={openProjectInitializeDialog} onOpenInterview={openInterviewDialog}
            onViewFacts={() => setInitializeDetailsView("facts")}
            onViewMarkdown={() => setInitializeDetailsView("markdown")} summaryProps={{
              catalog: modelCatalog, loading: summaryGenerating, profileId: synthesisModelProfileId,
              selectedProfile: selectedSynthesisModelProfile, summary: projectInitializationSummary,
              tier: synthesisTier, onChangeProfile: setSynthesisModelProfileId,
              onChangeTier: selectSynthesisTier,
              onGenerate: () => void generateProjectInitializationSummary(),
              onView: () => setInitializeDetailsView("summary"),
            }} />}
            output={<SessionOutputPanel events={displayAcpEvents} eventsListRef={acpEventsList} output={output}
              openedTranscript={openedTranscriptSession} runtimeMode={runtimeMode} showWaiting={showAcpWaiting}
              terminalElementRef={terminalElement} onFocusTerminal={focusTerminal} onShowLiveEvents={showLiveAcpEvents} />}
            task={activeTask ? <TaskPhasePanel task={activeTask} artifacts={taskPhase.artifacts}
            currentPhase={taskPhase.currentPhase} sourceEvents={taskPhase.sourceEvents} kind={taskPhase.kind}
            selectedSourceIds={taskPhase.sourceIds} content={taskPhase.content}
            error={taskPhase.error} loading={taskPhase.loading || taskPhaseRuns.loading}
            canRunAgent={canUseAcpSession}
            agentRunning={acpPromptBusy}
            hasPhaseRun={hasCurrentPhaseRun}
            workspaceVerification={executionVerification}
            agentWorkspacePath={acpSession?.cwd ?? null}
            expectedWorkspacePath={selectedRepository?.path ?? selectedProject?.path ?? null}
            evidenceReviewed={taskPhase.evidenceReviewed} onChangeKind={taskPhase.changeKind}
            onChangeContent={taskPhase.changeContent} onToggleSource={taskPhase.toggleSource}
            onToggleAllSources={taskPhase.toggleAllSources}
            onPrepareCompletion={() => void taskPhase.prepareCompletion()}
            onAcknowledgeEvidenceReview={taskPhase.acknowledgeEvidenceReview}
            onCreateArtifact={() => void taskPhase.createArtifact()}
            onStart={() => void taskPhase.start()} onComplete={() => void taskPhase.complete()}
            onRunAndPrepare={(instruction) => void taskPhase.runAndPrepare(instruction)} /> : null}
            activity={activeTask ? (({ showAgent }) => <><TaskRecoveryNotice phaseReceipts={taskPhaseRuns.receipts}
            contextReceipts={taskDispatch.receipts} currentAcpSessionId={canUseAcpSession ? acpSession?.id ?? null : null}
            onReviewPhase={taskPhaseRuns.openResolution} onReviewContext={taskDispatch.openResolution} />
            <DeliveryReadinessPanel repositoryPath={selectedRepository?.path ?? null}
            readiness={deliveryReadiness.readiness} loading={deliveryReadiness.loading}
            provenanceHistory={deliveryReadiness.provenanceHistory}
            error={deliveryReadiness.error} onRefresh={() => void deliveryReadiness.refresh()} />
            <TaskAgentReportsPanel reports={taskAgentReports.reports} loading={taskAgentReports.loading}
            runningRole={taskAgentReports.runningRole} error={taskAgentReports.error}
            runDisabledReason={taskAgentReports.runDisabledReason}
            onDraftFollowUp={(draft) => { setAcpPromptFromRuntime(draft); showAgent(); }}
            onRun={(role) => void taskAgentReports.run(role)}
            onRefresh={() => void taskAgentReports.refresh()} />
            <TaskPhaseRunHistoryPanel receipts={taskPhaseRuns.receipts}
            loading={taskPhaseRuns.loading} error={taskPhaseRuns.error} resolutionReceiptId={taskPhaseRuns.resolutionReceiptId}
            resolutionReason={taskPhaseRuns.resolutionReason} onRefresh={() => void taskPhaseRuns.refresh()}
            onOpenResolution={taskPhaseRuns.openResolution} onChangeResolutionReason={taskPhaseRuns.changeResolutionReason}
            onCancelResolution={taskPhaseRuns.cancelResolution} onResolve={() => void taskPhaseRuns.resolve()} />
            <TaskDispatchHistoryPanel receipts={taskDispatch.receipts} loading={taskDispatch.loading}
            error={taskDispatch.error} resolutionReceiptId={taskDispatch.resolutionReceiptId}
            resolutionReason={taskDispatch.resolutionReason}
            onRefresh={() => void taskDispatch.refresh()} onOpenResolution={taskDispatch.openResolution}
            onChangeResolutionReason={taskDispatch.changeResolutionReason}
            onCancelResolution={taskDispatch.cancelResolution}
            onResolve={() => void taskDispatch.resolve()} /></>) : null}
            currentPhase={activeTask?.currentPhase ?? null}
            phaseRunCount={taskPhaseRuns.receipts.length}
            contextDispatchCount={taskDispatch.receipts.length}
            reportCount={taskAgentReports.reports.length}
            pendingPermissionCount={acpPermissions.length}
            onChangeView={workspaceNavigation.changeView} />
        ) : null}
        {error ? (
          <p className="error-message" role="alert">
            {error}
          </p>
        ) : null}

        {runtimeMode === "pty" ? <SessionOutputPanel
          events={displayAcpEvents}
          eventsListRef={acpEventsList}
          openedTranscript={openedTranscriptSession}
          output={output}
          runtimeMode={runtimeMode}
          showWaiting={showAcpWaiting}
          terminalElementRef={terminalElement}
          onFocusTerminal={focusTerminal}
          onShowLiveEvents={showLiveAcpEvents}
        /> : null}
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
          regeneratingSection={initializeSummarySectionGenerating}
          view={initializeDetailsView}
          onApproveSummary={() => void approveProjectInitializationSummary()}
          onReviewSummaryClaim={(claimId, status, content, reason) =>
            void reviewProjectInitializationSummaryClaim(claimId, status, content, reason)}
          onPrepareSummaryAutopilot={() => void prepareProjectInitializationSummaryAutopilot()}
          onRegenerateSummarySection={(section) =>
            void regenerateProjectInitializationSummarySection(section)}
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
          sending={acpPromptBusy} canSend={canUseAcpSession} preview={taskContextPreview}
          onClose={closeTaskContextPreview} onSend={() => { void (async () => {
            if (taskContextPreview && await sendAcpPrompt(taskContextPreview)) {
              closeTaskContextPreview(); await taskDispatch.refresh();
            }
          })(); }} />
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
