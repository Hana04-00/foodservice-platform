import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ghar Se Tiffin — home-style meal subscriptions",
  description:
    "Subscribe to a fresh, home-style lunch or dinner tiffin. Choose your weekdays, cancel before the cutoff, and carry the credit forward.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
