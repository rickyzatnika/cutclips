import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { Providers } from "@/providers/providers";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Footer } from "@/components/layout/footer";

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
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg?v=3", apple: "/icon.svg?v=3" },
  appleWebApp: {
    capable: true,
    title: "CutClips",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${inter.variable} dark`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-[#050505] text-white">
        <Providers>
          <div className="pb-20 sm:pb-0">{children}</div>
          <MobileNav />
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
