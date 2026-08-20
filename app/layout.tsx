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
  twitter: {
    card: "summary",
    title: "The Death Over — Cricket Strategy Game by Safiullah Baig",
    description:
      "Set your field, choose deliveries, bluff AI batters, and defend the final over in a browser-based cricket strategy game.",
  },
};

const gameJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["VideoGame", "SoftwareApplication"],
      "@id": "https://www.deathover.xyz/#game",
      name: "The Death Over",
      url: "https://www.deathover.xyz/",
      description:
        "A browser-based cricket strategy game about defending the final over through field placement, delivery selection, batter behavior, and bluffing.",
      applicationCategory: "GameApplication",
      operatingSystem: "Web browser",
      gamePlatform: "Web browser",
      genre: ["Cricket", "Strategy"],
      isAccessibleForFree: true,
      creator: { "@id": "https://safiullahbaig.com/#person" },
    },
    {
      "@type": "Person",
      "@id": "https://safiullahbaig.com/#person",
      name: "Safiullah Baig",
      url: "https://safiullahbaig.com/",
      sameAs: ["https://github.com/bagel786"],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased ${jetbrainsMono.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(gameJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
