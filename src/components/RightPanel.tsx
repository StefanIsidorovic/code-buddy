import { Activity, Settings2 } from "lucide-react";
import { AgentsIndicator } from "./AgentsIndicator";
import { DoctorPanel } from "./DoctorPanel";
import { normalizeMode } from "./TopBar";
import { useAppStore } from "../store/appStore";
import type { AgentEvent } from "../lib/types";

export function RightPanel() {
  const agents = useAppStore((state) => state.agents);
  const projects = useAppStore((state) => state.projects);
  const sessions = useAppStore((state) => state.sessions);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const selectedAgentId = useAppStore((state) => state.selectedAgentId);
  const selectedMode = useAppStore((state) => state.selectedMode);
  const selectedModel = useAppStore((state) => state.selectedModel);
  const chatEvents = useAppStore((state) => state.chatEvents);
  const busy = useAppStore((state) => state.busy);
  const createAgentsMdForSelected = useAppStore(
    (state) => state.createAgentsMdForSelected,
  );

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const activity = activeSession ? chatEvents[activeSession.id] ?? [] : [];

  return (
    <aside className="details-panel" aria-label="Session details">
      <section className="status-block">
        <div className="section-heading">
          <h2>Session</h2>
          <Settings2 size={15} aria-hidden="true" />
        </div>
        {activeSession ? (
          <>
            <AgentsIndicator
              status={activeSession.agents_status}
              path={activeSession.agents_path}
            />
            {activeSession.agents_status === "not_found" ? (
              <button
                className="secondary-action full"
                type="button"
                disabled={busy}
                onClick={() => void createAgentsMdForSelected()}
              >
                Create AGENTS.md
              </button>
            ) : null}
            <dl>
              <div>
                <dt>State</dt>
                <dd>{activeSession.state}</dd>
              </div>
              <div>
                <dt>Agent</dt>
                <dd>{activeSession.agent_name}</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>{normalizeMode(activeSession.mode)}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{activeSession.model ?? "default"}</dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            {selectedProject ? (
              <button
                className="secondary-action full"
                type="button"
                disabled={busy}
                onClick={() => void createAgentsMdForSelected()}
              >
                Create AGENTS.md
              </button>
            ) : null}
            <dl>
              <div>
                <dt>Project</dt>
                <dd>{selectedProject?.name ?? "none"}</dd>
              </div>
              <div>
                <dt>Agent</dt>
                <dd>{selectedAgent?.display_name ?? "none"}</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>{normalizeMode(selectedMode)}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{selectedModel.trim() || "default"}</dd>
              </div>
            </dl>
          </>
        )}
      </section>

      <section className="status-block">
        <div className="section-heading">
          <h2>Activity</h2>
          <Activity size={15} aria-hidden="true" />
        </div>
        <div className="activity-list">
          {activity.length === 0 ? (
            <div className="empty-inline">No activity</div>
          ) : (
            activity.slice(-8).map((event, index) => (
              <article className="activity-item" key={`${event.type}-${index}`}>
                <span>{eventLabel(event.type)}</span>
                <strong>{activityTitle(event)}</strong>
                <p>{activityBody(event)}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <DoctorPanel agents={agents} />
    </aside>
  );
}

function activityTitle(event: AgentEvent): string {
  if (event.type === "tool_call" || event.type === "tool_result") {
    return event.name;
  }
  if (event.type === "notice") {
    return event.level;
  }
  return eventLabel(event.type);
}

function activityBody(event: AgentEvent): string {
  switch (event.type) {
    case "assistant_delta":
    case "assistant_message":
    case "user_message":
    case "notice":
      return event.text;
    case "tool_call":
      return JSON.stringify(event.input);
    case "tool_result":
      return event.output;
    case "completed":
      return event.exit_code === null ? "done" : `exit ${event.exit_code}`;
    case "session_started":
      return event.agent_session_id ?? "started";
    case "raw_output":
      return `${event.bytes.length} bytes`;
  }
}

function eventLabel(type: AgentEvent["type"]): string {
  return type.replace(/_/g, " ");
}
