import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "";
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "";

function extractPublicId(url: string): string | null {
  const m = url.match(/\/upload\/v\d+\/(.+?)\.(jpg|jpeg|png|gif|webp)/i);
  return m ? m[1] : null;
}

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

async function deleteFromCloudinary(publicId: string) {
  const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: new URLSearchParams({ public_id: publicId }),
    },
  );
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Please sign in" }, { status: 401 });
    }

    const { paymentIds, proofUrls } = await request.json();
    if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
      return NextResponse.json({ error: "Missing paymentIds" }, { status: 400 });
    }

    // Delete from Cloudinary
    if (Array.isArray(proofUrls)) {
      await Promise.allSettled(
        proofUrls.map((url) => {
          const publicId = extractPublicId(url);
          if (publicId) return deleteFromCloudinary(publicId);
          return Promise.resolve();
        }),
      );
    }

    // Delete from Convex
    await convexMutation("payments:removeBulk", { paymentIds, adminEmail: session.user.email });

    return NextResponse.json({ success: true, deleted: paymentIds.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
