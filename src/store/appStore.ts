import { create } from "zustand";
import { api, subscribeToSessionEvents } from "../lib/api";
import type {
  AgentEvent,
  AgentId,
  AgentInfo,
  AgentsFileResolution,
  AgentsFileStatus,
  Project,
  RunMode,
  RuntimeSession,
  SessionLifecycle,
  SessionStatePayload,
  ViewMode,
} from "../lib/types";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

interface AppData {
  agents: AgentInfo[];
  projects: Project[];
  sessions: RuntimeSession[];
  terminalBuffers: Record<string, string>;
  chatEvents: Record<string, AgentEvent[]>;
  activeSessionId: string | null;
  selectedProjectId: string | null;
  selectedAgentId: AgentId | null;
  selectedMode: RunMode;
  selectedModel: string;
  viewMode: ViewMode;
  promptText: string;
  rawInput: boolean;
  projectName: string;
  projectPath: string;
  loading: boolean;
  busy: boolean;
  initialized: boolean;
  error: string | null;
  eventUnsubscribe: (() => void) | null;
}

interface AppActions {
  initialize: () => Promise<void>;
  createProject: () => Promise<void>;
  createAgentsMdForSelected: () => Promise<void>;
  startSession: () => Promise<void>;
  stopActiveSession: (force?: boolean) => Promise<void>;
  sendPrompt: () => Promise<void>;
  writeRawData: (text: string) => Promise<void>;
  resizeActiveSession: (cols: number, rows: number) => Promise<void>;
  setActiveSession: (sessionId: string) => void;
  setSelectedProject: (projectId: string) => void;
  setSelectedAgent: (agentId: AgentId) => void;
  setSelectedMode: (mode: RunMode) => void;
  setSelectedModel: (model: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setPromptText: (text: string) => void;
  setRawInput: (enabled: boolean) => void;
  setProjectName: (name: string) => void;
  setProjectPath: (path: string) => void;
  clearError: () => void;
  resetForTest: () => void;
}

export type AppStore = AppData & AppActions;

const baseState = (): AppData => ({
  agents: [],
  projects: [],
  sessions: [],
  terminalBuffers: {},
  chatEvents: {},
  activeSessionId: null,
  selectedProjectId: null,
  selectedAgentId: null,
  selectedMode: "interactive",
  selectedModel: "",
  viewMode: "terminal",
  promptText: "",
  rawInput: false,
  projectName: "",
  projectPath: "",
  loading: false,
  busy: false,
  initialized: false,
  error: null,
  eventUnsubscribe: null,
});

export const useAppStore = create<AppStore>((set, get) => ({
  ...baseState(),

  initialize: async () => {
    const current = get();
    if (current.initialized || current.loading) {
      return;
    }

    set({ loading: true, error: null });

    let eventUnsubscribe: (() => void) | null = null;
    try {
      eventUnsubscribe = await subscribeToSessionEvents({
        onOutput: (payload) => {
          const text = decoder.decode(new Uint8Array(payload.bytes));
          set((state) => ({
            terminalBuffers: {
              ...state.terminalBuffers,
              [payload.session_id]: `${state.terminalBuffers[payload.session_id] ?? ""}${text}`,
            },
          }));
        },
        onEvent: (payload) => {
          set((state) => ({
            chatEvents: {
              ...state.chatEvents,
              [payload.session_id]: [
                ...(state.chatEvents[payload.session_id] ?? []),
                payload.event,
              ],
            },
          }));
        },
        onState: (payload) => {
          const normalized = normalizeState(payload);
          set((state) => ({
            sessions: state.sessions.map((session) =>
              session.id === payload.session_id
                ? {
                    ...session,
                    state: normalized.state,
                    exit_code: normalized.exitCode,
                    error: normalized.error,
                  }
                : session,
            ),
          }));
        },
      });
    } catch {
      eventUnsubscribe = null;
    }

    try {
      const [agents, projects] = await Promise.all([
        api.listAgents(),
        api.listProjects(),
      ]);
      const selectedAgentId = pickInitialAgent(agents);
      const selectedProjectId = projects[0]?.id ?? null;

      set({
        agents,
        projects,
        selectedAgentId,
        selectedProjectId,
        loading: false,
        initialized: true,
        eventUnsubscribe,
      });
    } catch (error) {
      set({
        loading: false,
        initialized: true,
        eventUnsubscribe,
        error: `Backend unavailable: ${errorMessage(error)}`,
      });
    }
  },

  createProject: async () => {
    const { projectName, projectPath, selectedAgentId } = get();
    const path = projectPath.trim();
    if (!path) {
      set({ error: "Project path is required." });
      return;
    }

    set({ busy: true, error: null });
    try {
      const project = await api.createProject(
        path,
        projectName.trim() || basename(path),
        selectedAgentId,
      );
      set((state) => ({
        projects: [...state.projects, project],
        selectedProjectId: project.id,
        projectName: "",
        projectPath: "",
        busy: false,
      }));
    } catch (error) {
      set({ busy: false, error: errorMessage(error) });
    }
  },

  createAgentsMdForSelected: async () => {
    const state = get();
    const session = activeSession(state);
    const projectId = session?.project_id ?? state.selectedProjectId;
    const project = state.projects.find((candidate) => candidate.id === projectId);
    if (!project) {
      set({ error: "Select a project first." });
      return;
    }

    set({ busy: true, error: null });
    try {
      const resolution = await api.createAgentsMd(project.path);
      set((current) => ({
        busy: false,
        sessions: current.sessions.map((candidate) =>
          candidate.project_id === project.id
            ? {
                ...candidate,
                agents_status: resolution.status,
                agents_path: resolution.active_path,
              }
            : candidate,
        ),
      }));
    } catch (error) {
      set({ busy: false, error: errorMessage(error) });
    }
  },

  startSession: async () => {
    const state = get();
    const project = state.projects.find(
      (candidate) => candidate.id === state.selectedProjectId,
    );
    const agent = state.agents.find(
      (candidate) => candidate.id === state.selectedAgentId,
    );

    if (!project) {
      set({ error: "Create or select a project first." });
      return;
    }
    if (!agent) {
      set({ error: "Select an agent first." });
      return;
    }
    if (!agent.detection.installed) {
      set({ error: `${agent.display_name} is not installed.` });
      return;
    }

    set({ busy: true, error: null });
    try {
      const agentsFile = await resolveAgentsForProject(project);
      const sessionId = await api.startSession({
        agent_id: agent.id,
        cwd: project.path,
        mode: state.selectedMode,
        project_id: project.id,
        binary_path: agent.detection.binary_path,
        model: state.selectedModel.trim() || null,
        prompt: null,
        extra_args: [],
        extra_env: {},
      });
      const session: RuntimeSession = {
        id: sessionId,
        project_id: project.id,
        project_name: project.name,
        agent_id: agent.id,
        agent_name: agent.display_name,
        title: `${agent.display_name} - ${project.name}`,
        state: "starting",
        mode: state.selectedMode,
        model: state.selectedModel.trim() || null,
        exit_code: null,
        error: null,
        agents_status: agentsFile.status,
        agents_path: agentsFile.active_path,
        structured_events: agent.capabilities.structured_events,
        started_at: new Date().toISOString(),
      };
      const intro = [
        `Starting ${agent.display_name} in ${project.path}`,
        `AGENTS.md: ${agentsStatusLabel(agentsFile.status)}`,
        "",
      ].join("\r\n");

      set((current) => ({
        sessions: [...current.sessions, session],
        activeSessionId: sessionId,
        viewMode: "terminal",
        terminalBuffers: {
          ...current.terminalBuffers,
          [sessionId]: intro,
        },
        chatEvents: {
          ...current.chatEvents,
          [sessionId]: [],
        },
        busy: false,
      }));
    } catch (error) {
      set({ busy: false, error: errorMessage(error) });
    }
  },

  stopActiveSession: async (force = false) => {
    const session = activeSession(get());
    if (!session) {
      return;
    }

    set({ busy: true, error: null });
    try {
      await api.stopSession(session.id, force);
      set({ busy: false });
    } catch (error) {
      set({ busy: false, error: errorMessage(error) });
    }
  },

  sendPrompt: async () => {
    const state = get();
    const session = activeSession(state);
    const text = state.promptText.trim();
    if (!session || !text) {
      return;
    }

    set({ busy: true, error: null });
    try {
      if (state.rawInput) {
        await api.writeRaw(session.id, Array.from(encoder.encode(`${text}\n`)));
      } else {
        await api.writeInput(session.id, text);
      }
      set((current) => ({
        promptText: "",
        busy: false,
        chatEvents: {
          ...current.chatEvents,
          [session.id]: [
            ...(current.chatEvents[session.id] ?? []),
            { type: "user_message", text },
          ],
        },
      }));
    } catch (error) {
      set({ busy: false, error: errorMessage(error) });
    }
  },

  writeRawData: async (text: string) => {
    const state = get();
    const session = activeSession(state);
    if (!session || !state.rawInput) {
      return;
    }

    try {
      await api.writeRaw(session.id, Array.from(encoder.encode(text)));
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },

  resizeActiveSession: async (cols: number, rows: number) => {
    const session = activeSession(get());
    if (!session || cols <= 0 || rows <= 0) {
      return;
    }

    try {
      await api.resizeSession(session.id, cols, rows);
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId });
  },
  setSelectedProject: (projectId) => {
    set({ selectedProjectId: projectId });
  },
  setSelectedAgent: (agentId) => {
    const state = get();
    const agent = state.agents.find((candidate) => candidate.id === agentId);
    set({
      selectedAgentId: agentId,
      selectedMode:
        state.selectedMode === "headless" && !agent?.capabilities.headless
          ? "interactive"
          : state.selectedMode,
    });
  },
  setSelectedMode: (mode) => {
    if (mode === "headless") {
      const agent = get().agents.find(
        (candidate) => candidate.id === get().selectedAgentId,
      );
      if (!agent?.capabilities.headless) {
        return;
      }
    }
    set({ selectedMode: mode });
  },
  setSelectedModel: (model) => {
    set({ selectedModel: model });
  },
  setViewMode: (mode) => {
    set({ viewMode: mode });
  },
  setPromptText: (text) => {
    set({ promptText: text });
  },
  setRawInput: (enabled) => {
    set({ rawInput: enabled });
  },
  setProjectName: (name) => {
    set({ projectName: name });
  },
  setProjectPath: (path) => {
    set({ projectPath: path });
  },
  clearError: () => {
    set({ error: null });
  },
  resetForTest: () => {
    get().eventUnsubscribe?.();
    set(baseState());
  },
}));

function activeSession(state: AppData): RuntimeSession | null {
  return (
    state.sessions.find((session) => session.id === state.activeSessionId) ?? null
  );
}

function normalizeState(payload: SessionStatePayload): {
  state: SessionLifecycle;
  exitCode: number | null;
  error: string | null;
} {
  const wire = payload.state;
  if (typeof wire === "string") {
    return {
      state: wire,
      exitCode: payload.exit_code,
      error: null,
    };
  }
  if ("exited" in wire) {
    return {
      state: "exited",
      exitCode: wire.exited.code,
      error: null,
    };
  }
  return {
    state: "errored",
    exitCode: null,
    error: wire.errored.message,
  };
}

function pickInitialAgent(agents: AgentInfo[]): AgentId | null {
  const installed = agents.find((agent) => agent.detection.installed);
  return installed?.id ?? agents[0]?.id ?? null;
}

async function resolveAgentsForProject(
  project: Project,
): Promise<AgentsFileResolution> {
  try {
    return await api.resolveAgentsMd(project.path, project.path);
  } catch {
    return {
      status: "not_found",
      active_path: null,
      files: [],
      combined_content: null,
    };
  }
}

function basename(path: string): string {
  const cleaned = path.replace(/\/+$/, "");
  const parts = cleaned.split("/").filter(Boolean);
  return parts[parts.length - 1] || "Project";
}

function agentsStatusLabel(status: AgentsFileStatus): string {
  if (status === "not_found") {
    return "not found";
  }
  return status;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
}
