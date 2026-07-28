import type { TaskPhaseInfo } from "../../types/domain";

type StepStatus = "complete" | "current" | "pending";

interface Props {
  phase: TaskPhaseInfo["phase"]; hasDraft: boolean; hasEvidence: boolean; reviewed: boolean;
}

const phaseOutcomes: Record<TaskPhaseInfo["phase"], string> = {
  analysis: "Investigate boundaries, constraints, risks, and unknowns.",
  planning: "Produce a concrete, ordered implementation and verification plan.",
  execution: "Implement the approved plan and record changes, checks, and deviations.",
  review: "Check correctness, regressions, safety, and remaining limitations.",
};

export function TaskPhaseGuide({ phase, hasDraft, hasEvidence, reviewed }: Props) {
  const phaseLabel = `${phase[0].toUpperCase()}${phase.slice(1)}`;
  const labels = [`${phaseLabel} evidence`, "Save evidence", "Review", "Complete"];
  const statuses: StepStatus[] = [
    hasDraft || hasEvidence ? "complete" : "current",
    hasEvidence ? "complete" : hasDraft ? "current" : "pending",
    reviewed ? "complete" : hasEvidence ? "current" : "pending",
    reviewed ? "current" : "pending",
  ];
  const nextAction = reviewed ? "Complete the phase to reveal the next pending phase."
      : hasEvidence ? "Review the persisted evidence before completion."
      : hasDraft ? "Edit the draft if needed, then save it as evidence."
        : "Run the agent for this phase, or author evidence manually.";
  return <section className="task-phase-guide" aria-label="Phase completion progress">
    <p className="task-phase-outcome"><strong>{phase} outcome:</strong> {phaseOutcomes[phase]}</p>
    <ol>{labels.map((label, index) => <li key={label} data-status={statuses[index]}>
      <span aria-hidden="true">{statuses[index] === "complete" ? "✓" : index + 1}</span>
      <strong>{label}</strong><small>{statuses[index]}</small>
    </li>)}</ol>
    <p><strong>Next:</strong> {nextAction}</p>
  </section>;
}
