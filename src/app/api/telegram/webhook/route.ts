import { NextRequest, NextResponse } from "next/server";

const TG_API = "https://api.telegram.org/bot";
const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID || "";
const GROQ_KEY = process.env.GROQ_API_KEY_3 || process.env.GROQ_API_KEY_1 || "";
const TAVILY_KEY = process.env.TAVILY_API_KEY || "";
const AI_MODEL = process.env.TELEGRAM_AI_MODEL || "llama-3.3-70b-versatile";
const WORKER_SECRET = process.env.WORKER_API_KEY || "";

if (!CONVEX_URL) console.error("[TelegramBot] CONVEX_URL not set");
if (!BOT_TOKEN) console.error("[TelegramBot] TELEGRAM_BOT_TOKEN not set");
if (!ADMIN_ID) console.error("[TelegramBot] TELEGRAM_ADMIN_ID not set");

// ─── Helpers ─────────────────────────────────────────────

const TZ = "Asia/Jakarta";

function formatRp(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

function timeWIB(ts?: number): { jam: string; tgl: string } {
  const d = ts ? new Date(ts) : new Date();
  const jam = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ,
  }).format(d);
  const tgl = new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "numeric", year: "numeric", timeZone: TZ,
  }).format(d);
  return { jam, tgl };
}

// ─── Telegram API helpers ────────────────────────────────

async function tgFetch(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${TG_API}${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[TelegramBot] ${method} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

async function sendMessage(chatId: number | string, text: string, opts: Record<string, unknown> = {}) {
  return tgFetch("sendMessage", { chat_id: chatId, text, ...opts });
}

async function sendPhoto(chatId: number | string, photo: string, opts: Record<string, unknown> = {}) {
  return tgFetch("sendPhoto", { chat_id: chatId, photo, ...opts });
}

async function answerCallbackQuery(id: string, opts: Record<string, unknown> = {}) {
  return tgFetch("answerCallbackQuery", { callback_query_id: id, ...opts });
}

async function sendChatAction(chatId: number | string, action: string) {
  return tgFetch("sendChatAction", { chat_id: chatId, action });
}

// ─── Convex REST helpers ─────────────────────────────────

async function convexQuery(path: string, args: Record<string, unknown> = {}) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Convex ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.value;
}

async function convexMutation(path: string, args: Record<string, unknown> = {}) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Convex ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.value;
}

// ─── Memory helpers (via Convex) ─────────────────────────

async function getHistory(chatId: string): Promise<{ role: string; text: string }[]> {
  try {
    return await convexQuery("telegramBot:getMemory", { chatId });
  } catch {
    return [];
  }
}

async function addMemory(chatId: string, role: string, text: string) {
  try {
    await convexMutation("telegramBot:addMemory", { chatId, role, text });
  } catch (err) {
    console.error("[Memory] add error:", err);
  }
}

// ─── System prompt ────────────────────────────────────────

const SYSTEM_PROMPT = `Kamu adalah asisten AI untuk admin aplikasi CutClips — platform AI yang mengubah video YouTube jadi Shorts/Reels/TikTok.

Tugasmu bantu admin ngelola aplikasi. Kamu punya akses data REAL-TIME dari database.

DATA YANG BISA KAMU AKSES:
- Users: total, daftar nama yang online hari ini, user baru, admin
- Video: total video yang udah dianalisis
- Exports: antrian export clip (queued, processing)
- Payments: daftar pembayaran pending (lengkap dengan email user)
- Credits: credits masing-masing user
- Detail user spesifik (kalo dikasih email)

KARENA ITU:
- Jangan pernah bilang "gue gak punya akses data" — lo punya akses ke semuanya
- Kalo ditanya data, jawab pake data real-time yang udah dikasih
- Kalo data yang diminta nggak ada di konteks, bilang aja "data-nya nggak ada bos" — jangan halusinasi
- Kalo ditanya soal pembayaran, cek data pembayaran yang dikasih

KEPRIBADIAN:
- Santai, asik, panggil admin dengan "bos" - Jangan di setiap kalimat, tapi sesekali aja
- Pakai bahasa Indonesia gaul sehari-hari
- Jawab singkat tapi berbobot — maksimal 3-4 kalimat
- Kalo ditanya sesuatu yang butuh search internet, bilang "Bentar bos gue search dulu..." terus cari
- Punya ingatan — lo ingat obrolan sebelumnya sama admin
- Kalo ngasih saran, kasih alasan yang masuk akal

PENTING: Jangan pernah bilang "udah di approve" atau "udah di reject" kalo lo sendiri nggak bisa proses. Itu tugas sistem, bukan lo.`;

// ─── Groq AI ──────────────────────────────────────────────

async function aiChat(message: string, history: { role: string; text: string }[] = []) {
  const messages: { role: string; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];
  for (const h of history.slice(-20)) {
    messages.push({ role: h.role, content: h.text });
  }
  messages.push({ role: "user", content: message });

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      temperature: 0.8,
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty response");
  return content.trim();
}

async function tavilySearch(query: string): Promise<string | null> {
  if (!TAVILY_KEY) return null;
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query,
        search_depth: "basic",
        max_results: 5,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.map((r: { title: string; content: string; url: string }) =>
      `- ${r.title}: ${r.content} (${r.url})`
    ).join("\n") || null;
  } catch {
    return null;
  }
}

// ─── Data context ─────────────────────────────────────────

async function buildDataContext(text: string): Promise<string> {
  const parts: string[] = [];

  const { jam, tgl } = timeWIB();
  parts.push(`SEKARANG: Jam ${jam} WIB, tanggal ${tgl}`);

  try {
    const users: any[] = await convexQuery("users:list", {});
    const now = Date.now();
    const dayAgo = now - 86400000;
    const active = users.filter((u) => (u.lastActive || 0) > dayAgo);
    const newToday = users.filter((u) => (u.joinedAt || 0) > dayAgo);
    const admins = users.filter((u) => u.role === "admin");
    const totalCredits = users.reduce((s: number, u: any) => s + (u.credits || 0), 0);

    parts.push(`USERS:
- Total: ${users.length}
- Online hari ini (${active.length}): ${active.map((u: any) => u.name || u.email).join(", ") || "-"}
- User baru hari ini (${newToday.length}): ${newToday.map((u: any) => u.name || u.email).join(", ") || "-"}
- Admin: ${admins.map((u: any) => u.name || u.email).join(", ")}
- Credits per user:
${users.map((u: any) => `  • ${u.name || u.email}: ${u.credits || 0} credits`).join("\n")}`);
  } catch { }

  try {
    const queue: any = await convexQuery("exports:getQueueInfo", {});
    parts.push(`EXPORTS:
- Queued: ${queue.queuedCount || 0}
- Processing: ${queue.processingCount || 0}`);
  } catch { }

  try {
    const payments: any[] = await convexQuery("payments:getPending", {});
    parts.push(`PAYMENTS PENDING: ${payments.length}`);
    if (payments.length > 0) {
      parts.push(`Daftar pembayaran pending:
${payments.map((p: any) => `- ${p.email}: ${p.packId} (Rp${formatRp(p.amount)})`).join("\n")}`);
    }
  } catch { }

  // If email mentioned, fetch user detail
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    try {
      const user: any = await convexQuery("users:getByEmail", { email: emailMatch[0] });
      if (user) {
        const userPays: any[] = await convexQuery("payments:getByUser", { userId: user._id }).catch(() => []);
        const approved = userPays.filter((p: any) => p.status === "approved");
        parts.push(`USER DETAIL (${user.email}):
- Nama: ${user.name || "-"}
- Role: ${user.role || "user"}
- Credits: ${user.credits}
- Credits terpakai: ${user.totalCreditsUsed || 0}
- Join: ${new Date(user.joinedAt).toLocaleString("id-ID")}
- Total transaksi: ${approved.length}`);
      }
    } catch { }
  }

  return parts.join("\n\n");
}

// ─── Main chat handler ────────────────────────────────────

async function handleChat(chatId: number, text: string) {
  try {
    // Natural language approve/reject
    const approveMatch = text.match(
      /(?:approve|setujui|acc|terima|gas|lanjut|iya|ok)\s*(?:aja|dulu|ya|deh)?\s*(?:pembayaran|payment|transfer)?(?:\s*dari)?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
    );
    const rejectMatch = text.match(
      /(?:reject|tolak|cancel|batal|gak jadi|jangan|tidak)\s*(?:aja|dulu|ya|deh)?\s*(?:pembayaran|payment|transfer)?(?:\s*dari)?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
    );

    if (approveMatch) {
      const email = approveMatch[1];
      const pending: any[] = await convexQuery("payments:getPending", {});
      const payment = pending.find((p: any) => p.email.toLowerCase() === email.toLowerCase());
      if (payment) {
        await handleApprovePayment(chatId, payment);
      } else {
        await sendMessage(chatId, `Nggak ada pembayaran pending dari *${email}* bro.`, { parse_mode: "Markdown" });
      }
      return;
    }

    if (rejectMatch) {
      const email = rejectMatch[1];
      const pending: any[] = await convexQuery("payments:getPending", {});
      const payment = pending.find((p: any) => p.email.toLowerCase() === email.toLowerCase());
      const afterEmail = text.slice(text.toLowerCase().indexOf(email.toLowerCase()) + email.length);
      const reason = afterEmail.trim() || undefined;
      if (payment) {
        await handleRejectPayment(chatId, payment, reason);
      } else {
        await sendMessage(chatId, `Nggak ada pembayaran pending dari *${email}* bro.`, { parse_mode: "Markdown" });
      }
      return;
    }

    await sendChatAction(chatId, "typing");

    // Determine if search is needed
    const needsSearch = /(?:cari|search|google|tentang|apa itu|siapa|berapa|kapan|di mana|berita|terbaru|info|tutorial|how|what|why|when|where)/i.test(text) &&
      !/user|payment|export|clip|credit|dashboard|statistik|video|admin/i.test(text);

    // Gather data context
    const [dataContext, searchResult] = await Promise.all([
      buildDataContext(text),
      needsSearch ? tavilySearch(text) : Promise.resolve(null),
    ]);

    // Build prompt with data and optional search results
    let prompt = `Pesan admin: "${text}"\n\n`;
    if (dataContext) {
      prompt += `DATA APLIKASI REAL-TIME:\n${dataContext}\n\n`;
    }
    if (searchResult) {
      prompt += `HASIL SEARCH INTERNET:\n${searchResult}\n\n`;
    }
    prompt += `Jawab admin berdasarkan data di atas. Kalo data yang ditanya nggak ada di DATA APLIKASI, bilang aja nggak tahu. Jangan halusinasi angka atau data.`;

    const history = await getHistory(String(chatId));
    const reply = await aiChat(prompt, history);
    await addMemory(String(chatId), "assistant", reply);
    await sendMessage(chatId, reply);
  } catch (outerErr: any) {
    console.error("[Chat] AI error, fallback:", outerErr.message);
    try {
      const history = await getHistory(String(chatId));
      const reply = await aiChat(`Pesan admin: "${text}"\n\nJawab admin dengan santai.`, history);
      await addMemory(String(chatId), "assistant", reply);
      await sendMessage(chatId, reply);
    } catch (innerErr: any) {
      await sendMessage(chatId, `Waduh error bro: ${innerErr.message}`);
    }
  }
}

// ─── Payment helpers ──────────────────────────────────────

async function handleApprovePayment(chatId: number, payment: any) {
  try {
    await convexMutation("payments:approveByWorker", {
      paymentId: payment._id,
      workerSecret: WORKER_SECRET,
    });
    await sendMessage(chatId, `✅ Pembayaran dari *${payment.email}* udah di-approve bro! ${payment.credits} credits ditambahin.`, { parse_mode: "Markdown" });
  } catch (err: any) {
    await sendMessage(chatId, `Gagal approve bro: ${err.message}`);
  }
}

async function handleRejectPayment(chatId: number, payment: any, reason?: string) {
  try {
    await convexMutation("payments:rejectByWorker", {
      paymentId: payment._id,
      workerSecret: WORKER_SECRET,
      note: reason,
    });
    await sendMessage(chatId, `❌ Pembayaran dari *${payment.email}* udah di-reject bro.`, { parse_mode: "Markdown" });
  } catch (err: any) {
    await sendMessage(chatId, `Gagal reject bro: ${err.message}`);
  }
}

// ─── Callback Query Handler ───────────────────────────────

async function handleCallback(query: any) {
  const chatId = query.message.chat.id;
  if (String(chatId) !== ADMIN_ID) {
    await answerCallbackQuery(query.id, { text: "Maaf, bot ini khusus admin." });
    return;
  }

  const colonIdx = query.data.indexOf(":");
  const action = query.data.slice(0, colonIdx);
  const paymentId = query.data.slice(colonIdx + 1);

  if (!paymentId) {
    await answerCallbackQuery(query.id, { text: "Payment ID error!" });
    return;
  }

  await answerCallbackQuery(query.id, { text: action === "approve" ? "Approving..." : "Rejecting..." });

  try {
    const payment: any = await convexQuery("payments:getById", { paymentId });
    if (!payment) {
      await sendMessage(chatId, "Payment nggak ditemukan bro.");
      return;
    }
    if (payment.status !== "pending") {
      await sendMessage(chatId, `Payment ini udah ${payment.status} bro.`);
      return;
    }

    if (action === "approve") {
      await handleApprovePayment(chatId, payment);
    } else if (action === "reject") {
      await handleRejectPayment(chatId, payment);
    }
  } catch (err: any) {
    await sendMessage(chatId, `Gagal bro: ${err.message}`);
  }
}

// ─── Notification Drain ───────────────────────────────────

async function drainNotifications() {
  try {
    const notifications: any[] = await convexQuery("notifications:getUnsent", { limit: 5 });
    for (const n of notifications) {
      try {
        if (n.type === "payment") {
          let data: Record<string, unknown> = {};
          try { data = JSON.parse(n.data || "{}"); } catch { }
          const caption =
            `🧾 *Pembayaran Baru* — *${n.userName || n.userEmail}*\n\n` +
            `*Email:* ${n.userEmail}\n*Paket:* ${data.packId || "-"} (${data.credits || 0} credits)\n` +
            `*Total:* Rp${formatRp(data.amount as number || 0)}\n` +
            `*Tgl:* ${new Date(n.createdAt).toLocaleString("id-ID")}`;
          const keyboard = {
            inline_keyboard: [[
              { text: "✅ Approve", callback_data: `approve:${data.paymentId}` },
              { text: "❌ Reject", callback_data: `reject:${data.paymentId}` },
            ]],
          };
          if (data.proofUrl) {
            await sendPhoto(ADMIN_ID, data.proofUrl as string, {
              caption, parse_mode: "Markdown", reply_markup: keyboard,
            });
          } else {
            await sendMessage(ADMIN_ID, caption, { parse_mode: "Markdown", reply_markup: keyboard });
          }
        } else {
          const icon = n.type === "login" ? "🟢" : "🔴";
          const nama = n.userName || n.userEmail;
          const { jam } = timeWIB(n.createdAt);
          await sendMessage(ADMIN_ID, `${icon} *${nama}* ${n.type === "login" ? "login" : "logout"} bos, jam ${jam} barusan.`, { parse_mode: "Markdown" });
        }
        await convexMutation("notifications:markSent", { notificationId: n._id });
      } catch (err) {
        console.error("[Drain] Notification error:", err);
      }
    }
  } catch (err) {
    console.error("[Drain] Error:", err);
  }
}

// ─── Webhook Handler ──────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();

    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || "").trim();

      if (String(chatId) !== ADMIN_ID) {
        await sendMessage(chatId, "Maaf bro, bot ini khusus admin.");
        return NextResponse.json({ ok: true });
      }

      if (text) {
        await addMemory(String(chatId), "user", text);
        await handleChat(chatId, text);
      }
    }

    if (update.callback_query) {
      await handleCallback(update.callback_query);
    }

    if (update.message || update.callback_query) {
      drainNotifications().catch(() => { });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[TelegramBot/Webhook] Error:", err);
    return NextResponse.json({ ok: true });
  }
}
