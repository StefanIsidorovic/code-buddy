import { formatTimestamp } from "../../lib/presentation";
import type { TaskAgentReportInfo } from "../../types/domain";

interface Props {
  reports: TaskAgentReportInfo[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function TaskAgentReportsPanel({ reports, loading, error, onRefresh }: Props) {
  return <section className="task-dispatch-panel" aria-labelledby="task-agent-reports-title">
    <div className="doctor-heading"><div><h3 id="task-agent-reports-title">Advisor &amp; reviewer reports</h3>
      <span>{reports.length} report(s) · read-only</span></div>
      <button type="button" disabled={loading} onClick={onRefresh}>Refresh</button></div>
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
