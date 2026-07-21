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

export function WorkspaceContextSelector({
  project,
  repository,
  onOpenRepository,
  onOpenWorkspace,
}: WorkspaceContextSelectorProps) {
  return (
    <>
      <button
        aria-haspopup="dialog"
        className="workspace-picker"
        type="button"
        onClick={onOpenWorkspace}
      >
        <span className="workspace-picker-label">Current workspace</span>
        <strong>{project?.name ?? "Choose a workspace"}</strong>
        <small>{project?.path ?? "Add or select a project"}</small>
        <span className="workspace-picker-action" aria-hidden="true">Switch</span>
      </button>

      <button
        aria-haspopup="dialog"
        className="workspace-picker repository-picker"
        type="button"
        onClick={onOpenRepository}
        disabled={!project}
      >
        <span className="workspace-picker-label">Current repository</span>
        <strong>{repository?.name ?? (project ? "Choose a repository" : "No workspace")}</strong>
        <small>{repository?.path ?? "Select a workspace first"}</small>
        <span className="workspace-picker-action" aria-hidden="true">Manage</span>
      </button>
    </>
  );
}
