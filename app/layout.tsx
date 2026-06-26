import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lethe",
  description: "用密码临时分享加密纯文本内容。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
