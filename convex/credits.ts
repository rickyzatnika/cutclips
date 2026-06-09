import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

async function getUserByEmail(ctx: any, email: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .unique();
}

export const getBalance = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await getUserByEmail(ctx, identity.email ?? "");
    if (!user) return null;

    return {
      credits: user.credits,
      totalUsed: user.totalCreditsUsed,
    };
  },
});

export const getHistory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await getUserByEmail(ctx, identity.email ?? "");
    if (!user) return [];

    return await ctx.db
      .query("credits")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .collect();
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

    const admin = await getUserByEmail(ctx, identity.email ?? "");
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

export const spendCredits = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.credits < args.amount) throw new Error("Insufficient credits");

    const now = Date.now();
    await ctx.db.patch(args.userId, {
      credits: user.credits - args.amount,
      totalCreditsUsed: (user.totalCreditsUsed || 0) + args.amount,
    });

    await ctx.db.insert("credits", {
      userId: args.userId,
      amount: -args.amount,
      type: "used",
      description: args.description,
      createdAt: now,
    });
  },
});
