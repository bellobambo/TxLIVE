import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TxLIVE — Solana verified football predictions",
  description: "Free-to-play World Cup predictions powered by TxLINE data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
