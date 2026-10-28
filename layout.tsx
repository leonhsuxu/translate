import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "免费翻译 · Free Translate",
  description: "基于 Google / MyMemory 公开接口的零密钥翻译工具，可一键部署到 Vercel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
