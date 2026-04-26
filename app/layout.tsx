import { AppToaster } from "@/components/AppToaster";
import { ThemeScript } from "@/components/ThemeScript";
import type { Metadata } from "next";
import { Noto_Sans_SC, Outfit } from "next/font/google";
import "./globals.css";

const fontDisplay = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-app-display",
  display: "swap",
});

const fontBody = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-app-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Teacher AI — 托班两周周报",
  description: "托班双周简报：编辑内容、导入照片、生成 HTML 预览与长图 PNG",
  icons: {
    icon: [{ url: "/teacher-ai-icon.png", type: "image/png" }],
    apple: "/teacher-ai-icon.png",
  },
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
      <body className={`${fontDisplay.variable} ${fontBody.variable}`}>
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
