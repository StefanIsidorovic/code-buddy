import { StateNotice } from "../../components/ui/StateNotice";
import { CloseIcon } from "../../components/ui/icons";
import type { ProjectInfo } from "../../types/domain";

export type WorkspaceDialogProps = {
  busy: boolean;
  folderPicking: boolean;
  loading: boolean;
  name: string;
  path: string;
  projects: ProjectInfo[];
  selectedProjectId: string | null;
  sessionLocked: boolean;
  onAdd: () => void;
  onChangeName: (name: string) => void;
  onChangePath: (path: string) => void;
  onChooseFolder: () => void;
  onClose: () => void;
  onDelete: (project: ProjectInfo) => void;
  onRefresh: () => void;
  onSelect: (projectId: string) => void;
};

export function WorkspaceDialog(props: WorkspaceDialogProps) {
  const {
    busy, folderPicking, loading, name, path, projects, selectedProjectId,
    sessionLocked, onAdd, onChangeName, onChangePath, onChooseFolder, onClose,
    onDelete, onRefresh, onSelect,
  } = props;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section aria-labelledby="workspace-dialog-title" aria-modal="true"
        className="knowledge-modal workspace-modal" role="dialog">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Global context</p>
            <h2 id="workspace-dialog-title">Choose Workspace</h2>
            <span>Select the project AIadne should use across initialization and sessions.</span>
          </div>
          <button aria-label="Close workspace picker" className="icon-button"
            type="button" onClick={onClose}><CloseIcon /></button>
        </div>

        <div className="workspace-modal-toolbar">
          <strong>{projects.length} workspaces</strong>
          <button type="button" onClick={onRefresh} disabled={loading}>Refresh</button>
        </div>

        <ul className="project-list workspace-project-list" aria-label="Projects">
          {projects.length === 0 ? (
            <StateNotice as="li" kind="empty" title="No workspaces yet"
              description="Add your first project folder below to begin." />
          ) : projects.map((project) => {
            const selected = project.id === selectedProjectId;
            return (
              <li data-selected={selected} key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <span>{project.path}</span>
                  {selected ? <small>Current workspace</small> : null}
                </div>
                <div className="project-actions">
                  <button aria-label={`Select ${project.name} project`} aria-pressed={selected}
                    type="button" onClick={() => onSelect(project.id)}
                    disabled={busy || sessionLocked}>
                    {selected ? "Selected" : "Select"}
                  </button>
                  <button aria-label={`Delete ${project.name} project`}
                    className="danger-button" type="button" onClick={() => onDelete(project)}
                    disabled={busy || sessionLocked}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="workspace-create-panel">
          <div><span className="section-kicker">New workspace</span><h3>Add a project folder</h3></div>
          <div className="workspace-form">
            <label><span>Name</span><input aria-label="Project name"
              onChange={(event) => onChangeName(event.target.value)} value={name} /></label>
            <label><span>Path</span><input aria-label="Project path"
              onChange={(event) => onChangePath(event.target.value)} value={path} /></label>
            <button type="button" onClick={onChooseFolder}
              disabled={busy || folderPicking}>Choose Folder</button>
            <button className="primary-action" type="button" onClick={onAdd}
              disabled={busy || folderPicking || !name.trim() || !path.trim()}>
              Add Project
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
