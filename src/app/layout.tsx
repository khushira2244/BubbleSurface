import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BubbleSurface — Human-governed WebMCP for cybersecurity",
  description: "A dynamic WebMCP capability and control layer for cybersecurity applications.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
