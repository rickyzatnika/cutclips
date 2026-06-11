import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversations")
      .withIndex("by_email", (q) => q.eq("userEmail", args.email))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: { userEmail: v.string(), title: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("conversations", {
      userEmail: args.userEmail,
      title: args.title,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTitle = mutation({
  args: { conversationId: v.id("conversations"), title: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.conversationId, { title: args.title, updatedAt: now });
  },
});

export const remove = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();
    for (const m of msgs) {
      await ctx.db.delete(m._id);
    }
    await ctx.db.delete(args.conversationId);
  },
});
