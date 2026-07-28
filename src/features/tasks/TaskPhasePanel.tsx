import type { TaskInfo, TaskPhaseArtifactInfo, TaskPhaseInfo, TranscriptEventInfo } from "../../types/domain";
import { buildTaskPhaseExecutionPrompt } from "./taskPhaseExecution";
import { taskPhaseReviewCriteria } from "./taskPhaseReview";
import { TaskPhaseGuide } from "./TaskPhaseGuide";

interface Props { task: TaskInfo; artifacts: TaskPhaseArtifactInfo[]; currentPhase: TaskPhaseInfo | null;
  sourceEvents: TranscriptEventInfo[]; selectedSourceIds: string[]; kind: string; content: string;
  error: string | null; loading: boolean; onChangeKind: (value: string) => void;
  canRunAgent: boolean; agentRunning: boolean; hasPhaseRun: boolean; evidenceReviewed: boolean;
  onChangeContent: (value: string) => void; onToggleSource: (id: string, selected: boolean) => void;
  onToggleAllSources: (selected: boolean) => void;
  onCreateArtifact: () => void; onStart: () => void; onComplete: () => void;
  onRunAndPrepare: (instruction: string) => void; onPrepareCompletion: () => void;
  onAcknowledgeEvidenceReview: (reviewed: boolean) => void }

export function TaskPhasePanel({ task, artifacts, currentPhase, sourceEvents, selectedSourceIds,
  kind, content, error, loading, canRunAgent, agentRunning, hasPhaseRun, evidenceReviewed,
  onChangeKind, onChangeContent, onToggleSource, onToggleAllSources,
  onCreateArtifact, onStart, onComplete, onRunAndPrepare, onPrepareCompletion,
  onAcknowledgeEvidenceReview }: Props) {
  const phaseArtifacts = artifacts.filter(({ phase }) => phase === task.currentPhase);
  const inProgress = currentPhase?.status === "in_progress";
  const hasDraft = !!content.trim();
  const hasProvenance = selectedSourceIds.length > 0;
  const canSaveEvidence = hasDraft && hasProvenance;
  const agentInstruction = buildTaskPhaseExecutionPrompt(task);
  const nextPhase = task.phases.find(({ phaseIndex }) => phaseIndex === (currentPhase?.phaseIndex ?? -1) + 1)?.phase;
  return <section className="task-phase-panel" aria-labelledby="task-phase-title">
    <div className="doctor-heading"><div><h3 id="task-phase-title">Task phases</h3>
      <span>{task.status} · current: {task.currentPhase}</span></div></div>
    <ol className="task-phase-list">{task.phases.map((phase) => <li key={phase.id}
      data-current={phase.phase === task.currentPhase}><strong>{phase.phase}</strong><span>{phase.status}</span></li>)}</ol>
    <details className="task-operating-model"><summary>How this Task works</summary>
      <ul>
        <li><strong>Agent</strong><span>Prompt controls and permission decisions live in Agent; output stays visible beside every view.</span></li>
        <li><strong>Task</strong><span>Use this view to save evidence, review it, and complete one phase at a time.</span></li>
        <li><strong>Run &amp; prepare</strong><span>Optional helper: it drafts evidence, but never saves or completes the phase.</span></li>
        <li><strong>Activity</strong><span>Audit context sends, phase runs, interrupted receipts, and read-only advisor/reviewer reports.</span></li>
      </ul></details>
    {inProgress ? <TaskPhaseGuide hasRun={hasPhaseRun}
      hasDraft={hasDraft && hasProvenance}
      hasEvidence={phaseArtifacts.length > 0} reviewed={evidenceReviewed} /> : null}
    {inProgress ? <div className="task-next-step" role="status" aria-live="polite">
      <strong>Next step</strong>
      <p>{phaseArtifacts.length > 0
        ? "Review the saved evidence below, acknowledge the checkpoint, then complete the phase."
        : canSaveEvidence
          ? "Your evidence draft and provenance are ready. Save phase evidence."
          : hasPhaseRun
            ? "Review the prepared evidence text and selected provenance, then save it."
            : "Run & prepare this phase, or write evidence manually and select its transcript provenance."}</p>
      {phaseArtifacts.length === 0 ? <ul>
        <li data-complete={hasDraft}>Evidence text: {hasDraft ? "ready" : "required"}</li>
        <li data-complete={hasProvenance}>Transcript provenance: {hasProvenance
          ? `${selectedSourceIds.length} selected` : "select at least one event"}</li>
      </ul> : null}
    </div> : null}
    {error ? <p className="error-message" role="alert">{error}</p> : null}
    {currentPhase?.status === "pending" ? <button className="primary-action" type="button"
      disabled={loading} onClick={onStart}>Start {task.currentPhase}</button> : null}
    {inProgress ? <div className="task-artifact-editor">
      <div className="task-phase-run"><details><summary><span>Exact agent instruction</span>
        <small>Show the bounded prompt sent to the coding agent</small></summary>
        <pre>{agentInstruction}</pre></details>
        <button className="primary-action" type="button"
          disabled={!canRunAgent || agentRunning || loading || hasPhaseRun}
          onClick={() => onRunAndPrepare(agentInstruction)}>{agentRunning ? "Running phase…"
            : hasPhaseRun ? `${task.currentPhase} run finished` : `Run & prepare ${task.currentPhase}`}</button>
        {!canRunAgent ? <small>Start an ACP session to run this phase.</small> : null}
        <small>{hasPhaseRun ? "The phase response is ready to review and save as evidence."
          : "Runs this phase once and prepares an editable draft. It never saves or completes the phase."}</small></div>
      <label>Evidence type<select value={kind} onChange={(event) => onChangeKind(event.target.value)}>
        <option value="summary">Summary</option><option value="finding">Finding</option>
        <option value="risk">Risk</option><option value="decision">Decision</option>
        <option value="implementation_note">Implementation note</option>
        <option value="test_result">Test result</option>
      </select><small>Classifies this saved phase result so later context can identify its purpose.</small></label>
      <label>Phase evidence<textarea rows={3} value={content} placeholder="Write the result worth carrying into the next phase…"
        onChange={(event) => onChangeContent(event.target.value)} />
        <small>The durable conclusion for this phase. You can edit the prepared agent response before saving.</small></label>
      <button type="button" onClick={onPrepareCompletion}
        disabled={loading || agentRunning || !hasPhaseRun}>Prepare evidence from latest run</button>
      <small>{hasPhaseRun
        ? "Reloads the latest linked agent response into this editable draft."
        : "Available after a successful phase run. You can also write evidence manually."}</small>
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
      {!canSaveEvidence ? <small role="note">To enable Save phase evidence, add evidence text and select
        at least one supporting transcript event.</small> : null}
      <small>Saves this text as an immutable Task artifact linked to the selected transcript events.
        It does not complete the phase.</small>
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
