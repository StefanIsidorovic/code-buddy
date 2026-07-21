import { CloseIcon } from "../../components/ui/icons";

export type KnowledgeCardDialogProps = {
  body: string;
  error: string | null;
  kind: string;
  loading: boolean;
  title: string;
  onChangeBody: (body: string) => void;
  onChangeKind: (kind: string) => void;
  onChangeTitle: (title: string) => void;
  onClose: () => void;
  onCreate: () => void;
};

export function KnowledgeCardDialog(props: KnowledgeCardDialogProps) {
  const { body, error, kind, loading, title, onChangeBody, onChangeKind, onChangeTitle,
    onClose, onCreate } = props;
  return <div className="modal-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section aria-labelledby="knowledge-dialog-title" aria-modal="true"
      className="knowledge-modal" role="dialog">
      <div className="modal-heading"><div><p className="eyebrow">Knowledge</p>
        <h2 id="knowledge-dialog-title">New Knowledge Card</h2></div>
        <button aria-label="Close knowledge card dialog" className="icon-button" type="button"
          onClick={onClose} disabled={loading}><CloseIcon /></button>
      </div>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      <div className="knowledge-form knowledge-modal-form">
        <label><span>Title</span><input aria-label="Knowledge title"
          onChange={(event) => onChangeTitle(event.target.value)} value={title} /></label>
        <label><span>Kind</span><select aria-label="Knowledge kind"
          onChange={(event) => onChangeKind(event.target.value)} value={kind}>
          <option value="decision">Decision</option><option value="constraint">Constraint</option>
          <option value="preference">Preference</option><option value="fact">Fact</option>
          <option value="todo">Todo</option>
        </select></label>
        <label><span>Text</span><textarea aria-label="Knowledge body"
          onChange={(event) => onChangeBody(event.target.value)} rows={5} value={body} /></label>
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" onClick={onCreate}
            disabled={loading || !title.trim() || !body.trim()}>Create Card</button>
        </div>
      </div>
    </section>
  </div>;
}
