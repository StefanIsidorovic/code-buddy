import { CloseIcon } from "../../components/ui/icons";
import type { ProjectInfo } from "../../types/domain";

export type ProjectDeleteDialogProps = {
  busy: boolean;
  error: string | null;
  project: ProjectInfo;
  onClose: () => void;
  onConfirm: () => void;
};

export function ProjectDeleteDialog({ busy, error, project, onClose, onConfirm }:
  ProjectDeleteDialogProps) {
  return <div className="modal-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section aria-labelledby="project-delete-dialog-title" aria-modal="true"
      className="knowledge-modal project-delete-modal" role="dialog">
      <div className="modal-heading">
        <div><p className="eyebrow">Workspace</p>
          <h2 id="project-delete-dialog-title">Delete Project</h2></div>
        <button aria-label="Close delete project dialog" className="icon-button"
          type="button" onClick={onClose} disabled={busy}><CloseIcon /></button>
      </div>

      {error ? <p className="error-message" role="alert">{error}</p> : null}

      <p className="delete-modal-copy">
        Delete <strong>{project.name}</strong> from AIadne? This removes the saved project, its
        repository list, and its initialization runs. Saved transcripts are kept without the
        project link. Running ACP sessions will be stopped first.
      </p>

      <div className="modal-actions">
        <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
        <button aria-label="Confirm delete project" className="danger-button" type="button"
          onClick={onConfirm} disabled={busy}>Delete Project</button>
      </div>
    </section>
  </div>;
}
