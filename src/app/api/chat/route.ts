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
      description:
        "Cari gambar dari Pexels dan Unsplash berdasarkan kata kunci",
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
          maxResults: {
            type: "number",
            description: "Maksimal hasil (default 5)",
          },
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
  videos: {
    title: string;
    url: string;
    thumbnail: string;
    channelName?: string;
  }[];
}> {
  const keys = getApiKeys();

  async function groqCompletion(
    msgs: { role: string; content: string }[],
    tools?: unknown,
  ): Promise<{
    content: string;
    toolCalls?: {
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }[];
  }> {
    for (const key of keys) {
      for (const model of MODELS) {
        try {
          const body: Record<string, unknown> = {
            model,
            messages: msgs,
            temperature: 0.4,
            max_tokens: 2048,
          };
          if (tools) {
            body.tools = tools;
            body.tool_choice = "auto";
          }

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

  function stripFunctionTags(text: string): string {
    return text
      .replace(/<function=\w+>.*?<\/function>/g, "")
      .replace(/<function=\w+\/>/g, "")
      .replace(/<function=\w+>.*/g, "")
      .trim();
  }

  const extraImages: { url: string; alt?: string; source?: string }[] = [];
  const extraVideos: {
    title: string;
    url: string;
    thumbnail: string;
    channelName?: string;
  }[] = [];

  let currentMessages = [...messages];
  let finalContent = "";
  const maxRounds = 3;

  for (let round = 0; round < maxRounds; round++) {
    const result = await groqCompletion(currentMessages, TOOLS);

    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolMessages = [...currentMessages];

      for (const tc of result.toolCalls) {
        if (tc.type !== "function") continue;
        const fn = tc.function;
        let toolResult: unknown;

        try {
          const args = JSON.parse(fn.arguments);

          switch (fn.name) {
            case "search_web": {
              const r = await tavilySearch(args.query);
              toolResult = {
                results: (r.results || [])
                  .slice(0, 5)
                  .map((item: Record<string, string>) => ({
                    title: item.title,
                    url: item.url,
                    content: item.content?.slice(0, 300),
                  })),
                images: (r.images || []).slice(0, 3),
              };
              break;
            }
            case "search_images": {
              const unsplashRes = await unsplashSearch(args.query);
              const unsplashPhotos = (
                unsplashRes && "results" in unsplashRes
                  ? unsplashRes.results
                  : []
              ) as Record<string, unknown>[];

              toolResult = {
                unsplash_count: unsplashPhotos.length,
              };

              if (unsplashPhotos.length > 0) {
                extraImages.push(
                  ...unsplashPhotos
                    .slice(0, 8)
                    .map((p: Record<string, unknown>) => ({
                      url:
                        (p.urls as Record<string, string>)?.regular ||
                        (p.urls as Record<string, string>)?.small ||
                        "",
                      alt:
                        (p as Record<string, string>).alt_description ||
                        args.query,
                      source: "Unsplash",
                    })),
                );
              }
              break;
            }
            case "search_youtube": {
              const r = await youtubeSearch(args.query, args.maxResults || 5);
              const items = r.items || [];
              toolResult = {
                videos: items
                  .slice(0, 5)
                  .map((item: Record<string, unknown>) => ({
                    title:
                      (item.snippet as Record<string, string>)?.title || "",
                    videoId: (item.id as Record<string, string>)?.videoId || "",
                    channelName:
                      (item.snippet as Record<string, string>)?.channelTitle ||
                      "",
                    thumbnail: (item.snippet as Record<string, unknown>)
                      ?.thumbnails
                      ? (
                          (item.snippet as Record<string, unknown>)
                            .thumbnails as Record<string, unknown>
                        )?.high
                        ? (
                            (item.snippet as Record<string, unknown>)
                              .thumbnails as Record<
                              string,
                              Record<string, string>
                            >
                          )?.high?.url || ""
                        : (
                            (item.snippet as Record<string, unknown>)
                              .thumbnails as Record<
                              string,
                              Record<string, string>
                            >
                          )?.default?.url || ""
                      : "",
                  })),
              };
              if (items.length > 0) {
                extraVideos.push(
                  ...items.slice(0, 5).map((item: Record<string, unknown>) => {
                    const snippet = item.snippet as Record<string, string>;
                    const idData = item.id as Record<string, string>;
                    const thumbs = (item.snippet as Record<string, unknown>)
                      .thumbnails as Record<string, Record<string, string>>;
                    return {
                      title: snippet?.title || "",
                      url: `https://youtube.com/watch?v=${idData?.videoId || ""}`,
                      thumbnail:
                        thumbs?.high?.url || thumbs?.default?.url || "",
                      channelName: snippet?.channelTitle || "",
                    };
                  }),
                );
              }
              break;
            }
            default:
              toolResult = { error: `Unknown tool: ${fn.name}` };
          }
        } catch (e) {
          toolResult = { error: String(e) };
        }

        toolMessages.push({
          role: "assistant",
          content: "",
          tool_calls: [tc],
        } as unknown as { role: string; content: string });
        toolMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult),
        } as unknown as { role: string; content: string });
      }

      currentMessages = toolMessages;
    } else {
      finalContent = stripFunctionTags(result.content || "").trim();
      if (!finalContent && round === maxRounds - 1) {
        finalContent =
          "Coba ulangi pertanyaannya dengan cara yang berbeda ya, biar saya bisa bantu.";
      }
      break;
    }
  }

  return { content: finalContent, images: extraImages, videos: extraVideos };
}

async function processWithLLM(
  convId: string,
  email: string,
  userMessage: string,
) {
  const allHistory = await convexQuery("messages:list", {
    conversationId: convId,
  });
  const history = allHistory.slice(-15);

  let userDataStr = "";
  // const needsUserData = /kredit|saldo|clip|video|highlight|user|akun|profil|data/i.test(
  //   userMessage,
  // );
  const needsUserData =
    /(kredit|credit|saldo|clip|video|highlight|akun|profil|user|data|statistik|generate|riwayat|hasil|sisa)/i.test(
      userMessage,
    );
  if (needsUserData) {
    try {
      const user = await convexQuery("users:getByEmail", { email });
      const clips = await convexQuery("videos:listByUserWithClips", { email });
      const unclipped = await convexQuery("highlights:listUnclipped", {
        email,
      });

      const uniqueVideos = new Set(
        clips.map((c: any) => c.video?._id).filter(Boolean),
      );
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
  }

  const now = new Date();
  const nowFormatted = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const SYSTEM_PROMPT = `
Hari ini: ${nowFormatted}

# IDENTITAS

Kamu adalah AI Assistant resmi CutClips.

Tugas utama:
- Membantu pengguna menggunakan CutClips.
- Menjelaskan fitur aplikasi.
- Memberikan ide konten.
- Memberikan ide video viral.
- Menggunakan tools jika diperlukan.

# PRIORITAS JAWABAN

1. Jika user sedang ngobrol santai, balas seperti manusia biasa.
2. Jika user bertanya tentang CutClips, gunakan pengetahuan CutClips.
3. Jika user meminta pencarian, gunakan tools yang tersedia.
4. Jika user meminta data dirinya, gunakan DATA USER.
5. Jangan menjelaskan fitur CutClips jika tidak ditanyakan.

# TOOLS

Tools tersedia:
- search_web
- search_images
- search_youtube

Gunakan tool calling resmi.

Jika informasi membutuhkan data terbaru:
gunakan tools yang tersedia.

Jangan pernah menulis syntax tool atau function ke dalam balasan.

Jangan mengarang:
- hasil pencarian
- URL
- data YouTube
- data pengguna

# GAYA BAHASA

- Gunakan Bahasa Indonesia santai dan ramah.
- Ikuti bahasa user.
- Jika user menggunakan Bahasa Sunda, balas dengan Sunda yang natural.
- Jawaban singkat, jelas, dan langsung ke inti.
- Maksimal 4 kalimat jika memungkinkan.
- Hindari poin-poin jika tidak diperlukan.
- Utamakan gaya chat manusia.
- Jangan terdengar seperti dokumentasi.
- Jangan memperkenalkan diri berulang kali.

# PERCAKAPAN

Jika user hanya menyapa:
balas secara natural.

Contoh:

User: Halo
Assistant: Halo 👋 Ada yang bisa saya bantu?

User: Lagi apa?
Assistant: Lagi siap bantu 😄

# BATASAN

- Kamu bukan admin.
- Kamu tidak memiliki akses admin.
- Kamu tidak dapat approve pembayaran.
- Kamu tidak dapat mengubah data pengguna.
- Kamu tidak dapat melihat data pengguna lain.
- Jangan pernah mengaku memiliki akses yang tidak tersedia.
- Jangan mengarang informasi.
- Jangan membuat janji yang tidak bisa dilakukan.

# DATA USER

Jika data user tersedia:
- gunakan data tersebut.
- hanya gunakan data user saat ini.
- jangan mengarang angka atau nilai.

# PENANGANAN MASALAH

Jika membutuhkan tindakan admin:
arahkan user menghubungi admin.

Jika terjadi error teknis:
arahkan user menghubungi admin.

Jika tidak memiliki informasi yang cukup:
ajukan pertanyaan lanjutan yang relevan.
`;

  const CUTCLIPS_KNOWLEDGE = `
# FITUR CUTCLIPS

## Analyze

Tempel link YouTube untuk menganalisis video.

Hasil:
- Highlight potensial
- Momen menarik
- Kandidat clip viral

## Generate

Pilih highlight lalu buat clip.

Hasil:
- Video pendek siap download
- Cocok untuk TikTok
- Cocok untuk Shorts
- Cocok untuk Reels

## Workspace

Menampilkan semua clip yang pernah dibuat user.

## History

Menampilkan highlight yang belum dijadikan clip.

User dapat:
- Membuat clip
- Menghapus highlight

## Billing

Halaman pembelian kredit.

Paket:

Gratis
- Gratis

Starter
- Rp25.000
- 200 kredit
- Bonus 100 kredit

Kreator
- Rp75.000
- 500 kredit

## Cara Pembelian

1. Buka Billing
2. Pilih paket
3. Klik Beli
4. Scan QRIS
5. Upload bukti pembayaran
6. Admin melakukan verifikasi
7. Kredit masuk otomatis

## User Info

Menampilkan:
- Profil
- Sisa kredit
- Kredit terpakai

## Chat AI

Asisten AI CutClips untuk membantu pengguna.
`;
  const USER_CONTEXT = `
# DATA USER

${userDataStr}
`;
  const needsKnowledge =
    /(cutclips|analyze|generate|billing|credit|workspace|history)/i.test(
      userMessage,
    );

  const groqMessages = [
    {
      role: "system",
      content: `
          ${SYSTEM_PROMPT}

          ${needsKnowledge ? CUTCLIPS_KNOWLEDGE : ""}

          ${USER_CONTEXT}
      `,
    },

    ...history.map((m: any) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  return await callGroqWithTools(groqMessages);
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const audioFile = formData.get("audio") as File | null;
      let convId = (formData.get("conversationId") as string) || "";
      const email = formData.get("email") as string;

      if (!audioFile || !email) {
        return NextResponse.json(
          { error: "Audio file and email are required" },
          { status: 400 },
        );
      }

      const transcript = await transcribeAudio(audioFile);
      if (!transcript.trim()) {
        return NextResponse.json(
          { error: "Could not transcribe audio" },
          { status: 400 },
        );
      }

      // Same LLM flow as text messages, using transcript as message
      if (!convId) {
        convId = await convexMutation("conversations:create", {
          userEmail: email,
          title: transcript.slice(0, 60),
        });
      }

      const voiceHistory = await convexQuery("messages:list", {
        conversationId: convId,
      });
      if (voiceHistory.length === 0) {
        await convexMutation("conversations:updateTitle", {
          conversationId: convId,
          title: transcript.slice(0, 60),
        });
      }

      await convexMutation("messages:send", {
        conversationId: convId,
        role: "user",
        content: transcript,
      });

      const {
        content: aiResponse,
        images,
        videos,
      } = await processWithLLM(convId, email, transcript);

      const saveArgs: Record<string, unknown> = {
        conversationId: convId,
        role: "assistant",
        content: aiResponse,
      };
      if (videos.length > 0) saveArgs.videos = videos;
      if (images.length > 0) saveArgs.images = images;

      await convexMutation("messages:send", saveArgs);

      return NextResponse.json({
        conversationId: convId,
        content: aiResponse,
        transcript,
        images,
        videos,
      });
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

    // Update title based on first user message
    const history = await convexQuery("messages:list", {
      conversationId: convId,
    });
    if (history.length === 0) {
      await convexMutation("conversations:updateTitle", {
        conversationId: convId,
        title: message.slice(0, 60),
      });
    }

    await convexMutation("messages:send", {
      conversationId: convId,
      role: "user",
      content: message,
    });

    const {
      content: aiResponse,
      images,
      videos,
    } = await processWithLLM(convId, email, message);

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
