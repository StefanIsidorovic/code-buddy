export type AgentId = "codex" | "kimi" | "claude-code" | "fake";

export type RunMode = "interactive" | "headless";

export type ViewMode = "terminal" | "chat";

export type SessionLifecycle =
  | "idle"
  | "starting"
  | "running"
  | "waiting_for_input"
  | "busy"
  | "exited"
  | "killed"
  | "errored";

export type SessionStateWire =
  | "idle"
  | "starting"
  | "running"
  | "waiting_for_input"
  | "busy"
  | "killed"
  | { exited: { code: number | null } }
  | { errored: { message: string } };

export type AgentsFileStatus = "active" | "not_found" | "injected";

export interface Detection {
  installed: boolean;
  binary_path: string | null;
  version: string | null;
}

export interface Capabilities {
  interactive: boolean;
  headless: boolean;
  structured_events: boolean;
  resume_session: boolean;
  selectable_model: boolean;
  streaming: boolean;
  reads_agents_md_natively: boolean;
}

export interface AgentInfo {
  id: AgentId;
  display_name: string;
  detection: Detection;
  capabilities: Capabilities;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  default_agent: AgentId | null;
  settings_json: string;
  created_at: string;
}

export interface StartSessionRequest {
  agent_id: AgentId;
  cwd: string;
  mode: RunMode;
  project_id: string | null;
  binary_path: string | null;
  model: string | null;
  prompt: string | null;
  extra_args: string[];
  extra_env: Record<string, string>;
}

export interface AgentsFileEntry {
  path: string;
  relative_dir: string;
  priority: number;
  content: string;
}

export interface AgentsFileResolution {
  status: AgentsFileStatus;
  active_path: string | null;
  files: AgentsFileEntry[];
  combined_content: string | null;
}

export type NoticeLevel = "info" | "warning" | "error";

export type AgentEvent =
  | { type: "session_started"; agent_session_id: string | null }
  | { type: "user_message"; text: string }
  | { type: "assistant_delta"; text: string }
  | { type: "assistant_message"; text: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "tool_result"; name: string; output: string; is_error: boolean }
  | { type: "notice"; level: NoticeLevel; text: string }
  | { type: "completed"; exit_code: number | null }
  | { type: "raw_output"; bytes: number[] };

export interface SessionOutputPayload {
  session_id: string;
  bytes: number[];
}

export interface SessionEventPayload {
  session_id: string;
  event: AgentEvent;
}

export interface SessionStatePayload {
  session_id: string;
  state: SessionStateWire;
  exit_code: number | null;
}

export interface RuntimeSession {
  id: string;
  project_id: string;
  project_name: string;
  agent_id: AgentId;
  agent_name: string;
  title: string;
  state: SessionLifecycle;
  mode: RunMode;
  model: string | null;
  exit_code: number | null;
  error: string | null;
  agents_status: AgentsFileStatus;
  agents_path: string | null;
  structured_events: boolean;
  started_at: string;
}
