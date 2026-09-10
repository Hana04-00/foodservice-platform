import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GharSe Tiffin — subscription home tiffin",
  description:
    "Subscribe to a daily lunch or dinner tiffin, skip days before the cutoff, and pay one monthly invoice.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
