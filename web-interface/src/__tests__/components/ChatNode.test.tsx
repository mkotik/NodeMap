import { render, screen } from "@testing-library/react";
import { ChatNode } from "@/components";

describe("ChatNode", () => {
  it("renders children", () => {
    render(<ChatNode>Hello world</ChatNode>);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("defaults to ai variant", () => {
    const { container } = render(<ChatNode>Content</ChatNode>);
    const node = container.firstChild as HTMLElement;
    expect(node.className).toContain("ai");
  });

  it("applies user variant", () => {
    const { container } = render(<ChatNode variant="user">Content</ChatNode>);
    const node = container.firstChild as HTMLElement;
    expect(node.className).toContain("user");
  });

  it("applies custom className", () => {
    const { container } = render(
      <ChatNode className="custom">Content</ChatNode>,
    );
    const node = container.firstChild as HTMLElement;
    expect(node.className).toContain("custom");
  });
});
