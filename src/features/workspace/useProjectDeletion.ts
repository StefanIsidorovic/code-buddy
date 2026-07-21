import { useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { ProjectInfo } from "../../types/domain";

interface Options {
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  stopAcpSessions: () => Promise<number>;
  removeFromCatalog: (projectId: string) => void;
  removeEvidence: (projectId: string) => void;
  notifySuccess: (message: string) => void;
}

export function useProjectDeletion({
  busy,
  onBusyChange,
  stopAcpSessions,
  removeFromCatalog,
  removeEvidence,
  notifySuccess,
}: Options) {
  const [candidate, setCandidate] = useState<ProjectInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open(project: ProjectInfo) {
    setCandidate(project);
    setError(null);
  }

  function close() {
    if (busy) return;
    setCandidate(null);
    setError(null);
  }

  async function confirm() {
    if (!candidate) return;
    const projectId = candidate.id;
    const projectName = candidate.name;
    onBusyChange(true);
    setError(null);
    try {
      const stoppedCount = await stopAcpSessions();
      await invokeCommand("delete_project", { projectId });
      removeFromCatalog(projectId);
      removeEvidence(projectId);
      setCandidate(null);
      notifySuccess(deletionMessage(projectName, stoppedCount));
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      onBusyChange(false);
    }
  }

  return { candidate, error, open, close, confirm };
}

function deletionMessage(projectName: string, stoppedCount: number) {
  if (stoppedCount === 0) return `${projectName} deleted.`;
  return `${projectName} deleted. Stopped ${stoppedCount} ACP session${stoppedCount === 1 ? "" : "s"}.`;
}
