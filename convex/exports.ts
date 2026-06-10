import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getById = query({
  args: { exportId: v.id("exports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.exportId);
  },
});

export const getByHighlightId = query({
  args: { highlightId: v.id("highlights") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("exports")
      .withIndex("by_highlightId", (q) => q.eq("highlightId", args.highlightId))
      .first();
  },
});

export const create = mutation({
  args: {
    highlightId: v.id("highlights"),
    userId: v.optional(v.id("users")),
    creditCost: v.number(),
    includeCaptions: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("exports", {
      highlightId: args.highlightId,
      userId: args.userId,
      status: "queued",
      creditCost: args.creditCost,
      includeCaptions: args.includeCaptions ?? true,
      createdAt: Date.now(),
    });
  },
});

export const updateProgress = mutation({
  args: { exportId: v.id("exports"), workerSecret: v.string(), progress: v.string() },
  handler: async (ctx, args) => {
    if (args.workerSecret !== process.env.WORKER_API_KEY) {
      throw new Error("Invalid worker secret");
    }
    await ctx.db.patch(args.exportId, { progress: args.progress as any });
  },
});

export const claimQueued = mutation({
  args: { workerSecret: v.string() },
  handler: async (ctx, args) => {
    if (args.workerSecret !== process.env.WORKER_API_KEY) {
      throw new Error("Invalid worker secret");
    }

    const job = await ctx.db
      .query("exports")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .first();

    if (!job) return null;

    await ctx.db.patch(job._id, {
      status: "processing",
      progress: "downloading",
    });

    const highlight = await ctx.db.get(job.highlightId);
    const video = highlight ? await ctx.db.get(highlight.videoId) : null;
    const analyzeJob = video ? await ctx.db
      .query("analyzeJobs")
      .withIndex("by_youtubeUrl", (q) => q.eq("youtubeUrl", video.youtubeUrl))
      .first() : null;

    return {
      exportId: job._id,
      highlightId: job.highlightId,
      includeCaptions: job.includeCaptions ?? true,
      startTime: highlight?.startTime,
      endTime: highlight?.endTime,
      youtubeUrl: video?.youtubeUrl,
      videoTitle: video?.title,
      transcriptSegments: analyzeJob?.transcriptSegments || [],
    };
  },
});

export const complete = mutation({
  args: {
    exportId: v.id("exports"),
    downloadUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.exportId, {
      status: "completed",
      downloadUrl: args.downloadUrl,
      completedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { exportId: v.id("exports"), email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (!user) throw new Error("Not authenticated");

    const exp = await ctx.db.get(args.exportId);
    if (!exp) throw new Error("Export not found");
    if (exp.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.delete(args.exportId);
  },
});

export const getQueueInfo = query({
  args: {},
  handler: async (ctx) => {
    const queued = await ctx.db
      .query("exports")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();

    const processing = await ctx.db
      .query("exports")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();

    const totalAhead = queued.length + processing.length;

    return {
      queueLength: totalAhead,
      estimatedSeconds: totalAhead * 60,
      queuedCount: queued.length,
      processingCount: processing.length,
    };
  },
});

export const fail = mutation({
  args: {
    exportId: v.id("exports"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.exportId, {
      status: "failed",
      error: args.error,
      completedAt: Date.now(),
    });
  },
});
