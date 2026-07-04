import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { useAppStore } from "./store/appStore";
import type { SessionEventHandlers } from "./lib/api";
import type { AgentInfo, Project } from "./lib/types";

const mocks = vi.hoisted(() => ({
  handlers: [] as SessionEventHandlers[],
  api: {
    listAgents: vi.fn(),
    listProjects: vi.fn(),
    createProject: vi.fn(),
    resolveAgentsMd: vi.fn(),
    createAgentsMd: vi.fn(),
    startSession: vi.fn(),
    writeInput: vi.fn(),
    writeRaw: vi.fn(),
    resizeSession: vi.fn(),
    stopSession: vi.fn(),
  },
  subscribeToSessionEvents: vi.fn(),
}));

vi.mock("./lib/api", () => ({
  api: mocks.api,
  subscribeToSessionEvents: mocks.subscribeToSessionEvents,
}));

const agents: AgentInfo[] = [
  {
    id: "codex",
    display_name: "Codex",
    detection: {
      installed: true,
      binary_path: "/usr/bin/codex",
      version: "codex 0.128.0",
    },
    capabilities: {
      interactive: true,
      headless: true,
      structured_events: true,
      resume_session: false,
      selectable_model: true,
      streaming: true,
      reads_agents_md_natively: true,
    },
  },
  {
    id: "kimi",
    display_name: "Kimi",
    detection: {
      installed: false,
      binary_path: null,
      version: null,
    },
    capabilities: {
      interactive: true,
      headless: false,
      structured_events: false,
      resume_session: false,
      selectable_model: true,
      streaming: true,
      reads_agents_md_natively: false,
    },
  },
];

const project: Project = {
  id: "project-1",
  name: "code-buddy",
  path: "/tmp/code-buddy",
  default_agent: "codex",
  settings_json: "{}",
  created_at: "2026-07-04T15:00:00Z",
};

describe("App shell", () => {
  beforeEach(() => {
    useAppStore.getState().resetForTest();
    mocks.handlers.length = 0;
    Object.values(mocks.api).forEach((mock) => mock.mockReset());
    mocks.subscribeToSessionEvents.mockReset();
    mocks.subscribeToSessionEvents.mockImplementation(
      async (handlers: SessionEventHandlers) => {
        mocks.handlers.push(handlers);
        return vi.fn();
      },
    );
    mocks.api.listAgents.mockResolvedValue(agents);
    mocks.api.listProjects.mockResolvedValue([project]);
    mocks.api.resolveAgentsMd.mockResolvedValue({
      status: "active",
      active_path: "/tmp/code-buddy/AGENTS.md",
      files: [],
      combined_content: null,
    });
    mocks.api.createAgentsMd.mockResolvedValue({
      status: "active",
      active_path: "/tmp/code-buddy/AGENTS.md",
      files: [],
      combined_content: null,
    });
    mocks.api.startSession.mockResolvedValue("session-1");
    mocks.api.writeInput.mockResolvedValue(undefined);
    mocks.api.writeRaw.mockResolvedValue(undefined);
    mocks.api.resizeSession.mockResolvedValue(undefined);
    mocks.api.stopSession.mockResolvedValue(undefined);
  });

  it("renders projects, doctor status, and workspace controls", async () => {
    render(<App />);

    expect(screen.getByRole("main", { name: "Code Buddy" })).toBeInTheDocument();
    await waitFor(() => expect(mocks.api.listAgents).toHaveBeenCalled());

    expect(screen.getByRole("navigation", { name: "Project sessions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New session/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Session output" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Agent" })).toHaveValue("codex");
    expect(screen.getByText("codex 0.128.0")).toBeInTheDocument();
    expect(screen.getByText("missing")).toBeInTheDocument();
  });

  it("creates a project from the sidebar form", async () => {
    mocks.api.listProjects.mockResolvedValue([]);
    mocks.api.createProject.mockResolvedValue(project);

    render(<App />);
    await waitFor(() => expect(mocks.api.listProjects).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "code-buddy" },
    });
    fireEvent.change(screen.getByLabelText("Project path"), {
      target: { value: "/tmp/code-buddy" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add project/i }));

    await waitFor(() =>
      expect(mocks.api.createProject).toHaveBeenCalledWith(
        "/tmp/code-buddy",
        "code-buddy",
        "codex",
      ),
    );
    expect(await screen.findByRole("button", { name: /code-buddy/i })).toBeInTheDocument();
  });

  it("starts a session, dispatches prompts, and reflects streamed output", async () => {
    render(<App />);
    await waitFor(() => expect(mocks.api.listAgents).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /^Start$/i }));

    await waitFor(() =>
      expect(mocks.api.startSession).toHaveBeenCalledWith({
        agent_id: "codex",
        cwd: "/tmp/code-buddy",
        mode: "interactive",
        project_id: "project-1",
        binary_path: "/usr/bin/codex",
        model: null,
        prompt: null,
        extra_args: [],
        extra_env: {},
      }),
    );
    expect(screen.getByLabelText("Terminal output text")).toHaveTextContent(
      "AGENTS.md: active",
    );

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "summarize the repo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Send$/i }));

    await waitFor(() =>
      expect(mocks.api.writeInput).toHaveBeenCalledWith(
        "session-1",
        "summarize the repo",
      ),
    );

    act(() => {
      mocks.handlers[0]?.onOutput({
        session_id: "session-1",
        bytes: Array.from(new TextEncoder().encode("agent output")),
      });
    });

    expect(screen.getByLabelText("Terminal output text")).toHaveTextContent(
      "agent output",
    );
  });
});
