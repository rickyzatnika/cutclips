import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    videoId: v.string(),
    youtubeUrl: v.string(),
    title: v.optional(v.string()),
    duration: v.optional(v.number()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("analyzeJobs", {
      videoId: args.videoId,
      youtubeUrl: args.youtubeUrl,
      status: "queued",
      title: args.title,
      duration: args.duration,
      userId: args.userId,
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
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    await ctx.db.patch(args.jobId, {
      status: "completed",
      title: args.title,
      duration: args.duration,
      transcriptSegments: args.transcriptSegments as any,
      rawText: args.rawText,
      highlights: args.highlights as any,
      completedAt: Date.now(),
    });

    // Create video + highlights in proper tables for history page
    const existingVideo = await ctx.db
      .query("videos")
      .filter((q) => q.eq(q.field("youtubeUrl"), job.youtubeUrl))
      .first();

    let videoId: string;
    if (existingVideo) {
      videoId = existingVideo._id;
    } else {
      videoId = await ctx.db.insert("videos", {
        youtubeUrl: job.youtubeUrl,
        title: args.title,
        duration: args.duration,
        userId: job.userId,
        status: "completed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    for (const h of args.highlights) {
      await ctx.db.insert("highlights", {
        videoId: videoId as any,
        startTime: h.startTime,
        endTime: h.endTime,
        title: h.title,
        category: h.category as any,
        confidenceScore: h.confidenceScore,
        viralityScore: h.viralityScore,
        reasoning: h.reasoning,
        createdAt: Date.now(),
      });
    }
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

export const requeueAnalyze = mutation({
  args: {
    jobId: v.id("analyzeJobs"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (!admin || admin.role !== "admin") throw new Error("Not authorized");

    await ctx.db.patch(args.jobId, {
      status: "queued",
      error: undefined,
      completedAt: undefined,
      startedAt: undefined,
    });
  },
});

export const cancelAnalyze = mutation({
  args: {
    jobId: v.id("analyzeJobs"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (!admin || admin.role !== "admin") throw new Error("Not authorized");

    await ctx.db.patch(args.jobId, {
      status: "failed",
      error: "Dibatalkan oleh admin",
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
