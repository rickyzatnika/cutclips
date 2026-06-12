import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email ?? ""))
      .unique();
    if (!user) return [];

    return await ctx.db
      .query("videos")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const listByGuest = query({
  args: { guestSessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("videos")
      .withIndex("by_guestSessionId", (q) => q.eq("guestSessionId", args.guestSessionId))
      .order("desc")
      .collect();
  },
});

export const getByYoutubeUrl = query({
  args: { youtubeUrl: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("videos")
      .filter((q) => q.eq(q.field("youtubeUrl"), args.youtubeUrl))
      .first();
  },
});

export const getById = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.videoId);
  },
});

export const create = mutation({
  args: {
    youtubeUrl: v.string(),
    title: v.string(),
    duration: v.number(),
    thumbnailUrl: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    guestSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("videos", {
      youtubeUrl: args.youtubeUrl,
      title: args.title,
      duration: args.duration,
      thumbnailUrl: args.thumbnailUrl,
      userId: args.userId,
      guestSessionId: args.guestSessionId,
      status: "completed",
      freeHighlightCount: args.userId ? undefined : 3,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listByUserWithClips = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (!user) return [];

    const exports = await ctx.db
      .query("exports")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    const result = [];
    for (const exp of exports) {
      const highlight = await ctx.db.get(exp.highlightId);
      if (!highlight) continue;
      const video = await ctx.db.get(highlight.videoId);
      if (!video) continue;

      result.push({
        exportId: exp._id,
        status: exp.status,
        progress: exp.progress ?? 0,
        downloadUrl: exp.downloadUrl,
        highlightId: highlight._id,
        highlightTitle: highlight.title,
        category: highlight.category,
        startTime: highlight.startTime,
        endTime: highlight.endTime,
        createdAt: exp.createdAt,
        video: {
          _id: video._id,
          youtubeUrl: video.youtubeUrl,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
        },
      });
    }

    return result;
  },
});

export const listByUserWithStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email ?? ""))
      .unique();
    if (!user) return [];

    const videos = await ctx.db
      .query("videos")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    const result = [];
    for (const video of videos) {
      const highlights = await ctx.db
        .query("highlights")
        .withIndex("by_videoId", (q) => q.eq("videoId", video._id as any))
        .collect();

      const clipExports = await ctx.db
        .query("exports")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();

      const clipCount = clipExports.filter((e) => {
        const h = highlights.find((h) => h._id === e.highlightId);
        return h && h.videoId === (video._id as any);
      }).length;

      result.push({
        ...video,
        highlightCount: highlights.length,
        clipCount,
      });
    }

    return result;
  },
});

export const remove = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const video = await ctx.db.get(args.videoId);
    if (!video) throw new Error("Video not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email ?? ""))
      .unique();
    if (!user || video.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.delete(args.videoId);
  },
});
