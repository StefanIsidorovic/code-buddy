import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AcpSessionEvent, TranscriptEventInfo } from "../../types/domain";
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
import { useAcpEventDrain } from "./useAcpEventDrain";

const event: AcpSessionEvent = { kind: "agent_message", content: "live" };
const persisted: TranscriptEventInfo = { id: "event-1", sessionId: "transcript-1", sequence: 0,
  kind: "agent_message", content: "live", createdAt: 1 };

function setup(activeId = "current") {
  const append = vi.fn(); const record = vi.fn().mockResolvedValue([persisted]);
  return { append, record, ...renderHook(() => useAcpEventDrain({ append,
    getActiveTranscriptId: () => activeId, record })) };
}

describe("useAcpEventDrain", () => {
  beforeEach(() => invoke.mockReset());
  it("pins live output to the transcript that started the prompt", async () => {
    invoke.mockResolvedValue([event]); const { result, record } = setup("new-view");
    act(() => result.current.beginPrompt("transcript-1"));
    await act(() => result.current.drain("acp-1"));
    expect(record).toHaveBeenCalledWith("transcript-1", [event]);
  });
  it("serializes overlapping drains so events persist once", async () => {
    let release: (events: AcpSessionEvent[]) => void = () => undefined;
    invoke.mockReturnValue(new Promise<AcpSessionEvent[]>((resolve) => { release = resolve; }));
    const { result, record } = setup();
    let first: Promise<TranscriptEventInfo[]>; let second: Promise<TranscriptEventInfo[]>;
    act(() => { first = result.current.drain("acp-1"); second = result.current.drain("acp-1"); });
    await act(async () => { release([event]); await Promise.all([first, second]); });
    expect(invoke).toHaveBeenCalledOnce(); expect(record).toHaveBeenCalledOnce();
  });
  it("deduplicates phase event ids captured across live drains", async () => {
    invoke.mockResolvedValue([event]); const { result } = setup();
    act(() => result.current.beginPrompt("transcript-1", true));
    await act(() => result.current.drain("acp-1")); await act(() => result.current.drain("acp-1"));
    expect(result.current.capturedPhaseEventIds()).toEqual(["event-1"]);
  });
});
