import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { WorkspaceView } from "./WorkspaceNavigation";

type TaskWorkspaceView = "agent" | "task" | "activity";
interface WorkspaceActions { showAgent: () => void; }
type ActivityContent = ReactNode | ((actions: WorkspaceActions) => ReactNode);

interface Props {
  activeView: WorkspaceView; agent: ReactNode; knowledge: ReactNode; output: ReactNode;
  task: ReactNode | null; activity: ActivityContent | null; currentPhase: string | null;
  phaseRunCount: number; contextDispatchCount: number; reportCount: number;
  pendingPermissionCount: number; onChangeView: (view: WorkspaceView) => void;
}

const taskViews: TaskWorkspaceView[] = ["agent", "task", "activity"];

export function AcpWorkspaceViews({ activeView, agent, knowledge, output, task, activity,
  currentPhase, phaseRunCount, contextDispatchCount, reportCount, pendingPermissionCount,
  onChangeView }: Props) {
  const taskAvailable = task !== null; const taskWasAvailable = useRef(taskAvailable);
  const [taskView, setTaskView] = useState<TaskWorkspaceView>(taskAvailable ? "task" : "agent");
  useEffect(() => {
    if (!taskWasAvailable.current && taskAvailable) setTaskView("task");
    if (taskWasAvailable.current && !taskAvailable && taskView !== "agent") setTaskView("agent");
    taskWasAvailable.current = taskAvailable;
  }, [taskAvailable, taskView]);
  function showAgent() { onChangeView("task"); setTaskView("agent"); }
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const available = taskViews.filter((view) => view === "agent" || taskAvailable);
    const index = available.indexOf(taskView); let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % available.length;
    if (event.key === "ArrowLeft") next = (index - 1 + available.length) % available.length;
    if (event.key === "Home") next = 0; if (event.key === "End") next = available.length - 1;
    if (next === null) return; event.preventDefault(); setTaskView(available[next]);
    document.getElementById(`acp-${available[next]}-tab`)?.focus();
  }
  const renderedActivity = typeof activity === "function" ? activity({ showAgent }) : activity;
  const details: Record<TaskWorkspaceView, string> = {
    agent: pendingPermissionCount > 0 ? `${pendingPermissionCount} permission pending` : "Controls & permissions",
    task: currentPhase ? `Current: ${currentPhase}` : "No active task",
    activity: taskAvailable
      ? `${phaseRunCount} run(s) · ${contextDispatchCount} send(s) · ${reportCount} report(s)`
      : "No active task",
  };
  return <section className="acp-workspace" aria-label="ACP workspace">
    {pendingPermissionCount > 0 && (activeView !== "task" || taskView !== "agent")
      ? <div className="acp-permission-notice" role="alert"><div>
        <strong>Agent is waiting for permission</strong><span>Review the requested action to continue.</span></div>
        <button type="button" onClick={showAgent}>Review permission</button></div> : null}
    <div className="acp-workspace-body">
      <div className="acp-workspace-main">
        {activeView === "knowledge" ? <div className="acp-workspace-panel">{knowledge}</div> : <>
          <div className="acp-workspace-tabs" role="tablist" aria-label="Task workspace views">
            {taskViews.map((view) => <button key={view} id={`acp-${view}-tab`} type="button" role="tab"
              aria-selected={taskView === view} tabIndex={taskView === view ? 0 : -1}
              disabled={view !== "agent" && !taskAvailable}
              onClick={() => setTaskView(view)} onKeyDown={handleTabKey}>
              <strong>{view === "agent" ? "Agent" : view === "task" ? "Task" : "Activity"}</strong>
              <small>{details[view]}</small></button>)}</div>
          <div className="acp-task-workspace-content">
            {taskView === "agent" ? <div className="acp-workspace-panel acp-agent-view">{agent}</div> : null}
            {taskView === "task" && task ? <div className="acp-workspace-panel">{task}</div> : null}
            {taskView === "activity" && renderedActivity ? <div
              className="acp-workspace-panel acp-activity-view">{renderedActivity}</div> : null}
          </div>
        </>}
      </div>
      <aside className="acp-output-rail" aria-label="Persistent session output">{output}</aside>
    </div>
  </section>;
}
