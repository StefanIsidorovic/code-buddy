import { formatTimestamp } from "../../lib/presentation";
import type { TaskAgentReportInfo, TaskAgentRole } from "../../types/domain";

interface Props {
  reports: TaskAgentReportInfo[];
  loading: boolean;
  runningRole: TaskAgentRole | null;
  error: string | null;
  runDisabledReason: string | null;
  onRefresh: () => void;
  onRun: (role: TaskAgentRole) => void;
}

export function TaskAgentReportsPanel({ reports, loading, runningRole, error, runDisabledReason,
  onRefresh, onRun }: Props) {
  const runLocked = runningRole !== null || runDisabledReason !== null;
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
    {reports.length === 0 ? <p>{loading ? "Loading reports…" : "No secondary-agent reports yet."}</p>
      : <ol className="task-agent-report-list">{reports.map((report) => <li key={report.id}>
        <div><strong>#{report.sequence + 1} · {report.role} · {report.phase}</strong>
          <span>{formatTimestamp(report.createdAt)}</span></div>
        <p>{report.content}</p>
        <small>Transcript {report.transcriptSessionId} · {report.sourceTranscriptEventIds.length} provenance event(s)</small>
      </li>)}</ol>}
  </section>;
}
