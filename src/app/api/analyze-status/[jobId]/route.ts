import { NextRequest, NextResponse } from "next/server";

const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "";

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    const job = await convexQuery("analyzeJobs:getById", { jobId });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      jobId: job._id,
      status: job.status,
      title: job.title,
      duration: job.duration,
      transcriptSegments: job.transcriptSegments,
      rawText: job.rawText,
      highlights: job.highlights,
      error: job.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
