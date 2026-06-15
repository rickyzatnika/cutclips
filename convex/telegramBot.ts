import { v } from "convex/values";
import { internalAction, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

const TG_API = "https://api.telegram.org/bot";

function formatRp(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

function timeWIB(ts: number): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(new Date(ts));
}

function dateTimeWIB(ts: number): string {
  const d = new Date(ts);
  const jam = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(d);
  const tgl = new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "numeric", year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(d);
  return `${tgl} ${jam}`;
}

async function tgFetch(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`${TG_API}${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[TelegramBot] ${method} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

export const sendPendingNotifications = internalAction({
  handler: async (ctx) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminId = process.env.TELEGRAM_ADMIN_ID;
    if (!botToken || !adminId) return;

    const notifications = await ctx.runQuery(api.notifications.getUnsent, { limit: 10 });

    for (const n of notifications) {
      try {
        if (n.type === "payment") {
          let data: Record<string, unknown> = {};
          try { data = JSON.parse(n.data || "{}"); } catch {}

          const caption =
            `🧾 *Pembayaran Baru* — *${n.userName || n.userEmail}*\n\n` +
            `*Email:* ${n.userEmail}\n` +
            `*Paket:* ${data.packId || "-"} (${data.credits || 0} credits)\n` +
            `*Total:* Rp${formatRp(data.amount as number || 0)}\n` +
            `*Tgl:* ${dateTimeWIB(n.createdAt)}`;

          const keyboard = {
            inline_keyboard: [[
              { text: "✅ Approve", callback_data: `approve:${data.paymentId}` },
              { text: "❌ Reject", callback_data: `reject:${data.paymentId}` },
            ]],
          };

          if (data.proofUrl) {
            await tgFetch(botToken, "sendPhoto", {
              chat_id: adminId,
              photo: data.proofUrl,
              caption,
              parse_mode: "Markdown",
              reply_markup: keyboard,
            });
          } else {
            await tgFetch(botToken, "sendMessage", {
              chat_id: adminId,
              text: caption,
              parse_mode: "Markdown",
              reply_markup: keyboard,
            });
          }
        } else {
          const icon = n.type === "login" ? "🟢" : "🔴";
          const jam = timeWIB(n.createdAt);
          const nama = n.userName || n.userEmail;
          await tgFetch(botToken, "sendMessage", {
            chat_id: adminId,
            text: `${icon} *${nama}* ${n.type === "login" ? "login" : "logout"} bos, jam ${jam} barusan.`,
            parse_mode: "Markdown",
          });
        }

        await ctx.runMutation(api.notifications.markSent, { notificationId: n._id });
      } catch (err) {
        console.error("[TelegramBot/Notif] Error:", err);
      }
    }
  },
});

export const getMemory = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("telegramMemory")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();
    return doc?.history ?? [];
  },
});

export const addMemory = mutation({
  args: {
    chatId: v.string(),
    role: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("telegramMemory")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();

    const entry = { role: args.role, text: args.text, ts: Date.now() };

    if (existing) {
      const history = [...existing.history, entry].slice(-50);
      await ctx.db.patch(existing._id, { history });
    } else {
      await ctx.db.insert("telegramMemory", {
        chatId: args.chatId,
        history: [entry],
      });
    }
  },
});

export const clearMemory = mutation({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("telegramMemory")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
