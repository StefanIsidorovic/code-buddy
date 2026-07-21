import { formatTimestamp } from "../../lib/presentation";
import type { TaskContextDispatchReceiptInfo } from "../../types/domain";

interface Props { receipts: TaskContextDispatchReceiptInfo[]; loading: boolean; error: string | null;
  resolutionReceiptId: string | null; resolutionReason: string; onRefresh: () => void;
  onOpenResolution: (receiptId: string) => void; onChangeResolutionReason: (value: string) => void;
  onCancelResolution: () => void; onResolve: () => void }

export function TaskDispatchHistoryPanel({ receipts, loading, error, resolutionReceiptId,
  resolutionReason, onRefresh, onOpenResolution, onChangeResolutionReason, onCancelResolution,
  onResolve }: Props) {
  return <section className="task-dispatch-panel" aria-labelledby="task-dispatch-title">
    <div className="doctor-heading"><div><h3 id="task-dispatch-title">Context dispatch history</h3>
      <span>{receipts.length} receipt(s)</span></div>
      <button type="button" onClick={onRefresh} disabled={loading}>Refresh</button></div>
    {error ? <p className="error-message" role="alert">{error}</p> : null}
    {receipts.length === 0 ? <p>{loading ? "Loading dispatch receipts…" : "No reviewed context sent yet."}</p>
      : <ol className="task-dispatch-list">{receipts.map((receipt) => <li key={receipt.id}
        data-status={receipt.status}><div><strong>#{receipt.sequence + 1} · {receipt.status}</strong>
          <span>{formatTimestamp(receipt.createdAt)} · {receipt.sources.length} source(s)</span></div>
        <p>{receipt.userPrompt}</p>
        {receipt.stopReason ? <small>Stop reason: {receipt.stopReason}</small> : null}
        {receipt.error ? <small>{receipt.error}</small> : null}
        <details><summary>Exact dispatched context</summary><pre>{receipt.renderedContext}</pre></details>
        {receipt.status === "pending" && resolutionReceiptId !== receipt.id
          ? <button type="button" onClick={() => onOpenResolution(receipt.id)} disabled={loading}>
            Resolve pending receipt</button> : null}
        {receipt.status === "pending" && resolutionReceiptId === receipt.id
          ? <div className="task-dispatch-resolution"><label>Resolution reason
            <textarea rows={2} maxLength={1000} value={resolutionReason}
              onChange={(event) => onChangeResolutionReason(event.target.value)} /></label>
            <p>Stop the associated ACP session first. This can only mark the uncertain dispatch as
              failed; it cannot claim that ACP received it.</p>
            <div><button type="button" onClick={onCancelResolution} disabled={loading}>Cancel</button>
              <button type="button" onClick={onResolve} disabled={loading || !resolutionReason.trim()}>
                Mark as failed</button></div></div> : null}
      </li>)}</ol>}
  </section>;
}
