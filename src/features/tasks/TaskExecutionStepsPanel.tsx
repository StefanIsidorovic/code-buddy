import { useState } from "react";
import type { TaskPlanStepInfo, TaskPlanStepRunInfo, TaskPlanVersionInfo } from "../../types/domain";
import { deriveTaskExecutionWaves } from "./taskExecutionWaves";

interface Props {
  plan: TaskPlanVersionInfo | null;
  runs: TaskPlanStepRunInfo[];
  nextStep: TaskPlanStepInfo | null;
  canRun: boolean;
  loading: boolean;
  actionRunId: string | null;
  cleanupWarnings: Record<string, string>;
  error: string | null;
  onRun: () => void;
  onReview: (runId: string, decision: "accept" | "reject", note: string) => void;
  onIntegrate: (runId: string) => void;
}

export function TaskExecutionStepsPanel({ plan, runs, nextStep, canRun, loading, actionRunId,
  cleanupWarnings, error, onRun, onReview, onIntegrate }: Props) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!plan) return <section className="task-execution-steps" aria-labelledby="execution-steps-title">
    <h4 id="execution-steps-title">Approved plan steps</h4>
    <p className="task-helper-card">Execution needs an approved structured plan.</p>
  </section>;
  const waves = deriveTaskExecutionWaves(plan.steps);
  return <section className="task-execution-steps" aria-labelledby="execution-steps-title">
    <div className="doctor-heading"><div><h4 id="execution-steps-title">Approved plan steps</h4>
      <span>{runs.filter((run) => run.status === "accepted"
        && (!run.isolationId || run.integrationStatus === "integrated")).length}/{plan.steps.length} completed</span>
    </div></div>
    {error ? <p className="error-message" role="alert">{error}</p> : null}
    <details className="task-helper-card">
      <summary>Execution waves · {waves.length}</summary>
      <ol>{waves.map((wave) => <li key={wave.number}>
        <strong>Wave {wave.number} · {wave.parallel ? "parallel-ready" : "serial"}</strong>
        <span>{wave.steps.map((step) => `Step ${step.orderIndex + 1}`).join(", ")}</span>
        <small>{wave.reason}</small>
      </li>)}</ol>
      <small>This is a deterministic safety preview. Runs are still dispatched serially;
        future isolated wave runs will also integrate one at a time.</small>
    </details>
    <ol>{plan.steps.map((step) => {
      const attempts = runs.filter((run) => run.planStepId === step.id);
      const run = attempts[attempts.length - 1] ?? null;
      const note = run ? notes[run.id] ?? "" : "";
      const isNext = nextStep?.id === step.id;
      const canAccept = run?.status === "sent" && run.scopeStatus === "within_scope"
        && run.verificationStatus !== "unavailable" && !!note.trim();
      return <li key={step.id} data-status={run?.status ?? (isNext ? "next" : "waiting")}>
        <header><span>{step.orderIndex + 1}</span><div><strong>{step.title}</strong>
          <small>{run?.status ?? (isNext ? "ready" : "waiting")} · tier {run?.modelTier
            ?? (step.complexity <= 2 ? "small" : step.complexity === 3 ? "mid" : "high")}</small>
        </div></header>
        <p>{step.description}</p>
        <details><summary>Scope and acceptance</summary>
          <strong>Expected paths</strong>
          {step.expectedPaths.length ? <ul>{step.expectedPaths.map((path) => <li key={path}>
            <code>{path}</code></li>)}</ul> : <p>No writes declared.</p>}
          <strong>Acceptance criteria</strong>
          <ul>{step.acceptanceCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
        </details>
        {run ? <div className="task-step-run-result" data-scope={run.scopeStatus ?? "missing"}>
          <span>Attempt {run.attempt} · verification {run.verificationStatus ?? "pending"}
            {" "}· scope {run.scopeStatus ?? "pending"}</span>
          {run.verificationChangedFiles.length > 0 ? <ul>{run.verificationChangedFiles.map((path) =>
            <li key={path}><code>{path}</code></li>)}</ul> : null}
          {run.scopeViolations.length > 0 ? <p role="alert">Outside expected scope:
            {" "}{run.scopeViolations.join(", ")}</p> : null}
          {run.error ? <p role="alert">{run.error}</p> : null}
          {run.integrationStatus === "integrated" ? <p role="status">Integrated commit{" "}
            <code>{run.integratedCommitSha}</code></p> : null}
          {run.integrationStatus === "conflicted" ? <p role="alert">Integration conflicted:
            {" "}{run.integrationError}. Isolation retained
            {run.isolationWorktreePath ? <> at <code>{run.isolationWorktreePath}</code></> : null}
            {" "}for recovery.</p> : null}
          {run.integrationStatus === "pending" ? <p role="status">Integration is pending.</p> : null}
          {cleanupWarnings[run.id] ? <p role="alert">Integrated successfully, but cleanup needs
            attention: {cleanupWarnings[run.id]}</p> : null}
        </div> : null}
        {isNext && (!run || run.status === "failed") ? <button type="button"
          className="primary-action" disabled={!canRun || loading} onClick={onRun}>
          {loading ? "Running step…" : run?.status === "failed" ? "Retry this step" : "Run this step"}
        </button> : null}
        {run?.status === "sent" ? <fieldset><legend>Review this step</legend>
          <label>Review note<textarea rows={2} value={note}
            onChange={(event) => setNotes((current) => ({ ...current, [run.id]: event.target.value }))} /></label>
          <div className="task-step-review-actions">
            <button type="button" disabled={!canAccept || actionRunId === run.id}
              onClick={() => onReview(run.id, "accept", note)}>Accept step</button>
            <button type="button" disabled={!note.trim() || actionRunId === run.id}
              onClick={() => onReview(run.id, "reject", note)}>Reject & retry</button>
          </div>
          {!canAccept ? <small>Accept requires available within-scope Git verification and a review note.</small> : null}
        </fieldset> : null}
        {run?.status === "accepted" && run.isolationId && !run.integrationStatus
          ? <button type="button" className="primary-action"
            disabled={actionRunId !== null || loading}
            onClick={() => onIntegrate(run.id)}>
            {actionRunId === run.id ? "Integrating step…" : "Integrate accepted step"}
          </button> : null}
      </li>;
    })}</ol>
    {!canRun && nextStep ? <p className="task-helper-card">Start a matching ACP session to run the next step.</p> : null}
  </section>;
}
