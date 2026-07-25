import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NOBORI Broadcast Control",
  description: "OBS browser-source overlays for NOBORI Overwatch broadcasts.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
