import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Sims 5 Real Estate",
  description:
    "An AI-assisted real estate investment simulator that scores Abu Dhabi districts and parcels using market, land, community, and amenity signals.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-night-900 text-sand-50 antialiased">
        {children}
      </body>
    </html>
  );
}
