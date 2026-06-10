import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getUnsent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_sent", (q) => q.eq("sent", false))
      .order("asc")
      .take(args.limit ?? 20);
  },
});

export const send = mutation({
  args: {
    type: v.union(v.literal("login"), v.literal("logout")),
    userEmail: v.string(),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      type: args.type,
      userEmail: args.userEmail,
      userName: args.userName,
      sent: false,
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

    const notification = await ctx.db
      .query("notifications")
      .withIndex("by_sent", (q) => q.eq("sent", false))
      .order("asc")
      .first();

    if (!notification) return null;

    return {
      _id: notification._id,
      type: notification.type,
      userEmail: notification.userEmail,
      userName: notification.userName,
      data: notification.data,
      createdAt: notification.createdAt,
    };
  },
});

export const markSent = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, { sent: true });
  },
});
