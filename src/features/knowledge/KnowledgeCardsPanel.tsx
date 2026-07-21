import type { KnowledgeItemInfo } from "../../types/domain";

export type KnowledgeCardsPanelProps = {
  attachedCount: number;
  attachedIds: string[];
  error: string | null;
  items: KnowledgeItemInfo[];
  loading: boolean;
  onAdd: () => void;
  onToggle: (item: KnowledgeItemInfo, attached: boolean) => void;
};

export function KnowledgeCardsPanel(props: KnowledgeCardsPanelProps) {
  const { attachedCount, attachedIds, error, items, loading, onAdd, onToggle } = props;
  return <details className="agent-accordion sidebar-knowledge">
    <summary><span>Knowledge Cards</span><strong>{attachedCount} attached</strong></summary>
    <div className="accordion-body">
      <div className="knowledge-toolbar"><div><h3 id="knowledge-title">Knowledge Cards</h3>
        <span>{items.length} available</span></div>
        <button aria-label="Add knowledge card" className="icon-button" type="button"
          onClick={onAdd} disabled={loading}>+</button>
      </div>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      <ul className="knowledge-list" aria-label="Knowledge cards">
        {items.length === 0 ? <li>No knowledge cards yet.</li> : items.map((item) => {
          const attached = attachedIds.includes(item.id);
          return <li data-selected={attached} key={item.id}><label>
            <input type="checkbox" checked={attached}
              onChange={(event) => onToggle(item, event.currentTarget.checked)} />
            <span><strong>{item.title}</strong><small>
              {item.kind} · {item.scope} · {item.projectId ? "project" : "global"}</small>
              <em>{item.body}</em></span>
          </label></li>;
        })}
      </ul>
    </div>
  </details>;
}
