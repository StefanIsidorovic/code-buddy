import { CheckCircle2, Info, MessageSquare, Wrench } from "lucide-react";
import type { AgentEvent } from "../lib/types";

interface ChatPaneProps {
  events: AgentEvent[];
  hasStructuredEvents: boolean;
}

export function ChatPane({ events, hasStructuredEvents }: ChatPaneProps) {
  if (events.length === 0) {
    return (
      <div className="empty-output" aria-label="Chat events">
        <MessageSquare size={26} aria-hidden="true" />
        <h2>{hasStructuredEvents ? "No events yet" : "Terminal-only session"}</h2>
      </div>
    );
  }

  return (
    <div className="chat-pane" aria-label="Chat events">
      {events.map((event, index) => (
        <article className={`chat-event ${event.type}`} key={`${event.type}-${index}`}>
          <EventIcon event={event} />
          <div>
            <strong>{titleForEvent(event)}</strong>
            <p>{bodyForEvent(event)}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function EventIcon({ event }: { event: AgentEvent }) {
  if (event.type === "tool_call" || event.type === "tool_result") {
    return <Wrench size={16} aria-hidden="true" />;
  }
  if (event.type === "completed") {
    return <CheckCircle2 size={16} aria-hidden="true" />;
  }
  return <Info size={16} aria-hidden="true" />;
}

function titleForEvent(event: AgentEvent): string {
  switch (event.type) {
    case "user_message":
      return "User";
    case "assistant_delta":
    case "assistant_message":
      return "Assistant";
    case "tool_call":
      return `Tool call: ${event.name}`;
    case "tool_result":
      return `Tool result: ${event.name}`;
    case "notice":
      return `Notice: ${event.level}`;
    case "completed":
      return "Completed";
    case "session_started":
      return "Session started";
    case "raw_output":
      return "Raw output";
  }
}

function bodyForEvent(event: AgentEvent): string {
  switch (event.type) {
    case "user_message":
    case "assistant_delta":
    case "assistant_message":
      return event.text;
    case "tool_call":
      return stringifyValue(event.input);
    case "tool_result":
      return event.output;
    case "notice":
      return event.text;
    case "completed":
      return event.exit_code === null ? "No exit code" : `Exit ${event.exit_code}`;
    case "session_started":
      return event.agent_session_id ?? "Local session";
    case "raw_output":
      return `${event.bytes.length} bytes`;
  }
}

function stringifyValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
