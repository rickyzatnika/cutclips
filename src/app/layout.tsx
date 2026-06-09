import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { Providers } from "@/providers/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "CutClips — AI Highlight Discovery",
    template: "%s | CutClips",
  },
  description:
    "AI finds the most engaging moments from your YouTube videos automatically. Turn long videos into viral Shorts, Reels, and TikToks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-black text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
