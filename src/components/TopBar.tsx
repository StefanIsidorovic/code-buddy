import { Bot, Play, Square } from "lucide-react";
import { useAppStore } from "../store/appStore";
import type { AgentId, RunMode } from "../lib/types";

export function TopBar() {
  const agents = useAppStore((state) => state.agents);
  const sessions = useAppStore((state) => state.sessions);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const selectedAgentId = useAppStore((state) => state.selectedAgentId);
  const selectedMode = useAppStore((state) => state.selectedMode);
  const selectedModel = useAppStore((state) => state.selectedModel);
  const busy = useAppStore((state) => state.busy);
  const setActiveSession = useAppStore((state) => state.setActiveSession);
  const setSelectedAgent = useAppStore((state) => state.setSelectedAgent);
  const setSelectedMode = useAppStore((state) => state.setSelectedMode);
  const setSelectedModel = useAppStore((state) => state.setSelectedModel);
  const startSession = useAppStore((state) => state.startSession);
  const stopActiveSession = useAppStore((state) => state.stopActiveSession);

  const activeAgent = agents.find((agent) => agent.id === selectedAgentId);
  const headlessAvailable = activeAgent?.capabilities.headless ?? false;
  const stopDisabled =
    busy ||
    !sessions.some(
      (session) =>
        session.id === activeSessionId &&
        !["exited", "killed", "errored"].includes(session.state),
    );

  return (
    <header className="topbar">
      <div className="tab-strip" aria-label="Sessions">
        {sessions.length === 0 ? (
          <span className="empty-tab">No sessions</span>
        ) : (
          sessions.map((session) => (
            <button
              className={`session-tab ${session.id === activeSessionId ? "active" : ""}`}
              type="button"
              key={session.id}
              onClick={() => setActiveSession(session.id)}
            >
              <span className="agent-badge">{session.agent_name}</span>
              <span>{session.project_name}</span>
            </button>
          ))
        )}
      </div>

      <div className="run-controls">
        <label className="select-wrap">
          <Bot size={15} aria-hidden="true" />
          <select
            aria-label="Agent"
            value={selectedAgentId ?? ""}
            onChange={(event) => setSelectedAgent(event.target.value as AgentId)}
          >
            {agents.length === 0 ? (
              <option value="">No agents</option>
            ) : (
              agents.map((agent) => (
                <option value={agent.id} key={agent.id}>
                  {agent.display_name}
                </option>
              ))
            )}
          </select>
        </label>

        <div className="segmented" aria-label="Run mode">
          <button
            className={selectedMode === "interactive" ? "active" : ""}
            type="button"
            onClick={() => setSelectedMode("interactive")}
          >
            PTY
          </button>
          <button
            className={selectedMode === "headless" ? "active" : ""}
            type="button"
            disabled={!headlessAvailable}
            onClick={() => setSelectedMode("headless")}
          >
            JSON
          </button>
        </div>

        <input
          className="model-input"
          aria-label="Model"
          value={selectedModel}
          onChange={(event) => setSelectedModel(event.target.value)}
          placeholder="Default model"
        />

        <button
          className="secondary-action icon-action"
          type="button"
          disabled={stopDisabled}
          onClick={() => void stopActiveSession(false)}
          title="Stop"
        >
          <Square size={15} aria-hidden="true" />
          <span>Stop</span>
        </button>
        <button
          className="primary-action icon-action"
          type="button"
          disabled={busy || agents.length === 0}
          onClick={() => void startSession()}
        >
          <Play size={15} aria-hidden="true" />
          <span>Start</span>
        </button>
      </div>
    </header>
  );
}

export function normalizeMode(mode: RunMode): string {
  return mode === "headless" ? "JSON" : "PTY";
}
