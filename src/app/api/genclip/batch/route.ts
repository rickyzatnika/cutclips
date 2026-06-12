import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "";

async function convexQuery(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.value;
}

async function convexMutation(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.value;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { youtubeUrl, videoTitle, highlights, includeCaptions, template } = body;

    if (!youtubeUrl || !highlights || !highlights.length) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return Response.json({ error: "Please sign in" }, { status: 401 });
    }

    const user = await convexQuery("users:getByEmail", { email: session.user.email });
    if (!user) return Response.json({ error: "User not found" }, { status: 401 });

    const totalCost = highlights.length * 20;
    if (user.credits < totalCost) {
      return Response.json({
        error: `Need ${totalCost} credits to generate ${highlights.length} clips. You have ${user.credits}.`,
      }, { status: 403 });
    }

    const existing = await convexQuery("videos:getByYoutubeUrl", { youtubeUrl });
    const maxEnd = Math.max(...highlights.map((h: { endTime: number }) => h.endTime));
    const videoId = existing?._id ?? await convexMutation("videos:create", {
      youtubeUrl, title: videoTitle || "Video", duration: Math.max(maxEnd, 600), userId: user._id,
    });

    const results: { highlightId: string; exportId: string; title: string }[] = [];

    for (const h of highlights) {
      const highlightId = await convexMutation("highlights:create", {
        videoId,
        startTime: h.startTime,
        endTime: h.endTime,
        title: h.title || "Highlight",
        category: h.category || "hook",
        confidenceScore: h.confidenceScore || 80,
        viralityScore: h.viralityScore || 80,
        reasoning: h.reasoning || "",
      });

      const exportId = await convexMutation("exports:create", {
        highlightId, userId: user._id, creditCost: 20,
        includeCaptions: includeCaptions !== false,
        template: template || "default",
      });

      results.push({ highlightId, exportId, title: h.title });
    }

    await convexMutation("credits:spendCredits", {
      userId: user._id,
      amount: totalCost,
      description: `Generate ${highlights.length} clips: ${videoTitle || "Video"}`,
    });

    return Response.json({ exports: results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Batch failed" }, { status: 500 });
  }
}
