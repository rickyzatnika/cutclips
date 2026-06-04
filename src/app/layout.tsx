// @ts-ignore
import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata } from "next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "ShortAI - AI Short Video Generator",
    template: "%s | ShortAI",
  },
  description:
    "Ubah video YouTube panjang menjadi short video viral dengan AI. AI clipping, AI captioning, AI voice-over.",
};

import { Providers } from "@/providers/providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html  lang="id" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
