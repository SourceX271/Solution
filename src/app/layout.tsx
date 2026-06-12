import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solution",
  description: "Solution - Community Tech Solutions & Q&A Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
