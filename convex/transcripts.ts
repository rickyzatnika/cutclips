import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByVideoId = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transcripts")
      .withIndex("by_videoId", (q) => q.eq("videoId", args.videoId))
      .first();
  },
});

export const create = mutation({
  args: {
    videoId: v.id("videos"),
    source: v.union(v.literal("youtube"), v.literal("whisper")),
    rawText: v.string(),
    segments: v.array(
      v.object({
        start: v.number(),
        end: v.number(),
        text: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("transcripts", {
      videoId: args.videoId,
      source: args.source,
      rawText: args.rawText,
      segments: args.segments,
      createdAt: Date.now(),
    });
  },
});
