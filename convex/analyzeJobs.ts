import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    videoId: v.string(),
    youtubeUrl: v.string(),
    title: v.optional(v.string()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("analyzeJobs", {
      videoId: args.videoId,
      youtubeUrl: args.youtubeUrl,
      status: "queued",
      title: args.title,
      duration: args.duration,
      createdAt: Date.now(),
    });
  },
});

export const claimQueued = mutation({
  args: { workerSecret: v.string() },
  handler: async (ctx, args) => {
    if (args.workerSecret !== process.env.WORKER_API_KEY) {
      throw new Error("Invalid worker secret");
    }

    const job = await ctx.db
      .query("analyzeJobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .first();

    if (!job) return null;

    await ctx.db.patch(job._id, {
      status: "processing",
      startedAt: Date.now(),
    });

    return {
      jobId: job._id,
      videoId: job.videoId,
      youtubeUrl: job.youtubeUrl,
      title: job.title,
    };
  },
});

export const complete = mutation({
  args: {
    jobId: v.id("analyzeJobs"),
    title: v.string(),
    duration: v.number(),
    transcriptSegments: v.array(
      v.object({ start: v.number(), end: v.number(), text: v.string() }),
    ),
    rawText: v.string(),
    highlights: v.array(
      v.object({
        startTime: v.number(),
        endTime: v.number(),
        title: v.string(),
        category: v.string(),
        confidenceScore: v.number(),
        viralityScore: v.number(),
        reasoning: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "completed",
      title: args.title,
      duration: args.duration,
      transcriptSegments: args.transcriptSegments as any,
      rawText: args.rawText,
      highlights: args.highlights as any,
      completedAt: Date.now(),
    });
  },
});

export const fail = mutation({
  args: {
    jobId: v.id("analyzeJobs"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      error: args.error,
      completedAt: Date.now(),
    });
  },
});

export const getById = query({
  args: { jobId: v.id("analyzeJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});
