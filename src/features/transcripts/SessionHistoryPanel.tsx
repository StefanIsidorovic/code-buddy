import { filterTranscriptSessions, formatTimestamp, shortId } from "../../lib/presentation";
import type { TranscriptSessionInfo } from "../../types/domain";

export type SessionHistoryPanelProps = {
  activeSessionTitle: string | null;
  error: string | null;
  filter: string;
  loading: boolean;
  renameTitle: string;
  selectedSessionId: string | null;
  sessions: TranscriptSessionInfo[];
  onChangeFilter: (filter: string) => void;
  onChangeRenameTitle: (title: string) => void;
  onOpen: (session: TranscriptSessionInfo) => void;
  onRefresh: () => void;
  onRename: () => void;
};

export function SessionHistoryPanel(props: SessionHistoryPanelProps) {
  const { activeSessionTitle, error, filter, loading, renameTitle, selectedSessionId, sessions,
    onChangeFilter, onChangeRenameTitle, onOpen, onRefresh, onRename } = props;
  const filtered = filterTranscriptSessions(sessions, filter);
  const visible = filtered.slice(0, 3);
  const selected = sessions.find((session) => session.id === selectedSessionId) ?? null;
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
      <ul className="history-list" aria-label="Session history">
        {sessions.length === 0 ? <li>No saved sessions yet.</li>
          : filtered.length === 0 ? <li>No sessions match this filter.</li>
          : visible.map((session) => <li data-selected={session.id === selectedSessionId} key={session.id}>
            <button type="button" aria-label={`Open ${session.title} transcript`}
              aria-pressed={session.id === selectedSessionId} onClick={() => onOpen(session)} disabled={loading}>
              <strong>{session.title}</strong><span>{session.source} · {session.runtime} · {session.eventCount} events</span>
              <small>{formatTimestamp(session.updatedAt)} · {shortId(session.id)}</small>
            </button></li>)}
      </ul>
    </div>
  </details>;
}
