import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
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
  description: "Node Based AI Chat",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body>
        <div className="app-layout">
          <Sidebar />
          <div className="app-main">
            <TopNav />
            <main className="app-content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
