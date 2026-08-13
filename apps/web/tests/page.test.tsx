import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "../app/page";
import { CodingRoom } from "../features/coding/coding-room";

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

  it("shows role-aware starter-code review feedback", async () => {
    const user = userEvent.setup();
    render(<CodingRoom />);

    fireEvent.change(screen.getByLabelText("Coding target role"), { target: { value: "QA Release Engineer" } });
    fireEvent.change(screen.getByLabelText("Coding topic"), { target: { value: "release risk filtering" } });
    await user.click(screen.getByRole("button", { name: /generate challenge/i }));
    await user.click(screen.getByRole("button", { name: /review code/i }));

    expect(screen.getByText("Local code review updated.")).toBeInTheDocument();
    expect(screen.getAllByText(/starter template/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/parsing, role-specific filtering\/aggregation/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/qa review/i).some((item) => /test|fail|pass|severity|coverage|risk|flaky/i.test(item.textContent ?? ""))).toBe(true);
  });
});
