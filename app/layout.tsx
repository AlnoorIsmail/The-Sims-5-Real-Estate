import type { Metadata } from "next";
import "./globals.css";

// Update this with your project's name and pitch — it sets the browser tab
// title and social previews.
export const metadata: Metadata = {
  title: "AI PropTech Prototype — Abu Dhabi AI PropTech Challenge",
  description:
    "Building the Intelligence Layer for Land, Investment and Communities.",
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
