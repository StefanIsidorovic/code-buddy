import { TerminalSquare, MessageSquare, X } from "lucide-react";
import { useEffect } from "react";
import "./App.css";
import { ChatPane } from "./components/ChatPane";
import { CommandBar } from "./components/CommandBar";
import { RightPanel } from "./components/RightPanel";
import { Sidebar } from "./components/Sidebar";
import { TerminalPane } from "./components/TerminalPane";
import { TopBar } from "./components/TopBar";
import { useAppStore } from "./store/appStore";

function App() {
  const initialize = useAppStore((state) => state.initialize);
  const sessions = useAppStore((state) => state.sessions);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const terminalBuffers = useAppStore((state) => state.terminalBuffers);
  const chatEvents = useAppStore((state) => state.chatEvents);
  const viewMode = useAppStore((state) => state.viewMode);
  const rawInput = useAppStore((state) => state.rawInput);
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const writeRawData = useAppStore((state) => state.writeRawData);
  const resizeActiveSession = useAppStore((state) => state.resizeActiveSession);
  const clearError = useAppStore((state) => state.clearError);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;
  const terminalOutput = activeSession
    ? terminalBuffers[activeSession.id] ?? ""
    : "";
  const activeEvents = activeSession ? chatEvents[activeSession.id] ?? [] : [];
  const chatAvailable = activeSession?.structured_events ?? false;

  return (
    <main className="app-shell" aria-label="Code Buddy">
      <Sidebar />

      <section className="workspace" aria-label="Session workspace">
        <TopBar />

        {error ? (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button type="button" onClick={clearError} aria-label="Dismiss error">
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="content-grid">
          <section className="main-pane" aria-label="Session output">
            <div className="view-toggle" role="tablist" aria-label="View mode">
              <button
                className={viewMode === "terminal" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={viewMode === "terminal"}
                onClick={() => setViewMode("terminal")}
              >
                <TerminalSquare size={15} aria-hidden="true" />
                <span>Terminal</span>
              </button>
              <button
                className={viewMode === "chat" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={viewMode === "chat"}
                disabled={!activeSession || !chatAvailable}
                onClick={() => setViewMode("chat")}
              >
                <MessageSquare size={15} aria-hidden="true" />
                <span>Chat</span>
              </button>
            </div>

            {loading ? (
              <div className="empty-output" aria-live="polite">
                <h2>Loading workspace</h2>
              </div>
            ) : viewMode === "chat" ? (
              <ChatPane
                events={activeEvents}
                hasStructuredEvents={activeSession?.structured_events ?? false}
              />
            ) : (
              <TerminalPane
                session={activeSession}
                output={terminalOutput}
                rawInput={rawInput}
                onRawData={(text) => void writeRawData(text)}
                onResize={(cols, rows) => void resizeActiveSession(cols, rows)}
              />
            )}

            <CommandBar />
          </section>

          <RightPanel />
        </div>
      </section>
    </main>
  );
}

export default App;
