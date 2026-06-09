import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";

const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;

async function callConvexQuery(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_SITE_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  if (!res.ok) return null;
  return res.json();
}

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await callConvexQuery("users:verifyPassword", {
          email: credentials.email,
          password: credentials.password,
        });

        if (!user) return null;

        return {
          id: user._id,
          name: user.name,
          email: user.email,
          image: user.image ?? null,
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user?.email) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_CONVEX_URL}/api/mutation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "users:createOrUpdateUser",
            args: { email: user.email, name: user.name || "", image: user.image || undefined },
          }),
        }).catch((e) => {
          console.error("[auth] fetch error:", e);
          return null;
        });
        if (res) {
          const data = await res.json();
          if (data.error) console.error("[auth] mutation error:", data.error);
          else console.log("[auth] user created/updated:", data.value);
        }
      }
      return true;
    },
    async jwt({ token, account }) {
      if (account?.id_token) {
        token.idToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).idToken = token.idToken;
      (session as any).role = token.role;
      return session;
    },
  },
};
