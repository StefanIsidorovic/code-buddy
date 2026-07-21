import type { ReactNode } from "react";

interface Props {
  phase: ReactNode;
  phaseRunHistory: ReactNode;
  contextDispatchHistory: ReactNode;
  phaseRunCount: number;
  contextDispatchCount: number;
}

export function TaskWorkflowRegion({ phase, phaseRunHistory, contextDispatchHistory,
  phaseRunCount, contextDispatchCount }: Props) {
  return <section className="task-workflow-region" aria-label="Task workflow">
    {phase}
    <details className="task-workflow-history">
      <summary><span>Task activity</span><small>{phaseRunCount} phase run(s) · {contextDispatchCount} context send(s)</small></summary>
      <div>{phaseRunHistory}{contextDispatchHistory}</div>
    </details>
  </section>;
}
