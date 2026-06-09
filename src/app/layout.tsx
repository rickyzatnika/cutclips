// @ts-ignore: CSS side-effect import type declarations are handled by Next.js app router
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
    default: "CutClips — Temukan Highlight AI",
    template: "%s | CutClips",
  },
  description:
    "AI menemukan momen paling menarik dari video YouTube kamu secara otomatis. Ubah video panjang jadi Shorts, Reels, dan TikTok viral.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-[#050505] text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
