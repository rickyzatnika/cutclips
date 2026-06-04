import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    auth0Id: v.optional(v.string()),
    password: v.optional(v.string()),
    plan: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("pro"),
      v.literal("business"),
    ),
    credits: v.number(),
    totalCreditsUsed: v.number(),
    lastCreditReset: v.optional(v.number()),
    lastActive: v.optional(v.number()),
    joinedAt: v.number(),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
  }).index("by_auth0Id", ["auth0Id"]).index("by_email", ["email"]),

  projects: defineTable({
    userId: v.id("users"),
    title: v.string(),
    youtubeUrl: v.optional(v.string()),
    type: v.optional(v.union(v.literal("youtube"), v.literal("script"))),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    shortCount: v.number(),
    totalViews: v.number(),
    clips: v.optional(
      v.array(
        v.object({
          start: v.number(),
          end: v.number(),
          description: v.string(),
        }),
      ),
    ),
    captions: v.optional(v.any()),
    voiceOver: v.optional(v.string()),
    videoUrls: v.optional(v.array(v.string())),
    progress: v.optional(v.number()),
    error: v.optional(v.string()),
    fontFamily: v.optional(v.string()),
    outlineColor: v.optional(v.string()),
    fontSize: v.optional(v.number()),
    script: v.optional(
      v.object({
        topic: v.string(),
        scenes: v.array(
          v.object({
            sceneDescription: v.string(),
            visualKeyword: v.string(),
            narration: v.string(),
            duration: v.number(),
          }),
        ),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  processingJobs: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    youtubeUrl: v.optional(v.string()),
    title: v.string(),
    type: v.optional(v.union(v.literal("youtube"), v.literal("script"))),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    fontFamily: v.optional(v.string()),
    outlineColor: v.optional(v.string()),
    fontSize: v.optional(v.number()),
    script: v.optional(
      v.object({
        topic: v.string(),
        scenes: v.array(
          v.object({
            sceneDescription: v.string(),
            visualKeyword: v.string(),
            narration: v.string(),
            duration: v.number(),
          }),
        ),
      }),
    ),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
    progress: v.optional(v.number()),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    retryCount: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_userId", ["userId"]),

  credits: defineTable({
    userId: v.id("users"),
    amount: v.number(),
    type: v.union(v.literal("granted"), v.literal("used"), v.literal("purchased"), v.literal("reset")),
    description: v.string(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  invoices: defineTable({
    userId: v.id("users"),
    invoiceNumber: v.string(),
    package: v.string(),
    amount: v.number(),
    price: v.number(),
    credits: v.number(),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("cancelled")),
    paidAt: v.optional(v.number()),
    confirmedBy: v.optional(v.id("users")),
    buktiTransfer: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]).index("by_status", ["status"]),

  brandTemplates: defineTable({
    userId: v.id("users"),
    name: v.string(),
    fontFamily: v.string(),
    outlineColor: v.string(),
    fontSize: v.number(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),
});
