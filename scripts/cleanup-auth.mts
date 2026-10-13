import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    options: "-c timezone=UTC",
  }),
});
try {
  const now = new Date();
  const results = await db.$transaction([
    db.verificationToken.deleteMany({ where: { expires: { lt: now } } }),
    db.session.deleteMany({ where: { expires: { lt: now } } }),
    db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  console.log(
    `Removed ${results.reduce((total, result) => total + result.count, 0)} expired authentication records.`,
  );
} finally {
  await db.$disconnect();
}
