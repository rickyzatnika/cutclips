import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    image: v.optional(v.string()),
    credits: v.number(),
    totalCreditsUsed: v.number(),
    lastActive: v.optional(v.number()),
    joinedAt: v.number(),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),

  }).index("by_email", ["email"]),

  videos: defineTable({
    userId: v.optional(v.id("users")),
    guestSessionId: v.optional(v.string()),
    youtubeUrl: v.string(),
    title: v.string(),
    duration: v.number(),
    thumbnailUrl: v.optional(v.string()),
    status: v.union(
      v.literal("completed"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
    freeHighlightCount: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_guestSessionId", ["guestSessionId"]),

  transcripts: defineTable({
    videoId: v.id("videos"),
    source: v.union(v.literal("youtube"), v.literal("whisper")),
    rawText: v.string(),
    segments: v.array(
      v.object({
        start: v.number(),
        end: v.number(),
        text: v.string(),
      }),
    ),
    createdAt: v.number(),
  }).index("by_videoId", ["videoId"]),

  highlights: defineTable({
    videoId: v.id("videos"),
    startTime: v.number(),
    endTime: v.number(),
    title: v.string(),
    category: v.union(
      v.literal("funny"),
      v.literal("emotional"),
      v.literal("inspirational"),
      v.literal("shocking"),
      v.literal("educational"),
      v.literal("hook"),
    ),
    confidenceScore: v.number(),
    viralityScore: v.number(),
    reasoning: v.string(),
    createdAt: v.number(),
  })
    .index("by_videoId", ["videoId"])
    .index("by_videoId_score", ["videoId", "viralityScore"]),

  exports: defineTable({
    highlightId: v.id("highlights"),
    userId: v.optional(v.id("users")),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    downloadUrl: v.optional(v.string()),
    progress: v.optional(v.union(v.number(), v.string())),
    error: v.optional(v.string()),
    creditCost: v.number(),
    includeCaptions: v.optional(v.boolean()),
    template: v.optional(v.string()),
    sumberVideo: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_highlightId", ["highlightId"])
    .index("by_status", ["status"])
    .index("by_userId", ["userId"]),

  credits: defineTable({
    userId: v.id("users"),
    amount: v.number(),
    type: v.union(v.literal("granted"), v.literal("used"), v.literal("purchased")),
    description: v.string(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  analyzeJobs: defineTable({
    videoId: v.string(),
    youtubeUrl: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    title: v.optional(v.string()),
    duration: v.optional(v.number()),
    transcriptSegments: v.optional(v.array(
      v.object({ start: v.number(), end: v.number(), text: v.string() }),
    )),
    rawText: v.optional(v.string()),
    highlights: v.optional(v.array(
      v.object({
        startTime: v.number(),
        endTime: v.number(),
        title: v.string(),
        category: v.string(),
        confidenceScore: v.number(),
        viralityScore: v.number(),
        reasoning: v.string(),
      }),
    )),
    error: v.optional(v.string()),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  }).index("by_status", ["status"]).index("by_youtubeUrl", ["youtubeUrl"]),

  notifications: defineTable({
    type: v.union(v.literal("login"), v.literal("logout"), v.literal("payment")),
    userEmail: v.string(),
    userName: v.optional(v.string()),
    data: v.optional(v.string()),
    sent: v.boolean(),
    createdAt: v.number(),
  }).index("by_sent", ["sent"]),

  payments: defineTable({
    userId: v.id("users"),
    email: v.string(),
    packId: v.string(),
    credits: v.number(),
    amount: v.number(),
    proofUrl: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    adminNote: v.optional(v.string()),
    createdAt: v.number(),
    approvedAt: v.optional(v.number()),
  })
      .index("by_status", ["status"])
      .index("by_userId", ["userId"]),

  dramas: defineTable({
    source: v.string(),
    externalId: v.string(),
    title: v.string(),
    cover: v.string(),
    description: v.optional(v.string()),
    totalEpisodes: v.number(),
    cloudinaryUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_source_external", ["source", "externalId"])
    .index("by_source", ["source"]),

  episodes: defineTable({
    dramaId: v.id("dramas"),
    episodeNumber: v.number(),
    title: v.string(),
    videoUrl: v.string(),
    cloudinaryUrl: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("expired"), v.literal("uploaded")),
    createdAt: v.number(),
  })
    .index("by_dramaId", ["dramaId"])
    .index("by_dramaId_episode", ["dramaId", "episodeNumber"]),

  conversations: defineTable({
    userEmail: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_email", ["userEmail"]),

  messages: defineTable({
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
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),
});
