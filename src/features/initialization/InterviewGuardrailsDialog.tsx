import { CloseIcon } from "../../components/ui/icons";
import { guardrailKindClassName, guardrailKindLabel } from "../../lib/presentation";
import type {
  InterviewScope,
  ProjectInitializationGuardrailInput,
  ProjectInitializationGuardrailKind,
  ProjectRepositoryInfo,
} from "../../types/domain";

export type InterviewGuardrailsDialogProps = {
  content: string;
  drafts: ProjectInitializationGuardrailInput[];
  error: string | null;
  kind: ProjectInitializationGuardrailKind;
  loading: boolean;
  pathPattern: string;
  repositories: ProjectRepositoryInfo[];
  repositoryId: string;
  scope: InterviewScope;
  onAdd: () => void;
  onChangeContent: (content: string) => void;
  onChangeKind: (kind: ProjectInitializationGuardrailKind) => void;
  onChangePathPattern: (pathPattern: string) => void;
  onChangeRepositoryId: (repositoryId: string) => void;
  onChangeScope: (scope: InterviewScope) => void;
  onClose: () => void;
  onRemove: (index: number) => void;
  onSave: () => void;
};

export function InterviewGuardrailsDialog(props: InterviewGuardrailsDialogProps) {
  const {
    content, drafts, error, kind, loading, pathPattern, repositories, repositoryId,
    scope, onAdd, onChangeContent, onChangeKind, onChangePathPattern,
    onChangeRepositoryId, onChangeScope, onClose, onRemove, onSave,
  } = props;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section aria-labelledby="interview-dialog-title" aria-modal="true"
        className="knowledge-modal interview-modal" role="dialog">
        <div className="modal-heading">
          <div><p className="eyebrow">Initialize</p><h2 id="interview-dialog-title">Interview Guardrails</h2></div>
          <button aria-label="Close interview guardrails" className="icon-button"
            type="button" onClick={onClose} disabled={loading}><CloseIcon /></button>
        </div>

        {error ? <p className="error-message" role="alert">{error}</p> : null}

        <div className="interview-form">
          <label><span>Scope</span><select aria-label="Guardrail scope" value={scope}
            onChange={(event) => onChangeScope(event.currentTarget.value as InterviewScope)}>
            <option value="project">Project-wide</option><option value="repository">Repository</option>
          </select></label>
          {scope === "repository" ? (
            <label><span>Repository</span><select aria-label="Guardrail repository" value={repositoryId}
              onChange={(event) => onChangeRepositoryId(event.currentTarget.value)}>
              {repositories.map((repository) => (
                <option key={repository.id} value={repository.id}>{repository.name}</option>
              ))}
            </select></label>
          ) : null}
          <label><span>Type</span><select aria-label="Guardrail type" value={kind}
            onChange={(event) =>
              onChangeKind(event.currentTarget.value as ProjectInitializationGuardrailKind)}>
            <option value="fragile">Fragile</option>
            <option value="do_not_touch">Do not touch</option>
            <option value="requires_review">Needs review</option>
            <option value="agent_rule">Agent rule</option>
          </select></label>
          <label><span>Path or glob</span><input aria-label="Guardrail path pattern"
            value={pathPattern} onChange={(event) => onChangePathPattern(event.currentTarget.value)} /></label>
          <label className="interview-content-field"><span>Guardrail</span>
            <textarea aria-label="Guardrail content" rows={4} value={content}
              onChange={(event) => onChangeContent(event.currentTarget.value)} />
          </label>
          <button type="button" onClick={onAdd}>Add Guardrail</button>
        </div>

        <ul className="guardrail-draft-list" aria-label="Draft interview guardrails">
          {drafts.length === 0 ? <li>No guardrails yet.</li> : drafts.map((guardrail, index) => (
            <li key={`${guardrail.kind}-${index}`}>
              <div className="guardrail-heading">
                <span className={guardrailKindClassName(guardrail.kind)}>
                  {guardrailKindLabel(guardrail.kind)}
                </span>
                <strong>{guardrail.repositoryId
                  ? repositories.find((repository) => repository.id === guardrail.repositoryId)?.name
                    ?? "Repository"
                  : "Project-wide"}</strong>
              </div>
              {guardrail.pathPattern ? <code>{guardrail.pathPattern}</code> : null}
              <p>{guardrail.content}</p>
              <button type="button" onClick={() => onRemove(index)}>Remove</button>
            </li>
          ))}
        </ul>

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" onClick={onSave} disabled={loading || drafts.length === 0}>
            Save Interview
          </button>
        </div>
      </section>
    </div>
  );
}
