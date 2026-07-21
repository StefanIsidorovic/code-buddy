import { formatTimestamp } from "../../lib/presentation";
import type { TaskPhaseRunReceiptInfo } from "../../types/domain";

interface Props { receipts: TaskPhaseRunReceiptInfo[]; loading: boolean; error: string | null;
  resolutionReceiptId: string | null; resolutionReason: string; onRefresh: () => void;
  onOpenResolution: (id: string) => void; onChangeResolutionReason: (value: string) => void;
  onCancelResolution: () => void; onResolve: () => void }

export function TaskPhaseRunHistoryPanel({ receipts, loading, error, resolutionReceiptId,
  resolutionReason, onRefresh, onOpenResolution, onChangeResolutionReason, onCancelResolution,
  onResolve }: Props) {
  return <section className="task-dispatch-panel" aria-labelledby="phase-run-history-title">
    <div className="doctor-heading"><div><h3 id="phase-run-history-title">Phase run history</h3>
      <span>{receipts.length} run(s)</span></div><button type="button" disabled={loading} onClick={onRefresh}>Refresh</button></div>
    {error ? <p className="error-message" role="alert">{error}</p> : null}
    {receipts.length === 0 ? <p>{loading ? "Loading phase runs…" : "No phase runs yet."}</p>
      : <ol className="task-dispatch-list">{receipts.map((receipt) => <li key={receipt.id} data-status={receipt.status}>
        <div><strong>#{receipt.sequence + 1} · {receipt.phase} · {receipt.status}</strong>
          <span>{formatTimestamp(receipt.createdAt)}</span></div>
        {receipt.stopReason ? <small>Stop reason: {receipt.stopReason}</small> : null}
        {receipt.error ? <small>{receipt.error}</small> : null}
        <details><summary>Exact phase instruction</summary><pre>{receipt.instruction}</pre></details>
        {receipt.status === "pending" && resolutionReceiptId !== receipt.id ? <button type="button"
          disabled={loading} onClick={() => onOpenResolution(receipt.id)}>Resolve pending run</button> : null}
        {receipt.status === "pending" && resolutionReceiptId === receipt.id ? <div className="task-dispatch-resolution">
          <label>Resolution reason<textarea rows={2} maxLength={1000} value={resolutionReason}
            onChange={(event) => onChangeResolutionReason(event.target.value)} /></label>
          <p>Stop the associated ACP session first. This can only mark the uncertain run as failed.</p>
          <div><button type="button" disabled={loading} onClick={onCancelResolution}>Cancel</button>
            <button type="button" disabled={loading || !resolutionReason.trim()} onClick={onResolve}>Mark as failed</button></div>
        </div> : null}</li>)}</ol>}
  </section>;
}
