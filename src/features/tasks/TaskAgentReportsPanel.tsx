import { useState } from "react";
import { formatTimestamp } from "../../lib/presentation";
import type { TaskAgentReportInfo, TaskAgentRole } from "../../types/domain";
import { buildTaskAgentFindingFollowUpPrompt, deriveTaskAgentFindings } from "./taskAgentReportBrief";

interface Props {
  reports: TaskAgentReportInfo[];
  loading: boolean;
  runningRole: TaskAgentRole | null;
  error: string | null;
  runDisabledReason: string | null;
  onRefresh: () => void;
  onRun: (role: TaskAgentRole) => void;
  onDraftFollowUp: (draft: string) => void;
}

export function TaskAgentReportsPanel({ reports, loading, runningRole, error, runDisabledReason,
  onRefresh, onRun, onDraftFollowUp }: Props) {
  const [resolvedFindingIds, setResolvedFindingIds] = useState<ReadonlySet<string>>(() => new Set());
  const runLocked = runningRole !== null || runDisabledReason !== null;
  const findings = deriveTaskAgentFindings(reports);
  function toggleResolved(findingId: string) {
    setResolvedFindingIds((current) => {
      const next = new Set(current);
      if (next.has(findingId)) next.delete(findingId);
      else next.add(findingId);
      return next;
    });
  }
  return <section className="task-dispatch-panel" aria-labelledby="task-agent-reports-title">
    <div className="doctor-heading"><div><h3 id="task-agent-reports-title">Advisor &amp; reviewer reports</h3>
      <span>{runningRole ? `Running ${runningRole}…` : `${reports.length} report(s) · read-only`}</span></div>
      <div className="button-row">
        <button type="button" disabled={runLocked} title={runDisabledReason ?? undefined}
          onClick={() => onRun("advisor")}>{runningRole === "advisor" ? "Running advisor…" : "Run advisor"}</button>
        <button type="button" disabled={runLocked} title={runDisabledReason ?? undefined}
          onClick={() => onRun("reviewer")}>{runningRole === "reviewer" ? "Running reviewer…" : "Run reviewer"}</button>
        <button type="button" disabled={loading} onClick={onRefresh}>Refresh</button>
      </div></div>
    {error ? <p className="error-message" role="alert">{error}</p> : null}
    {findings.length > 0 ? <section className="task-agent-brief" aria-labelledby="task-agent-brief-title">
      <div><h4 id="task-agent-brief-title">Review brief</h4>
        <small>Exact snippets from read-only secondary reports. Drafting and resolving are local only.</small></div>
      <ol>{findings.map((finding) => {
        const resolved = resolvedFindingIds.has(finding.id);
        return <li key={finding.id} data-kind={finding.kind} data-resolved={resolved}>
          <span>{finding.kind}</span><div className="task-agent-brief-copy">
            <p>{finding.content}</p>
            <small>{finding.role} · {finding.phase} · transcript {finding.transcriptSessionId}
              · {finding.provenanceEventCount} provenance event(s)
              {resolved ? " · locally resolved" : ""}</small>
            <div className="task-agent-brief-actions">
              <button type="button" onClick={() => onDraftFollowUp(
                buildTaskAgentFindingFollowUpPrompt(finding),
              )}>Draft follow-up</button>
              <button type="button" aria-pressed={resolved} onClick={() => toggleResolved(finding.id)}>
                {resolved ? "Reopen" : "Mark resolved"}
              </button>
            </div>
          </div></li>;
      })}</ol>
    </section> : null}
    {reports.length === 0 ? <p>{loading ? "Loading reports…" : "No secondary-agent reports yet."}</p>
      : <ol className="task-agent-report-list">{reports.map((report) => <li key={report.id}>
        <div><strong>#{report.sequence + 1} · {report.role} · {report.phase}</strong>
          <span>{formatTimestamp(report.createdAt)}</span></div>
        <p>{report.content}</p>
        <small>Transcript {report.transcriptSessionId} · {report.sourceTranscriptEventIds.length} provenance event(s)</small>
      </li>)}</ol>}
  </section>;
}
