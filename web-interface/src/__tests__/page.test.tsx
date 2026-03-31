import { render, screen } from "@testing-library/react";
import { ChatProvider } from "@/context/ChatContext";
import { AuthProvider } from "@/context/AuthContext";
import Home from "@/app/page";

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
