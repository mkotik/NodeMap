import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { ChatProvider } from "@/context/ChatContext";
import Sidebar from "@/components/Sidebar/Sidebar";
import TopNav from "@/components/TopNav/TopNav";
import "./globals.scss";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NodeMap",
  description: "AI Chat with Branching Conversations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body>
        <AuthProvider>
          <ChatProvider>
            <div className="app-layout">
              <Sidebar />
              <div className="app-main">
                <TopNav />
                <main className="app-content">{children}</main>
                <footer className="app-footer">
                  <a href="/terms">Terms of Service</a>
                  <a href="/privacy">Privacy Policy</a>
                </footer>
              </div>
            </div>
          </ChatProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
