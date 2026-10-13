export type Principal = {
  id: string;
  role: "USER" | "MODERATOR" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  emailVerified: Date | null;
};

export class AccessError extends Error {
  constructor(
    public status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

export function requireActiveUser(user: Principal | null): Principal {
  if (!user) throw new AccessError(401, "Sign in to continue.");
  if (user.status !== "ACTIVE" || !user.emailVerified)
    throw new AccessError(
      403,
      "This account is not permitted to perform this action.",
    );
  return user;
}

export function requireOwner(
  user: Principal | null,
  ownerId: string,
): Principal {
  const actor = requireActiveUser(user);
  if (actor.id !== ownerId)
    throw new AccessError(403, "You can only edit your own profile.");
  return actor;
}

export function requireModerator(user: Principal | null): Principal {
  const actor = requireActiveUser(user);
  if (actor.role !== "MODERATOR" && actor.role !== "ADMIN")
    throw new AccessError(403, "Moderator access is required.");
  return actor;
}
