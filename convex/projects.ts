import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();

    if (!user) return [];

    return await ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();

    if (!user) return null;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return null;

    return project;
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();

    if (user?.role !== "admin") return [];

    return await ctx.db
      .query("projects")
      .order("desc")
      .collect();
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) throw new Error("Not found");

    await ctx.db.delete(args.projectId);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    youtubeUrl: v.optional(v.string()),
    type: v.union(v.literal("youtube"), v.literal("script")),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    fontFamily: v.optional(v.string()),
    outlineColor: v.optional(v.string()),
    fontSize: v.optional(v.number()),
    script: v.optional(
      v.object({
        topic: v.string(),
        scenes: v.array(
          v.object({
            sceneDescription: v.string(),
            visualKeyword: v.string(),
            narration: v.string(),
            duration: v.number(),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const now = Date.now();

    const projectId = await ctx.db.insert("projects", {
      userId: user._id,
      title: args.title,
      youtubeUrl: args.youtubeUrl,
      type: args.type,
      status: "queued",
      shortCount: 0,
      totalViews: 0,
      fontFamily: args.fontFamily,
      outlineColor: args.outlineColor,
      fontSize: args.fontSize,
      script: args.script,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("processingJobs", {
      projectId,
      userId: user._id,
      youtubeUrl: args.youtubeUrl,
      title: args.title,
      type: args.type,
      provider: args.provider,
      model: args.model,
      accessToken: args.accessToken,
      fontFamily: args.fontFamily,
      outlineColor: args.outlineColor,
      fontSize: args.fontSize,
      script: args.script,
      status: "queued",
      createdAt: now,
      retryCount: 0,
    });

    return projectId;
  },
});

export const updateProgress = mutation({
  args: {
    projectId: v.id("projects"),
    progress: v.number(),
    status: v.optional(
      v.union(v.literal("processing"), v.literal("completed"), v.literal("failed")),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return; // skip

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();
    if (!user) return;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return;

    await ctx.db.patch(args.projectId, {
      progress: args.progress,
      updatedAt: Date.now(),
      ...(args.status ? { status: args.status } : {}),
    });
  },
});

export const updateProjectResult = mutation({
  args: {
    projectId: v.id("projects"),
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

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();
    if (!user) return;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return;

    await ctx.db.patch(args.projectId, {
      status: "completed",
      shortCount: args.clips.length,
      clips: args.clips,
      captions: args.captions,
      voiceOver: args.voiceOver,
      videoUrls: args.videoUrls,
      updatedAt: Date.now(),
    });
  },
});
