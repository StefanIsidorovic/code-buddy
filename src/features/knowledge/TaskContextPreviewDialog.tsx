import { StateNotice } from "../../components/ui/StateNotice";
import { CloseIcon } from "../../components/ui/icons";
import type { UnifiedTaskContextSelectionInfo } from "../../types/domain";

export type TaskContextPreviewDialogProps = {
  error: string | null;
  loading: boolean;
  sending: boolean;
  canSend: boolean;
  preview: UnifiedTaskContextSelectionInfo | null;
  onClose: () => void;
  onSend: () => void;
};

export function TaskContextPreviewDialog({ error, loading, sending, canSend, preview, onClose, onSend }:
  TaskContextPreviewDialogProps) {
  return <div className="modal-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !loading) onClose();
  }}>
    <section role="dialog" aria-modal="true" aria-labelledby="task-context-preview-title"
      className="knowledge-modal task-context-preview-modal">
      <div className="modal-heading"><div><span>Knowledge selector</span>
        <h2 id="task-context-preview-title">Task Context Preview</h2></div>
        <button type="button" aria-label="Close task context preview" className="icon-button"
          onClick={onClose} disabled={loading}><CloseIcon /></button>
      </div>
      {loading ? <StateNotice kind="loading" title="Selecting minimal task context…"
        description="Ranking project knowledge, attached cards, and Task artifacts against one character budget." />
        : error ? <StateNotice kind="error" title="Task context could not be selected"
          description={error} />
        : preview ? <div className="task-context-preview-body">
          <dl className="task-context-budget" aria-label="Task context budget">
            <div><dt>Budget</dt><dd>{preview.characterBudget}</dd></div>
            <div><dt>Used</dt><dd>{preview.usedCharacters}</dd></div>
            <div><dt>Remaining</dt><dd>{preview.remainingCharacters}</dd></div>
          </dl>
          <section aria-label="Included task context"><h3>Included · {preview.included.length}</h3>
            {preview.included.length > 0 ? <ol className="task-context-entry-list">
              {preview.included.map((entry) => <li key={`${entry.source.sourceType}-${entry.source.id}`}><div>
                <strong>{entry.source.kind.replace(/_/g, " ")}</strong>
                <span>{entry.reason.replace(/_/g, " ")} · score {entry.score}</span>
              </div><small>{entry.source.sourceType.replace(/_/g, " ")} · {entry.source.title}</small>
                <p>{entry.source.content}</p></li>)}
            </ol> : <StateNotice kind="empty" title="No units matched this task"
              description="Try a more specific task or review the approved Knowledge Units." />}
          </section>
          <section aria-label="Excluded task context"><h3>Excluded · {preview.excluded.length}</h3>
            <ul className="task-context-entry-list excluded">{preview.excluded.map((entry) =>
              <li key={`${entry.source.sourceType}-${entry.source.id}`}><div><strong>{entry.source.kind.replace(/_/g, " ")}</strong>
                <span>{entry.reason.replace(/_/g, " ")}</span></div>
                <small>{entry.source.sourceType.replace(/_/g, " ")} · {entry.source.title}</small>
                <p>{entry.source.content}</p></li>)}</ul>
          </section>
          <label className="field"><span>Exact rendered context</span>
            <textarea readOnly value={preview.renderedContext} rows={8} /></label>
          <p className="field-hint">Your original prompt stays unchanged. This exact context is sent only
            when you choose the action below.</p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Close</button>
            <button type="button" onClick={onSend}
              disabled={!canSend || sending || preview.renderedContext.trim().length === 0}>
              {sending ? "Sending context…" : "Send with this context"}
            </button>
          </div>
        </div>
        : <StateNotice kind="empty" title="No preview available"
          description="Run the selector again to build an auditable task-context preview." />}
    </section>
  </div>;
}
