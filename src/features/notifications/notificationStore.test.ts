import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toastDismissMs, useNotificationStore } from "./notificationStore";

describe("notification store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useNotificationStore.getState().reset();
  });

  afterEach(() => {
    useNotificationStore.getState().reset();
    vi.useRealTimers();
  });

  it("keeps only the three newest messages", () => {
    const { push } = useNotificationStore.getState();
    push("success", "one");
    push("error", "two");
    push("success", "three");
    push("error", "four");
    expect(useNotificationStore.getState().messages.map((message) => message.text)).toEqual([
      "two", "three", "four",
    ]);
  });

  it("supports manual dismissal", () => {
    const id = useNotificationStore.getState().push("success", "done");
    useNotificationStore.getState().dismiss(id);
    expect(useNotificationStore.getState().messages).toEqual([]);
  });

  it("dismisses messages automatically", () => {
    useNotificationStore.getState().push("error", "failed");
    vi.advanceTimersByTime(toastDismissMs);
    expect(useNotificationStore.getState().messages).toEqual([]);
  });

  it("reset clears messages, timers, and deterministic sequence", () => {
    const first = useNotificationStore.getState().push("success", "first");
    useNotificationStore.getState().reset();
    const next = useNotificationStore.getState().push("success", "next");
    expect(first.split("-").slice(-1)[0]).toBe("0");
    expect(next.split("-").slice(-1)[0]).toBe("0");
  });
});
