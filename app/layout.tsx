import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "700", "800"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.deathover.xyz"),
  title: {
    default: "The Death Over — Cricket Strategy Game by Safiullah Baig",
    template: "%s | Death Over",
  },
  description:
    "The Death Over is a browser-based cricket strategy game created by Safiullah Baig. Set your field, choose deliveries, bluff AI batters, and defend the final over.",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "The Death Over — Cricket Strategy Game by Safiullah Baig",
    description:
      "The Death Over is a browser-based cricket strategy game created by Safiullah Baig. Set your field, choose deliveries, bluff AI batters, and defend the final over.",
    type: "website",
    url: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased ${jetbrainsMono.variable}`}>{children}</body>
    </html>
  );
}
