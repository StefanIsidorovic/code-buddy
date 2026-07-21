import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeItemInfo, ProjectInitializationInfo, ProjectInitializationSummaryInfo,
  TaskContextSelectionInfo } from "../../types/domain";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
import { useKnowledgeWorkspace } from "./useKnowledgeWorkspace";

const item: KnowledgeItemInfo = { id: "k1", projectId: "p1", title: "Rule", body: "Test first",
  kind: "decision", scope: "project", sourceTranscriptSessionId: null, createdAt: 1, updatedAt: 1 };
const initialization: ProjectInitializationInfo = { id: "i1", projectId: "p1", status: "summary",
  repositoryCount: 1, createdAt: 1, updatedAt: 1 };
const summary = { id: "sum1", initializationId: "i1", status: "approved" } as ProjectInitializationSummaryInfo;
const preview: TaskContextSelectionInfo = { initializationId: "i1", characterBudget: 6000,
  usedCharacters: 10, remainingCharacters: 5990, renderedContext: "context", included: [], excluded: [] };
const options = { projectId: "p1", activeTranscriptId: "t1", initialization, summary,
  prompt: "Fix tests", repositoryId: "r1" };

describe("useKnowledgeWorkspace", () => {
  beforeEach(() => invoke.mockReset());

  it("loads project cards and preserves only valid attachments", async () => {
    invoke.mockResolvedValue([item]); const { result } = renderHook(() => useKnowledgeWorkspace(options));
    await waitFor(() => expect(result.current.items).toEqual([item]));
    await act(() => result.current.toggle(item, true));
    expect(result.current.attachedItems).toEqual([item]);
    expect(invoke).toHaveBeenCalledWith("attach_knowledge_to_transcript_session",
      { sessionId: "t1", knowledgeItemId: "k1" });
  });

  it("creates, resets, and attaches a project card to the active transcript", async () => {
    invoke.mockImplementation((command) => command === "list_knowledge_items" ? Promise.resolve([]) : Promise.resolve(item));
    const { result } = renderHook(() => useKnowledgeWorkspace(options));
    act(() => { result.current.changeTitle("Rule"); result.current.changeBody("Test first"); result.current.openDialog(); });
    await act(() => result.current.create());
    expect(invoke).toHaveBeenCalledWith("create_knowledge_item", { request: { projectId: "p1",
      title: "Rule", body: "Test first", kind: "decision", scope: "project", sourceTranscriptSessionId: "t1" } });
    expect(result.current.dialogOpen).toBe(false); expect(result.current.title).toBe("");
  });

  it("requires an approved Summary before context preview", async () => {
    invoke.mockResolvedValue([]); const { result } = renderHook(() => useKnowledgeWorkspace({ ...options, summary: null }));
    await act(() => result.current.previewContext());
    expect(result.current.previewOpen).toBe(true);
    expect(result.current.previewError).toBe("Approve a Summary before previewing task context.");
  });

  it("previews task context with exact scope and budget", async () => {
    invoke.mockImplementation((command) => command === "select_project_task_context" ? Promise.resolve(preview) : Promise.resolve([]));
    const { result } = renderHook(() => useKnowledgeWorkspace(options)); await act(() => result.current.previewContext());
    expect(invoke).toHaveBeenCalledWith("select_project_task_context", { request: { initializationId: "i1",
      task: "Fix tests", repositoryId: "r1", paths: [], characterBudget: 6000 } });
    expect(result.current.preview).toEqual(preview);
  });
});
