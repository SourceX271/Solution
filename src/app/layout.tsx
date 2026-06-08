import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solution",
  description: "Solution - 社区技术文档与问答平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SessionProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
