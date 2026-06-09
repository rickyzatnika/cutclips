import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByVideoId = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("highlights")
      .withIndex("by_videoId_score", (q) => q.eq("videoId", args.videoId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    videoId: v.id("videos"),
    startTime: v.number(),
    endTime: v.number(),
    title: v.string(),
    category: v.union(
      v.literal("funny"),
      v.literal("emotional"),
      v.literal("inspirational"),
      v.literal("shocking"),
      v.literal("educational"),
      v.literal("hook"),
    ),
    confidenceScore: v.number(),
    viralityScore: v.number(),
    reasoning: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("highlights", {
      videoId: args.videoId,
      startTime: args.startTime,
      endTime: args.endTime,
      title: args.title,
      category: args.category,
      confidenceScore: args.confidenceScore,
      viralityScore: args.viralityScore,
      reasoning: args.reasoning,
      createdAt: Date.now(),
    });
  },
});

export const createBatch = mutation({
  args: {
    videoId: v.id("videos"),
    highlights: v.array(
      v.object({
        startTime: v.number(),
        endTime: v.number(),
        title: v.string(),
        category: v.union(
          v.literal("funny"),
          v.literal("emotional"),
          v.literal("inspirational"),
          v.literal("shocking"),
          v.literal("educational"),
          v.literal("hook"),
        ),
        confidenceScore: v.number(),
        viralityScore: v.number(),
        reasoning: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ids: string[] = [];
    for (const h of args.highlights) {
      const id = await ctx.db.insert("highlights", {
        videoId: args.videoId,
        startTime: h.startTime,
        endTime: h.endTime,
        title: h.title,
        category: h.category,
        confidenceScore: h.confidenceScore,
        viralityScore: h.viralityScore,
        reasoning: h.reasoning,
        createdAt: now,
      });
      ids.push(id);
    }
    return ids;
  },
});

export const remove = mutation({
  args: { highlightId: v.id("highlights") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.highlightId);
  },
});
