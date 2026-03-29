import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BranchButton } from "@/components";

describe("BranchButton", () => {
  it("renders children", () => {
    render(<BranchButton>New Path</BranchButton>);
    expect(
      screen.getByRole("button", { name: "New Path" }),
    ).toBeInTheDocument();
  });

  it("defaults to primary variant", () => {
    const { container } = render(<BranchButton>Click</BranchButton>);
    const btn = container.firstChild as HTMLElement;
    expect(btn.className).toContain("primary");
  });

  it("applies ghost variant", () => {
    const { container } = render(
      <BranchButton variant="ghost">Edit</BranchButton>,
    );
    const btn = container.firstChild as HTMLElement;
    expect(btn.className).toContain("ghost");
  });

  it("calls onClick handler", async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(<BranchButton onClick={handleClick}>Click</BranchButton>);
    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
