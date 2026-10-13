import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { requireActiveUser, type Principal } from "./authorization";

export async function lockedActiveUser(
  tx: Prisma.TransactionClient,
  actor: Principal | null,
) {
  const { id } = requireActiveUser(actor);
  // Hold account privileges stable until the mutation commits; revocation takes an UPDATE lock.
  const [current] = await tx.$queryRaw<Principal[]>`
    SELECT id, role, status, "emailVerified" FROM "User" WHERE id = ${id} FOR SHARE
  `;
  return requireActiveUser(current ?? null);
}
