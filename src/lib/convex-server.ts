import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
}

export const convexServer = new ConvexHttpClient(CONVEX_URL);