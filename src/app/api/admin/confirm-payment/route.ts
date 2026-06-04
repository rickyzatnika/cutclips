import { NextRequest, NextResponse } from "next/server";
import { convexServer } from "@/lib/convex-server";
import { api } from "@convex/_generated/api";

export async function POST(req: NextRequest) {
  try {
    const { invoiceId } = await req.json();

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID required" }, { status: 400 });
    }

    await convexServer.mutation(api.payments.confirmPayment, { invoiceId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Confirm payment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal konfirmasi pembayaran" },
      { status: 500 }
    );
  }
}