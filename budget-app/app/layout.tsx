import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Patrick's Budget",
  description: "Pay-period budget tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
