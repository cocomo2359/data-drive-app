import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Five-Minute News",
  description: "Local, global and tech news from your own channels, on one page.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
