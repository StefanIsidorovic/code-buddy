import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App shell", () => {
  it("renders the multi-agent workspace", () => {
    render(<App />);

    expect(screen.getByRole("main", { name: "Code Buddy" })).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New session" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Session output" })).toBeInTheDocument();
    expect(screen.getByLabelText("Terminal output")).toHaveTextContent("AGENTS.md: active");
  });
});
