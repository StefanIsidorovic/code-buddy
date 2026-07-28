import type { ReactNode } from "react";
import type {
  GitDeliveryReadinessInfo,
  TaskInfo,
  TaskPhaseArtifactInfo,
  TaskPhaseRunReceiptInfo,
} from "../../types/domain";
import { executionVerificationForTask } from "./taskPhaseExecution";

interface Props {
  task: TaskInfo;
  artifacts: TaskPhaseArtifactInfo[];
  phaseReceipts: TaskPhaseRunReceiptInfo[];
  deliveryReadiness: GitDeliveryReadinessInfo | null;
  recoveryNotice: ReactNode;
  optionalChecks: ReactNode;
  auditTrail: ReactNode;
  deliveryDetails: ReactNode;
}

export function TaskActivityPanel({ task, artifacts, phaseReceipts, deliveryReadiness,
  recoveryNotice, optionalChecks, auditTrail, deliveryDetails }: Props) {
  const completedPhases = task.phases.filter(({ status }) => status === "completed").length;
  const complete = completedPhases === task.phases.length;
  const latestArtifact = [...artifacts].reverse().find(({ phase }) => phase === "review")
    ?? artifacts[artifacts.length - 1] ?? null;
  const verification = executionVerificationForTask(task, phaseReceipts, null);
  const changedFiles = verification?.changedFiles.length
    ? verification.changedFiles
    : deliveryReadiness?.changedFiles ?? [];

  return <div className="task-activity-panel">
    {recoveryNotice}
    <section className="task-result-card" aria-labelledby="task-result-title">
      <div className="task-result-heading">
        <div><span>Task result</span><h2 id="task-result-title">
          {complete ? "Completed" : `${task.currentPhase} in progress`}
        </h2></div>
        <strong data-complete={complete}>{completedPhases}/{task.phases.length} phases complete</strong>
      </div>
      <dl className="task-result-facts" aria-label="Task result summary">
        <div><dt>Evidence</dt><dd>{artifacts.length} saved result(s)</dd></div>
        <div><dt>Repository</dt><dd>{repositoryResult(verification?.status ?? null, changedFiles.length)}</dd></div>
        <div><dt>Changed files</dt><dd>{changedFiles.length}</dd></div>
      </dl>
      {changedFiles.length > 0 ? <ul className="task-result-files" aria-label="Changed files">
        {changedFiles.map((file) => <li key={`${file.status}:${file.path}`}>
          <strong>{file.status}</strong><span>{file.path}</span>
        </li>)}
      </ul> : null}
      <div className="task-result-conclusion">
        <strong>Latest conclusion</strong>
        {latestArtifact ? <><p>{latestArtifact.content}</p>
          <small>{latestArtifact.phase} evidence · {latestArtifact.sourceTranscriptEventIds.length} source event(s)</small></>
          : <p>No phase evidence has been saved yet.</p>}
      </div>
    </section>

    <details className="task-activity-details">
      <summary><span><strong>Optional checks</strong>
        <small>Run an advisor or reviewer only when you want a second opinion.</small></span></summary>
      {optionalChecks}
    </details>
    <details className="task-activity-details">
      <summary><span><strong>Audit trail</strong>
        <small>{phaseReceipts.length} phase run(s) · prompts, receipts and context delivery.</small></span></summary>
      <div className="task-activity-details-content">{auditTrail}</div>
    </details>
    <details className="task-activity-details">
      <summary><span><strong>Delivery details</strong>
        <small>Git readiness, changed files and commit provenance.</small></span></summary>
      {deliveryDetails}
    </details>
  </div>;
}

function repositoryResult(status: "changed" | "unchanged" | "unavailable" | null, fileCount: number) {
  if (status === "changed") return "Changes verified";
  if (status === "unchanged" && fileCount > 0) return "Existing changes verified";
  if (status === "unchanged") return "No change detected";
  if (status === "unavailable") return "Verification unavailable";
  return fileCount > 0 ? "Changes detected" : "Not verified yet";
}
