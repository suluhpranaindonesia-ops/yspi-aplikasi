import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YSPI — Cerita & Pencapaian Guru",
  description: "Pusat cerita guru, kisah berdampak, dan dukungan Yayasan Suluh Prana Indonesia.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/logo-yspi.png",
    shortcut: "/logo-yspi.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
