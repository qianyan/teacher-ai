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
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
