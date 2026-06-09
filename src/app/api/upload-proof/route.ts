import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Please sign in" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("proof") as File | null;
    const packId = formData.get("packId") as string;
    const credits = parseInt(formData.get("credits") as string, 10);
    const amount = parseInt(formData.get("amount") as string, 10);

    if (!file || !packId || !credits || !amount) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const user = await convexQuery("users:getByEmail", { email: session.user.email });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;

    const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64");
    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
        },
        body: new URLSearchParams({
          file: dataUri,
          folder: "cutclips/payments",
          public_id: `proof-${Date.now()}`,
        }),
      },
    );

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`Upload failed: ${text.slice(0, 200)}`);
    }

    const uploadData = await uploadRes.json();
    const proofUrl = uploadData.secure_url;

    const paymentId = await convexMutation("payments:create", {
      userId: user._id,
      email: session.user.email,
      packId,
      credits,
      amount,
      proofUrl,
    });

    return NextResponse.json({ paymentId, proofUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
