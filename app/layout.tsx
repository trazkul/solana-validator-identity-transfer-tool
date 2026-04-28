import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solana Validator Identity Transfer Tool",
  description:
    "Simulation-first assistant for securely demonstrating Solana validator identity migration.",
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
