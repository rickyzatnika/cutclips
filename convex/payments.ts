import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    packId: v.string(),
    credits: v.number(),
    amount: v.number(),
    proofUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const paymentId = await ctx.db.insert("payments", {
      userId: args.userId,
      email: args.email,
      packId: args.packId,
      credits: args.credits,
      amount: args.amount,
      proofUrl: args.proofUrl,
      status: "pending",
      createdAt: now,
    });

    const user = await ctx.db.get(args.userId);

    await ctx.db.insert("notifications", {
      type: "payment",
      userEmail: args.email,
      userName: user?.name,
      data: JSON.stringify({
        paymentId,
        packId: args.packId,
        credits: args.credits,
        amount: args.amount,
        proofUrl: args.proofUrl,
      }),
      sent: false,
      createdAt: now,
    });

    return paymentId;
  },
});

export const getPending = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .collect();
  },
});

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("payments").order("desc").collect();
  },
});

export const getById = query({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.paymentId);
  },
});

export const getLatestByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email ?? ""))
      .unique();
    if (!user) return null;

    return await ctx.db
      .query("payments")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();
  },
});

export const approve = mutation({
  args: {
    paymentId: v.id("payments"),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.adminEmail))
      .unique();
    if (!admin || admin.role !== "admin") throw new Error("Not authorized");

    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Payment not found");
    if (payment.status !== "pending") throw new Error("Payment already processed");

    const user = await ctx.db.get(payment.userId);
    if (!user) throw new Error("User not found");

    const now = Date.now();

    await ctx.db.patch(payment.userId, {
      credits: user.credits + payment.credits,
    });

    await ctx.db.insert("credits", {
      userId: payment.userId,
      amount: payment.credits,
      type: "purchased",
      description: `Pembelian ${payment.credits} kredit - ${payment.packId}`,
      createdAt: now,
    });

    await ctx.db.patch(args.paymentId, {
      status: "approved",
      approvedAt: now,
    });
  },
});

export const reject = mutation({
  args: {
    paymentId: v.id("payments"),
    adminEmail: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.adminEmail))
      .unique();
    if (!admin || admin.role !== "admin") throw new Error("Not authorized");

    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Payment not found");
    if (payment.status !== "pending") throw new Error("Payment already processed");

    await ctx.db.patch(args.paymentId, {
      status: "rejected",
      adminNote: args.note,
      approvedAt: Date.now(),
    });
  },
});

export const approveByWorker = mutation({
  args: {
    paymentId: v.id("payments"),
    workerSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.workerSecret !== process.env.WORKER_API_KEY) {
      throw new Error("Invalid worker secret");
    }

    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Payment not found");
    if (payment.status !== "pending") throw new Error("Payment already processed");

    const user = await ctx.db.get(payment.userId);
    if (!user) throw new Error("User not found");

    const now = Date.now();

    await ctx.db.patch(payment.userId, {
      credits: user.credits + payment.credits,
    });

    await ctx.db.insert("credits", {
      userId: payment.userId,
      amount: payment.credits,
      type: "purchased",
      description: `Pembelian ${payment.credits} kredit - ${payment.packId}`,
      createdAt: now,
    });

    await ctx.db.patch(args.paymentId, {
      status: "approved",
      approvedAt: now,
    });
  },
});

export const rejectByWorker = mutation({
  args: {
    paymentId: v.id("payments"),
    workerSecret: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.workerSecret !== process.env.WORKER_API_KEY) {
      throw new Error("Invalid worker secret");
    }

    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Payment not found");
    if (payment.status !== "pending") throw new Error("Payment already processed");

    await ctx.db.patch(args.paymentId, {
      status: "rejected",
      adminNote: args.note,
      approvedAt: Date.now(),
    });
  },
});
