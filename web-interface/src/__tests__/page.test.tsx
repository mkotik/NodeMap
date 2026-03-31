import { render, screen } from "@testing-library/react";
import { ChatProvider } from "@/context/ChatContext";
import { AuthProvider } from "@/context/AuthContext";
import Home from "@/app/page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("Home", () => {
  it("renders without crashing", () => {
    render(
      <AuthProvider>
        <ChatProvider>
          <Home />
        </ChatProvider>
      </AuthProvider>,
    );
    expect(screen.getByText("Start a conversation")).toBeInTheDocument();
  });
});
