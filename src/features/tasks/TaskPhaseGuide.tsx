type StepStatus = "complete" | "current" | "optional" | "pending";

interface Props { hasDraft: boolean; hasEvidence: boolean; reviewed: boolean }

const labels = ["Run", "Prepare", "Save evidence", "Review", "Complete"];

export function TaskPhaseGuide({ hasDraft, hasEvidence, reviewed }: Props) {
  const statuses: StepStatus[] = [
    "optional",
    "optional",
    hasEvidence ? "complete" : "current",
    reviewed ? "complete" : hasEvidence ? "current" : "pending",
    reviewed ? "current" : "pending",
  ];
  const nextAction = reviewed ? "Complete the phase to reveal the next pending phase."
    : hasEvidence ? "Review the persisted evidence before completion."
      : hasDraft ? "Edit the draft if needed, then save it as evidence."
        : "Run and prepare a linked draft, or author evidence manually.";
  return <section className="task-phase-guide" aria-label="Phase completion progress">
    <ol>{labels.map((label, index) => <li key={label} data-status={statuses[index]}>
      <span aria-hidden="true">{statuses[index] === "complete" ? "✓" : index + 1}</span>
      <strong>{label}</strong><small>{statuses[index]}</small>
    </li>)}</ol>
    <p><strong>Next:</strong> {nextAction}</p>
  </section>;
}
