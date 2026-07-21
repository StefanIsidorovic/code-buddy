import { StateNotice } from "../../components/ui/StateNotice";
import { CloseIcon } from "../../components/ui/icons";
import type { ProjectInfo, ProjectRepositoryInfo } from "../../types/domain";

export type RepositoryDialogProps = {
  busy: boolean;
  loading: boolean;
  name: string;
  path: string;
  project: ProjectInfo | null;
  repositories: ProjectRepositoryInfo[];
  selectedRepositoryId: string | null;
  sessionLocked: boolean;
  onAdd: () => void;
  onChangeName: (name: string) => void;
  onChangePath: (path: string) => void;
  onClose: () => void;
  onDelete: (repositoryId: string) => void;
  onRefresh: () => void;
  onSelect: (repositoryId: string) => void;
};

export function RepositoryDialog(props: RepositoryDialogProps) {
  const { busy, loading, name, path, project, repositories, selectedRepositoryId,
    sessionLocked, onAdd, onChangeName, onChangePath, onClose, onDelete, onRefresh,
    onSelect } = props;
  const mutationLocked = busy || loading || sessionLocked;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section aria-labelledby="repository-dialog-title" aria-modal="true"
        className="knowledge-modal workspace-modal repository-modal" role="dialog">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{project?.name ?? "Workspace"}</p>
            <h2 id="repository-dialog-title">Choose Repository</h2>
            <span>Select which repository agents should use, or add another folder.</span>
          </div>
          <button aria-label="Close repository picker" className="icon-button"
            type="button" onClick={onClose}><CloseIcon /></button>
        </div>

        <div className="workspace-modal-toolbar">
          <strong>{repositories.length} repositories</strong>
          <button type="button" onClick={onRefresh} disabled={!project || loading}>Refresh</button>
        </div>

        <ul className="project-list workspace-project-list" aria-label="Project repositories">
          {repositories.length === 0 ? (
            <StateNotice as="li" kind="empty" title="No repositories yet"
              description="Add the first repository for this workspace below." />
          ) : repositories.map((repository) => {
            const selected = repository.id === selectedRepositoryId;
            return (
              <li data-selected={selected} key={repository.id}>
                <div>
                  <strong>{repository.name}</strong><span>{repository.path}</span>
                  {repository.isDefault ? <small>Default repository</small> : null}
                </div>
                <div className="project-actions">
                  <button aria-label={`Select ${repository.name} repository`} aria-pressed={selected}
                    type="button" onClick={() => onSelect(repository.id)} disabled={busy || sessionLocked}>
                    {selected ? "Selected" : "Select"}
                  </button>
                  <button aria-label={`Delete ${repository.name} repository`} type="button"
                    onClick={() => onDelete(repository.id)}
                    disabled={mutationLocked || repository.isDefault}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="workspace-create-panel">
          <div><span className="section-kicker">New repository</span><h3>Add a repository folder</h3></div>
          <div className="workspace-form repository-form">
            <label><span>Name</span><input aria-label="Repository name"
              onChange={(event) => onChangeName(event.target.value)} value={name} /></label>
            <label><span>Path</span><input aria-label="Repository path"
              onChange={(event) => onChangePath(event.target.value)} value={path} /></label>
            <button className="primary-action" type="button" onClick={onAdd}
              disabled={busy || loading || !project || !name.trim() || !path.trim()}>
              Add Repository
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
