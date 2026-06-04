import NextAuth from "next-auth";
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
    async jwt({ token, account, user }) {
      if (account?.id_token) {
        token.idToken = account.id_token;
      }
      if (user?.email) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_CONVEX_URL}/api/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: "users:getRoleByEmail", args: { email: user.email } }),
          });
          if (res.ok) {
            const data = await res.json();
            token.role = data?.value || "user";
          }
        } catch {
          token.role = "user";
        }
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
