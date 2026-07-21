import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationViewport } from "./NotificationViewport";
import { useNotificationStore } from "./notificationStore";

describe("notification viewport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    act(() => { useNotificationStore.getState().reset(); });
  });

  afterEach(() => {
    act(() => { useNotificationStore.getState().reset(); });
    vi.useRealTimers();
  });

  it("renders semantic messages and supports accessible dismissal", () => {
    render(<NotificationViewport />);
    act(() => {
      useNotificationStore.getState().push("success", "Workspace saved");
      useNotificationStore.getState().push("error", "Backend unavailable");
    });

    expect(screen.getByRole("status")).toHaveTextContent("Workspace saved");
    expect(screen.getByRole("alert")).toHaveTextContent("Backend unavailable");
    fireEvent.click(screen.getByRole("button", {
      name: "Dismiss notification: Workspace saved",
    }));
    expect(screen.queryByText("Workspace saved")).not.toBeInTheDocument();
    expect(screen.getByText("Backend unavailable")).toBeInTheDocument();
  });

  it("clears notifications when the viewport unmounts", () => {
    const view = render(<NotificationViewport />);
    act(() => { useNotificationStore.getState().push("success", "Temporary"); });
    view.unmount();
    expect(useNotificationStore.getState().messages).toEqual([]);
  });
});
