import type { TaskPlanCritiqueInfo, TaskPlanEvaluationInfo } from "../../types/domain";

interface Props {
  evaluation: TaskPlanEvaluationInfo;
  critique: TaskPlanCritiqueInfo | null;
  loading: boolean;
  canRun: boolean;
  onRun: () => void;
}

export function TaskPlanCritiquePanel({ evaluation, critique, loading, canRun, onRun }: Props) {
  if (evaluation.findings.length === 0) return null;
  return <section className="task-plan-critique" aria-labelledby="plan-critique-title">
    <div><div><h5 id="plan-critique-title">Grounded critique</h5>
      <span>{critique ? `${critique.source} · ${critique.issues.length} issue(s)` : "not run"}</span></div>
      {!critique ? <button type="button" disabled={loading || !canRun} onClick={onRun}>
        {loading ? "Running critique…" : "Run grounded critique"}</button> : null}</div>
    {!critique ? <p>A read-only agent ranks up to three deterministic findings. Every claim must
      cite a finding ID; unsupported claims are discarded.</p>
      : <ol>{critique.issues.map((issue, index) => <li key={`${critique.id}:${index}`}>
        <div>{issue.findingIds.map((id) => <code key={id}>{id}</code>)}</div>
        <strong>{issue.explanation}</strong>
        <p><span>Proposed repair:</span> {issue.proposedRepair}</p>
      </li>)}</ol>}
    {!canRun && !critique ? <small>Select an ACP agent and repository to run critique.</small> : null}
  </section>;
}
