import { useState } from "react";
import type { WorkspaceView } from "./WorkspaceNavigation";

export function useWorkspaceNavigation() {
  const [activeView, setActiveView] = useState<WorkspaceView>("task");
  return { activeView, changeView: setActiveView };
}
