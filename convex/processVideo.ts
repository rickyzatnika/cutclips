import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function fetchYouTubeTitle(url: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    );
    const data = await res.json();
    return data.title || "Unknown Title";
  } catch {
    return "Unknown Title";
  }
}

async function analyzeWithGemini(title: string): Promise<{
  clips: { start: number; end: number; description: string }[];
  captions: string;
  voiceOver: string;
}> {
  const prompt = `You are an AI video editor. Given a YouTube video titled "${title}", create 2 short clips (each 30 seconds) that capture the most engaging moments.

Return ONLY valid JSON with this structure:
{
  "clips": [
    { "start": 0, "end": 30, "description": "Brief description of clip 1" },
    { "start": 30, "end": 60, "description": "Brief description of clip 2" }
  ],
  "captions": "Example animated caption text for the short video",
  "voiceOver": "Example AI voice-over narration script"
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const cleanJson = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleanJson);
}

export const processProject = action({
  args: {
    projectId: v.id("projects"),
    youtubeUrl: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const title = args.title || (await fetchYouTubeTitle(args.youtubeUrl));

    await ctx.runMutation(internal.processVideo.updateStatus, {
      projectId: args.projectId,
      status: "processing",
      title,
    });

    try {
      const result = await analyzeWithGemini(title);

      await ctx.runMutation(internal.processVideo.updateResult, {
        projectId: args.projectId,
        status: "completed",
        shortCount: result.clips.length,
        clips: result.clips,
        captions: result.captions,
        voiceOver: result.voiceOver,
      });

      return { success: true, clips: result.clips.length };
    } catch (error) {
      await ctx.runMutation(internal.processVideo.updateStatus, {
        projectId: args.projectId,
        status: "failed",
        title,
      });
      throw error;
    }
  },
});

export const updateStatus = internalMutation({
  args: {
    projectId: v.id("projects"),
    status: v.union(v.literal("processing"), v.literal("completed"), v.literal("failed")),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.title) patch.title = args.title;
    await ctx.db.patch(args.projectId, patch);
  },
});

export const updateResult = internalMutation({
  args: {
    projectId: v.id("projects"),
    status: v.union(v.literal("processing"), v.literal("completed"), v.literal("failed")),
    shortCount: v.number(),
    clips: v.array(
      v.object({
        start: v.number(),
        end: v.number(),
        description: v.string(),
      }),
    ),
    captions: v.string(),
    voiceOver: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      status: args.status,
      shortCount: args.shortCount,
      updatedAt: Date.now(),
      clips: args.clips,
      captions: args.captions,
      voiceOver: args.voiceOver,
    });
  },
});
