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

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await convexQuery("users:getByEmail", { email: session.user.email });
  return user;
}

// POST /api/genclip — auto-save highlight on page mount (no credit cost)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { youtubeUrl, startTime, endTime, title, category, confidenceScore, viralityScore, reasoning } = body;

    if (!youtubeUrl || startTime == null || endTime == null) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const user = await getUser();
    if (!user) return Response.json({ error: "Please sign in" }, { status: 401 });

    const existing = await convexQuery("videos:getByYoutubeUrl", { youtubeUrl });
    const videoId = existing?._id ?? await convexMutation("videos:create", {
      youtubeUrl, title: title || "Video", duration: Math.max(endTime, 600), userId: user._id,
    });

    const highlightId = await convexMutation("highlights:create", {
      videoId, startTime, endTime, title: title || "Highlight",
      category: category || "hook", confidenceScore: confidenceScore || 80,
      viralityScore: viralityScore || 80, reasoning: reasoning || "",
    });

    return Response.json({ videoId, highlightId, videoTitle: title || "Video" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 500 });
  }
}

// PUT /api/genclip — create export + deduct credits (button click)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { highlightId, title, includeCaptions } = body;

    if (!highlightId) {
      return Response.json({ error: "Missing highlightId" }, { status: 400 });
    }

    const user = await getUser();
    if (!user) return Response.json({ error: "Please sign in" }, { status: 401 });
    if (user.credits < 20) return Response.json({ error: "Need 20 credits" }, { status: 403 });

    const exportId = await convexMutation("exports:create", {
      highlightId, userId: user._id, creditCost: 20, includeCaptions: includeCaptions !== false,
    });

    await convexMutation("credits:spendCredits", {
      userId: user._id, amount: 20, description: `Generate clip: ${title || "Untitled"}`,
    });

    return Response.json({ exportId });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Export failed" }, { status: 500 });
  }
}
