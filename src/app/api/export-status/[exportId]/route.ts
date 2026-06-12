import { NextRequest, NextResponse } from "next/server";
import { convexQuery } from "@/lib/convex-rest";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ exportId: string }> },
) {
  try {
    const { exportId } = await params;

    const [exportDoc, queueInfo] = await Promise.all([
      convexQuery("exports:getById", { exportId }),
      convexQuery("exports:getQueueInfo", {}),
    ]);

    if (!exportDoc) {
      return NextResponse.json({ error: "Export not found" }, { status: 404 });
    }

    return NextResponse.json({
      _id: exportDoc._id,
      status: exportDoc.status,
      progress: typeof exportDoc.progress === "number"
        ? Math.round(exportDoc.progress <= 1 ? exportDoc.progress * 100 : exportDoc.progress)
        : 0,
      downloadUrl: exportDoc.downloadUrl,
      error: exportDoc.error,
      createdAt: exportDoc.createdAt,
      completedAt: exportDoc.completedAt,
      queue: exportDoc.status === "queued" ? {
        ahead: Math.max(0, (queueInfo?.queueLength || 1) - 1),
        estimatedSeconds: Math.max(30, (queueInfo?.queueLength || 1) * 60),
      } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get export status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
