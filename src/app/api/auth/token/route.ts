import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const idToken = (session as any)?.idToken;
    return Response.json({ accessToken: idToken || null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ accessToken: null, error: message });
  }
}
