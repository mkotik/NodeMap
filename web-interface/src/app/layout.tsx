import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { ChatProvider } from "@/context/ChatContext";
import Sidebar from "@/components/Sidebar/Sidebar";
import TopNav from "@/components/TopNav/TopNav";
import VerifyBanner from "@/app/_components/VerifyBanner/VerifyBanner";
import "./globals.scss";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NodeMap",
  description: "Let's go down the rabbit hole",
  openGraph: {
    title: "NodeMap",
    description: "Let's go down the rabbit hole",
    images: [{ url: "/logo.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NodeMap",
    description: "Let's go down the rabbit hole",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${spaceGrotesk.variable}`}>
      <body>
        <AuthProvider>
          <ChatProvider>
            <div className="app-layout">
              <Sidebar />
              <div className="app-main">
                <VerifyBanner />
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
