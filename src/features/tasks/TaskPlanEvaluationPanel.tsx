import type { TaskPlanEvaluationInfo, TaskPlanVersionInfo } from "../../types/domain";

interface Props {
  plan: TaskPlanVersionInfo;
  evaluation: TaskPlanEvaluationInfo | null;
  loading: boolean;
  onEvaluate: (planVersionId: string) => void;
}

export function TaskPlanEvaluationPanel({ plan, evaluation, loading, onEvaluate }: Props) {
  if (!evaluation) return <section className="task-plan-evaluation" data-verdict="pending"
    aria-labelledby="plan-evaluation-title">
    <div><div><h5 id="plan-evaluation-title">Plan evaluation</h5>
      <span>v{plan.version} · not run</span></div>
      <button type="button" disabled={loading} onClick={() => onEvaluate(plan.id)}>
        Evaluate plan v{plan.version}</button></div>
    <p>Checks requirement coverage, scope contradictions and expected-path collisions without using a model.</p>
  </section>;

  const blocking = evaluation.findings.filter(({ severity }) => severity === "blocking").length;
  const warnings = evaluation.findings.length - blocking;
  return <section className="task-plan-evaluation" data-verdict={evaluation.verdict}
    aria-labelledby="plan-evaluation-title">
    <div><div><h5 id="plan-evaluation-title">Plan evaluation</h5>
      <span>v{evaluation.planVersion} · {evaluation.verdict}</span></div>
      <strong>{blocking} blocking · {warnings} warning(s)</strong></div>
    {evaluation.findings.length === 0
      ? <p>Every in-scope requirement is covered and no structural conflict was found.</p>
      : <ol>{evaluation.findings.map((finding) => <li key={finding.id}
        data-severity={finding.severity}>
        <div><strong>{finding.code}</strong><code>{finding.id}</code></div>
        <p>{finding.message}</p>
      </li>)}</ol>}
  </section>;
}
