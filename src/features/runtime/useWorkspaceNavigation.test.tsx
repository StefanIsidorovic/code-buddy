import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";

describe("useWorkspaceNavigation", () => {
  it("defaults to Task workspace and preserves an explicit Knowledge selection", () => {
    const { result } = renderHook(() => useWorkspaceNavigation());
    expect(result.current.activeView).toBe("task");
    act(() => result.current.changeView("knowledge"));
    expect(result.current.activeView).toBe("knowledge");
  });
});
