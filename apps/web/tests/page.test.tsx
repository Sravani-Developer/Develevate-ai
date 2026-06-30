import { render, screen } from "@testing-library/react";
import Page from "../app/page";

vi.mock("@monaco-editor/react", () => ({
  default: () => <div data-testid="editor" />
}));

describe("DevElevate dashboard", () => {
  it("renders the core product modules", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { name: "DevElevate AI" })).toBeInTheDocument();
    expect(screen.getByText("AI mock interview")).toBeInTheDocument();
    expect(screen.getByText("Real-time coding room")).toBeInTheDocument();
    expect(screen.getByText("AI resume analyzer")).toBeInTheDocument();
    expect(screen.getByText("Analytics dashboard")).toBeInTheDocument();
  });
});
