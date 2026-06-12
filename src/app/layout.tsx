import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Solution - 社区技术解决方案与问答平台",
    template: "%s | Solution",
  },
  description: "面向开发者的技术社区平台，提供解决方案、技术问答和优秀开发工具推荐。支持中文和英文。",
  keywords: ["技术", "解决方案", "问答", "软件推荐", "开发者社区", "编程", "tech", "solutions", "Q&A"],
  authors: [{ name: "Solution Team" }],
  creator: "Solution",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3456"),
  openGraph: {
    type: "website",
    locale: "zh_CN",
    alternateLocale: "en_US",
    siteName: "Solution",
    title: "Solution - 社区技术解决方案与问答平台",
    description: "面向开发者的技术社区平台，提供解决方案、技术问答和优秀开发工具推荐。",
    url: "/",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Solution Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Solution - 社区技术解决方案与问答平台",
    description: "面向开发者的技术社区平台，提供解决方案、技术问答和优秀开发工具推荐。",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
