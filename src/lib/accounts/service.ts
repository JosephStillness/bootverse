import "server-only";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { authConfigured } from "./config";
import { requireOwner, type Principal } from "./authorization";
import { profileSchema } from "./validation";
import { lockedActiveUser } from "./authorization-db";

export const publicProfileSelect = {
  username: true,
  displayName: true,
  bio: true,
  createdAt: true,
  images: { where: { status: "PUBLISHED", state: "READY" }, select: { id: true }, take: 1 },
  user: { select: { creator: { select: { status: true, verificationStatus: true } } } },
} as const;

export async function currentUser(): Promise<Principal | null> {
  if (!authConfigured()) return null;
  const session = await auth();
  if (!session?.user?.id) return null;
  return getDb().user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, status: true, emailVerified: true },
  });
}

export async function updateProfile(
  actor: Principal | null,
  ownerId: string,
  input: unknown,
) {
  requireOwner(actor, ownerId);
  const data = profileSchema.parse(input);
  return getDb().$transaction(async (tx) => {
    requireOwner(await lockedActiveUser(tx, actor), ownerId);
    return tx.userProfile.update({
      where: { userId: ownerId },
      data,
      select: publicProfileSelect,
    });
  });
}
