import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalDb = globalThis as unknown as { bootverseDb?: PrismaClient };

export function getDb() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured.");
  if (!globalDb.bootverseDb) {
    globalDb.bootverseDb = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        connectionTimeoutMillis: 5000,
        // Prisma's pg adapter normalizes timestamps as UTC; align every connection.
        options: "-c timezone=UTC",
      }),
    });
  }
  return globalDb.bootverseDb;
}
