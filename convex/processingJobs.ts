import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

export const claimJob = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();
    if (!user) return null;

    const job = await ctx.db
      .query("processingJobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .first();

    if (!job) return null;
    if (job.projectId !== args.projectId) return null;
    if (job.userId !== user._id) return null;

    const isAdmin = user.role === "admin";

    if (user.credits < 5 && !isAdmin) {
      await ctx.db.patch(job._id, {
        status: "failed",
        error: "Insufficient credits",
        completedAt: Date.now(),
      });
      await ctx.db.patch(job.projectId, {
        status: "failed",
        error: "Credit tidak mencukupi",
        updatedAt: Date.now(),
      });
      return null;
    }

    const now = Date.now();
    await ctx.db.patch(job._id, {
      status: "processing",
      startedAt: now,
    });

    if (!isAdmin) {
      await ctx.db.patch(user._id, {
        credits: user.credits - 5,
        totalCreditsUsed: user.totalCreditsUsed + 5,
      });

      await ctx.db.insert("credits", {
        userId: user._id,
        amount: -5,
        type: "used",
        description: `Project: ${job.title}`,
        createdAt: now,
      });
    }

    await ctx.db.patch(job.projectId, {
      status: "processing",
      progress: 0,
      updatedAt: now,
    });

    return {
      jobId: job._id,
      projectId: job.projectId,
      youtubeUrl: job.youtubeUrl,
      title: job.title,
      type: job.type,
      provider: job.provider || null,
      model: job.model || null,
      accessToken: job.accessToken || null,
      fontFamily: job.fontFamily || null,
      outlineColor: job.outlineColor || null,
      fontSize: job.fontSize || null,
      script: job.script || null,
      isAdmin,
    };
  },
});

export const failJob = mutation({
  args: {
    jobId: v.id("processingJobs"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    await ctx.db.patch(args.jobId, {
      status: "failed",
      error: args.error,
      completedAt: Date.now(),
    });

    await ctx.db.patch(job.projectId, {
      status: "failed",
      error: args.error,
      progress: 0,
      updatedAt: Date.now(),
    });
  },
});

export const completeJob = mutation({
  args: {
    jobId: v.id("processingJobs"),
    clips: v.array(
      v.object({
        start: v.number(),
        end: v.number(),
        description: v.string(),
      }),
    ),
    captions: v.any(),
    voiceOver: v.string(),
    videoUrls: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      status: "completed",
      progress: 100,
      completedAt: now,
    });

    await ctx.db.patch(job.projectId, {
      status: "completed",
      shortCount: args.clips.length,
      clips: args.clips,
      captions: args.captions,
      voiceOver: args.voiceOver,
      videoUrls: args.videoUrls,
      progress: 100,
      error: undefined,
      updatedAt: now,
    });
  },
});

export const updateJobProgress = mutation({
  args: {
    jobId: v.id("processingJobs"),
    progress: v.number(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    await ctx.db.patch(args.jobId, { progress: args.progress });
    await ctx.db.patch(job.projectId, {
      progress: args.progress,
      updatedAt: Date.now(),
    });
  },
});

export const listQueued = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("processingJobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .collect();
  },
});

export const requeueStuckJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const stuckJobs = await ctx.db
      .query("processingJobs")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();

    const now = Date.now();
    const timeoutMs = 10 * 60 * 1000;

    for (const job of stuckJobs) {
      if (job.startedAt && (now - job.startedAt) > timeoutMs) {
        const retryCount = (job.retryCount || 0) + 1;
        const project = await ctx.db.get(job.projectId);
        if (!project) {
          await ctx.db.delete(job._id);
          continue;
        }
        if (retryCount >= 3) {
          await ctx.db.patch(job._id, {
            status: "failed",
            error: "Timeout after 3 retries",
            completedAt: now,
          });
          await ctx.db.patch(job.projectId, {
            status: "failed",
            error: "Waktu processing habis",
            updatedAt: now,
          });
        } else {
          await ctx.db.patch(job._id, {
            status: "queued",
            retryCount,
            startedAt: undefined,
          });
          await ctx.db.patch(job.projectId, {
            status: "queued",
            updatedAt: now,
          });
        }
      }
    }
  },
});
