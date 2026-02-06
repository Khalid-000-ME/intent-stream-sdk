import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Intent-Stream-SDK | MEV-Proof DeFi Execution",
  description: "Sub-second, MEV-proof DeFi execution through intent streaming using Yellow Network, Uniswap v4, and Circle Arc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
