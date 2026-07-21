import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";

type WorkspaceView = "agent" | "task" | "activity";

interface Props {
  agent: ReactNode;
  output: ReactNode;
  task: ReactNode | null;
  activity: ReactNode | null;
  currentPhase: string | null;
  phaseRunCount: number;
  contextDispatchCount: number;
}

const views: WorkspaceView[] = ["agent", "task", "activity"];

export function AcpWorkspaceViews({ agent, output, task, activity, currentPhase,
  phaseRunCount, contextDispatchCount }: Props) {
  const [activeView, setActiveView] = useState<WorkspaceView>("agent");
  const taskAvailable = task !== null;
  const activityAvailable = activity !== null;

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const availableViews = views.filter((view) => view === "agent" ||
      (view === "task" && taskAvailable) || (view === "activity" && activityAvailable));
    const currentIndex = availableViews.indexOf(activeView);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % availableViews.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + availableViews.length) % availableViews.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = availableViews.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextView = availableViews[nextIndex];
    setActiveView(nextView);
    document.getElementById(`acp-${nextView}-tab`)?.focus();
  }

  useEffect(() => {
    if ((!taskAvailable && activeView === "task") ||
      (!activityAvailable && activeView === "activity")) {
      setActiveView("agent");
    }
  }, [activeView, activityAvailable, taskAvailable]);

  const labels: Record<WorkspaceView, { title: string; detail: string }> = {
    agent: { title: "Agent", detail: "Controls & output" },
    task: { title: "Task", detail: currentPhase ? `Current: ${currentPhase}` : "No active task" },
    activity: {
      title: "Activity",
      detail: taskAvailable ? `${phaseRunCount} run(s) · ${contextDispatchCount} send(s)` : "No active task",
    },
  };

  return <section className="acp-workspace" aria-label="ACP workspace">
    <div className="acp-workspace-tabs" role="tablist" aria-label="ACP workspace views">
      {views.map((view) => {
        const disabled = (view === "task" && !taskAvailable) ||
          (view === "activity" && !activityAvailable);
        return <button key={view} id={`acp-${view}-tab`} type="button" role="tab"
          aria-controls={`acp-${view}-panel`} aria-selected={activeView === view}
          tabIndex={activeView === view ? 0 : -1} disabled={disabled}
          onClick={() => setActiveView(view)} onKeyDown={handleTabKey}>
          <strong>{labels[view].title}</strong><small>{labels[view].detail}</small>
        </button>;
      })}
    </div>

    {activeView === "agent" ? <div id="acp-agent-panel" className="acp-workspace-panel acp-agent-view"
      role="tabpanel" aria-labelledby="acp-agent-tab">{agent}{output}</div> : null}
    {activeView === "task" && task ? <div id="acp-task-panel" className="acp-workspace-panel"
      role="tabpanel" aria-labelledby="acp-task-tab">{task}</div> : null}
    {activeView === "activity" && activity ? <div id="acp-activity-panel"
      className="acp-workspace-panel acp-activity-view" role="tabpanel"
      aria-labelledby="acp-activity-tab">{activity}</div> : null}
  </section>;
}
