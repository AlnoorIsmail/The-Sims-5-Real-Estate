import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Sims 5 Real Estate",
  description:
    "Estimate property value, profit, and risk before deciding whether to buy.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f2eee5] text-[#17201f] antialiased">
        {children}
      </body>
    </html>
  );
}
