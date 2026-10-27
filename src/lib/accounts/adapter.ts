import "server-only";
import { randomUUID } from "node:crypto";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { getDb } from "@/lib/db";
import {readOnlyAuth} from './read-only-auth';

export function accountAdapter(): Adapter {
  const db = getDb();
  const base=PrismaAdapter(db);
  return {
    ...base,
    async updateSession(data) {
      return readOnlyAuth.getStore()
        ? db.session.findUnique({where:{sessionToken:data.sessionToken}})
        : base.updateSession!(data);
    },
    // Session revocation and expired-session cleanup can race normal sign-out.
    async deleteSession(sessionToken) {
      if(readOnlyAuth.getStore())return;
      await db.session.deleteMany({ where: { sessionToken } });
    },
    // The account and public profile are created atomically after email verification.
    async createUser(data) {
      return db.user.create({
        data: {
          email: data.email,
          emailVerified: data.emailVerified,
          profile: {
            create: {
              username: `member-${randomUUID().replaceAll("-", "").slice(0, 16)}`,
              displayName: "Boot enthusiast",
            },
          },
        },
      });
    },
  };
}
