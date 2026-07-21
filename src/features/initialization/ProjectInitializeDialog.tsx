import { CloseIcon } from "../../components/ui/icons";
import type { ProjectRepositoryInfo } from "../../types/domain";

export type ProjectInitializeDialogProps = {
  error: string | null;
  loading: boolean;
  repositories: ProjectRepositoryInfo[];
  selectedRepositoryIds: string[];
  onClose: () => void;
  onStart: () => void;
  onToggleRepository: (repositoryId: string, selected: boolean) => void;
};

export function ProjectInitializeDialog(props: ProjectInitializeDialogProps) {
  const {
    error, loading, repositories, selectedRepositoryIds, onClose, onStart,
    onToggleRepository,
  } = props;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section aria-labelledby="project-initialize-dialog-title" aria-modal="true"
        className="knowledge-modal project-initialize-modal" role="dialog">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Project</p>
            <h2 id="project-initialize-dialog-title">Project Initialize</h2>
          </div>
          <button aria-label="Close project initialize dialog" className="icon-button"
            type="button" onClick={onClose} disabled={loading}><CloseIcon /></button>
        </div>

        {error ? <p className="error-message" role="alert">{error}</p> : null}

        <div className="initialize-section">
          <h3>Repositories</h3>
          <ul className="initialize-repository-list" aria-label="Repositories to initialize">
            {repositories.map((repository) => (
              <li key={repository.id}>
                <label>
                  <input aria-label={`Include ${repository.name} repository`}
                    checked={selectedRepositoryIds.includes(repository.id)} type="checkbox"
                    onChange={(event) =>
                      onToggleRepository(repository.id, event.currentTarget.checked)} />
                  <span><strong>{repository.name}</strong><small>{repository.path}</small></span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="initialize-section">
          <h3>Phases</h3>
          <ol className="initialize-phase-list">
            <li>Facts</li>
            <li>Markdown analysis</li>
            <li>Interview</li>
            <li>Knowledge summary</li>
          </ol>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" onClick={onStart}
            disabled={loading || selectedRepositoryIds.length === 0}>Start Initialize</button>
        </div>
      </section>
    </div>
  );
}
