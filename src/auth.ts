import "server-only";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { accountAdapter } from "@/lib/accounts/adapter";
import { authConfigured } from "@/lib/accounts/config";
import { consumeLimit } from "@/lib/accounts/rate-limit";
import { emailSchema } from "@/lib/accounts/validation";
import { getDb } from "@/lib/db";

export const { handlers, auth } = NextAuth(() => ({
  adapter: authConfigured() ? accountAdapter() : undefined,
  secret: process.env.AUTH_SECRET,
  // Every HTTP auth request is checked against the fixed AUTH_URL in its handler.
  trustHost: true,
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  providers: authConfigured()
    ? [
        Nodemailer({
          server: process.env.EMAIL_SERVER,
          from: process.env.EMAIL_FROM,
          maxAge: 15 * 60,
          normalizeIdentifier: (identifier) =>
            emailSchema.parse(identifier.trim()),
        }),
      ]
    : [],
  pages: {
    signIn: "/login",
    verifyRequest: "/check-email",
    error: "/login",
    newUser: "/account",
  },
  callbacks: {
    async signIn({ user, email }) {
      if (!authConfigured() || !emailSchema.safeParse(user.email).success)
        return false;
      if (email?.verificationRequest) {
        const perEmail = await consumeLimit(`email:${user.email}`, 3, 15 * 60);
        const global = await consumeLimit("email:global", 60, 60 * 60);
        if (!perEmail || !global) return false;
      }
      const account = await getDb().user.findUnique({
        where: { email: user.email! },
        select: { status: true },
      });
      return !account || account.status === "ACTIVE";
    },
    async session({ session, user }) {
      const profile = await getDb().userProfile.findUnique({
        where: { userId: user.id },
        select: { displayName: true },
      });
      return {
        expires: session.expires,
        user: {
          id: user.id,
          name: profile?.displayName ?? "Boot enthusiast",
          image: null,
        },
      };
    },
    redirect({ url, baseUrl }) {
      try {
        const target = new URL(url, baseUrl);
        return target.origin === new URL(process.env.AUTH_URL ?? baseUrl).origin
          ? target.href
          : `${baseUrl}/account`;
      } catch {
        return `${baseUrl}/account`;
      }
    },
  },
  logger: {
    // Auth errors can include addresses/tokens/transport credentials. Log the type only.
    error(error) {
      console.error("Authentication failed:", error.name);
    },
  },
}));
