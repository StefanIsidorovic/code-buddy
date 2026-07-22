import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { invokeCommand } from "./tauriGateway";

describe("Tauri command gateway", () => {
  beforeEach(() => invoke.mockReset());

  it("forwards an allowed command without arguments and returns its typed result", async () => {
    invoke.mockResolvedValue([{ id: "p1" }]);
    await expect(invokeCommand<Array<{ id: string }>>("list_projects")).resolves.toEqual([{ id: "p1" }]);
    expect(invoke).toHaveBeenCalledWith("list_projects");
  });

  it("forwards command arguments unchanged", async () => {
    invoke.mockResolvedValue("output");
    const args = { sessionId: "s1" };
    await expect(invokeCommand<string>("drain_session_output", args)).resolves.toBe("output");
    expect(invoke).toHaveBeenCalledWith("drain_session_output", args);
  });

  it("preserves backend errors", () => {
    const error = new Error("backend failed");
    invoke.mockImplementationOnce(() => { throw error; });
    expect(() => invokeCommand("list_model_catalog")).toThrow(error);
  });

  it("forwards the exact ACP recovery identity to the load command", async () => {
    invoke.mockResolvedValue({ id: "local-session", agentSessionId: "saved-agent-session" });
    const args = { request: { candidateId: "codex-acp", agentSessionId: "saved-agent-session", cwd: "/repo" } };
    await invokeCommand("load_acp_registry_session", args);
    expect(invoke).toHaveBeenCalledWith("load_acp_registry_session", args);
  });

  it("forwards immutable task agent report commands through the typed boundary", async () => {
    const args = { request: { taskId: "t1", phase: "analysis", role: "advisor",
      transcriptSessionId: "advisor-transcript", content: "Finding", sourceTranscriptEventIds: ["e1"] } };
    invoke.mockResolvedValue({ id: "report-1" });
    await invokeCommand("create_task_agent_report", args);
    await invokeCommand("list_task_agent_reports", { taskId: "t1" });
    expect(invoke).toHaveBeenNthCalledWith(1, "create_task_agent_report", args);
    expect(invoke).toHaveBeenNthCalledWith(2, "list_task_agent_reports", { taskId: "t1" });
  });
});
