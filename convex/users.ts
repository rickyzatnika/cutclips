import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import bcrypt from "bcryptjs";

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();

    return user;
  },
});

export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const createOrUpdateUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();

    const now = Date.now();

    if (existing) {
      const patches: Record<string, unknown> = {
        name: args.name,
        email: args.email,
        image: args.image,
      };
      if (args.email === process.env.ADMIN_EMAIL) {
        patches.role = "admin";
      }
      await ctx.db.patch(existing._id, patches);
      return existing._id;
    }

    // Check if user exists by email but missing auth0Id (e.g. registered via password)
    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (existingByEmail && !existingByEmail.auth0Id) {
      await ctx.db.patch(existingByEmail._id, {
        auth0Id: identity.subject,
        name: args.name,
        image: args.image,
        role: args.email === process.env.ADMIN_EMAIL ? "admin" : existingByEmail.role,
      });
      return existingByEmail._id;
    }

    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      emailVerified: true,
      image: args.image,
      auth0Id: identity.subject,
      plan: "free",
      credits: 150,
      totalCreditsUsed: 0,
      joinedAt: now,
      role: args.email === process.env.ADMIN_EMAIL ? "admin" : "user",
    });

    await ctx.db.insert("credits", {
      userId,
      amount: 150,
      type: "granted",
      description: "Free signup credits",
      createdAt: now,
    });

    return userId;
  },
});

export const registerWithPassword = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existing) throw new Error("Email sudah terdaftar");

    const hashed = await bcrypt.hash(args.password, 10);
    const now = Date.now();

    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      emailVerified: true,
      password: hashed,
      plan: "free",
      credits: 150,
      totalCreditsUsed: 0,
      joinedAt: now,
      role: args.email === process.env.ADMIN_EMAIL ? "admin" : "user",
    });

    await ctx.db.insert("credits", {
      userId,
      amount: 150,
      type: "granted",
      description: "Free signup credits",
      createdAt: now,
    });

    return { _id: userId, name: args.name, email: args.email };
  },
});

export const verifyPassword = query({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (!user?.password) return null;

    const valid = await bcrypt.compare(args.password, user.password);
    if (!valid) return null;

    return { _id: user._id, name: user.name, email: user.email, image: user.image };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();

    return user?.role === "admin";
  },
});

export const getRoleByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    return user?.role ?? null;
  },
});

export const updatePlan = mutation({
  args: {
    userId: v.id("users"),
    plan: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("pro"),
      v.literal("business"),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const admin = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();

    if (admin?.role !== "admin") throw new Error("Not authorized");

    await ctx.db.patch(args.userId, { plan: args.plan });
  },
});

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();

    if (user) {
      await ctx.db.patch(user._id, { lastActive: Date.now() });
    }
  },
});

export const setAdmin = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, { role: "admin" });
  },
});
