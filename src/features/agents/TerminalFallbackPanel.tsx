import { doctorDetail, doctorStatusLabel, transportDetail } from "../../lib/presentation";
import type { AgentDoctorReport, RuntimeMode } from "../../types/domain";

export type TerminalFallbackPanelProps = {
  error: string | null;
  loading: boolean;
  reports: AgentDoctorReport[];
  runtimeMode: RuntimeMode;
  sessionLocked: boolean;
  onRefresh: () => void;
  onToggleMode: () => void;
};

export function TerminalFallbackPanel(props: TerminalFallbackPanelProps) {
  const { error, loading, reports, runtimeMode, sessionLocked, onRefresh, onToggleMode } = props;
  return <details className="agent-accordion sidebar-agent sidebar-fallback">
    <summary><span>Terminal PTY</span><strong>{runtimeMode === "pty" ? "active" : "fallback"}</strong></summary>
    <div className="accordion-body">
      <div className="doctor-heading"><h3 id="sidebar-doctor-title">Agent Doctor</h3>
        <button type="button" onClick={onRefresh} disabled={loading}>Refresh</button></div>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      <div className="fallback-actions"><button type="button" onClick={onToggleMode}
        disabled={sessionLocked}>{runtimeMode === "pty" ? "Use ACP" : "Open PTY"}</button></div>
      <ul className="doctor-list" aria-label="Agent CLI status">
        {reports.map((report) => <li className="doctor-item" data-status={report.status}
          key={report.adapter.id}><div><strong>{report.adapter.displayName}</strong>
            <span>{report.adapter.executable}</span></div><div>
            <span className="doctor-status">{doctorStatusLabel(report.status)}</span>
            <span>{doctorDetail(report)}</span><span>{transportDetail(report.adapter.transports)}</span>
          </div></li>)}
      </ul>
    </div>
  </details>;
}
