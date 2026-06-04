import { v } from "convex/values";
import { mutation } from "./_generated/server";

const WORKER_SECRET = process.env.WORKER_API_KEY;

function checkAuth() {
  if (!WORKER_SECRET) {
    throw new Error("WORKER_API_KEY not set in Convex environment variables");
  }
}

export const claimNextJob = mutation({
  args: { workerSecret: v.string() },
  handler: async (ctx, args) => {
    if (args.workerSecret !== WORKER_SECRET) {
      throw new Error("Invalid worker secret");
    }

    const job = await ctx.db
      .query("processingJobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .first();

    if (!job) return null;

    const user = await ctx.db.get(job.userId);
    if (!user) return null;

    const project = await ctx.db.get(job.projectId);
    if (!project) {
      await ctx.db.patch(job._id, {
        status: "failed",
        error: "Project sudah tidak ada",
        completedAt: Date.now(),
      });
      return null;
    }

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
      fontFamily: job.fontFamily || null,
      outlineColor: job.outlineColor || null,
      fontSize: job.fontSize || null,
      script: job.script || null,
      isAdmin,
    };
  },
});

export const workerFailJob = mutation({
  args: {
    workerSecret: v.string(),
    jobId: v.id("processingJobs"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.workerSecret !== WORKER_SECRET) {
      throw new Error("Invalid worker secret");
    }

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

export const workerCompleteJob = mutation({
  args: {
    workerSecret: v.string(),
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
    if (args.workerSecret !== WORKER_SECRET) {
      throw new Error("Invalid worker secret");
    }

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

export const workerUpdateProgress = mutation({
  args: {
    workerSecret: v.string(),
    jobId: v.id("processingJobs"),
    progress: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.workerSecret !== WORKER_SECRET) {
      throw new Error("Invalid worker secret");
    }

    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    await ctx.db.patch(args.jobId, { progress: args.progress });
    await ctx.db.patch(job.projectId, {
      progress: args.progress,
      updatedAt: Date.now(),
    });
  },
});
