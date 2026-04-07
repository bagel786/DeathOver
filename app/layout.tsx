import type { Metadata, Viewport } from "next";
import { Anton } from "next/font/google";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "The Death Over Challenge",
  description: "A 2D cricket tactical simulator. Defend your total in the final over.",
  openGraph: {
    title: "The Death Over Challenge",
    description: "Can you defend it? Set your field, pick your delivery, survive the death over.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased ${anton.variable}`}>{children}</body>
    </html>
  );
}
