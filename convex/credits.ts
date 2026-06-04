import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

export const getBalance = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();

    if (!user) return null;

    return {
      credits: user.credits,
      totalUsed: user.totalCreditsUsed,
      lastReset: user.lastCreditReset,
      plan: user.plan,
    };
  },
});

export const getHistory = query({
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
      .query("credits")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const resetAllMonthlyCredits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const now = Date.now();

    for (const user of users) {
      const daysSinceReset = (now - user.lastCreditReset) / (1000 * 60 * 60 * 24);
      if (daysSinceReset < 30) continue;

      const newCredits = user.plan === "starter" ? 150 : user.plan === "pro" ? 500 : 150;

      await ctx.db.patch(user._id, {
        credits: newCredits,
        lastCreditReset: now,
      });

      await ctx.db.insert("credits", {
        userId: user._id,
        amount: newCredits,
        type: "reset",
        description: "Monthly credit reset",
        createdAt: now,
      });
    }
  },
});

export const addCredits = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const admin = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();

    if (admin?.role !== "admin") throw new Error("Not authorized");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const now = Date.now();
    await ctx.db.patch(args.userId, {
      credits: user.credits + args.amount,
    });

    await ctx.db.insert("credits", {
      userId: args.userId,
      amount: args.amount,
      type: args.amount >= 0 ? "granted" : "used",
      description: args.description,
      createdAt: now,
    });
  },
});

export const resetMonthlyCredits = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const now = Date.now();
    const daysSinceReset = (now - user.lastCreditReset) / (1000 * 60 * 60 * 24);

    if (daysSinceReset < 30) return;

    const newCredits = user.plan === "starter" ? 150 : user.plan === "pro" ? 500 : 150;

    await ctx.db.patch(user._id, {
      credits: newCredits,
      lastCreditReset: now,
    });

    await ctx.db.insert("credits", {
      userId: user._id,
      amount: newCredits,
      type: "reset",
      description: "Monthly credit reset",
      createdAt: now,
    });
  },
});
