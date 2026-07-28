import type { TaskPhaseInfo } from "../../types/domain";

type StepStatus = "complete" | "current" | "pending";

interface Props {
  phase: TaskPhaseInfo["phase"]; hasEvidenceText: boolean; provenanceCount: number;
  hasPhaseRun: boolean; hasEvidence: boolean; reviewed: boolean;
}

const phaseOutcomes: Record<TaskPhaseInfo["phase"], string> = {
  analysis: "Investigate boundaries, constraints, risks, and unknowns.",
  planning: "Produce a concrete, ordered implementation and verification plan.",
  execution: "Implement the approved plan and record changes, checks, and deviations.",
  review: "Check correctness, regressions, safety, and remaining limitations.",
};

export function TaskPhaseGuide({ phase, hasEvidenceText, provenanceCount, hasPhaseRun,
  hasEvidence, reviewed }: Props) {
  const hasDraft = hasEvidenceText && provenanceCount > 0;
  const phaseLabel = `${phase[0].toUpperCase()}${phase.slice(1)}`;
  const labels = [`${phaseLabel} evidence`, "Save evidence", "Review", "Complete"];
  const statuses: StepStatus[] = [
    hasDraft || hasEvidence ? "complete" : "current",
    hasEvidence ? "complete" : hasDraft ? "current" : "pending",
    reviewed ? "complete" : hasEvidence ? "current" : "pending",
    reviewed ? "current" : "pending",
  ];
  const nextAction = reviewed ? "Complete the phase to reveal the next pending phase."
    : hasEvidence ? "Review the saved evidence, acknowledge the checkpoint, then complete the phase."
      : hasDraft ? "Your evidence draft and provenance are ready. Save phase evidence."
        : hasPhaseRun ? "Review the prepared evidence text and provenance, then save it."
          : "Create phase evidence: run the agent, or write it manually and select provenance.";
  return <section className="task-phase-guide" aria-label="Phase completion progress">
    <p className="task-phase-outcome"><strong>{phase} outcome:</strong> {phaseOutcomes[phase]}</p>
    <ol>{labels.map((label, index) => <li key={label} data-status={statuses[index]}>
      <span aria-hidden="true">{statuses[index] === "complete" ? "✓" : index + 1}</span>
      <strong>{label}</strong><small>{statuses[index]}</small>
    </li>)}</ol>
    <div className="task-phase-next" role="status" aria-live="polite">
      <p><strong>Next:</strong> {nextAction}</p>
      {!hasEvidence ? <ul>
        <li data-complete={hasEvidenceText}>Evidence text: {hasEvidenceText ? "ready" : "required"}</li>
        <li data-complete={provenanceCount > 0}>Transcript provenance: {provenanceCount > 0
          ? `${provenanceCount} selected` : "select at least one event"}</li>
      </ul> : null}
    </div>
  </section>;
}
