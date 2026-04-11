import { ThemeScript } from "@/components/ThemeScript";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teacher AI — Biweekly Report",
  description: "Toddler class biweekly newsletter generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="light" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
