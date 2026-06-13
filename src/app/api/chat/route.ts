import { NextResponse } from "next/server";
import { createApi } from "unsplash-js";
import { YoutubeTranscript } from "youtube-transcript";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const YOUTUBE_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

	const MODELS = ["llama-3.3-70b-versatile"];

function getApiKeys(): string[] {
	const keys: string[] = [];
	for (let i = 1; i <= 5; i++) {
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
			description: "Cari gambar berdasarkan kata kunci",
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

function extractYoutubeVideoId(text: string): string | null {
	const match = text.match(YOUTUBE_REGEX);
	return match ? match[1] : null;
}

async function fetchYoutubeTranscript(videoId: string): Promise<{
	transcript: string;
	segments: { start: number; end: number; text: string }[];
} | null> {
	try {
		const entries = await YoutubeTranscript.fetchTranscript(videoId, {
			lang: "id",
		});
		if (!entries || entries.length === 0) return null;
		const transcript = entries.map((e) => e.text).join(" ");
		const segments = entries.map((e) => ({
			start: e.offset / 1000,
			end: (e.offset + e.duration) / 1000,
			text: e.text,
		}));
		return { transcript, segments };
	} catch {
		try {
			const entries = await YoutubeTranscript.fetchTranscript(videoId);
			if (!entries || entries.length === 0) return null;
			const transcript = entries.map((e) => e.text).join(" ");
			const segments = entries.map((e) => ({
				start: e.offset / 1000,
				end: (e.offset + e.duration) / 1000,
				text: e.text,
			}));
			return { transcript, segments };
		} catch {
			return null;
		}
	}
}

async function fetchYoutubeVideoDetails(videoId: string): Promise<{
	title: string;
	thumbnail: string;
	channelName: string;
} | null> {
	if (!YOUTUBE_API_KEY) {
		try {
			const res = await fetch(
				`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
				{ headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) },
			);
			if (res.ok) {
				const data = await res.json();
				return {
					title: data.title || "YouTube Video",
					thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
					channelName: data.author_name || "",
				};
			}
		} catch { /* fallback */ }
		return {
			title: "YouTube Video",
			thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
			channelName: "",
		};
	}
	try {
		const res = await fetch(
			`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`,
		);
		const data = await res.json();
		const item = data?.items?.[0]?.snippet;
		if (!item) {
			return {
				title: "YouTube Video",
				thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
				channelName: "",
			};
		}
		return {
			title: item.title || "YouTube Video",
			thumbnail:
				item.thumbnails?.maxres?.url ||
				item.thumbnails?.high?.url ||
				item.thumbnails?.default?.url ||
				`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
			channelName: item.channelTitle || "",
		};
	} catch {
		return {
			title: "YouTube Video",
			thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
			channelName: "",
		};
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
			.replace(/<[a-z_]+\s*>\s*\{[\s\S]*?\}\s*<\/[a-z_]+>/g, "")
			.replace(/<[a-z_]+\s*>\s*\{[\s\S]*?\}\s*$/gm, "")
			.replace(/<function=\w+>[\s\S]*?<\/function>/g, "")
			.replace(/<function=\w+\/>/g, "")
			.replace(/<function=\w+>[\s\S]*/g, "")
			.replace(/function=(?:search_web|search_images|search_youtube)>\s*\{[^}]*\}/g, "")
			.replace(/function=(?:search_web|search_images|search_youtube)>\s*\{[^}]*$/gm, "")
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
							const [pexelRes, unsplashRes] = await Promise.all([
								pexelsSearch(args.query),
								unsplashSearch(args.query),
							]);
							const pexelPhotos = pexelRes.photos || [];
							const unsplashPhotos = (
								unsplashRes && "results" in unsplashRes
									? unsplashRes.results
									: []
							) as Record<string, unknown>[];

							const foundImages: { url: string; alt: string }[] = [];

							let remaining = 6;
							if (pexelPhotos.length > 0) {
								const take = Math.min(pexelPhotos.length, remaining);
								const pexelItems = pexelPhotos
									.slice(0, take)
									.map((p: Record<string, unknown>) => {
										const psrc = p.src as Record<string, string>;
										return {
											url:
												psrc?.medium ||
												psrc?.original ||
												(p as Record<string, string>).url,
											alt: (p as Record<string, string>).alt || args.query,
										};
									});
								extraImages.push(...pexelItems);
								foundImages.push(...pexelItems);
								remaining -= take;
							}
							if (remaining > 0 && unsplashPhotos.length > 0) {
								const take = Math.min(unsplashPhotos.length, remaining);
								const unsplashItems = unsplashPhotos
									.slice(0, take)
									.map((p: Record<string, unknown>) => ({
										url:
											(p.urls as Record<string, string>)?.regular ||
											(p.urls as Record<string, string>)?.small ||
											"",
										alt:
											(p as Record<string, string>).alt_description ||
											args.query,
									}));
								extraImages.push(...unsplashItems);
								foundImages.push(...unsplashItems);
							}

							toolResult = {
								images: foundImages.map((img) => img.alt),
							};
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
			if (!finalContent) {
				finalContent = "Maaf, saya lagi error. Coba tanya lagi ya.";
			}
			break;
		}
	}

	return { content: finalContent, images: extraImages, videos: extraVideos };
}

class PaidUserError extends Error {
	status = 403;
}

async function checkPaidUser(email: string) {
	const user = await convexQuery("users:getByEmail", { email });
	if (!user) throw new Error("User not found");
	const totalReceived = (user.credits ?? 0) + (user.totalCreditsUsed ?? 0);
	if (totalReceived <= 100) {
		const err = new PaidUserError(
			"Fitur Chat AI hanya untuk pengguna Starter & Kreator. Silakan isi credit terlebih dahulu.",
		);
		throw err;
	}
}

async function processWithLLM(
	convId: string,
	email: string,
	userMessage: string,
	youtubeContext?: {
		title: string;
		transcript: string;
		url: string;
		thumbnail: string;
		channelName: string;
	} | null,
) {
	const allHistory = await convexQuery("messages:list", {
		conversationId: convId,
	});
	const history = allHistory.slice(-15);

	let userDataStr = "";
	let clipDetailStr = "";
	const needsUserData =
		/(kredit|credit|saldo|clip|video|highlight|akun|profil|user|data|statistik|generate|riwayat|hasil|sisa|nama|bagus|menarik|rekomendasi|saran|pilih|hook|viral|favorit|terbaik|populer|tayang|view|punya|saya)/i.test(
			userMessage,
		) || history.length > 1;
	if (needsUserData) {
		try {
			const user = await convexQuery("users:getByEmail", { email });
			const clips = await convexQuery("videos:listByUserWithClips", { email });
			const unclipped = await convexQuery("highlights:listUnclipped", {
				email,
			});

			const uniqueVideos = new Set(
				clips
					.map(
						(c: Record<string, unknown>) =>
							(c.video as Record<string, unknown>)?._id,
					)
					.filter(Boolean),
			);
			const totalVideos = uniqueVideos.size;
			const totalClips = clips.length;
			const totalHighlights = unclipped.length;

			userDataStr =
				"Nama: " + (user?.name || "-") + "\n" +
				"Email: " + (user?.email || email) + "\n" +
				"Sisa Kredit: " + (user?.credits ?? 0) + "\n" +
				"Total Kredit Terpakai: " + (user?.totalCreditsUsed ?? 0) + "\n" +
				"Total Video Dianalisis: " + totalVideos + "\n" +
				"Total Highlight: " + totalHighlights + "\n" +
				"Total Clip Dibuat: " + totalClips + "\n" +
				"Bergabung Sejak: " + (user?.joinedAt ? new Date(user.joinedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-") + "\n" +
				"Role: " + (user?.role || "user") + "\n";

			const sortedClips = [...(clips as any[])]
				.filter((c) => c.status === "completed")
				.sort((a, b) => b.viralityScore - a.viralityScore);

			if (sortedClips.length > 0) {
				clipDetailStr = "\n\nDAFTAR CLIP YANG SUDAH DIBUAT (diurutkan viralityScore tertinggi):\n";
				sortedClips.slice(0, 20).forEach((c, i) => {
					clipDetailStr +=
						(i + 1) + ". \"" + c.highlightTitle + "\"" +
						" — Video: \"" + c.video.title + "\"" +
						" | Kategori: " + (c.category || "-") +
						" | Virality: " + (c.viralityScore ?? 0) +
						" | Durasi: " + Math.round((c.endTime - c.startTime) / 60) + "m" +
						"\n";
				});
			}
		} catch {
			userDataStr = "Gagal memuat data user";
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
		timeZone: "Asia/Jakarta",
	});

	const SYSTEM_PROMPT = `
Hari ini: ${nowFormatted}

Kamu adalah AI CutClips — ahli analisa konten media sosial. 
Pakar dalam: analisa video YouTube/Youtube shorts/TikTok/Instagram, strategi konten viral, 
riset tren, optimasi judul & thumbnail, dan insight audiens.
Pake data, tren, dan tools buat ngasih saran yang actionable.

PENTING — PRIORITAS JAWAB:
1. DATA USER & DATA CLIP (disediakan di bawah) — jawab LANGSUNG, jangan cari di web/youtube.
2. DATA YOUTUBE (transkrip video) — jawab dari transkrip, jangan cari eksternal.
3. TREN / INFO UMUM — baru pake tools pencarian.

ATURAN DATA USER & CLIP:
- Kalau ditanya data user (kredit, clip, jumlah video, info user), JAWAB LANGSUNG. Jangan pake tools.
- Kalau ditanya "video/clip mana yang bagus/menarik/terbaik", lihat DAFTAR CLIP di bawah. Analisis virality score, kategori, judul — kasih rekomendasi berdasarkan DATA TERSEBUT. Bukan cari di web/youtube.
- Kalo data user kosong/error, bilang "Maaf, data user tidak tersedia."

GAYA NGOMONG:
- Santai, natural, kayak chat sama temen. Gak usah kaku atau formal.
- Ikutin bahasa user: Indonesia santai, Inggris, atau Sunda.
- Jawab singkat aja, maks 4 kalimat. Gak usah pake poin-poin kalo gak perlu.
- Jangan pake emoji berlebihan.
- Jangan ngejelasin fitur CutClips kalo gak ditanya.
- Jangan bilang "tidak bisa menampilkan gambar" — gambar SUDAH terkirim otomatis di samping teks ini, user bisa liat.
- Jangan nyebut sumber gambar (Pexels/Unsplash) pas nampilin hasil.
- Kalau user minta analisis video YouTube/transkrip tapi gak ngirim link, kasih tau cara dengan menyebut nama user dari DATA USER: "[Maaf {nama},] silakan copy link URL YouTube yang ingin dianalisis ya, nanti saya bantu."
- Transkrip video otomatis saya ambil pas user ngirim link YouTube. Gak perlu repot-repot.

ATURAN TOOLS — PAKE HANYA KALAU DIMINTA:
- JANGAN iniciatif manggil tools kalo user gak minta. Ngobrol biasa aja.
- Kalo user minta cari info TREN / BERITA / TOPIK UMUM → pake search_web.
- Kalo user minta gambar/foto/ilustrasi → pake search_images.
- Kalo user minta video YouTube (bukan punya mereka) → pake search_youtube.
- Kalo user cuma ngobrol/nanya biasa, JAWAB LANGSUNG. Jangan pake tools.
- KALO PERTANYAAN BISA DIJAWAB DARI DATA YANG SUDAH DISEDIAKAN (data user, daftar clip, transkrip), JANGAN PAKE TOOLS.

JANGAN PERNAH nulis function=search_web>, function=search_images>, function=search_youtube>, <function=...>, atau format function call apapun di teks. Kalo mau pake tools, pake tool calling bawaan model — jangan ditulis manual.

BATASAN:
- Kamu bukan admin, gak bisa approve pembayaran, gak bisa ngubah data user.
- Arahkan hubungi admin kalo butuh tindakan admin atau ada error teknis.
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
- 100 kredit
- + Bonus 100 kredit

Kreator
- Rp75.000
- 500 kredit

## Cara Pembelian/isi credit/topup credit

1. Tap tombol Isi Credit
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

Asisten AI CutClips untuk membantu.
`;
	const USER_CONTEXT = userDataStr ? `
# DATA USER
${userDataStr}
${clipDetailStr}
` : "";
	const YOUTUBE_CONTEXT = youtubeContext
		? `
# YOUTUBE VIDEO CONTEXT

User mengirim link YouTube: ${youtubeContext.url}
Judul Video: ${youtubeContext.title}
Channel: ${youtubeContext.channelName}

Transkrip Video (udah di-fetch sama sistem):
${youtubeContext.transcript.slice(0, 12000)}

	PENTING: Transkrip di atas CUMA KAMU yang bisa lihat, USER GAK BISA LIAT. Jadi:
- Jangan bilang "maaf gak bisa buka link" atau "gak bisa akses YouTube"
- Jangan bilang "lihat transkrip di atas" — karena user gak bisa lihat
- Kalau user minta transkrip, sajikan dengan RAPI: bagi per segmen, kasih timestamp, ringkas kalau perlu
- JANGAN dump transkrip mentah-mentah — format biar enak dibaca
- Kalau user nanya tentang isi video, jawab berdasarkan transkrip
- Langsung jawab pertanyaan user, jangan nanya "apa pertanyaanmu?"

TUGAS TAMBAHAN — ANALISIS HOOK:
Setiap kali user ngirim link YouTube, otomatis analisis transkrip dan cari 3-5 momen HOOK terbaik.
Hook = momen paling menarik, lucu, shocking, emosional, atau viral-potential dari video.
Untuk setiap hook, kasih:
- ⏱ Timestamp (kira-kira menit:detik)
- 📌 Judul hook singkat
- 💬 Kutipan transkripnya (1-2 kalimat)
- 🎯 Kenapa ini hook bagus (1 kalimat)
- 🔥 Viral Score: [1-100] — seberapa viral potensial momen ini

Sajikan hook-hook ini di awal respons, sebelum jawab pertanyaan user.
Kalo user cuma kirim link tanpa teks, langsung kasih daftar hook nya.
`
		: "";
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

          ${YOUTUBE_CONTEXT}

          ${USER_CONTEXT}
      `,
		},

		...history.map((m: Record<string, unknown>) => ({
			role: m.role as string,
			content: m.content as string,
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

			await checkPaidUser(email);

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

		await checkPaidUser(email);

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

		let youtubeContext: {
			title: string;
			transcript: string;
			url: string;
			thumbnail: string;
			channelName: string;
		} | null = null;
		const videoId = extractYoutubeVideoId(message);
		if (videoId) {
			const [transcriptData, videoDetails] = await Promise.all([
				fetchYoutubeTranscript(videoId),
				fetchYoutubeVideoDetails(videoId),
			]);
			if (transcriptData && videoDetails) {
				youtubeContext = {
					title: videoDetails.title,
					transcript: transcriptData.transcript,
					url: `https://youtube.com/watch?v=${videoId}`,
					thumbnail: videoDetails.thumbnail,
					channelName: videoDetails.channelName,
				};
			}
		}

		await convexMutation("messages:send", {
			conversationId: convId,
			role: "user",
			content: message,
		});

		let userMsgForLLM = message;
		if (youtubeContext) {
			userMsgForLLM = `${message}\n\n(Lihat transkrip video YouTube di system context untuk detail)`;
		}

		const {
			content: aiResponse,
			images,
			videos,
		} = await processWithLLM(convId, email, userMsgForLLM, youtubeContext);

		const allVideos = [...videos];
		if (youtubeContext) {
			const exists = allVideos.some((v) => v.url === youtubeContext.url);
			if (!exists) {
				allVideos.push({
					title: youtubeContext.title,
					url: youtubeContext.url,
					thumbnail: youtubeContext.thumbnail,
					channelName: youtubeContext.channelName,
				});
			}
		}

		const saveArgs: Record<string, unknown> = {
			conversationId: convId,
			role: "assistant",
			content: aiResponse,
		};
		if (allVideos.length > 0) saveArgs.videos = allVideos;
		if (images.length > 0) saveArgs.images = images;

		const msgId = await convexMutation("messages:send", saveArgs);

		return NextResponse.json({
			conversationId: convId,
			messageId: msgId,
			content: aiResponse,
			images,
			videos: allVideos,
		});
	} catch (err) {
		const status = err instanceof PaidUserError ? 403 : 500;
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "Internal error" },
			{ status },
		);
	}
}
