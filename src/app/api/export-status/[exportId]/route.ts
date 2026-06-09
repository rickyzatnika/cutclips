import { NextRequest, NextResponse } from "next/server";
import { convexQuery } from "@/lib/convex-rest";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ exportId: string }> },
) {
  try {
    const { exportId } = await params;

    const exportDoc = await convexQuery("exports:getById", { exportId });

    if (!exportDoc) {
      return NextResponse.json({ error: "Export not found" }, { status: 404 });
    }

    return NextResponse.json({
      _id: exportDoc._id,
      status: exportDoc.status,
      downloadUrl: exportDoc.downloadUrl,
      error: exportDoc.error,
      createdAt: exportDoc.createdAt,
      completedAt: exportDoc.completedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get export status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
