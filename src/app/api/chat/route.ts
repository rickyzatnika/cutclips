import { NextResponse } from "next/server";
import { createApi } from "unsplash-js";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

function getApiKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`GROQ_API_KEY_${i}`];
    if (key) keys.push(key);
  }
  if (keys.length === 0) {
    const fallback = process.env.GROQ_API_KEY;
    if (fallback) keys.push(fallback);
  }
  return keys;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Cari informasi terbaru dari web pakai Tavily search engine",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Kata kunci pencarian" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_images",
      description: "Cari gambar dari Pexels dan Unsplash berdasarkan kata kunci",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Kata kunci gambar" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_youtube",
      description: "Cari video YouTube berdasarkan kata kunci",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Kata kunci video YouTube" },
          maxResults: { type: "number", description: "Maksimal hasil (default 5)" },
        },
        required: ["query"],
      },
    },
  },
];

async function convexMutation(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.value;
}

async function convexQuery(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.value;
}

async function transcribeAudio(audioFile: File): Promise<string> {
  const keys = getApiKeys();
  if (keys.length === 0) throw new Error("No GROQ API keys configured");

  for (const key of keys) {
    try {
      const formData = new FormData();
      formData.append("file", audioFile);
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("language", "id");

      const res = await fetch(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: formData,
        },
      );

      if (res.status === 429 || res.status === 413) continue;
      if (!res.ok) continue;

      const data = await res.json();
      return data.text || "";
    } catch {
      continue;
    }
  }

  throw new Error("All Groq API keys failed for transcription");
}

// --- Tool implementations ---

async function tavilySearch(query: string) {
  if (!TAVILY_API_KEY) return { error: "Tavily API key not configured" };
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "basic",
        include_images: true,
        max_results: 5,
      }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { error: String(err) };
  }
}

async function pexelsSearch(query: string) {
  if (!PEXELS_API_KEY) return { error: "Pexels API key not configured" };
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5`,
      { headers: { Authorization: PEXELS_API_KEY } },
    );
    const data = await res.json();
    return data;
  } catch (err) {
    return { error: String(err) };
  }
}

const unsplash = UNSPLASH_ACCESS_KEY
  ? createApi({ accessKey: UNSPLASH_ACCESS_KEY })
  : null;

async function unsplashSearch(query: string) {
  if (!unsplash) return { error: "Unsplash API key not configured" };
  try {
    const { data, error } = await unsplash.GET("/search/photos", {
      params: { query: { query, per_page: 5 } },
    });
    if (error) return { error: String(error) };
    return data;
  } catch (err) {
    return { error: String(err) };
  }
}

async function youtubeSearch(query: string, maxResults = 5) {
  if (!YOUTUBE_API_KEY) return { error: "YouTube API key not configured" };
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&maxResults=${maxResults}&type=video&key=${YOUTUBE_API_KEY}`,
    );
    const data = await res.json();
    return data;
  } catch (err) {
    return { error: String(err) };
  }
}

// --- Groq call with tool support ---

async function callGroqWithTools(
  messages: { role: string; content: string }[],
): Promise<{
  content: string;
  images: { url: string; alt?: string; source?: string }[];
  videos: { title: string; url: string; thumbnail: string; channelName?: string }[];
}> {
  const keys = getApiKeys();

  async function groqCompletion(
    msgs: { role: string; content: string }[],
    tools?: unknown,
  ): Promise<{ content: string; toolCalls?: { id: string; type: string; function: { name: string; arguments: string } }[] }> {
    for (const key of keys) {
      for (const model of MODELS) {
        try {
          const body: Record<string, unknown> = {
            model,
            messages: msgs,
            temperature: 0.7,
            max_tokens: 1024,
          };
          if (tools) body.tools = tools;

          const res = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`,
              },
              body: JSON.stringify(body),
            },
          );

          if (res.status === 429 || res.status === 413) continue;
          if (!res.ok) continue;

          const data = await res.json();
          const choice = data.choices?.[0]?.message;
          return {
            content: choice?.content || "",
            toolCalls: choice?.tool_calls,
          };
        } catch {
          continue;
        }
      }
    }
    return { content: "" };
  }

  // First call with tools
  const first = await groqCompletion(messages, TOOLS);

  const extraImages: { url: string; alt?: string; source?: string }[] = [];
  const extraVideos: { title: string; url: string; thumbnail: string; channelName?: string }[] = [];

  if (first.toolCalls && first.toolCalls.length > 0) {
    const toolMessages = [...messages];

    for (const tc of first.toolCalls) {
      if (tc.type !== "function") continue;
      const fn = tc.function;
      let result: unknown;

      try {
        const args = JSON.parse(fn.arguments);

        switch (fn.name) {
          case "search_web": {
            const r = await tavilySearch(args.query);
            result = {
              results: (r.results || []).slice(0, 5).map((item: Record<string, string>) => ({
                title: item.title,
                url: item.url,
                content: item.content?.slice(0, 300),
              })),
              images: (r.images || []).slice(0, 3),
            };
            break;
          }
          case "search_images": {
            const [pexelRes, unsplashRes] = await Promise.all([
              pexelsSearch(args.query),
              unsplashSearch(args.query),
            ]);

            const pexelPhotos = pexelRes.photos || [];
            const unsplashPhotos = (unsplashRes && "results" in unsplashRes ? unsplashRes.results : []) as Record<string, unknown>[];

            result = {
              pexels_count: pexelPhotos.length,
              unsplash_count: unsplashPhotos.length,
            };

            if (pexelPhotos.length > 0) {
              extraImages.push(
                ...pexelPhotos.slice(0, 4).map((p: Record<string, unknown>) => {
                  const psrc = p.src as Record<string, string>;
                  return {
                    url: psrc?.medium || psrc?.original || (p as Record<string, string>).url,
                    alt: (p as Record<string, string>).alt || args.query,
                    source: "Pexels",
                  };
                }),
              );
            }

            if (unsplashPhotos.length > 0) {
              extraImages.push(
                ...unsplashPhotos.slice(0, 4).map((p: Record<string, unknown>) => ({
                  url: (p.urls as Record<string, string>)?.regular || (p.urls as Record<string, string>)?.small || "",
                  alt: (p as Record<string, string>).alt_description || args.query,
                  source: "Unsplash",
                })),
              );
            }
            break;
          }
          case "search_youtube": {
            const r = await youtubeSearch(args.query, args.maxResults || 5);
            const items = r.items || [];
            result = {
              videos: items.slice(0, 5).map((item: Record<string, unknown>) => ({
                title: (item.snippet as Record<string, string>)?.title || "",
                videoId: (item.id as Record<string, string>)?.videoId || "",
                channelName: (item.snippet as Record<string, string>)?.channelTitle || "",
                thumbnail: (item.snippet as Record<string, unknown>)?.thumbnails
                  ? ((item.snippet as Record<string, unknown>).thumbnails as Record<string, unknown>)?.high
                    ? (((item.snippet as Record<string, unknown>).thumbnails as Record<string, Record<string, string>>)?.high?.url || "")
                    : (((item.snippet as Record<string, unknown>).thumbnails as Record<string, Record<string, string>>)?.default?.url || "")
                  : "",
              })),
            };
            if (items.length > 0) {
              extraVideos.push(
                ...items.slice(0, 5).map((item: Record<string, unknown>) => {
                  const snippet = item.snippet as Record<string, string>;
                  const idData = item.id as Record<string, string>;
                  const thumbs = (item.snippet as Record<string, unknown>).thumbnails as Record<string, Record<string, string>>;
                  return {
                    title: snippet?.title || "",
                    url: `https://youtube.com/watch?v=${idData?.videoId || ""}`,
                    thumbnail: thumbs?.high?.url || thumbs?.default?.url || "",
                    channelName: snippet?.channelTitle || "",
                  };
                }),
              );
            }
            break;
          }
          default:
            result = { error: `Unknown tool: ${fn.name}` };
        }
      } catch (e) {
        result = { error: String(e) };
      }

      toolMessages.push({
        role: "assistant",
        content: "",
        tool_calls: [tc],
      } as unknown as { role: string; content: string });
      toolMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      } as unknown as { role: string; content: string });
    }

    const second = await groqCompletion(toolMessages);
    return {
      content: second.content,
      images: extraImages,
      videos: extraVideos,
    };
  }

  return { content: first.content, images: [], videos: [] };
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const audioFile = formData.get("audio") as File | null;
      const convId = (formData.get("conversationId") as string) || "";
      const email = formData.get("email") as string;

      if (!audioFile || !email) {
        return NextResponse.json(
          { error: "Audio file and email are required" },
          { status: 400 },
        );
      }

      const transcript = await transcribeAudio(audioFile);
      return NextResponse.json({ conversationId: convId, transcript });
    }

    const { conversationId, message, email } = await req.json();

    if (!message || !email) {
      return NextResponse.json(
        { error: "Message and email are required" },
        { status: 400 },
      );
    }

    let convId = conversationId;

    if (!convId) {
      convId = await convexMutation("conversations:create", {
        userEmail: email,
        title: message.slice(0, 60),
      });
    }

    await convexMutation("messages:send", {
      conversationId: convId,
      role: "user",
      content: message,
    });

    const history = await convexQuery("messages:list", {
      conversationId: convId,
    });

    // Fetch user's own data for AI context
    let userDataStr = "";
    try {
      const user = await convexQuery("users:getByEmail", { email });
      const clips = await convexQuery("videos:listByUserWithClips", { email });
      const unclipped = await convexQuery("highlights:listUnclipped", { email });

      const uniqueVideos = new Set(clips.map((c: any) => c.video?._id).filter(Boolean));
      const totalVideos = uniqueVideos.size;
      const totalClips = clips.length;
      const totalHighlights = unclipped.length;

      userDataStr =
        "\n\n== DATA USER (hanya info user ini) ==\n" +
        `Nama: ${user?.name || "-"}\n` +
        `Email: ${user?.email || email}\n` +
        `Sisa Kredit: ${user?.credits ?? 0}\n` +
        `Total Kredit Terpakai: ${user?.totalCreditsUsed ?? 0}\n` +
        `Total Video Dianalisis: ${totalVideos}\n` +
        `Total Highlight: ${totalHighlights}\n` +
        `Total Clip Dibuat: ${totalClips}\n` +
        `Bergabung Sejak: ${user?.joinedAt ? new Date(user.joinedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}\n` +
        `Role: ${user?.role || "user"}\n`;
    } catch {
      userDataStr = "\n\n(Gagal memuat data user)";
    }

    const groqMessages: { role: string; content: string }[] = [
      {
        role: "system",
        content:
          "Kamu adalah asisten AI dari aplikasi CutClips — pembuat video pendek viral (TikTok/Shorts/Reels). " +
          "Tugasmu membantu USER (bukan admin) menggunakan fitur aplikasi. " +
          "Kamu punya akses ke tools: search_web (Tavily), search_images (Pexels), search_youtube. " +
          "Gunakan tools ini saat user minta informasi, gambar, atau video YouTube. " +
          "Kamu TIDAK punya akses ke data admin, data pengguna lain, atau data sensitif. " +
          "Jangan pernah membaca, mengintip, atau membocorkan data admin. " +
          "Gunakan Bahasa Indonesia yang santai dan ramah, panggil user 'kak'. " +
          "Jika user menanyakan data miliknya sendiri (seperti sisa kredit, jumlah video, highlight, dll), " +
          "jawab langsung dari DATA USER di bawah ini. " +
          "Jangan pernah menyebutkan data user lain." +
          "" +
          "BATASI balasan maksimal 8-10 kalimat singkat dan padat. Jangan lebay. " +
          "" +
          "Berikut panduan fitur yang wajib kamu kuasai:\n" +
          "\n" +
          "== FITUR UTAMA ==\n" +
          "1. Analyze (/analyze) — Tempel link YouTube, tunggu proses analisis, dapat daftar highlight (momen viral).\n" +
          "2. Generate (/generate) — Pilih highlight, klik 'Buat Clip', tunggu rendering video, hasilnya video siap download.\n" +
          "3. Workspace (/workspace) — Halaman utama setelah login. Lihat semua clip yang sudah digenerate.\n" +
          "4. History (/workspace/history) — Riwayat highlight yang belum di-clip. Bisa dihapus atau dibikin clip.\n" +
          "5. Billing (/workspace/billing) — Beli kredit. Ada 3 paket: Gratis (gratis), Starter (25rb, 200 kredit — bonus 100!), Kreator (75rb, 500 kredit).\n" +
          "6. Cara beli: pilih paket → klik Beli → scan QRIS → upload bukti bayar → tunggu approve admin → kredit otomatis masuk.\n" +
          "7. User Info (/workspace/user-info) — Lihat profil, sisa kredit, kredit terpakai.\n" +
          "8. Chat AI (/chat-ai) — Ini kamu! User bisa tanya-tanya di sini.\n" +
          "\n" +
          "== ALUR PEMBELIAN KREDIT ==\n" +
          "- User klik 'Isi Credit' di tab bawah / menu billing\n" +
          "- Pilih paket Starter (25rb/200 kredit — bonus 100!) atau Kreator (75rb/500 kredit)\n" +
          "- Klik Beli, muncul invoice dengan QRIS\n" +
          "- Scan QRIS pakai GoPay, m-banking, atau e-wallet lain\n" +
          "- Setelah bayar, upload bukti transfer\n" +
          "- Admin akan approve, kredit masuk otomatis\n" +
          "\n" +
          "== PENTING ==\n" +
          "- Jangan pernah mengaku sebagai admin atau punya akses admin.\n" +
          "- Jika user minta sesuatu di luar kemampuanmu, arahkan ke admin.\n" +
          "- Jika user nanya soal error teknis, arahkan hubungi admin.\n" +
          "- Jangan pernah memberikan informasi pricing di luar yang sudah disebutkan.\n" +
          "- Balas dengan 3-4 kalimat maksimal, to the point, ga usah basa-basi.\n" +
          "- Kamu bisa bantu cari ide konten, rekomendasi video viral, atau jelasin cara pakai fitur.\n" +
          userDataStr,
      },
      ...history.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const { content: aiResponse, images, videos } = await callGroqWithTools(groqMessages);

    const saveArgs: Record<string, unknown> = {
      conversationId: convId,
      role: "assistant",
      content: aiResponse,
    };
    if (videos.length > 0) saveArgs.videos = videos;
    if (images.length > 0) saveArgs.images = images;

    const msgId = await convexMutation("messages:send", saveArgs);

    return NextResponse.json({
      conversationId: convId,
      messageId: msgId,
      content: aiResponse,
      images,
      videos,
    });
  } catch (err) {
    console.error("[chat] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
