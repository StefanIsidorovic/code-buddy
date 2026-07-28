import { useEffect, useState } from "react";
import type { GitWorkspaceVerificationInfo, TaskInfo, TaskPhaseArtifactInfo, TaskPhaseInfo,
  TranscriptEventInfo } from "../../types/domain";
import { buildTaskPhaseExecutionPrompt } from "./taskPhaseExecution";
import { taskPhaseReviewCriteria } from "./taskPhaseReview";
import { TaskPhaseGuide } from "./TaskPhaseGuide";

interface Props { task: TaskInfo; artifacts: TaskPhaseArtifactInfo[]; currentPhase: TaskPhaseInfo | null;
  sourceEvents: TranscriptEventInfo[]; selectedSourceIds: string[]; kind: string; content: string;
  error: string | null; loading: boolean; onChangeKind: (value: string) => void;
  canRunAgent: boolean; agentRunning: boolean; hasPhaseRun: boolean; evidenceReviewed: boolean;
  workspaceVerification: GitWorkspaceVerificationInfo | null;
  agentWorkspacePath: string | null; expectedWorkspacePath: string | null;
  onChangeContent: (value: string) => void; onToggleSource: (id: string, selected: boolean) => void;
  onToggleAllSources: (selected: boolean) => void;
  onCreateArtifact: () => void; onStart: () => void; onComplete: () => void;
  onRunAndPrepare: (instruction: string) => void; onPrepareCompletion: () => void;
  onAcknowledgeEvidenceReview: (reviewed: boolean) => void }

export function TaskPhasePanel({ task, artifacts, currentPhase, sourceEvents, selectedSourceIds,
  kind, content, error, loading, canRunAgent, agentRunning, hasPhaseRun, evidenceReviewed,
  workspaceVerification,
  agentWorkspacePath, expectedWorkspacePath,
  onChangeKind, onChangeContent, onToggleSource, onToggleAllSources,
  onCreateArtifact, onStart, onComplete, onRunAndPrepare, onPrepareCompletion,
  onAcknowledgeEvidenceReview }: Props) {
  const [viewedPhase, setViewedPhase] = useState<TaskPhaseInfo["phase"]>(task.currentPhase);
  useEffect(() => setViewedPhase(task.currentPhase), [task.id, task.currentPhase]);
  const phaseArtifacts = artifacts.filter(({ phase }) => phase === task.currentPhase);
  const viewedPhaseArtifacts = artifacts.filter(({ phase }) => phase === viewedPhase);
  const viewingCurrentPhase = viewedPhase === task.currentPhase;
  const inProgress = currentPhase?.status === "in_progress";
  const hasDraft = !!content.trim();
  const hasProvenance = selectedSourceIds.length > 0;
  const canSaveEvidence = hasDraft && hasProvenance;
  const currentExecutionVerification = task.currentPhase === "execution"
    && workspaceVerification?.taskId === task.id && workspaceVerification.phase === "execution"
    ? workspaceVerification : null;
  const executionAccepted = currentExecutionVerification?.status === "changed"
    || currentExecutionVerification?.status === "unchanged"
      && currentExecutionVerification.changedFiles.length > 0;
  const executionBlocked = !!currentExecutionVerification && !executionAccepted;
  const canRetryExecution = task.currentPhase === "execution"
    && !!currentExecutionVerification && !executionAccepted;
  const workspaceMismatch = !!agentWorkspacePath && !!expectedWorkspacePath
    && agentWorkspacePath !== expectedWorkspacePath;
  const agentInstruction = buildTaskPhaseExecutionPrompt(task);
  const nextPhase = task.phases.find(({ phaseIndex }) => phaseIndex === (currentPhase?.phaseIndex ?? -1) + 1)?.phase;
  return <section className="task-phase-panel" aria-labelledby="task-phase-title">
    <div className="doctor-heading"><div><h3 id="task-phase-title">Task phases</h3>
      <span>{task.status} · current: {task.currentPhase}</span></div></div>
    <ol className="task-phase-list">{task.phases.map((phase) => <li key={phase.id}
      data-current={phase.phase === task.currentPhase} data-viewed={phase.phase === viewedPhase}>
      {phase.status === "completed" || phase.phase === task.currentPhase
        ? <button type="button" aria-pressed={phase.phase === viewedPhase}
          onClick={() => setViewedPhase(phase.phase)}><strong>{phase.phase}</strong>
          <span>{phase.status}</span></button>
        : <><strong>{phase.phase}</strong><span>{phase.status}</span></>}
    </li>)}</ol>
    <details className="task-operating-model"><summary>How this Task works</summary>
      <ul>
        <li><strong>Agent</strong><span>Prompt controls and permission decisions live in Agent; output stays visible beside every view.</span></li>
        <li><strong>Task</strong><span>Use this view to save evidence, review it, and complete one phase at a time.</span></li>
        <li><strong>Create evidence</strong><span>Run the agent for this phase, or write evidence manually. Both paths remain editable before saving.</span></li>
        <li><strong>Activity</strong><span>Audit context sends, phase runs, interrupted receipts, and read-only advisor/reviewer reports.</span></li>
      </ul></details>
    {inProgress && viewingCurrentPhase ? <div className="task-phase-sticky" aria-label="Current phase guidance">
      <TaskPhaseGuide phase={task.currentPhase} hasEvidenceText={hasDraft}
        provenanceCount={selectedSourceIds.length} hasPhaseRun={hasPhaseRun}
        hasEvidence={phaseArtifacts.length > 0} reviewed={evidenceReviewed} />
    </div> : null}
    {error ? <p className="error-message" role="alert">{error}</p> : null}
    {workspaceMismatch ? <div className="task-workspace-mismatch" role="alert">
      <strong>ACP session is using a different repository</strong>
      <span>Selected repository: {expectedWorkspacePath}</span>
      <span>Active ACP workspace: {agentWorkspacePath}</span>
      <small>Stop the ACP session, select the repository, then start a new ACP session before
        running this phase.</small>
    </div> : null}
    {viewingCurrentPhase && currentPhase?.status === "pending" ? <button className="primary-action" type="button"
      disabled={loading} onClick={onStart}>Start {task.currentPhase}</button> : null}
    {inProgress && viewingCurrentPhase ? <div className="task-artifact-editor">
      <fieldset className="task-phase-run"><legend>Step 1 · Create phase evidence</legend>
        <strong>Agent-assisted path</strong>
        <p>Runs the coding agent for this {task.currentPhase} phase and copies its linked response
          into an editable draft. This does not save evidence or complete the phase.</p>
        <details><summary><span>Exact agent instruction</span>
        <small>Show the bounded prompt sent to the coding agent</small></summary>
        <pre>{agentInstruction}</pre></details>
        <button className="primary-action" type="button"
          disabled={!canRunAgent || workspaceMismatch || agentRunning || loading
            || hasPhaseRun && !canRetryExecution}
          onClick={() => onRunAndPrepare(agentInstruction)}>{agentRunning ? "Running phase…"
            : canRetryExecution ? "Rerun execution after fixing workspace"
              : hasPhaseRun ? `${task.currentPhase} agent run finished` : `Run agent for ${task.currentPhase}`}</button>
        {!canRunAgent ? <small className="task-helper-card">Start an ACP session to run this phase.</small> : null}
        {hasPhaseRun ? <small className="task-helper-card">The agent response is ready below for review and saving.</small> : null}
        <div className="task-manual-evidence-path task-helper-card"><strong>Manual path</strong>
          <span>Skip the agent and write evidence directly below, then choose its transcript provenance.</span></div>
      </fieldset>
      <fieldset className="task-phase-step"><legend>Step 2 · Save evidence</legend>
      <label>Evidence type<select value={kind} onChange={(event) => onChangeKind(event.target.value)}>
        <option value="summary">Summary</option><option value="finding">Finding</option>
        <option value="risk">Risk</option><option value="decision">Decision</option>
        <option value="implementation_note">Implementation note</option>
        <option value="test_result">Test result</option>
      </select><small className="task-helper-card">Classifies this saved phase result so later
        context can identify its purpose.</small></label>
      <label>Phase evidence<textarea rows={3} value={content} placeholder="Write the result worth carrying into the next phase…"
        onChange={(event) => onChangeContent(event.target.value)} />
        <small className="task-helper-card">The durable conclusion for this phase. You can edit
          the prepared agent response before saving.</small></label>
      {hasPhaseRun ? <><button type="button" onClick={onPrepareCompletion}
        disabled={loading || agentRunning}>Restore latest agent draft</button>
        <small className="task-helper-card">Reloads the latest linked agent response and its
          provenance into this editable draft.</small></> : null}
      <details key={hasPhaseRun || hasProvenance ? "provenance-open" : "provenance-closed"}
        className="task-provenance-picker" open={hasPhaseRun || hasProvenance ? true : undefined}>
        <summary><span>Transcript provenance</span>
        <small>{selectedSourceIds.length} selected · {sourceEvents.length} persisted event(s)</small></summary>
        {sourceEvents.length === 0 ? <p>No persisted transcript events yet.</p>
          : <><p>Choose the exact transcript events that support this evidence. They remain attached as its audit trail.</p>
            <label className="task-provenance-select-all"><input type="checkbox"
              checked={selectedSourceIds.length === sourceEvents.length}
              onChange={(event) => onToggleAllSources(event.target.checked)} />
              Select all persisted events</label>
            <div className="task-provenance-list">{sourceEvents.map((event) => <label key={event.id}>
            <input type="checkbox" checked={selectedSourceIds.includes(event.id)}
              onChange={(change) => onToggleSource(event.id, change.target.checked)} />
            <span className="task-provenance-meta">#{event.sequence + 1} · {event.kind.split("_").join(" ")}</span>
            <span className="task-provenance-content">{event.content}</span></label>)}</div></>}
      </details>
      <button type="button" onClick={onCreateArtifact} disabled={loading || !kind.trim()
        || !canSaveEvidence}>Save phase evidence</button>
      {!canSaveEvidence ? <small className="task-helper-card" role="note">To enable Save phase
        evidence, add evidence text and select at least one supporting transcript event.</small> : null}
      <small className="task-helper-card">Saves this text as an immutable Task artifact linked to
        the selected transcript events. It does not complete the phase.</small>
      </fieldset>
      <fieldset className="task-phase-step task-phase-review"><legend>Step 3 · Review evidence</legend>
      {phaseArtifacts.length > 0 ? <>
        <ul>{taskPhaseReviewCriteria[task.currentPhase].map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
        <label><input type="checkbox" checked={evidenceReviewed}
          onChange={(event) => onAcknowledgeEvidenceReview(event.target.checked)} />
          I reviewed the persisted evidence against these criteria.</label></>
        : <small className="task-helper-card">Save phase evidence before reviewing it against
          the phase criteria.</small>}
      </fieldset>
      <fieldset className="task-phase-step"><legend>Step 4 · Complete phase</legend>
      {task.currentPhase === "execution" && hasPhaseRun ? <div className="task-execution-verification"
        data-status={currentExecutionVerification?.status ?? "missing"} role="status">
        <strong>{currentExecutionVerification?.status === "changed"
          ? "Repository changes verified"
          : currentExecutionVerification?.status === "unchanged"
            && currentExecutionVerification.changedFiles.length > 0
            ? "Existing repository changes verified"
          : currentExecutionVerification?.status === "unchanged"
            ? "No repository changes found"
            : "Repository verification unavailable"}</strong>
        {currentExecutionVerification ? <><span>Workspace: {currentExecutionVerification.workspacePath}</span>
          {currentExecutionVerification.changedFiles.length > 0
            ? <ul>{currentExecutionVerification.changedFiles.map((file) =>
              <li key={`${file.status}:${file.path}`}><code>{file.status}</code> {file.path}</li>)}</ul> : null}
          {currentExecutionVerification.error ? <small>{currentExecutionVerification.error}</small> : null}</>
          : <span>This run has no repository-derived verification result.</span>}
      </div> : null}
      <button className="primary-action" type="button" onClick={onComplete}
        disabled={loading || phaseArtifacts.length === 0 || !evidenceReviewed || executionBlocked}>{nextPhase
          ? `Complete ${task.currentPhase} & show ${nextPhase}` : `Complete ${task.currentPhase} & finish task`}</button>
      <small className="task-helper-card">Completes only the current phase. The next phase is
        revealed but never started automatically.</small>
      {executionBlocked ? <small className="task-helper-card">Execution cannot be completed from
        this local run until AIadne verifies a repository change. Fix the workspace/Git problem,
        make the approved change, then rerun execution.</small> : null}
      </fieldset>
    </div> : null}
    <div className="task-artifact-list" aria-label={viewingCurrentPhase
      ? "Current phase artifacts" : `${viewedPhase} phase history`}>
      <strong>{viewingCurrentPhase ? "Current phase artifacts" : `${viewedPhase} phase evidence`}</strong>
      {!viewingCurrentPhase ? <p className="task-helper-card">Read-only completed phase.
        Its saved evidence and provenance remain immutable.</p> : null}
      {viewedPhaseArtifacts.length === 0 ? <p>No artifacts yet.</p> : <ul>{viewedPhaseArtifacts.map((artifact) =>
        <li key={artifact.id}><span>{artifact.kind}</span><p>{artifact.content}</p>
          <small>{artifact.sourceTranscriptEventIds.length} source event(s)</small></li>)}</ul>}</div>
  </section>;
}
