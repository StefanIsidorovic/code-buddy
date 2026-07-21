import type { RefObject } from "react";
import { StateNotice } from "../../components/ui/StateNotice";
import { acpEventLabel, shortId, transcriptEventLabel } from "../../lib/presentation";
import type { AcpSessionEvent, RuntimeMode, TranscriptSessionInfo } from "../../types/domain";

export type SessionOutputPanelProps = {
  events: AcpSessionEvent[];
  eventsListRef: RefObject<HTMLUListElement | null>;
  openedTranscript: TranscriptSessionInfo | null;
  output: string;
  runtimeMode: RuntimeMode;
  showWaiting: boolean;
  terminalElementRef: RefObject<HTMLDivElement | null>;
  onFocusTerminal: () => void;
  onShowLiveEvents: () => void;
};

export function SessionOutputPanel({
  events,
  eventsListRef,
  openedTranscript,
  output,
  runtimeMode,
  showWaiting,
  terminalElementRef,
  onFocusTerminal,
  onShowLiveEvents,
}: SessionOutputPanelProps) {
  return (
    <section className="output-panel" aria-labelledby="output-title">
      <div className="section-heading">
        <p className="eyebrow">Output</p>
        <h2 id="output-title">Session Output</h2>
      </div>
      <div className="output-body">
        {runtimeMode === "pty" ? (
          <section className="terminal-output" aria-labelledby="terminal-output-title">
            <h3 id="terminal-output-title">PTY Stream</h3>
            <div
              className="terminal-frame"
              aria-label="Interactive PTY terminal"
              onClick={onFocusTerminal}
              ref={terminalElementRef}
            />
            <span className="sr-only">{output || "No output yet."}</span>
          </section>
        ) : null}

        {runtimeMode === "acp" ? (
          <section className="acp-events-panel" aria-labelledby="acp-events-title">
            <div className="output-heading">
              <div>
                <h3 id="acp-events-title">{openedTranscript ? "Saved Transcript" : "ACP Events"}</h3>
                {openedTranscript ? (
                  <p>{openedTranscript.title} · {openedTranscript.eventCount} events · {shortId(openedTranscript.id)}</p>
                ) : null}
              </div>
              {openedTranscript ? (
                <button type="button" onClick={onShowLiveEvents}>View Live ACP</button>
              ) : null}
            </div>
            <ul aria-label="ACP events" ref={eventsListRef}>
              {events.length === 0 && !showWaiting ? (
                <StateNotice
                  as="li"
                  kind="empty"
                  title={openedTranscript
                    ? "No saved events in this transcript yet."
                    : "No ACP events yet."}
                  description={openedTranscript
                    ? "This saved session does not contain any recorded transcript events."
                    : "Start an ACP session and send a prompt to see structured events here."}
                />
              ) : (
                <>
                  {events.map((event, index) => (
                    <li data-kind={event.kind} key={`${event.kind}-${index}`}>
                      <strong>{openedTranscript
                        ? transcriptEventLabel(event.kind)
                        : acpEventLabel(event.kind)}</strong>
                      <span>{event.content}</span>
                    </li>
                  ))}
                  {showWaiting ? (
                    <li data-kind="pending" aria-live="polite">
                      <strong>Waiting</strong>
                      <span className="waiting-message">
                        <span className="waiting-dots" aria-hidden="true"><i /><i /><i /></span>
                        Agent is preparing a response
                      </span>
                    </li>
                  ) : null}
                </>
              )}
            </ul>
          </section>
        ) : null}
      </div>
    </section>
  );
}
