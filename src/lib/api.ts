import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AgentInfo,
  AgentsFileResolution,
  Project,
  SessionEventPayload,
  SessionOutputPayload,
  SessionStatePayload,
  StartSessionRequest,
} from "./types";

export const SESSION_OUTPUT_EVENT = "session:output";
export const SESSION_EVENT_EVENT = "session:event";
export const SESSION_STATE_EVENT = "session:state";

export const api = {
  listAgents: () => invoke<AgentInfo[]>("list_agents"),
  listProjects: () => invoke<Project[]>("list_projects"),
  createProject: (path: string, name: string, defaultAgent: string | null) =>
    invoke<Project>("create_project", {
      path,
      name,
      defaultAgent,
    }),
  resolveAgentsMd: (projectRoot: string, cwd: string) =>
    invoke<AgentsFileResolution>("resolve_agents_md", {
      projectRoot,
      cwd,
    }),
  createAgentsMd: (projectRoot: string) =>
    invoke<AgentsFileResolution>("create_agents_md", {
      projectRoot,
    }),
  startSession: (request: StartSessionRequest) =>
    invoke<string>("start_session", { request }),
  writeInput: (sessionId: string, text: string) =>
    invoke<void>("write_input", { sessionId, text }),
  writeRaw: (sessionId: string, bytes: number[]) =>
    invoke<void>("write_raw", { sessionId, bytes }),
  resizeSession: (sessionId: string, cols: number, rows: number) =>
    invoke<void>("resize_session", { sessionId, cols, rows }),
  stopSession: (sessionId: string, force = false) =>
    invoke<void>("stop_session", { sessionId, force }),
};

export interface SessionEventHandlers {
  onOutput: (payload: SessionOutputPayload) => void;
  onEvent: (payload: SessionEventPayload) => void;
  onState: (payload: SessionStatePayload) => void;
}

export async function subscribeToSessionEvents(
  handlers: SessionEventHandlers,
): Promise<UnlistenFn> {
  const unlisteners = await Promise.all([
    listen<SessionOutputPayload>(SESSION_OUTPUT_EVENT, (event) => {
      handlers.onOutput(event.payload);
    }),
    listen<SessionEventPayload>(SESSION_EVENT_EVENT, (event) => {
      handlers.onEvent(event.payload);
    }),
    listen<SessionStatePayload>(SESSION_STATE_EVENT, (event) => {
      handlers.onState(event.payload);
    }),
  ]);

  return () => {
    unlisteners.forEach((unlisten) => {
      unlisten();
    });
  };
}
