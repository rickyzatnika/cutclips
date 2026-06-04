import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

const PACKAGES: Record<string, { label: string; price: number; credits: number }> = {
  starter: { label: "Starter", price: 25000, credits: 100 },
  pro: { label: "Pro", price: 75000, credits: 200 },
  business: { label: "Business", price: 150000, credits: 500 },
};

export const getPackages = query({
  args: {},
  handler: async () => {
    return Object.entries(PACKAGES).map(([id, pkg]) => ({ id, ...pkg }));
  },
});

let invoiceCounter = Date.now();

function generateInvoiceNumber(): string {
  invoiceCounter++;
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `INV/CUT/${dateStr}/${String(invoiceCounter).slice(-6)}`;
}

export const createInvoice = mutation({
  args: {
    packageId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const pkg = PACKAGES[args.packageId];
    if (!pkg) throw new Error("Paket tidak ditemukan");

    const invoiceId = await ctx.db.insert("invoices", {
      userId: user._id,
      invoiceNumber: generateInvoiceNumber(),
      package: pkg.label,
      amount: pkg.price,
      price: pkg.price,
      credits: pkg.credits,
      status: "pending",
      createdAt: Date.now(),
    });

    return await ctx.db.get(invoiceId);
  },
});

export const getMyInvoices = query({
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
      .query("invoices")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const getInvoiceById = query({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.invoiceId);
  },
});

export const listAllInvoices = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const admin = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();
    if (admin?.role !== "admin") return [];

    return await ctx.db.query("invoices").order("desc").collect();
  },
});

export const uploadBuktiTransfer = mutation({
  args: {
    invoiceId: v.id("invoices"),
    buktiTransfer: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice tidak ditemukan");
    if (invoice.userId !== user._id) throw new Error("Unauthorized");
    if (invoice.status !== "pending") throw new Error("Invoice tidak bisa diupdate");

    await ctx.db.patch(args.invoiceId, {
      buktiTransfer: args.buktiTransfer,
    });

    return await ctx.db.get(args.invoiceId);
  },
});

export const confirmPayment = mutation({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const admin = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", identity.subject))
      .unique();
    if (admin?.role !== "admin") throw new Error("Not authorized");

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice tidak ditemukan");
    if (invoice.status !== "pending") throw new Error("Invoice sudah diproses");
    if (!invoice.buktiTransfer) throw new Error("Belum ada bukti transfer");

    const now = Date.now();

    await ctx.db.patch(args.invoiceId, {
      status: "paid",
      paidAt: now,
      confirmedBy: admin._id,
    });

    const user = await ctx.db.get(invoice.userId);
    if (!user) throw new Error("User tidak ditemukan");

    await ctx.db.patch(invoice.userId, {
      plan: invoice.package.toLowerCase() as "starter" | "pro" | "business",
      credits: user.credits + invoice.credits,
    });

    await ctx.db.insert("credits", {
      userId: invoice.userId,
      amount: invoice.credits,
      type: "purchased",
      description: `Pembelian paket ${invoice.package} - ${invoice.invoiceNumber}`,
      createdAt: now,
    });
  },
});

export const cancelExpiredInvoices = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    const expiredInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .filter((q) => q.lt(q.field("createdAt"), twentyFourHoursAgo))
      .collect();

    for (const invoice of expiredInvoices) {
      await ctx.db.patch(invoice._id, {
        status: "cancelled",
      });
    }

    return expiredInvoices.length;
  },
});
