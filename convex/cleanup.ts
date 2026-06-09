import { mutation } from "./_generated/server";

export const purgeAll = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    for (const u of users) await ctx.db.delete(u._id);

    const videos = await ctx.db.query("videos").collect();
    for (const v of videos) await ctx.db.delete(v._id);

    const transcripts = await ctx.db.query("transcripts").collect();
    for (const t of transcripts) await ctx.db.delete(t._id);

    const highlights = await ctx.db.query("highlights").collect();
    for (const h of highlights) await ctx.db.delete(h._id);

    const exports = await ctx.db.query("exports").collect();
    for (const e of exports) await ctx.db.delete(e._id);

    const credits = await ctx.db.query("credits").collect();
    for (const c of credits) await ctx.db.delete(c._id);

    return "all data purged";
  },
});
