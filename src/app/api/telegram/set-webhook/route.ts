import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  }

  const vercelUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "";
  const baseUrl = process.env.NEXTAUTH_URL || vercelUrl || "http://localhost:3000";
  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`;

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`,
    { method: "POST" },
  );

  const data = await res.json();
  return NextResponse.json(data);
}
