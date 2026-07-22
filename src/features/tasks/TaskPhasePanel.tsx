import type { TaskInfo, TaskPhaseArtifactInfo, TaskPhaseInfo, TranscriptEventInfo } from "../../types/domain";
import { buildTaskPhaseExecutionPrompt } from "./taskPhaseExecution";
import { taskPhaseReviewCriteria } from "./taskPhaseReview";
import { TaskPhaseGuide } from "./TaskPhaseGuide";

interface Props { task: TaskInfo; artifacts: TaskPhaseArtifactInfo[]; currentPhase: TaskPhaseInfo | null;
  sourceEvents: TranscriptEventInfo[]; selectedSourceIds: string[]; kind: string; content: string;
  error: string | null; loading: boolean; onChangeKind: (value: string) => void;
  canRunAgent: boolean; agentRunning: boolean; evidenceReviewed: boolean;
  onChangeContent: (value: string) => void; onToggleSource: (id: string, selected: boolean) => void;
  onCreateArtifact: () => void; onStart: () => void; onComplete: () => void;
  onRunAndPrepare: (instruction: string) => void; onPrepareCompletion: () => void;
  onAcknowledgeEvidenceReview: (reviewed: boolean) => void }

export function TaskPhasePanel({ task, artifacts, currentPhase, sourceEvents, selectedSourceIds,
  kind, content, error, loading, canRunAgent, agentRunning, evidenceReviewed, onChangeKind, onChangeContent,
  onToggleSource, onCreateArtifact, onStart, onComplete, onRunAndPrepare, onPrepareCompletion,
  onAcknowledgeEvidenceReview }: Props) {
  const phaseArtifacts = artifacts.filter(({ phase }) => phase === task.currentPhase);
  const inProgress = currentPhase?.status === "in_progress";
  const agentInstruction = buildTaskPhaseExecutionPrompt(task);
  const nextPhase = task.phases.find(({ phaseIndex }) => phaseIndex === (currentPhase?.phaseIndex ?? -1) + 1)?.phase;
  return <section className="task-phase-panel" aria-labelledby="task-phase-title">
    <div className="doctor-heading"><div><h3 id="task-phase-title">Task phases</h3>
      <span>{task.status} · current: {task.currentPhase}</span></div></div>
    <ol className="task-phase-list">{task.phases.map((phase) => <li key={phase.id}
      data-current={phase.phase === task.currentPhase}><strong>{phase.phase}</strong><span>{phase.status}</span></li>)}</ol>
    <details className="task-operating-model"><summary>How this Task works</summary>
      <ul>
        <li><strong>Agent</strong><span>Chat and live output happen in the Agent view.</span></li>
        <li><strong>Task</strong><span>Use this view to save evidence, review it, and complete one phase at a time.</span></li>
        <li><strong>Run &amp; prepare</strong><span>Optional helper: it drafts evidence, but never saves or completes the phase.</span></li>
        <li><strong>Activity</strong><span>Audit context sends, phase runs, interrupted receipts, and read-only advisor/reviewer reports.</span></li>
      </ul></details>
    {inProgress ? <TaskPhaseGuide hasDraft={!!content.trim() && selectedSourceIds.length > 0}
      hasEvidence={phaseArtifacts.length > 0} reviewed={evidenceReviewed} /> : null}
    {error ? <p className="error-message" role="alert">{error}</p> : null}
    {currentPhase?.status === "pending" ? <button className="primary-action" type="button"
      disabled={loading} onClick={onStart}>Start {task.currentPhase}</button> : null}
    {inProgress ? <div className="task-artifact-editor">
      <div className="task-phase-run"><details><summary>Exact agent instruction</summary>
        <pre>{agentInstruction}</pre></details>
        <button className="primary-action" type="button" disabled={!canRunAgent || agentRunning || loading}
          onClick={() => onRunAndPrepare(agentInstruction)}>{agentRunning ? "Running phase…"
            : `Run & prepare ${task.currentPhase}`}</button>
        {!canRunAgent ? <small>Start an ACP session to run this phase.</small> : null}
        <small>This runs one prompt and prepares an editable linked draft. Saving evidence and completion remain manual.</small></div>
      <label>Artifact kind<input value={kind} onChange={(event) => onChangeKind(event.target.value)} /></label>
      <label>Phase evidence<textarea rows={3} value={content}
        onChange={(event) => onChangeContent(event.target.value)} /></label>
      <button type="button" onClick={onPrepareCompletion} disabled={loading}>Prepare completion</button>
      <small>This prepares an editable draft from the latest linked phase run. It does not save evidence or complete the phase.</small>
      <details className="task-provenance-picker"><summary><span>Transcript provenance</span>
        <small>{selectedSourceIds.length} selected · {sourceEvents.length} persisted event(s)</small></summary>
        {sourceEvents.length === 0 ? <p>No persisted transcript events yet.</p>
          : <div className="task-provenance-list">{sourceEvents.map((event) => <label key={event.id}>
            <input type="checkbox" checked={selectedSourceIds.includes(event.id)}
              onChange={(change) => onToggleSource(event.id, change.target.checked)} />
            <span className="task-provenance-meta">#{event.sequence + 1} · {event.kind.split("_").join(" ")}</span>
            <span className="task-provenance-content">{event.content}</span></label>)}</div>}
      </details>
      <button type="button" onClick={onCreateArtifact} disabled={loading || !kind.trim()
        || !content.trim() || selectedSourceIds.length === 0}>Add evidence</button>
      {phaseArtifacts.length > 0 ? <fieldset className="task-phase-review"><legend>Review checkpoint</legend>
        <ul>{taskPhaseReviewCriteria[task.currentPhase].map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
        <label><input type="checkbox" checked={evidenceReviewed}
          onChange={(event) => onAcknowledgeEvidenceReview(event.target.checked)} />
          I reviewed the persisted evidence against these criteria.</label></fieldset> : null}
      <button className="primary-action" type="button" onClick={onComplete}
        disabled={loading || phaseArtifacts.length === 0 || !evidenceReviewed}>{nextPhase
          ? `Complete ${task.currentPhase} & show ${nextPhase}` : `Complete ${task.currentPhase} & finish task`}</button>
    </div> : null}
    <div className="task-artifact-list"><strong>Current phase artifacts</strong>
      {phaseArtifacts.length === 0 ? <p>No artifacts yet.</p> : <ul>{phaseArtifacts.map((artifact) =>
        <li key={artifact.id}><span>{artifact.kind}</span><p>{artifact.content}</p>
          <small>{artifact.sourceTranscriptEventIds.length} source event(s)</small></li>)}</ul>}</div>
  </section>;
}
