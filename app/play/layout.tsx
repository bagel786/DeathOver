import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Play | Death Over",
};

export default function PlayLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
