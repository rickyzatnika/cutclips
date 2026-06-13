import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/landing/hero";

export const metadata: Metadata = {
  title: "CutClips — Ubah Video YouTube Jadi Clip Viral",
  description:
    "AI otomatis menemukan momen terbaik dari video YouTube dan ubah jadi Shorts, Reels, dan TikTok yang siap viral. Tanpa edit manual.",
  openGraph: {
    title: "CutClips — Temukan Highlight AI",
    description:
      "AI otomatis menemukan momen terbaik dari video YouTube dan ubah jadi Shorts, Reels, dan TikTok.",
    type: "website",
  },
};

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/workspace");

  return (
    <>
      <Navbar />
      <main>
        <Hero />
      </main>
      <Footer />
    </>
  );
}
