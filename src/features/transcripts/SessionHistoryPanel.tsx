import { filterTranscriptSessions, formatTimestamp, shortId } from "../../lib/presentation";
import type { TranscriptSessionInfo } from "../../types/domain";

export type SessionHistoryPanelProps = {
  activeSessionTitle: string | null;
  error: string | null;
  filter: string;
  loading: boolean;
  renameTitle: string;
  resumeDisabled: boolean;
  resumeDisabledReason: string | null;
  resumeError: string | null;
  resumingSessionId: string | null;
  selectedSessionId: string | null;
  sessions: TranscriptSessionInfo[];
  onChangeFilter: (filter: string) => void;
  onChangeRenameTitle: (title: string) => void;
  onOpen: (session: TranscriptSessionInfo) => void;
  onRefresh: () => void;
  onRename: () => void;
  onResume: (session: TranscriptSessionInfo) => void;
};

export function SessionHistoryPanel(props: SessionHistoryPanelProps) {
  const { activeSessionTitle, error, filter, loading, renameTitle, resumeDisabled,
    resumeDisabledReason, resumeError, resumingSessionId, selectedSessionId, sessions,
    onChangeFilter, onChangeRenameTitle, onOpen, onRefresh, onRename, onResume } = props;
  const filtered = filterTranscriptSessions(sessions, filter);
  const visible = filtered.slice(0, 3);
  const selected = sessions.find((session) => session.id === selectedSessionId) ?? null;
  const resumeLocked = loading || resumeDisabled || resumingSessionId !== null;
  const resumeLockReason = resumeDisabledReason ?? (resumeDisabled ? "Resume is unavailable right now." : null);
  return <details className="agent-accordion sidebar-history">
    <summary><span>Session History</span><strong>{filtered.length}/{sessions.length} saved</strong></summary>
    <div className="accordion-body">
      <div className="doctor-heading"><h3 id="history-title">Session History</h3>
        <span>{activeSessionTitle ?? "none active"}</span>
        <button type="button" onClick={onRefresh} disabled={loading}>Refresh</button></div>
      <label className="history-filter"><span>Filter</span><input aria-label="Filter session history"
        onChange={(event) => onChangeFilter(event.target.value)}
        placeholder="Search title, agent, id..." value={filter} /></label>
      <div className="history-rename" aria-label="Rename selected session"><label>
        <span>Selected name</span><input aria-label="Selected session name" disabled={!selected}
          onChange={(event) => onChangeRenameTitle(event.target.value)} value={renameTitle} /></label>
        <button type="button" onClick={onRename} disabled={loading || !selected ||
          !renameTitle.trim() || renameTitle.trim() === selected.title}>Rename</button></div>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      {resumeError ? <p className="error-message history-resume-message" role="alert">{resumeError}</p> : null}
      {resumeLockReason ? <p className="history-resume-message">{resumeLockReason}</p> : null}
      <ul className="history-list" aria-label="Session history">
        {sessions.length === 0 ? <li>No saved sessions yet.</li>
          : filtered.length === 0 ? <li>No sessions match this filter.</li>
          : visible.map((session) => <li data-selected={session.id === selectedSessionId} key={session.id}>
            <button className="history-open" type="button" aria-label={`Open ${session.title} transcript`}
              aria-pressed={session.id === selectedSessionId} onClick={() => onOpen(session)} disabled={loading}>
              <small>{session.source} · {session.runtime}</small><strong>{session.title}</strong>
              <span>{session.eventCount} events · {formatTimestamp(session.updatedAt)} · {shortId(session.id)}</span>
            </button>{session.runtime === "acp" ? <button className="history-resume" type="button"
              aria-label={`Resume ${session.title} session`} onClick={() => onResume(session)}
              title={resumeLocked ? resumeLockReason ?? "Resume is busy." : "Resume this ACP session"}
              disabled={resumeLocked}>
              {resumingSessionId === session.id ? "Resuming…" : resumeLocked ? "Locked" : "Resume"}</button> : null}</li>)}
      </ul>
    </div>
  </details>;
}
