import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("PTY test panel", () => {
  it("renders fake CLI controls", () => {
    render(<App />);

    expect(screen.getByRole("main", { name: "AIadne PTY test" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fake CLI Controls" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByLabelText("PTY output")).toHaveTextContent("No output yet.");
  });
});
