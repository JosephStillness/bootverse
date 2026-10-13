import "server-only";
import { createHmac } from "node:crypto";
import { getDb } from "@/lib/db";

export async function consumeLimit(
  subject: string,
  limit: number,
  windowSeconds: number,
) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Authentication is not configured.");
  const window = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = createHmac("sha256", secret)
    .update(`${subject}:${window}`)
    .digest("hex");
  const expiresAt = new Date((window + 1) * windowSeconds * 1000);
  // Atomic upsert increments prevent concurrent requests bypassing the limit.
  const bucket = await getDb().rateLimit.upsert({
    where: { key },
    create: { key, count: 1, expiresAt },
    update: { count: { increment: 1 } },
  });
  return bucket.count <= limit;
}
