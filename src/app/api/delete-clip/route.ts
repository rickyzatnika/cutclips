import { NextRequest, NextResponse } from "next/server";

const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "";
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "";

async function convexMutation(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.value;
}

async function convexQuery(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.value;
}

async function deleteFromCloudinary(publicId: string) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return;

  const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/destroy`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ public_id: publicId }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`[delete-clip] Cloudinary delete failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { exportId, email } = await request.json();

    if (!exportId || !email) {
      return NextResponse.json({ error: "Missing exportId or email" }, { status: 400 });
    }

    const exportDoc = await convexQuery("exports:getById", { exportId });
    if (!exportDoc) {
      return NextResponse.json({ error: "Export not found" }, { status: 404 });
    }

    if (exportDoc.downloadUrl) {
      const url = exportDoc.downloadUrl as string;
      const match = url.match(/\/v\d+\/(.+?)\.\w+$/);
      if (match) {
        const publicId = match[1];
        await deleteFromCloudinary(publicId);
      }
    }

    await convexMutation("exports:remove", { exportId, email });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
