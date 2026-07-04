import { FileText } from "lucide-react";
import type { AgentsFileStatus } from "../lib/types";

interface AgentsIndicatorProps {
  status: AgentsFileStatus;
  path: string | null;
}

export function AgentsIndicator({ status, path }: AgentsIndicatorProps) {
  return (
    <span className={`agents-indicator ${status}`} title={path ?? undefined}>
      <FileText size={14} aria-hidden="true" />
      <span>AGENTS.md: {labelForStatus(status)}</span>
    </span>
  );
}

function labelForStatus(status: AgentsFileStatus): string {
  if (status === "not_found") {
    return "not found";
  }
  return status;
}
