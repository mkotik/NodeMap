import { render } from "@testing-library/react";
import { NodePoint } from "@/components";

describe("NodePoint", () => {
  it("renders as a span", () => {
    const { container } = render(<NodePoint />);
    expect(container.firstChild?.nodeName).toBe("SPAN");
  });

  it("is aria-hidden", () => {
    const { container } = render(<NodePoint />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("defaults to primary color", () => {
    const { container } = render(<NodePoint />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("primary");
  });

  it("applies active class when active", () => {
    const { container } = render(<NodePoint active />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("active");
  });

  it("applies secondary color", () => {
    const { container } = render(<NodePoint color="secondary" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("secondary");
  });
});
