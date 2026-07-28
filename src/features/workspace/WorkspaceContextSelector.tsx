import type { ProjectInfo, ProjectRepositoryInfo } from "../../types/domain";

export type WorkspaceContextSelectorProps = {
  project: ProjectInfo | null;
  repository: ProjectRepositoryInfo | null;
  onOpenRepository: () => void;
  onOpenWorkspace: () => void;
};

export function WorkspaceContextSummary({
  project,
  repository,
}: Pick<WorkspaceContextSelectorProps, "project" | "repository">) {
  return (
    <p className="mobile-context-summary" aria-live="polite">
      <span>{project?.name ?? "No workspace"}</span>
      <span aria-hidden="true">/</span>
      <span>{repository?.name ?? (project ? "Default repository" : "No repository")}</span>
    </p>
  );
}

function SwitchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M3.5 7.5h6l2-2h9v13h-17z" />
    </svg>
  );
}

export function WorkspaceContextFooterActions({
  project,
  repository,
  onOpenRepository,
  onOpenWorkspace,
}: WorkspaceContextSelectorProps) {
  return (
    <>
      <div className="runtime-context-action">
        <dt>Workspace</dt>
        <dd>
          <button aria-haspopup="dialog"
            aria-label={`Switch workspace: ${project?.name ?? "none selected"}`}
            type="button" onClick={onOpenWorkspace}>
            <SwitchIcon />
            <strong>{project?.name ?? "Choose workspace"}</strong>
          </button>
        </dd>
      </div>
      <div className="runtime-context-action">
        <dt>Repository</dt>
        <dd>
          <button aria-haspopup="dialog"
            aria-label={`Switch repository: ${repository?.name ?? (project ? "default path" : "no workspace")}`}
            type="button" onClick={onOpenRepository} disabled={!project}>
            <SwitchIcon />
            <strong>{repository?.name ?? (project ? "Default path" : "No workspace")}</strong>
            {repository ? <small>{repository.path}</small> : null}
          </button>
        </dd>
      </div>
    </>
  );
}
