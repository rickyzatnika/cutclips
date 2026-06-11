import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    audioUrl: v.optional(v.string()),
    videos: v.optional(v.array(v.object({
      title: v.string(),
      url: v.string(),
      thumbnail: v.string(),
      channelName: v.optional(v.string()),
    }))),
    images: v.optional(v.array(v.object({
      url: v.string(),
      alt: v.optional(v.string()),
      source: v.optional(v.string()),
    }))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.conversationId, { updatedAt: now });
    return await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      audioUrl: args.audioUrl,
      videos: args.videos,
      images: args.images,
      createdAt: now,
    });
  },
});
