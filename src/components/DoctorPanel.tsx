import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { AgentInfo } from "../lib/types";

interface DoctorPanelProps {
  agents: AgentInfo[];
}

export function DoctorPanel({ agents }: DoctorPanelProps) {
  return (
    <section className="status-block" aria-label="Agent doctor">
      <div className="section-heading">
        <h2>Doctor</h2>
      </div>
      <div className="doctor-list">
        {agents.map((agent) => (
          <article className="doctor-item" key={agent.id}>
            {agent.detection.installed ? (
              <CheckCircle2 size={15} aria-hidden="true" />
            ) : (
              <AlertTriangle size={15} aria-hidden="true" />
            )}
            <div>
              <strong>{agent.display_name}</strong>
              <span>
                {agent.detection.installed
                  ? agent.detection.version ?? "installed"
                  : "missing"}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
