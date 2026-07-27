export type WorkspaceView = "knowledge" | "task";

interface Props {
  activeView: WorkspaceView;
  currentPhase: string | null;
  initializationStatus: string | null;
  pendingPermissionCount: number;
  onChangeView: (view: WorkspaceView) => void;
}

export function WorkspaceNavigation({ activeView, currentPhase, initializationStatus,
  pendingPermissionCount, onChangeView }: Props) {
  return <nav className="workspace-navigation" aria-label="Primary workspace sections">
    <button type="button" aria-current={activeView === "knowledge" ? "page" : undefined}
      onClick={() => onChangeView("knowledge")}><span><strong>Project Knowledge</strong>
        <small>{initializationStatus ?? "Not initialized"}</small></span>
      <span aria-hidden="true">›</span></button>
    <button type="button" aria-current={activeView === "task" ? "page" : undefined}
      onClick={() => onChangeView("task")}><span><strong>Task</strong>
        <small>{currentPhase ? `Current: ${currentPhase}` : "Agent, phases & activity"}</small></span>
      {pendingPermissionCount > 0
        ? <b aria-label={`${pendingPermissionCount} pending permission requests`}>{pendingPermissionCount}</b>
        : <span aria-hidden="true">›</span>}</button>
  </nav>;
}
