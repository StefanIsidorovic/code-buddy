import type { AcpEventKind } from "../types/domain";

export type AcpEvent = { kind: AcpEventKind; content: string };
export type KnowledgeItem = { title: string; body: string; kind: string; scope: string };
export type TranscriptSession = {
  id: string; projectId: string | null; runtime: string; source: string; title: string;
};

const eventKinds = new Set<string>([
  "agent_message", "user_message", "plan", "tool_call", "usage", "notice", "error",
]);

export function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

export function formatPromptWithKnowledge(items: KnowledgeItem[], prompt: string) {
  if (items.length === 0) return prompt;
  const context = items
    .map((item, index) => `${index + 1}. ${item.title} (${item.kind}, ${item.scope})\n${item.body}`)
    .join("\n\n");
  return `Attached session knowledge:\n${context}\n\nUser prompt:\n${prompt}`;
}

export function formatPromptWithTaskContext(context: string, prompt: string) {
  const selectedContext = context.trim();
  if (!selectedContext) return prompt;
  return `Selected task context:\n${selectedContext}\n\nUser prompt:\n${prompt}`;
}

export function shortId(id: string) {
  return id.slice(0, 8);
}

export function formatTimestamp(timestamp: number) {
  return new Date(timestamp * 1_000).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function filterTranscriptSessions<T extends TranscriptSession>(sessions: T[], filter: string) {
  const query = filter.trim().toLowerCase();
  if (!query) return sessions;
  return sessions.filter((session) =>
    [session.title, session.source, session.runtime, session.id, session.projectId ?? "", shortId(session.id)]
      .join(" ").toLowerCase().includes(query),
  );
}

export function joinAcpText(left: string, right: string) {
  if (!left.trim()) return right;
  if (!right.trim()) return left;
  if (left.endsWith("\n") || right.startsWith("\n")) return `${left}${right}`;
  return `${left} ${right}`;
}

function coalesceEvents<T extends AcpEvent>(events: T[]) {
  const coalesced: T[] = [];
  for (const event of events) {
    const previous = coalesced[coalesced.length - 1];
    if (previous && previous.kind === event.kind && (event.kind === "agent_message" || event.kind === "plan")) {
      previous.content = joinAcpText(previous.content, event.content);
    } else {
      coalesced.push({ ...event });
    }
  }
  return coalesced;
}

export const coalesceAcpEvents = coalesceEvents;
export const coalesceTranscriptEvents = coalesceEvents;

export function transcriptEventToAcpEvent(event: { kind: string; content: string }): AcpEvent {
  return { kind: isAcpEventKind(event.kind) ? event.kind : "notice", content: event.content };
}

export function isAcpEventKind(kind: string): kind is AcpEventKind {
  return eventKinds.has(kind);
}

export function formatCommand(command: string[]) {
  return command.map((part) => (part.includes(" ") ? JSON.stringify(part) : part)).join(" ");
}

export function acpCandidateStatusLabel(status: string) {
  if (status === "ready") return "Ready";
  if (status === "installable") return "Installable";
  if (status === "missing_runner") return "Missing runner";
  return "Missing binary";
}

export function capabilityLabel(status: string) {
  if (status === "supported") return "Supported";
  if (status === "unsupported") return "Unsupported";
  return "Unknown";
}

export function doctorStatusLabel(status: string) {
  if (status === "installed") return "Installed";
  if (status === "missing") return "Missing";
  return "Error";
}

export function doctorDetail(report: { status: string; version: string | null; path: string | null;
  error: string | null; installHint: string }) {
  if (report.status === "installed") return report.version ?? report.path ?? "Ready";
  if (report.status === "missing") return report.installHint;
  return report.error ?? report.installHint;
}

export function transportDetail(transports: { pty: string; acpStdio: string }) {
  return `PTY: ${capabilityLabel(transports.pty)} · ACP: ${capabilityLabel(transports.acpStdio)}`;
}

export function formatModelTier(tier: string) {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function modelCapabilityBadges(profile: { capabilities: {
  structuredOutput: string; reasoningControl: string; backgroundMode: string;
  api: string; cli: string; acp: string;
} }) {
  return [
    { label: "structured", status: profile.capabilities.structuredOutput },
    { label: "reasoning", status: profile.capabilities.reasoningControl },
    { label: "background", status: profile.capabilities.backgroundMode },
    { label: "api", status: profile.capabilities.api },
    { label: "cli", status: profile.capabilities.cli },
    { label: "acp", status: profile.capabilities.acp },
  ];
}

export function acpEventLabel(kind: AcpEventKind) {
  return ({ agent_message: "Agent", user_message: "User", tool_call: "Tool", plan: "Plan",
    notice: "Notice", usage: "Usage", error: "Error" } as const)[kind];
}

export function transcriptEventLabel(kind: AcpEventKind) {
  if (kind === "user_message") return "Question";
  if (kind === "agent_message") return "Answer";
  return acpEventLabel(kind);
}

export function folderNameFromPath(path: string) {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? "Project";
}

export function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

export function guardrailKindClassName(kind: string) {
  const normalized = kind.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `guardrail-kind guardrail-kind-${normalized}`;
}

export function guardrailKindLabel(kind: string) {
  const labels: Record<string, string> = {
    fragile: "Fragile",
    do_not_touch: "Do not touch",
    requires_review: "Needs review",
    agent_rule: "Agent rule",
  };
  return labels[kind] ?? kind.replace(/[_-]+/g, " ");
}

export function markdownCategoryClassName(category: string) {
  const normalized = category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `markdown-category markdown-category-${normalized}`;
}

export function formatMarkdownCategory(category: string) {
  return category.replace(/[_-]+/g, " ");
}
