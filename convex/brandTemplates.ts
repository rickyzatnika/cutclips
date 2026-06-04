import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
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
      .query("brandTemplates")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    fontFamily: v.string(),
    outlineColor: v.string(),
    fontSize: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("brandTemplates", {
      userId: user._id,
      name: args.name,
      fontFamily: args.fontFamily,
      outlineColor: args.outlineColor,
      fontSize: args.fontSize,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("brandTemplates"),
    name: v.optional(v.string()),
    fontFamily: v.optional(v.string()),
    outlineColor: v.optional(v.string()),
    fontSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const template = await ctx.db.get(args.id);
    if (!template) throw new Error("Template not found");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.fontFamily !== undefined) patch.fontFamily = args.fontFamily;
    if (args.outlineColor !== undefined) patch.outlineColor = args.outlineColor;
    if (args.fontSize !== undefined) patch.fontSize = args.fontSize;
    await ctx.db.patch(args.id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("brandTemplates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await ctx.db.delete(args.id);
  },
});
