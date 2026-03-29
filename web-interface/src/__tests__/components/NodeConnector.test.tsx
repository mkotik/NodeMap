import { render } from "@testing-library/react";
import { NodeConnector } from "@/components";

describe("NodeConnector", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 100, y: 200 };

  it("renders an SVG", () => {
    const { container } = render(<NodeConnector from={from} to={to} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders a path with cubic bezier curve", () => {
    const { container } = render(<NodeConnector from={from} to={to} />);
    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path?.getAttribute("d")).toContain("C");
  });

  it("applies active class when active", () => {
    const { container } = render(<NodeConnector from={from} to={to} active />);
    const path = container.querySelector("path");
    expect(path?.className.baseVal).toContain("active");
  });

  it("defaults to primary color", () => {
    const { container } = render(<NodeConnector from={from} to={to} />);
    const path = container.querySelector("path");
    expect(path?.className.baseVal).toContain("primary");
  });
});
