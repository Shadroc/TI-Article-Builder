import { render, screen } from "@testing-library/react";

function TestComponent() {
  return <p>Vitest is configured</p>;
}

describe("test setup", () => {
  it("renders with Testing Library", () => {
    render(<TestComponent />);
    expect(screen.getByText("Vitest is configured")).toBeInTheDocument();
  });
});
