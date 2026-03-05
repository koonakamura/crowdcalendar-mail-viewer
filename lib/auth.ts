import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

async function refreshAccessToken(account: {
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
  userId: string;
}) {
  if (!account.refresh_token) {
    throw new Error("No refresh token available");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });

  const tokens = await response.json();

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${tokens.error}`);
  }

  await prisma.account.updateMany({
    where: { userId: account.userId, provider: "google" },
    data: {
      access_token: tokens.access_token,
      expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 3600),
      ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
    },
  });

  return tokens.access_token as string;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      const account = await prisma.account.findFirst({
        where: { userId: user.id, provider: "google" },
      });

      if (account) {
        let accessToken = account.access_token;

        // トークンが期限切れ（または期限切れ間近）ならリフレッシュ
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = account.expires_at || 0;

        if (now >= expiresAt - 60) {
          try {
            accessToken = await refreshAccessToken(account);
            console.log("Access token refreshed successfully");
          } catch (error) {
            console.error("Failed to refresh access token:", error);
          }
        }

        (session as any).accessToken = accessToken;
        (session as any).refreshToken = account.refresh_token;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});