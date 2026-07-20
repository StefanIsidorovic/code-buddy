import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App, { boundToastMessages, StateNotice } from "./App";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

let onTerminalData: ((text: string) => void) | undefined;
const scrollToMock = vi.fn();

vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    cols: 92,
    dispose: vi.fn(),
    focus: vi.fn(),
    loadAddon: vi.fn(),
    onData: vi.fn((handler) => {
      onTerminalData = handler;
      return { dispose: vi.fn() };
    }),
    open: vi.fn(),
    rows: 18,
    reset: vi.fn(),
    write: vi.fn(),
    writeln: vi.fn(),
  })),
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
  })),
}));

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollToMock,
  });
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn().mockImplementation(() => ({
      disconnect: vi.fn(),
      observe: vi.fn(),
    })),
  );
});

beforeEach(() => {
  onTerminalData = undefined;
  scrollToMock.mockClear();
  vi.mocked(open).mockReset();
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation((command) => {
    if (command === "list_projects") {
      return Promise.resolve(defaultProjects());
    }

    if (command === "list_project_repositories") {
      return Promise.resolve(defaultProjectRepositories());
    }

    if (command === "list_project_initializations") {
      return Promise.resolve([]);
    }

    if (command === "list_project_initialization_facts") {
      return Promise.resolve([]);
    }

    if (command === "list_project_initialization_markdown_findings") {
      return Promise.resolve([]);
    }

    if (command === "list_project_initialization_guardrails") {
      return Promise.resolve([]);
    }

    if (command === "list_project_initialization_summary") {
      return Promise.resolve(null);
    }

    if (command === "list_model_catalog") {
      return Promise.resolve(defaultModelCatalog());
    }

    if (command === "list_transcript_sessions") {
      return Promise.resolve(defaultTranscriptSessions());
    }

    if (command === "list_project_tasks") {
      return Promise.resolve([]);
    }

    if (command === "create_transcript_session") {
      return Promise.resolve(defaultTranscriptSession());
    }

    if (command === "append_transcript_events") {
      return Promise.resolve([]);
    }

    if (command === "list_transcript_events") {
      return Promise.resolve([]);
    }

    if (command === "list_knowledge_items") {
      return Promise.resolve([]);
    }

    if (command === "create_knowledge_item") {
      return Promise.resolve(defaultKnowledgeItem());
    }

    if (command === "attach_knowledge_to_transcript_session") {
      return Promise.resolve([defaultKnowledgeItem()]);
    }

    if (command === "list_attached_knowledge") {
      return Promise.resolve([]);
    }

    if (command === "list_agent_doctor_reports") {
      return Promise.resolve(defaultDoctorReports());
    }

    if (command === "list_acp_registry_candidates") {
      return Promise.resolve(defaultAcpRegistryCandidates());
    }

    if (command === "drain_session_output") {
      return Promise.resolve("");
    }

    if (command === "drain_acp_events") {
      return Promise.resolve([]);
    }

    return Promise.resolve(undefined);
  });
});

async function flushAsyncState() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function getSidebarSection(name: string) {
  const summaryText = screen
    .getAllByText(name)
    .find((element) => element.closest("summary"));
  const details = summaryText?.closest("details");
  if (!details) {
    throw new Error(`Sidebar section not found: ${name}`);
  }

  return details;
}

function openSidebarSection(name: string) {
  const summary = getSidebarSection(name).querySelector("summary");
  if (!summary) {
    throw new Error(`Sidebar summary not found: ${name}`);
  }

  fireEvent.click(summary);
}

function openWorkspacePicker() {
  fireEvent.click(screen.getByRole("button", { name: /Current workspace/i }));
}

function openRepositoryPicker() {
  fireEvent.click(screen.getByRole("button", { name: /Current repository/i }));
}

function findCurrentRepository(name: string) {
  return screen.findByRole("button", { name: new RegExp(`Current repository.*${name}`, "i") });
}

describe("PTY test panel", () => {
  it("keeps only the three newest toast messages", () => {
    const messages = ["one", "two", "three", "four"].map((text, index) => ({
      id: `toast-${index}`,
      kind: "success" as const,
      text,
    }));

    expect(boundToastMessages([])).toEqual([]);
    expect(boundToastMessages(messages.slice(0, 2))).toEqual(messages.slice(0, 2));
    expect(boundToastMessages(messages).map((toast) => toast.text)).toEqual([
      "two",
      "three",
      "four",
    ]);
  });

  it("distinguishes prerequisite, loading, empty, success, and error notices", () => {
    render(
      <>
        <StateNotice kind="prerequisite" title="Needs setup" description="Complete setup first." />
        <StateNotice kind="loading" title="Loading data" description="Please wait." />
        <StateNotice kind="empty" title="No results" description="Try another query." />
        <StateNotice kind="success" title="Ready" description="The operation completed." />
        <StateNotice kind="error" title="Could not load" description="Try again." />
      </>,
    );

    expect(screen.getByText("Needs setup").closest(".state-notice"))
      .toHaveAttribute("data-kind", "prerequisite");
    expect(screen.getByText("No results").closest(".state-notice"))
      .toHaveAttribute("data-kind", "empty");
    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not loadTry again.");
  });

  it("presents the AIadne product workspace identity", async () => {
    const { container } = render(<App />);
    await flushAsyncState();

    expect(screen.getByRole("main", { name: "AIadne agent workspace" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AIadne" })).toBeInTheDocument();
    const brandMark = container.querySelector<HTMLImageElement>("img.app-mark");
    expect(brandMark?.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
    expect(brandMark).toHaveAttribute("alt", "");
    expect(brandMark).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Repository intelligence, woven together.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Project Initialization" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Build agent-ready context" }))
      .toBeInTheDocument();
    expect(screen.getByText("Choose a workspace to begin")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Session Output" })).toBeInTheDocument();
  });

  it("exposes the sidebar through an accessible mobile navigation toggle", async () => {
    const { container } = render(<App />);
    await flushAsyncState();

    const sidebar = container.querySelector(".intro-panel");
    const contextSummary = container.querySelector(".mobile-context-summary");
    const navigation = container.querySelector("#mobile-sidebar-navigation");
    const openNavigation = screen.getByRole("button", { name: "Open navigation" });

    expect(sidebar).toHaveAttribute("data-mobile-navigation-open", "false");
    expect(openNavigation).toHaveAttribute("aria-expanded", "false");
    expect(openNavigation).toHaveAttribute("aria-controls", "mobile-sidebar-navigation");
    expect(navigation).toBeInTheDocument();
    expect(contextSummary).toHaveTextContent("No workspace/No repository");

    fireEvent.click(openNavigation);

    const closeNavigation = screen.getByRole("button", { name: "Close navigation" });
    expect(sidebar).toHaveAttribute("data-mobile-navigation-open", "true");
    expect(closeNavigation).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(closeNavigation);

    expect(screen.getByRole("button", { name: "Open navigation" }))
      .toHaveAttribute("aria-expanded", "false");
    expect(sidebar).toHaveAttribute("data-mobile-navigation-open", "false");
  });

  it("renders fake and Codex PTY controls with agent doctor status", async () => {
    render(<App />);

    expect(screen.getByRole("main", { name: "AIadne agent workspace" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AIadne" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Current workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Project Initialization" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ACP Controls" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Session Output" })).toBeInTheDocument();
    expect(screen.getByLabelText("Runtime info")).toHaveTextContent("Workspace");
    expect(screen.getByLabelText("Runtime info")).toHaveTextContent("Repository");
    expect(screen.queryByRole("button", { name: "Structured ACP" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start Fake" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Fake ACP" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Selected ACP" })).toBeInTheDocument();
    expect(screen.getByLabelText("ACP session start actions"))
      .toContainElement(screen.getByRole("button", { name: "Start Selected ACP" }));
    expect(screen.queryByLabelText("ACP active session actions")).not.toBeInTheDocument();
    expect(screen.getByLabelText("ACP prompt actions"))
      .toContainElement(screen.getByRole("button", { name: "Send ACP" }));
    expect(screen.getByRole("button", { name: /Current repository/i })).toBeDisabled();
    for (const sidebarSectionName of [
      "ACP Agents",
      "Session History",
      "Knowledge Cards",
      "Terminal PTY",
    ]) {
      expect(getSidebarSection(sidebarSectionName)).toBeInTheDocument();
      expect(getSidebarSection(sidebarSectionName)).not.toHaveAttribute("open");
    }
    await flushAsyncState();
    openWorkspacePicker();
    expect(screen.getByRole("dialog", { name: "Choose Workspace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close workspace picker" }).querySelector("svg"))
      .toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Add Project" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Interactive PTY terminal")).not.toBeInTheDocument();
    openSidebarSection("ACP Agents");
    openSidebarSection("Session History");
    expect(screen.getByLabelText("ACP registry candidates")).toBeInTheDocument();
    expect(screen.getByLabelText("ACP prompt")).toBeInTheDocument();
    expect(await screen.findByText(/No workspaces yet/)).toBeInTheDocument();
    expect(screen.getByText("No ACP events yet.")).toBeInTheDocument();
    expect(screen.getByText("No ACP events yet.").closest(".state-notice"))
      .toHaveAttribute("data-kind", "empty");
    expect(screen.getByText("Choose a workspace to begin").closest(".state-notice"))
      .toHaveAttribute("data-kind", "prerequisite");
    expect(await screen.findByText("No saved sessions yet.")).toBeInTheDocument();
    expect(await screen.findAllByText("npx -y @agentclientprotocol/codex-acp@1.1.0"))
      .not.toHaveLength(0);
    expect(screen.getAllByText("Available through npx; first launch may download the ACP package."))
      .not.toHaveLength(0);
    expect(screen.getByText("Missing binary")).toBeInTheDocument();

    await openPtyFallback();

    expect(screen.getByRole("heading", { name: "PTY Controls" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Fake" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Codex" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Use ACP" })).not.toHaveLength(0);
    expect(await screen.findByLabelText("Interactive PTY terminal")).toBeInTheDocument();
    expect(screen.getByText("No output yet.")).toBeInTheDocument();
    expect(screen.queryByText("No ACP events yet.")).not.toBeInTheDocument();
    expect(await screen.findByText("codex 1.2.3")).toBeInTheDocument();
    expect(screen.getByText("PTY: Supported · ACP: Unknown")).toBeInTheDocument();
    expect(screen.getByText("Install Claude Code and make sure `claude` is available on PATH."))
      .toBeInTheDocument();
  });

  it("creates and selects a project workspace", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "create_project") {
        return Promise.resolve(defaultProject());
      }

      if (command === "list_project_repositories") {
        return Promise.resolve(defaultProjectRepositories());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    openWorkspacePicker();
    await screen.findByText(/No workspaces yet/);
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "AIadne" },
    });
    fireEvent.change(screen.getByLabelText("Project path"), {
      target: { value: "/home/katarina/projects/AIadne" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Project" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("create_project", {
        request: {
          name: "AIadne",
          path: "/home/katarina/projects/AIadne",
        },
      });
    });
    expect(await screen.findAllByText("/home/katarina/projects/AIadne")).not.toHaveLength(0);
    expect(await findCurrentRepository("AIadne")).toHaveTextContent(
      "/home/katarina/projects/AIadne",
    );
    expect(document.querySelector(".mobile-context-summary")).toHaveTextContent(
      "AIadne/AIadne",
    );
    expect(screen.getByRole("button", { name: "Select AIadne project" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("auto-dismisses workspace toast messages", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "create_project") {
        return Promise.resolve(defaultProject());
      }

      if (command === "list_project_repositories") {
        return Promise.resolve(defaultProjectRepositories());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    vi.useFakeTimers();
    try {
      render(<App />);
      await flushAsyncState();
      openWorkspacePicker();

      fireEvent.change(screen.getByLabelText("Project name"), {
        target: { value: "AIadne" },
      });
      fireEvent.change(screen.getByLabelText("Project path"), {
        target: { value: "/home/katarina/projects/AIadne" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add Project" }));
      await flushAsyncState();

      expect(screen.getByRole("status")).toHaveTextContent("AIadne added.");
      expect(screen.getByRole("status")).toHaveAttribute("data-kind", "success");
      expect(screen.getByRole("button", { name: "Dismiss notification: AIadne added." }))
        .toHaveClass("toast-close");

      act(() => {
        vi.advanceTimersByTime(4_000);
      });

      expect(screen.queryByText("AIadne added.")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("dismisses workspace toast messages manually", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "create_project") {
        return Promise.resolve(defaultProject());
      }

      if (command === "list_project_repositories") {
        return Promise.resolve(defaultProjectRepositories());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    openWorkspacePicker();
    await screen.findByText(/No workspaces yet/);
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "AIadne" },
    });
    fireEvent.change(screen.getByLabelText("Project path"), {
      target: { value: "/home/katarina/projects/AIadne" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Project" }));

    expect(await screen.findByText("AIadne added.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification: AIadne added." }));

    expect(screen.queryByText("AIadne added.")).not.toBeInTheDocument();
  });

  it("fills project name and path from the native folder picker", async () => {
    const openMock = vi.mocked(open);
    openMock.mockResolvedValue("/home/katarina/projects/AIadne");

    render(<App />);

    openWorkspacePicker();
    await screen.findByText(/No workspaces yet/);
    fireEvent.click(screen.getByRole("button", { name: "Choose Folder" }));

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith({
        directory: true,
        multiple: false,
        title: "Choose project folder",
      });
    });
    expect(screen.getByLabelText("Project path")).toHaveValue("/home/katarina/projects/AIadne");
    expect(screen.getByLabelText("Project name")).toHaveValue("AIadne");
  });

  it("confirms before deleting the selected project", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }

      if (command === "list_project_repositories") {
        return Promise.resolve(defaultProjectRepositories());
      }

      if (command === "delete_project") {
        return Promise.resolve(undefined);
      }

      if (command === "list_acp_sessions") {
        return Promise.resolve([
          {
            id: "acp-session-1",
            state: "running",
            pid: 456,
            cwd: "/home/katarina/projects/AIadne",
            protocolVersion: 1,
            agentSessionId: "fake-acp-session",
            agentName: "fake-acp",
            agentVersion: "0.1.0",
            exitCode: null,
          },
        ]);
      }

      if (command === "stop_acp_session") {
        return Promise.resolve({
          id: "acp-session-1",
          state: "killed",
          pid: 456,
          cwd: "/home/katarina/projects/AIadne",
          protocolVersion: 1,
          agentSessionId: "fake-acp-session",
          agentName: "fake-acp",
          agentVersion: "0.1.0",
          exitCode: null,
        });
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    await screen.findByRole("button", { name: /Current workspace.*AIadne/i });
    openWorkspacePicker();
    fireEvent.click(screen.getByRole("button", { name: "Delete AIadne project" }));
    expect(screen.getByRole("dialog", { name: "Delete Project" })).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalledWith("delete_project", {
      projectId: "project-aiadne",
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm delete project" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("list_acp_sessions");
      expect(invokeMock).toHaveBeenCalledWith("stop_acp_session", {
        sessionId: "acp-session-1",
        force: false,
      });
      expect(invokeMock).toHaveBeenCalledWith("delete_project", {
        projectId: "project-aiadne",
      });
    });
    expect(await screen.findByRole("button", { name: /Choose a workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "AIadne deleted. Stopped 1 ACP session.",
    );
  });

  it("adds and selects repositories within a project", async () => {
    const invokeMock = vi.mocked(invoke);
    const apiRepository = defaultProjectRepository({
      id: "repo-api",
      name: "API",
      path: "/home/katarina/projects/AIadne/api",
      isDefault: false,
    });
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }

      if (command === "list_project_repositories") {
        return Promise.resolve(defaultProjectRepositories());
      }

      if (command === "create_project_repository") {
        return Promise.resolve(apiRepository);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    await findCurrentRepository("AIadne");
    openRepositoryPicker();
    await screen.findByLabelText("Project repositories");
    fireEvent.change(screen.getByLabelText("Repository name"), {
      target: { value: "API" },
    });
    fireEvent.change(screen.getByLabelText("Repository path"), {
      target: { value: "/home/katarina/projects/AIadne/api" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Repository" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("create_project_repository", {
        request: {
          projectId: "project-aiadne",
          name: "API",
          path: "/home/katarina/projects/AIadne/api",
        },
      });
    });
    expect(await screen.findAllByText("/home/katarina/projects/AIadne/api")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Select API repository" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("starts project initialization with user-selected repositories", async () => {
    const invokeMock = vi.mocked(invoke);
    const apiRepository = defaultProjectRepository({
      id: "repo-api",
      name: "API",
      path: "/home/katarina/projects/AIadne/api",
      isDefault: false,
    });
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }

      if (command === "list_project_repositories") {
        return Promise.resolve([...defaultProjectRepositories(), apiRepository]);
      }

      if (command === "create_project_initialization") {
        return Promise.resolve({
          id: "init-1",
          projectId: "project-aiadne",
          status: "preflight",
          repositoryCount: 1,
          createdAt: 1_785_000_010,
          updatedAt: 1_785_000_010,
        });
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    await findCurrentRepository("AIadne");
    fireEvent.click(screen.getByRole("button", { name: "Initialize Project" }));
    expect(screen.getByRole("dialog", { name: "Project Initialize" })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Include API repository"));
    fireEvent.click(screen.getByRole("button", { name: "Start Initialize" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("create_project_initialization", {
        request: {
          projectId: "project-aiadne",
          repositoryIds: ["repo-aiadne"],
        },
      });
    });
    expect(await screen.findByText("Preflight · 1 repository")).toBeInTheDocument();
    expect(screen.getByLabelText("Preflight scope")).toHaveAttribute("data-state", "current");
    expect(screen.getByLabelText("Preflight scope")).toHaveTextContent(
      "1 repository selected for this initialization run.",
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Project Initialize" }))
        .not.toBeInTheDocument();
    });
  });

  it("collects and renders project initialization facts", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }

      if (command === "list_project_repositories") {
        return Promise.resolve(defaultProjectRepositories());
      }

      if (command === "create_project_initialization") {
        return Promise.resolve(defaultProjectInitialization());
      }

      if (command === "collect_project_initialization_facts") {
        return Promise.resolve(defaultProjectInitializationFacts());
      }

      if (command === "list_project_initialization_facts") {
        return Promise.resolve([]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    await findCurrentRepository("AIadne");
    fireEvent.click(screen.getByRole("button", { name: "Initialize Project" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Initialize" }));
    expect(await screen.findByText("Preflight · 1 repository")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collect Facts" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("collect_project_initialization_facts", {
        initializationId: "init-1",
      });
    });
    expect(await screen.findByText("Facts · 1 repository")).toBeInTheDocument();
    expect(screen.getByLabelText("Preflight scope")).toHaveAttribute("data-state", "complete");
    expect(screen.getByLabelText("Project initialization facts")).toHaveTextContent(
      "Git repository: yes",
    );
    expect(screen.getByLabelText("Project initialization facts")).toHaveTextContent(
      "Tracked files: 53",
    );
    expect(screen.getByText("2 collected")).toHaveAttribute("data-state", "success");
    fireEvent.click(screen.getByRole("button", { name: "View Facts" }));
    expect(screen.getByRole("dialog", { name: "Facts Detail" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project initialization fact details")).toHaveTextContent(
      "git rev-parse --show-toplevel",
    );
  });

  it("analyzes and renders project initialization markdown findings", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }

      if (command === "list_project_repositories") {
        return Promise.resolve(defaultProjectRepositories());
      }

      if (command === "create_project_initialization") {
        return Promise.resolve(defaultProjectInitialization());
      }

      if (command === "analyze_project_initialization_markdown") {
        return Promise.resolve(defaultProjectInitializationMarkdownFindings());
      }

      if (command === "list_project_initialization_facts") {
        return Promise.resolve([]);
      }

      if (command === "list_project_initialization_markdown_findings") {
        return Promise.resolve([]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    await findCurrentRepository("AIadne");
    fireEvent.click(screen.getByRole("button", { name: "Initialize Project" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Initialize" }));
    expect(await screen.findByText("Preflight · 1 repository")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Analyze Markdown" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("analyze_project_initialization_markdown", {
        initializationId: "init-1",
      });
    });
    expect(await screen.findByText("Markdown · 1 repository")).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Project initialization phases" }),
    ).toHaveTextContent("Markdown");
    const markdownFindings = screen.getByRole("list", {
      name: "Project initialization markdown findings",
    });
    expect(markdownFindings).toHaveTextContent("setup");
    expect(markdownFindings).toHaveTextContent("Setup");
    expect(markdownFindings).toHaveTextContent("README.md#setup");
    fireEvent.click(screen.getByRole("button", { name: "View Findings" }));
    expect(screen.getByRole("dialog", { name: "Markdown Findings" })).toBeInTheDocument();
    expect(
      screen.getByLabelText("Project initialization markdown finding details"),
    ).toHaveTextContent("Run npm install before starting.");
  });

  it("saves project initialization interview guardrails", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }

      if (command === "list_project_repositories") {
        return Promise.resolve(defaultProjectRepositories());
      }

      if (command === "create_project_initialization") {
        return Promise.resolve(defaultProjectInitialization());
      }

      if (command === "list_project_initialization_facts") {
        return Promise.resolve([]);
      }

      if (command === "list_project_initialization_markdown_findings") {
        return Promise.resolve([]);
      }

      if (command === "list_project_initialization_guardrails") {
        return Promise.resolve([]);
      }

      if (command === "save_project_initialization_guardrails") {
        return Promise.resolve(defaultProjectInitializationGuardrails());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    await findCurrentRepository("AIadne");
    fireEvent.click(screen.getByRole("button", { name: "Initialize Project" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Initialize" }));
    expect(await screen.findByText("Preflight · 1 repository")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Interview" }));
    expect(screen.getByRole("dialog", { name: "Interview Guardrails" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Guardrail type"), {
      target: { value: "agent_rule" },
    });
    fireEvent.change(screen.getByLabelText("Guardrail content"), {
      target: { value: "Always ask before schema changes." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Guardrail" }));
    fireEvent.change(screen.getByLabelText("Guardrail scope"), {
      target: { value: "repository" },
    });
    fireEvent.change(screen.getByLabelText("Guardrail type"), {
      target: { value: "do_not_touch" },
    });
    fireEvent.change(screen.getByLabelText("Guardrail path pattern"), {
      target: { value: "src/generated/**" },
    });
    fireEvent.change(screen.getByLabelText("Guardrail content"), {
      target: { value: "Generated files are overwritten by tooling." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Guardrail" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Interview" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("save_project_initialization_guardrails", {
        request: {
          initializationId: "init-1",
          guardrails: [
            {
              repositoryId: null,
              kind: "agent_rule",
              pathPattern: null,
              content: "Always ask before schema changes.",
            },
            {
              repositoryId: "repo-aiadne",
              kind: "do_not_touch",
              pathPattern: "src/generated/**",
              content: "Generated files are overwritten by tooling.",
            },
          ],
        },
      });
    });
    expect(await screen.findByText("Interview · 1 repository")).toBeInTheDocument();
    expect(screen.getByLabelText("Project initialization guardrails")).toHaveTextContent(
      "Do not touch",
    );
  });

  it("generates and approves project initialization summary", async () => {
    const invokeMock = vi.mocked(invoke);
    let summaryApproved = false;
    const draftSummary = defaultProjectInitializationSummary({
      requestedModelProfileId: "openai-gpt-5.6-sol-high",
      requestedModelProviderId: "openai",
      requestedModelId: "gpt-5.6-sol",
      requestedModelTier: "high",
      requestedModelParameters: [{ name: "reasoning.effort", value: "high" }],
      generationEngine: "openai_responses_v1",
    });
    const approvedSummary = defaultProjectInitializationSummary({
      requestedModelProfileId: "openai-gpt-5.6-sol-high",
      requestedModelProviderId: "openai",
      requestedModelId: "gpt-5.6-sol",
      requestedModelTier: "high",
      requestedModelParameters: [{ name: "reasoning.effort", value: "high" }],
      generationEngine: "openai_responses_v1",
      status: "approved",
      approvedAt: 1_785_000_060,
    });
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }

      if (command === "list_project_repositories") {
        return Promise.resolve(defaultProjectRepositories());
      }

      if (command === "create_project_initialization") {
        return Promise.resolve(defaultProjectInitialization());
      }

      if (command === "list_project_initialization_facts") {
        return Promise.resolve(defaultProjectInitializationFacts());
      }

      if (command === "list_project_initialization_markdown_findings") {
        return Promise.resolve(defaultProjectInitializationMarkdownFindings());
      }

      if (command === "list_project_initialization_guardrails") {
        return Promise.resolve(defaultProjectInitializationGuardrails());
      }

      if (command === "list_project_initialization_summary") {
        return Promise.resolve(null);
      }

      if (command === "list_project_initialization_knowledge_units") {
        return Promise.resolve(summaryApproved ? defaultKnowledgeUnits() : []);
      }

      if (command === "list_model_catalog") {
        return Promise.resolve(defaultModelCatalog());
      }

      if (command === "generate_project_initialization_summary") {
        return Promise.resolve(draftSummary);
      }

      if (command === "approve_project_initialization_summary") {
        summaryApproved = true;
        return Promise.resolve(approvedSummary);
      }

      if (command === "select_project_task_context") {
        return Promise.resolve(defaultTaskContextSelection());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    await findCurrentRepository("AIadne");
    fireEvent.click(screen.getByRole("button", { name: "Initialize Project" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Initialize" }));
    expect(await screen.findByText("Preflight · 1 repository")).toBeInTheDocument();

    expect(screen.getByLabelText("Synthesis model")).toHaveValue(
      "openai-gpt-5.6-terra-medium",
    );
    fireEvent.click(screen.getByRole("button", { name: "Max" }));
    expect(screen.getByRole("option", { name: /Claude Fable 5/ })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Anthropic synthesis adapter is not implemented yet",
    );
    expect(screen.getByRole("button", { name: "Generate Summary" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "High" }));
    fireEvent.change(screen.getByLabelText("Synthesis model"), {
      target: { value: "openai-gpt-5.6-sol-high" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("generate_project_initialization_summary", {
        request: {
          initializationId: "init-1",
          modelProfileId: "openai-gpt-5.6-sol-high",
        },
      });
    });
    expect(await screen.findByText("Summary · 1 repository")).toBeInTheDocument();
    expect(screen.getByLabelText("Project initialization summary preview")).toHaveTextContent(
      "Draft profile is ready for review.",
    );
    fireEvent.click(screen.getByRole("button", { name: "View Summary" }));
    expect(screen.getByRole("dialog", { name: "Summary Review" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project initialization summary")).toHaveTextContent(
      "Project controls CLI agents",
    );
    expect(screen.getByLabelText("Project initialization summary")).toHaveTextContent(
      "Do Not Touch",
    );
    expect(screen.getByLabelText("Summary generation provenance")).toHaveTextContent(
      "openai / gpt-5.6-sol",
    );
    expect(screen.getByLabelText("Summary generation provenance")).toHaveTextContent(
      "openai_responses_v1",
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve Summary" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("approve_project_initialization_summary", {
        summaryId: "summary-1",
      });
    });
    expect(await screen.findByText("approved")).toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith("list_project_initialization_knowledge_units", {
      initializationId: "init-1",
    });
    expect(screen.getByLabelText("Published knowledge units")).toHaveTextContent(
      "Project controls CLI agents",
    );
    expect(screen.getByLabelText("Published knowledge units")).toHaveTextContent(
      "README.md#purpose",
    );
    expect(screen.getByLabelText("Published knowledge units")).toHaveTextContent(
      "needs confirmation",
    );
    expect(screen.getByLabelText("Published knowledge units")).toHaveTextContent(
      "Needs confirmation; no evidence source.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.change(screen.getByLabelText("ACP prompt"), {
      target: { value: "Update project controls" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview Context" }));
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("select_project_task_context", {
        request: {
          initializationId: "init-1",
          task: "Update project controls",
          repositoryId: "repo-aiadne",
          paths: [],
          characterBudget: 6000,
        },
      });
    });
    const contextDialog = await screen.findByRole("dialog", { name: "Task Context Preview" });
    expect(screen.getByLabelText("Task context budget")).toHaveTextContent("120");
    expect(screen.getByLabelText("Included task context")).toHaveTextContent("mandatory kind");
    expect(screen.getByLabelText("Excluded task context")).toHaveTextContent("uncertain status");
    fireEvent.mouseDown(contextDialog.parentElement as HTMLElement);
    expect(screen.queryByRole("dialog", { name: "Task Context Preview" })).not.toBeInTheDocument();
  });

  it("restores the synthesis profile from a persisted summary", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }

      if (command === "list_project_repositories") {
        return Promise.resolve(defaultProjectRepositories());
      }

      if (command === "list_project_initializations") {
        return Promise.resolve([{ ...defaultProjectInitialization(), status: "summary" }]);
      }

      if (command === "list_project_initialization_facts") {
        return Promise.resolve(defaultProjectInitializationFacts());
      }

      if (command === "list_project_initialization_markdown_findings") {
        return Promise.resolve(defaultProjectInitializationMarkdownFindings());
      }

      if (command === "list_project_initialization_guardrails") {
        return Promise.resolve(defaultProjectInitializationGuardrails());
      }

      if (command === "list_project_initialization_summary") {
        return Promise.resolve(
          defaultProjectInitializationSummary({
            requestedModelProfileId: "anthropic-claude-opus-4.8-high",
            requestedModelProviderId: "anthropic",
            requestedModelId: "claude-opus-4-8",
            requestedModelTier: "high",
            requestedModelParameters: [{ name: "thinking", value: "adaptive" }],
          }),
        );
      }

      if (command === "list_model_catalog") {
        return Promise.resolve(defaultModelCatalog());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "list_transcript_sessions" || command === "list_knowledge_items") {
        return Promise.resolve([]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText("Synthesis model")).toHaveValue(
        "anthropic-claude-opus-4.8-high",
      );
    });
    expect(screen.getByRole("button", { name: "High" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Project initialization summary preview")).toHaveTextContent(
      "claude-opus-4-8",
    );
  });

  it("scopes project initialization status to the selected project", async () => {
    const invokeMock = vi.mocked(invoke);
    const secondProject = {
      id: "project-madsense",
      name: "MadSense",
      path: "/home/katarina/projects/MadSense",
      createdAt: 1_785_000_020,
      updatedAt: 1_785_000_020,
    };
    const secondRepository = defaultProjectRepository({
      id: "repo-madsense",
      projectId: secondProject.id,
      name: "MadSense",
      path: secondProject.path,
    });

    invokeMock.mockImplementation((command, args) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject(), secondProject]);
      }

      if (command === "list_project_repositories") {
        const projectId = (args as { projectId?: string } | undefined)?.projectId;
        return Promise.resolve(
          projectId === secondProject.id ? [secondRepository] : defaultProjectRepositories(),
        );
      }

      if (command === "create_project_initialization") {
        return Promise.resolve({
          id: "init-1",
          projectId: "project-aiadne",
          status: "preflight",
          repositoryCount: 1,
          createdAt: 1_785_000_010,
          updatedAt: 1_785_000_010,
        });
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    await findCurrentRepository("AIadne");
    fireEvent.click(screen.getByRole("button", { name: "Initialize Project" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Initialize" }));
    expect(await screen.findByText("Preflight · 1 repository")).toBeInTheDocument();

    openWorkspacePicker();
    fireEvent.click(screen.getByRole("button", { name: "Select MadSense project" }));
    expect(screen.queryByRole("dialog", { name: "Choose Workspace" })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText("Preflight · 1 repository")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("not started").length).toBeGreaterThan(0);
  });

  it("renders saved ACP transcript sessions", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_transcript_sessions") {
        return Promise.resolve([
          defaultTranscriptSession({
            id: "transcript-old",
            title: "Older Codex ACP",
            eventCount: 3,
          }),
          defaultTranscriptSession({
            id: "transcript-new",
            title: "Newer Codex ACP",
            eventCount: 2,
            updatedAt: 1_785_000_010,
          }),
        ]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      if (command === "list_transcript_events") {
        return Promise.resolve(defaultTranscriptEvents());
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    expect(await screen.findByText("Older Codex ACP")).toBeInTheDocument();
    expect(screen.getByText("Codex · acp · 3 events")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Older Codex ACP transcript" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("list_transcript_events", {
        sessionId: "transcript-old",
      });
    });
    expect(await screen.findByRole("heading", { name: "Saved Transcript" })).toBeInTheDocument();
    expect(screen.getByText("old question")).toBeInTheDocument();
    expect(screen.getByText("old answer")).toBeInTheDocument();
    expect(screen.getByText("Question")).toBeInTheDocument();
    expect(screen.getByText("Answer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Older Codex ACP transcript" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Open Newer Codex ACP transcript" }))
      .toHaveAttribute("aria-pressed", "false");

    invokeMock.mockImplementation((command, args) => {
      if (command === "list_transcript_events") {
        const sessionId = (args as { sessionId: string }).sessionId;
        return Promise.resolve(
          sessionId === "transcript-new" ? defaultTranscriptEvents("new") : defaultTranscriptEvents(),
        );
      }

      return Promise.resolve([]);
    });

    fireEvent.click(screen.getByRole("button", { name: "Open Newer Codex ACP transcript" }));

    await waitFor(() => {
      expect(screen.getByText("new question")).toBeInTheDocument();
    });
    expect(screen.queryByText("old question")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Older Codex ACP transcript" }))
      .toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Open Newer Codex ACP transcript" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("filters and renames saved ACP transcript sessions", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command, args) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_transcript_sessions") {
        return Promise.resolve([
          defaultTranscriptSession({
            id: "transcript-palette",
            title: "UI palette debug",
            eventCount: 4,
          }),
          defaultTranscriptSession({
            id: "transcript-backend",
            title: "Backend cleanup",
            eventCount: 2,
            updatedAt: 1_785_000_010,
          }),
        ]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "list_transcript_events") {
        return Promise.resolve(defaultTranscriptEvents());
      }

      if (command === "rename_transcript_session") {
        const request = (args as { request: { sessionId: string; title: string } }).request;
        return Promise.resolve(
          defaultTranscriptSession({
            id: request.sessionId,
            title: request.title,
            eventCount: 4,
          }),
        );
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    expect(await screen.findByText("UI palette debug")).toBeInTheDocument();
    expect(screen.getByText("Backend cleanup")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter session history"), {
      target: { value: "palette" },
    });

    expect(screen.getByText("1/2 saved")).toBeInTheDocument();
    expect(screen.getByText("UI palette debug")).toBeInTheDocument();
    expect(screen.queryByText("Backend cleanup")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open UI palette debug transcript" }));
    expect(await screen.findByDisplayValue("UI palette debug")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Selected session name"), {
      target: { value: "Palette review" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("rename_transcript_session", {
        request: {
          sessionId: "transcript-palette",
          title: "Palette review",
        },
      });
    });
    expect(await screen.findByText("Palette review")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter session history"), {
      target: { value: "missing" },
    });
    expect(screen.getByText("No sessions match this filter.")).toBeInTheDocument();
  });

  it("limits Session History to three visible rows", async () => {
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_transcript_sessions") {
        return Promise.resolve([
          defaultTranscriptSession({ id: "transcript-1", title: "First Codex ACP" }),
          defaultTranscriptSession({ id: "transcript-2", title: "Second Codex ACP" }),
          defaultTranscriptSession({ id: "transcript-3", title: "Third Codex ACP" }),
          defaultTranscriptSession({ id: "transcript-4", title: "Fourth Codex ACP" }),
        ]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    expect(await screen.findByText("First Codex ACP")).toBeInTheDocument();
    expect(screen.getByText("Second Codex ACP")).toBeInTheDocument();
    expect(screen.getByText("Third Codex ACP")).toBeInTheDocument();
    expect(screen.queryByText("Fourth Codex ACP")).not.toBeInTheDocument();
    expect(screen.getByText("4/4 saved")).toBeInTheDocument();
  });

  it("renders saved ACP transcript chunks as readable questions and answers", async () => {
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_transcript_sessions") {
        return Promise.resolve([
          defaultTranscriptSession({
            id: "transcript-chunks",
            title: "Chunked Codex ACP",
            eventCount: 5,
          }),
        ]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "list_transcript_events") {
        return Promise.resolve([
          {
            id: "event-question",
            sessionId: "transcript-chunks",
            sequence: 0,
            kind: "user_message",
            content: "Can you explain this?",
            createdAt: 1_785_000_001,
          },
          {
            id: "event-answer-a",
            sessionId: "transcript-chunks",
            sequence: 1,
            kind: "agent_message",
            content: "Yes,",
            createdAt: 1_785_000_002,
          },
          {
            id: "event-answer-b",
            sessionId: "transcript-chunks",
            sequence: 2,
            kind: "agent_message",
            content: "this is the answer.",
            createdAt: 1_785_000_003,
          },
          {
            id: "event-next-question",
            sessionId: "transcript-chunks",
            sequence: 3,
            kind: "user_message",
            content: "And the next thing?",
            createdAt: 1_785_000_004,
          },
        ]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Open Chunked Codex ACP transcript" }));

    expect(await screen.findByText("Can you explain this?")).toBeInTheDocument();
    expect(screen.getByText("Yes, this is the answer.")).toBeInTheDocument();
    expect(screen.getByText("And the next thing?")).toBeInTheDocument();
    expect(screen.getAllByText("Question")).toHaveLength(2);
    expect(screen.getByText("Answer")).toBeInTheDocument();
  });

  it("passes the selected repository cwd when launching a PTY session", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }

      if (command === "list_project_repositories") {
        return Promise.resolve([
          defaultProjectRepository(),
          defaultProjectRepository({
            id: "repo-api",
            name: "API",
            path: "/home/katarina/projects/AIadne/api",
            isDefault: false,
          }),
        ]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_fake_session") {
        return Promise.resolve({
          id: "session-with-cwd",
          state: "running",
          pid: 123,
          cols: 92,
          rows: 18,
          exitCode: null,
        });
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    await findCurrentRepository("AIadne");
    openRepositoryPicker();
    fireEvent.click(await screen.findByRole("button", { name: "Select API repository" }));
    await openPtyFallback();
    fireEvent.click(await screen.findByRole("button", { name: "Start Fake" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("start_fake_session", {
        request: {
          cols: 92,
          rows: 18,
          cwd: "/home/katarina/projects/AIadne/api",
        },
      });
    });
  });

  it("selects ACP registry candidates without launching them", async () => {
    const invokeMock = vi.mocked(invoke);

    render(<App />);

    const selectedCandidate = await screen.findByLabelText("Selected ACP candidate");
    expect(selectedCandidate).toHaveTextContent("Codex");

    fireEvent.click(screen.getByRole("button", { name: "Select Kimi CLI ACP candidate" }));

    expect(selectedCandidate).toHaveTextContent("Kimi CLI");
    expect(screen.getByRole("button", { name: "Select Kimi CLI ACP candidate" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Start Selected ACP" })).toBeDisabled();
    expect(invokeMock).not.toHaveBeenCalledWith("start_fake_acp_session", expect.anything());
  });

  it("starts the selected ACP registry candidate", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_acp_registry_session") {
        return Promise.resolve({
          id: "acp-session-2",
          state: "running",
          pid: 789,
          protocolVersion: 1,
          agentSessionId: "codex-acp-session",
          agentName: "codex-acp",
          agentVersion: "1.1.0",
          exitCode: null,
          codingModel: {
            currentValue: "gpt-5.6",
            options: [
              {
                value: "gpt-5.6",
                name: "GPT-5.6",
                description: "Default coding model",
              },
              {
                value: "gpt-5.6-mini",
                name: "GPT-5.6 Mini",
                description: "Faster coding model",
              },
            ],
          },
        });
      }

      if (command === "set_acp_model") {
        return Promise.resolve({
          id: "acp-session-2",
          state: "running",
          pid: 789,
          cwd: "/home/katarina/projects/AIadne",
          protocolVersion: 1,
          agentSessionId: "codex-acp-session",
          agentName: "codex-acp",
          agentVersion: "1.1.0",
          exitCode: null,
          codingModel: {
            currentValue: "gpt-5.6-mini",
            options: [
              { value: "gpt-5.6", name: "GPT-5.6", description: "Default coding model" },
              {
                value: "gpt-5.6-mini",
                name: "GPT-5.6 Mini",
                description: "Faster coding model",
              },
            ],
          },
        });
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    await screen.findByLabelText("Selected ACP candidate");
    fireEvent.click(screen.getByRole("button", { name: "Start Selected ACP" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("start_acp_registry_session", {
        request: {
          candidateId: "codex-acp",
          cwd: "/home/katarina/projects/AIadne",
        },
      });
    });
    expect(await screen.findAllByText("Codex · running · codex-acp-session"))
      .not.toHaveLength(0);
    expect(screen.queryByLabelText("ACP session start actions")).not.toBeInTheDocument();
    expect(screen.getByLabelText("ACP active session actions"))
      .toContainElement(screen.getByRole("button", { name: "Stop ACP" }));
    const codingModel = screen.getByRole("combobox", { name: "Coding model" });
    expect(codingModel).toHaveValue("gpt-5.6");

    fireEvent.change(codingModel, { target: { value: "gpt-5.6-mini" } });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("set_acp_model", {
        request: {
          sessionId: "acp-session-2",
          modelId: "gpt-5.6-mini",
        },
      });
    });
    expect(screen.getByRole("combobox", { name: "Coding model" })).toHaveValue("gpt-5.6-mini");
  });

  it("starts a non-default launchable ACP registry candidate", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_transcript_sessions") {
        return Promise.resolve([]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_acp_registry_session") {
        return Promise.resolve({
          id: "acp-session-gemini",
          state: "running",
          pid: 987,
          protocolVersion: 1,
          agentSessionId: "gemini-acp-session",
          agentName: "gemini-acp",
          agentVersion: "0.49.0",
          exitCode: null,
        });
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    await screen.findByLabelText("Selected ACP candidate");
    fireEvent.click(screen.getByRole("button", { name: "Select Gemini CLI ACP candidate" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Selected ACP" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("start_acp_registry_session", {
        request: {
          candidateId: "gemini",
        },
      });
    });
    expect(await screen.findAllByText("Gemini CLI · running · gemini-acp-session"))
      .not.toHaveLength(0);
    expect(screen.getByText("This agent does not advertise model selection.")).toBeInTheDocument();
  });

  it("locks ACP candidate selection while a session is running", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_transcript_sessions") {
        return Promise.resolve([]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_acp_registry_session") {
        return Promise.resolve({
          id: "acp-session-locked",
          state: "running",
          pid: 111,
          protocolVersion: 1,
          agentSessionId: "locked-acp-session",
          agentName: "codex-acp",
          agentVersion: "1.1.0",
          exitCode: null,
        });
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve("");
    });

    render(<App />);

    await screen.findByLabelText("Selected ACP candidate");
    fireEvent.click(screen.getByRole("button", { name: "Start Selected ACP" }));

    expect(await screen.findAllByText("Codex · running · locked-acp-session"))
      .not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Select Kimi CLI ACP candidate" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Select Gemini CLI ACP candidate" })).toBeDisabled();
  });

  it("writes xterm keyboard data to the active PTY session", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_fake_session") {
        return Promise.resolve({
          id: "session-1",
          state: "running",
          pid: 123,
          cols: 92,
          rows: 18,
          exitCode: null,
        });
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    await openPtyFallback();
    fireEvent.click(await screen.findByRole("button", { name: "Start Fake" }));

    expect(await screen.findAllByText("fake · running · 92x18")).not.toHaveLength(0);
    expect(invokeMock).toHaveBeenCalledWith("start_fake_session", {
      request: { cols: 92, rows: 18 },
    });

    expect(onTerminalData).toBeTypeOf("function");
    act(() => {
      onTerminalData?.("hello\r");
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("write_session_input", {
        sessionId: "session-1",
        text: "hello\r",
      });
    });
  });

  it("blocks Codex start when the CLI is missing", async () => {
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_transcript_sessions") {
        return Promise.resolve([]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports({ codexStatus: "missing" }));
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve("");
    });

    render(<App />);

    await openPtyFallback();
    await screen.findByText("Install the Codex CLI and make sure `codex` is available on PATH.");
    expect(screen.getByRole("button", { name: "Start Codex" })).toBeDisabled();
  });

  it("starts fake ACP and renders structured events", async () => {
    const invokeMock = vi.mocked(invoke);
    let promptSent = false;
    let eventDrained = false;
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_fake_acp_session") {
        return Promise.resolve({
          id: "acp-session-1",
          state: "running",
          pid: 456,
          protocolVersion: 1,
          agentSessionId: "fake-acp-session",
          agentName: "fake-acp",
          agentVersion: "0.1.0",
          exitCode: null,
        });
      }

      if (command === "create_transcript_session") {
        return Promise.resolve(defaultTranscriptSession());
      }

      if (command === "append_transcript_events") {
        return Promise.resolve([]);
      }

      if (command === "send_acp_prompt") {
        promptSent = true;
        return Promise.resolve({
          sessionId: "acp-session-1",
          stopReason: "end_turn",
        });
      }

      if (command === "drain_acp_events") {
        if (promptSent && !eventDrained) {
          eventDrained = true;
          return Promise.resolve([
            {
              kind: "agent_message",
              content: "fake acp received",
            },
            {
              kind: "agent_message",
              content: "prompt",
            },
          ]);
        }

        return Promise.resolve([]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start Fake ACP" }));
    expect(await screen.findAllByText("fake · running · fake-acp-session"))
      .not.toHaveLength(0);
    expect(invokeMock).toHaveBeenCalledWith("create_transcript_session", {
      request: {
        projectId: null,
        runtime: "acp",
        source: "fake",
        title: "Fake ACP",
      },
    });

    fireEvent.change(screen.getByLabelText("ACP prompt"), {
      target: { value: "hello acp" },
    });
    const collapseControls = screen.getByRole("button", { name: "Collapse ACP controls" });
    expect(collapseControls).toHaveAttribute("aria-expanded", "true");
    expect(collapseControls).toHaveAttribute("aria-controls", "acp-controls-content");

    fireEvent.click(collapseControls);

    expect(screen.getByRole("button", { name: "Expand ACP controls" }))
      .toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("ACP prompt")).not.toBeVisible();
    expect(screen.getByRole("button", { name: "Drain ACP" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Stop ACP" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Expand ACP controls" }));

    expect(screen.getByLabelText("ACP prompt")).toHaveValue("hello acp");
    fireEvent.click(screen.getByRole("button", { name: "Send ACP" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("send_acp_prompt", {
        sessionId: "acp-session-1",
        prompt: "hello acp",
      });
    });
    expect(invokeMock).toHaveBeenCalledWith("append_transcript_events", {
      sessionId: "transcript-1",
      events: [{ kind: "user_message", content: "hello acp" }],
    });
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("append_transcript_events", {
        sessionId: "transcript-1",
        events: [{ kind: "agent_message", content: "fake acp received prompt" }],
      });
    });
    expect(await screen.findByText("fake acp received prompt")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Task assessment" })).not.toBeInTheDocument();
    expect(scrollToMock).toHaveBeenCalled();
    expect(await screen.findByText("Stop reason: end_turn")).toBeInTheDocument();
  });

  it("creates knowledge cards and injects attached context into ACP prompts", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_transcript_sessions") {
        return Promise.resolve([]);
      }

      if (command === "list_knowledge_items") {
        return Promise.resolve([]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_fake_acp_session") {
        return Promise.resolve({
          id: "acp-session-1",
          state: "running",
          pid: 456,
          protocolVersion: 1,
          agentSessionId: "fake-acp-session",
          agentName: "fake-acp",
          agentVersion: "0.1.0",
          exitCode: null,
        });
      }

      if (command === "create_transcript_session") {
        return Promise.resolve(defaultTranscriptSession());
      }

      if (command === "create_knowledge_item") {
        return Promise.resolve(defaultKnowledgeItem());
      }

      if (command === "attach_knowledge_to_transcript_session") {
        return Promise.resolve([defaultKnowledgeItem()]);
      }

      if (command === "append_transcript_events") {
        return Promise.resolve([]);
      }

      if (command === "send_acp_prompt") {
        return Promise.resolve({
          sessionId: "acp-session-1",
          stopReason: "end_turn",
        });
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start Fake ACP" }));
    expect(await screen.findAllByText("fake · running · fake-acp-session"))
      .not.toHaveLength(0);

    fireEvent.click(screen.getAllByText("Knowledge Cards")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Add knowledge card" }));
    expect(screen.getByRole("dialog", { name: "New Knowledge Card" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Knowledge title"), {
      target: { value: "UI palette" },
    });
    fireEvent.change(screen.getByLabelText("Knowledge body"), {
      target: { value: "Use earth tones." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Card" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("create_knowledge_item", {
        request: {
          projectId: null,
          title: "UI palette",
          body: "Use earth tones.",
          kind: "decision",
          scope: "global",
          sourceTranscriptSessionId: "transcript-1",
        },
      });
    });
    expect(await screen.findByText("Use earth tones.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "New Knowledge Card" })).not.toBeInTheDocument();
    });
    expect(invokeMock).toHaveBeenCalledWith("attach_knowledge_to_transcript_session", {
      sessionId: "transcript-1",
      knowledgeItemId: "knowledge-1",
    });

    fireEvent.change(screen.getByLabelText("ACP prompt"), {
      target: { value: "hello acp" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send ACP" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("send_acp_prompt", {
        sessionId: "acp-session-1",
        prompt:
          "Attached session knowledge:\n1. UI palette (decision, global)\nUse earth tones.\n\nUser prompt:\nhello acp",
      });
    });
    expect(invokeMock).toHaveBeenCalledWith("append_transcript_events", {
      sessionId: "transcript-1",
      events: [{ kind: "user_message", content: "hello acp" }],
    });
  });

  it("creates one Task from the first project ACP prompt and reuses it for follow-ups", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }
      if (command === "list_project_tasks") {
        return Promise.resolve([]);
      }
      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }
      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }
      if (command === "start_fake_acp_session") {
        return Promise.resolve(defaultAcpSession());
      }
      if (command === "create_transcript_session") {
        return Promise.resolve(defaultTranscriptSession({ projectId: defaultProject().id }));
      }
      if (command === "create_task") {
        return Promise.resolve(defaultTask({ originalPrompt: "first task prompt" }));
      }
      if (command === "append_transcript_events" || command === "drain_acp_events") {
        return Promise.resolve([]);
      }
      if (command === "send_acp_prompt") {
        return Promise.resolve({ sessionId: "acp-session-1", stopReason: "end_turn" });
      }
      return Promise.resolve(undefined);
    });

    render(<App />);
    expect(await screen.findByText("AIadne")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start Fake ACP" }));
    expect(await screen.findAllByText("fake · running · fake-acp-session"))
      .not.toHaveLength(0);

    fireEvent.change(screen.getByLabelText("ACP prompt"), {
      target: { value: "first task prompt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send ACP" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("create_task", {
      request: {
        projectId: "project-aiadne",
        transcriptSessionId: "transcript-1",
        originalPrompt: "first task prompt",
      },
    }));
    expect(await screen.findByRole("heading", { name: "Task assessment" })).toBeInTheDocument();
    expect(screen.getByText("quick")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();
    expect(screen.getByText("bounded single-surface change")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Send ACP" })).not.toBeDisabled());

    fireEvent.click(screen.getByRole("button", { name: "Collapse ACP controls" }));
    expect(screen.getByText("Task assessment")).not.toBeVisible();
    expect(screen.queryByRole("heading", { name: "Task assessment" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand ACP controls" }));
    expect(screen.getByRole("heading", { name: "Task assessment" })).toBeVisible();

    fireEvent.change(screen.getByLabelText("ACP prompt"), {
      target: { value: "follow-up prompt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send ACP" }));
    await waitFor(() => {
      expect(invokeMock.mock.calls.filter(([command]) => command === "send_acp_prompt"))
        .toHaveLength(2);
    });
    expect(invokeMock.mock.calls.filter(([command]) => command === "create_task"))
      .toHaveLength(1);
    expect(invokeMock).toHaveBeenCalledWith("append_transcript_events", {
      sessionId: "transcript-1",
      events: [{ kind: "user_message", content: "first task prompt" }],
    });
  });

  it("does not record or send a project prompt when Task creation fails", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }
      if (command === "list_project_tasks") {
        return Promise.resolve([]);
      }
      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }
      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }
      if (command === "start_fake_acp_session") {
        return Promise.resolve(defaultAcpSession());
      }
      if (command === "create_transcript_session") {
        return Promise.resolve(defaultTranscriptSession({ projectId: defaultProject().id }));
      }
      if (command === "create_task") {
        return Promise.reject(new Error("task persistence failed"));
      }
      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }
      return Promise.resolve(undefined);
    });

    render(<App />);
    expect(await screen.findByText("AIadne")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start Fake ACP" }));
    expect(await screen.findAllByText("fake · running · fake-acp-session"))
      .not.toHaveLength(0);
    fireEvent.change(screen.getByLabelText("ACP prompt"), {
      target: { value: "tracked prompt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send ACP" }));

    expect(await screen.findByText("task persistence failed")).toBeInTheDocument();
    expect(invokeMock.mock.calls.some(([command]) => command === "append_transcript_events"))
      .toBe(false);
    expect(invokeMock.mock.calls.some(([command]) => command === "send_acp_prompt"))
      .toBe(false);
  });

  it("does not reuse a loaded Task for a newly created transcript", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }
      if (command === "list_project_tasks") {
        return Promise.resolve([defaultTask({ transcriptSessionId: "transcript-old" })]);
      }
      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }
      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }
      if (command === "start_fake_acp_session") {
        return Promise.resolve(defaultAcpSession());
      }
      if (command === "create_transcript_session") {
        return Promise.resolve(defaultTranscriptSession({ projectId: defaultProject().id }));
      }
      if (command === "create_task") {
        return Promise.resolve(defaultTask());
      }
      if (command === "append_transcript_events" || command === "drain_acp_events") {
        return Promise.resolve([]);
      }
      if (command === "send_acp_prompt") {
        return Promise.resolve({ sessionId: "acp-session-1", stopReason: "end_turn" });
      }
      return Promise.resolve(undefined);
    });

    render(<App />);
    expect(await screen.findByText("AIadne")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start Fake ACP" }));
    expect(await screen.findAllByText("fake · running · fake-acp-session"))
      .not.toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "Task assessment" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send ACP" }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("create_task", {
      request: {
        projectId: "project-aiadne",
        transcriptSessionId: "transcript-1",
        originalPrompt: "Hello from AIadne",
      },
    }));
  });

  it("restores and labels a user-overridden Task assessment", async () => {
    const invokeMock = vi.mocked(invoke);
    const overriddenTask = defaultTask({
      initialComplexityProfile: "quick",
      complexityProfile: "complex",
      complexityReasons: ["Analysis found backend and schema changes."],
      complexityConfidence: null,
      complexitySource: "user",
    });
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }
      if (command === "list_project_tasks") {
        return Promise.resolve([overriddenTask]);
      }
      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }
      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }
      if (command === "start_fake_acp_session") {
        return Promise.resolve(defaultAcpSession());
      }
      if (command === "create_transcript_session") {
        return Promise.resolve(defaultTranscriptSession({ projectId: defaultProject().id }));
      }
      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }
      return Promise.resolve(undefined);
    });

    render(<App />);
    expect(await screen.findByText("AIadne")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start Fake ACP" }));

    expect(await screen.findByRole("heading", { name: "Task assessment" })).toBeInTheDocument();
    expect(screen.getByText("complex")).toBeInTheDocument();
    expect(screen.getByText("User selected")).toBeInTheDocument();
    expect(screen.getByText("Analysis found backend and schema changes.")).toBeInTheDocument();
    expect(screen.getByText(/Initially assessed as/)).toHaveTextContent("quick");
  });

  it("does not send a project prompt without a persisted transcript", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }
      if (command === "list_project_tasks") {
        return Promise.resolve([]);
      }
      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }
      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }
      if (command === "start_fake_acp_session") {
        return Promise.resolve(defaultAcpSession());
      }
      if (command === "create_transcript_session") {
        return Promise.resolve(null);
      }
      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }
      return Promise.resolve(undefined);
    });

    render(<App />);
    expect(await screen.findByText("AIadne")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start Fake ACP" }));
    expect(await screen.findAllByText("fake · running · fake-acp-session"))
      .not.toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Send ACP" }));

    expect(await screen.findByText("A project Task requires an active transcript session."))
      .toBeInTheDocument();
    expect(invokeMock.mock.calls.some(([command]) => command === "create_task"))
      .toBe(false);
    expect(invokeMock.mock.calls.some(([command]) => command === "send_acp_prompt"))
      .toBe(false);
  });

  it("keeps ACP stop available while a prompt is in flight", async () => {
    const invokeMock = vi.mocked(invoke);
    let resolvePrompt: ((result: unknown) => void) | undefined;
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_fake_acp_session") {
        return Promise.resolve({
          id: "acp-session-1",
          state: "running",
          pid: 456,
          protocolVersion: 1,
          agentSessionId: "fake-acp-session",
          agentName: "fake-acp",
          agentVersion: "0.1.0",
          exitCode: null,
        });
      }

      if (command === "send_acp_prompt") {
        return new Promise((resolve) => {
          resolvePrompt = resolve;
        });
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start Fake ACP" }));
    expect(await screen.findAllByText("fake · running · fake-acp-session"))
      .not.toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Send ACP" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("send_acp_prompt", {
        sessionId: "acp-session-1",
        prompt: "Hello from AIadne",
      });
    });
    expect(screen.getByRole("button", { name: "Send ACP" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Drain ACP" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Stop ACP" })).not.toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for agent response...");
    expect(screen.getByText("Agent is preparing a response")).toBeInTheDocument();

    resolvePrompt?.({
      sessionId: "acp-session-1",
      stopReason: "end_turn",
    });
    expect(await screen.findByText("Stop reason: end_turn")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Agent is preparing a response")).not.toBeInTheDocument();
    });
  });

  it("clears ACP waiting state after the prompt result even while event drain continues", async () => {
    const invokeMock = vi.mocked(invoke);
    let promptSent = false;
    let resolveHeldDrain: ((events: unknown[]) => void) | undefined;
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_fake_acp_session") {
        return Promise.resolve({
          id: "acp-session-1",
          state: "running",
          pid: 456,
          protocolVersion: 1,
          agentSessionId: "fake-acp-session",
          agentName: "fake-acp",
          agentVersion: "0.1.0",
          exitCode: null,
        });
      }

      if (command === "send_acp_prompt") {
        promptSent = true;
        return Promise.resolve({
          sessionId: "acp-session-1",
          stopReason: "end_turn",
        });
      }

      if (command === "drain_acp_events") {
        if (promptSent && !resolveHeldDrain) {
          return new Promise((resolve) => {
            resolveHeldDrain = resolve;
          });
        }

        return Promise.resolve([]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start Fake ACP" }));
    expect(await screen.findAllByText("fake · running · fake-acp-session"))
      .not.toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Send ACP" }));

    expect(await screen.findByText("Stop reason: end_turn")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send ACP" })).not.toBeDisabled();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("Agent is preparing a response")).not.toBeInTheDocument();

    await act(async () => {
      resolveHeldDrain?.([]);
    });
  });
});

async function openPtyFallback() {
  fireEvent.click(screen.getByText("Terminal PTY"));
  fireEvent.click(await screen.findByRole("button", { name: "Open PTY" }));
}

function defaultProject() {
  return {
    id: "project-aiadne",
    name: "AIadne",
    path: "/home/katarina/projects/AIadne",
    createdAt: 1_785_000_000,
    updatedAt: 1_785_000_000,
  };
}

function defaultProjects() {
  return [];
}

function defaultProjectRepository(overrides: Partial<ReturnType<typeof baseProjectRepository>> = {}) {
  return {
    ...baseProjectRepository(),
    ...overrides,
  };
}

function baseProjectRepository() {
  return {
    id: "repo-aiadne",
    projectId: "project-aiadne",
    name: "AIadne",
    path: "/home/katarina/projects/AIadne",
    isDefault: true,
    createdAt: 1_785_000_000,
    updatedAt: 1_785_000_000,
  };
}

function defaultProjectRepositories() {
  return [defaultProjectRepository()];
}

function defaultProjectInitialization() {
  return {
    id: "init-1",
    projectId: "project-aiadne",
    status: "preflight",
    repositoryCount: 1,
    createdAt: 1_785_000_010,
    updatedAt: 1_785_000_010,
  };
}

function defaultProjectInitializationFacts() {
  return [
    {
      id: "fact-git",
      initializationId: "init-1",
      repositoryId: "repo-aiadne",
      repositoryName: "AIadne",
      repositoryPath: "/home/katarina/projects/AIadne",
      kind: "git_repository",
      label: "Git repository",
      value: "yes",
      source: "git rev-parse --show-toplevel",
      createdAt: 1_785_000_020,
    },
    {
      id: "fact-tracked-files",
      initializationId: "init-1",
      repositoryId: "repo-aiadne",
      repositoryName: "AIadne",
      repositoryPath: "/home/katarina/projects/AIadne",
      kind: "tracked_file_count",
      label: "Tracked files",
      value: "53",
      source: "git ls-files",
      createdAt: 1_785_000_020,
    },
  ];
}

function defaultProjectInitializationMarkdownFindings() {
  return [
    {
      id: "markdown-setup",
      initializationId: "init-1",
      repositoryId: "repo-aiadne",
      repositoryName: "AIadne",
      repositoryPath: "/home/katarina/projects/AIadne",
      filePath: "README.md",
      category: "setup",
      title: "Setup",
      excerpt: "Run npm install before starting.",
      source: "README.md#setup",
      createdAt: 1_785_000_030,
    },
  ];
}

function defaultProjectInitializationGuardrails() {
  return [
    {
      id: "guardrail-project",
      initializationId: "init-1",
      repositoryId: null,
      repositoryName: null,
      repositoryPath: null,
      guardrailIndex: 0,
      scope: "project",
      kind: "agent_rule",
      pathPattern: null,
      content: "Always ask before schema changes.",
      source: "user_interview",
      createdAt: 1_785_000_040,
    },
    {
      id: "guardrail-repo",
      initializationId: "init-1",
      repositoryId: "repo-aiadne",
      repositoryName: "AIadne",
      repositoryPath: "/home/katarina/projects/AIadne",
      guardrailIndex: 1,
      scope: "repository",
      kind: "do_not_touch",
      pathPattern: "src/generated/**",
      content: "Generated files are overwritten by tooling.",
      source: "user_interview",
      createdAt: 1_785_000_040,
    },
  ];
}

function defaultModelCatalog() {
  const supportedCapabilities = {
    structuredOutput: "supported",
    reasoningControl: "supported",
    backgroundMode: "supported",
    api: "supported",
    cli: "unknown",
    acp: "unknown",
  };

  return {
    schemaVersion: 1,
    providers: [
      { id: "openai", displayName: "OpenAI" },
      { id: "anthropic", displayName: "Anthropic" },
    ],
    profiles: [
      {
        id: "openai-gpt-5.6-luna-low",
        providerId: "openai",
        modelId: "gpt-5.6-luna",
        displayName: "GPT-5.6 Luna",
        tier: "fast",
        parameters: [{ name: "reasoning.effort", value: "low" }],
        capabilities: supportedCapabilities,
        status: "selectable",
        unavailableReason: null,
      },
      {
        id: "openai-gpt-5.6-terra-medium",
        providerId: "openai",
        modelId: "gpt-5.6-terra",
        displayName: "GPT-5.6 Terra",
        tier: "mid",
        parameters: [{ name: "reasoning.effort", value: "medium" }],
        capabilities: supportedCapabilities,
        status: "selectable",
        unavailableReason: null,
      },
      {
        id: "openai-gpt-5.6-sol-high",
        providerId: "openai",
        modelId: "gpt-5.6-sol",
        displayName: "GPT-5.6 Sol",
        tier: "high",
        parameters: [{ name: "reasoning.effort", value: "high" }],
        capabilities: supportedCapabilities,
        status: "selectable",
        unavailableReason: null,
      },
      {
        id: "anthropic-claude-opus-4.8-high",
        providerId: "anthropic",
        modelId: "claude-opus-4-8",
        displayName: "Claude Opus 4.8",
        tier: "high",
        parameters: [{ name: "thinking", value: "adaptive" }],
        capabilities: {
          ...supportedCapabilities,
          backgroundMode: "unknown",
        },
        status: "unavailable",
        unavailableReason: "Anthropic synthesis adapter is not implemented yet",
      },
      {
        id: "anthropic-claude-fable-5-max",
        providerId: "anthropic",
        modelId: "claude-fable-5",
        displayName: "Claude Fable 5",
        tier: "max",
        parameters: [{ name: "thinking", value: "adaptive" }],
        capabilities: {
          ...supportedCapabilities,
          backgroundMode: "unknown",
        },
        status: "unavailable",
        unavailableReason: "Anthropic synthesis adapter is not implemented yet",
      },
    ],
  };
}

function defaultProjectInitializationSummary(overrides = {}) {
  return {
    id: "summary-1",
    initializationId: "init-1",
    status: "draft",
    projectPurpose: "AIadne: Project controls CLI agents. (source: README.md)",
    repositoryMap: "- AIadne: /home/katarina/projects/AIadne; git: yes; tracked files: 53",
    repositoryRoles:
      "- AIadne: Full-stack app with TypeScript frontend and Rust/Tauri backend. Manifests: package.json, src-tauri/Cargo.toml. Entry points: src/App.tsx, src-tauri/src/lib.rs.",
    buildTestMatrix:
      "- AIadne: manifests: package.json, src-tauri/Cargo.toml; test files: 12; command hints: Setup (README.md#setup)",
    fragileAreas: "- AIadne warning: Do not edit generated files. (source: README.md#important)",
    doNotTouchRules:
      "- AIadne [src/generated/**]: Generated files are overwritten by tooling. (do not touch)",
    agentWorkingRules: "- Project-wide: Always ask before schema changes. (agent rule)",
    openQuestions: "No open questions recorded by initialization.",
    factCount: 2,
    markdownFindingCount: 1,
    guardrailCount: 2,
    requestedModelProfileId: "openai-gpt-5.6-terra-medium",
    requestedModelProviderId: "openai",
    requestedModelId: "gpt-5.6-terra",
    requestedModelTier: "mid",
    requestedModelParameters: [{ name: "reasoning.effort", value: "medium" }],
    modelCatalogSchemaVersion: 1,
    knowledgeSchemaVersion: 1,
    generationEngine: "openai_responses_v1",
    createdAt: 1_785_000_050,
    approvedAt: null,
    ...overrides,
  };
}

function defaultKnowledgeUnits() {
  return [
    {
      id: "unit-purpose",
      projectId: "project-1",
      initializationId: "init-1",
      derivedFromSummaryId: "summary-1",
      kind: "purpose",
      topic: "project_purpose",
      content: "Project controls CLI agents",
      scope: "project",
      status: "active",
      confidence: 100,
      schemaVersion: 1,
      sources: [
        {
          sourceKey: "README.md#purpose",
          repositoryId: null,
          path: null,
        },
      ],
      createdAt: 1_785_000_060,
    },
    {
      id: "unit-question",
      projectId: "project-1",
      initializationId: "init-1",
      derivedFromSummaryId: "summary-1",
      kind: "open_question",
      topic: "open_questions",
      content: "Needs confirmation: canonical commands.",
      scope: "project",
      status: "needs_confirmation",
      confidence: 0,
      schemaVersion: 1,
      sources: [],
      createdAt: 1_785_000_060,
    },
  ];
}

function defaultTaskContextSelection() {
  const [includedUnit, excludedUnit] = defaultKnowledgeUnits();
  return {
    initializationId: "init-1",
    characterBudget: 6000,
    usedCharacters: 120,
    remainingCharacters: 5880,
    renderedContext: "- [purpose / project_purpose] Project controls CLI agents",
    included: [
      {
        unit: includedUnit,
        score: 1000,
        reason: "mandatory_kind",
        characterCount: 120,
      },
    ],
    excluded: [
      {
        unit: excludedUnit,
        score: 0,
        reason: "uncertain_status",
        characterCount: 0,
      },
    ],
  };
}

function defaultTranscriptSession(overrides: Partial<ReturnType<typeof baseTranscriptSession>> = {}) {
  return {
    ...baseTranscriptSession(),
    ...overrides,
  };
}

function baseTranscriptSession() {
  return {
    id: "transcript-1",
    projectId: null as string | null,
    runtime: "acp",
    source: "Codex",
    title: "Codex ACP",
    startedAt: 1_785_000_001,
    updatedAt: 1_785_000_001,
    eventCount: 0,
  };
}

function defaultAcpSession() {
  return {
    id: "acp-session-1",
    state: "running",
    pid: 456,
    protocolVersion: 1,
    agentSessionId: "fake-acp-session",
    agentName: "fake-acp",
    agentVersion: "0.1.0",
    exitCode: null,
  };
}

function defaultTask(overrides: Partial<ReturnType<typeof baseTask>> = {}) {
  return {
    ...baseTask(),
    ...overrides,
  };
}

function baseTask() {
  const phases = ["analysis", "planning", "execution", "review"].map((phase, index) => ({
    id: `task-phase-${index + 1}`,
    taskId: "task-1",
    phase,
    phaseIndex: index,
    status: "pending",
    startedAt: null,
    completedAt: null,
  }));
  return {
    id: "task-1",
    projectId: "project-aiadne",
    transcriptSessionId: "transcript-1",
    originalPrompt: "Hello from AIadne",
    status: "pending",
    currentPhase: "analysis",
    initialComplexityProfile: "quick",
    initialComplexityReasons: ["bounded single-surface change"],
    initialComplexityConfidence: 82,
    complexityProfile: "quick",
    complexityReasons: ["bounded single-surface change"],
    complexityConfidence: 82 as number | null,
    complexitySource: "system",
    complexityAssessmentVersion: "deterministic_v1",
    phases,
    createdAt: 1_785_000_001,
    updatedAt: 1_785_000_001,
  };
}

function defaultTranscriptSessions() {
  return [];
}

function defaultTranscriptEvents(prefix = "old") {
  return [
    {
      id: "transcript-event-1",
      sessionId: "transcript-1",
      sequence: 0,
      kind: "user_message",
      content: `${prefix} question`,
      createdAt: 1_785_000_002,
    },
    {
      id: "transcript-event-2",
      sessionId: "transcript-1",
      sequence: 1,
      kind: "agent_message",
      content: `${prefix} answer`,
      createdAt: 1_785_000_003,
    },
  ];
}

function defaultKnowledgeItem(overrides = {}) {
  return {
    id: "knowledge-1",
    projectId: null,
    title: "UI palette",
    body: "Use earth tones.",
    kind: "decision",
    scope: "global",
    sourceTranscriptSessionId: "transcript-1",
    createdAt: 1_785_000_004,
    updatedAt: 1_785_000_004,
    ...overrides,
  };
}

function defaultDoctorReports({
  codexStatus = "installed",
}: {
  codexStatus?: "installed" | "missing" | "error";
} = {}) {
  return [
    {
      adapter: {
        id: "codex",
        displayName: "Codex",
        executable: "codex",
        transports: {
          pty: "supported",
          acpStdio: "unknown",
        },
      },
      status: codexStatus,
      path: codexStatus === "missing" ? null : "/usr/bin/codex",
      version: codexStatus === "installed" ? "codex 1.2.3" : null,
      error: codexStatus === "error" ? "version failed" : null,
      installHint: "Install the Codex CLI and make sure `codex` is available on PATH.",
    },
    {
      adapter: {
        id: "claude_code",
        displayName: "Claude Code",
        executable: "claude",
        transports: {
          pty: "unknown",
          acpStdio: "unknown",
        },
      },
      status: "missing",
      path: null,
      version: null,
      error: null,
      installHint: "Install Claude Code and make sure `claude` is available on PATH.",
    },
    {
      adapter: {
        id: "kimi",
        displayName: "Kimi",
        executable: "kimi",
        transports: {
          pty: "unknown",
          acpStdio: "unknown",
        },
      },
      status: "error",
      path: "/usr/bin/kimi",
      version: null,
      error: "version command failed",
      installHint: "Install Kimi CLI and make sure `kimi` is available on PATH.",
    },
  ];
}

function defaultAcpRegistryCandidates() {
  return [
    {
      id: "codex-acp",
      name: "Codex",
      version: "1.1.0",
      description: "ACP adapter for OpenAI's coding assistant",
      distribution: "npx",
      status: "installable",
      command: ["npx", "-y", "@agentclientprotocol/codex-acp@1.1.0"],
      runnerPath: "/usr/bin/npx",
      installHint: "Available through npx; first launch may download the ACP package.",
      sourceUrl: "https://github.com/agentclientprotocol/codex-acp",
    },
    {
      id: "kimi",
      name: "Kimi CLI",
      version: "1.48.0",
      description: "Moonshot AI's coding assistant",
      distribution: "binary",
      status: "missing_binary",
      command: ["kimi", "acp"],
      runnerPath: null,
      installHint: "Install `kimi` and make sure it is available on PATH.",
      sourceUrl: "https://github.com/MoonshotAI/kimi-cli",
    },
    {
      id: "gemini",
      name: "Gemini CLI",
      version: "0.49.0",
      description: "Google's official CLI for Gemini",
      distribution: "npx",
      status: "installable",
      command: ["npx", "-y", "@google/gemini-cli@0.49.0", "--acp"],
      runnerPath: "/usr/bin/npx",
      installHint: "Available through npx; first launch may download the ACP package.",
      sourceUrl: "https://github.com/google-gemini/gemini-cli",
    },
  ];
}
