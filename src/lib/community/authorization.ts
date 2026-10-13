import {
  AccessError,
  requireActiveUser,
  type Principal,
} from "../accounts/authorization";
export function canManagePost(actor: Principal | null, authorId: string) {
  return (
    !!actor &&
    actor.status === "ACTIVE" &&
    !!actor.emailVerified &&
    (actor.id === authorId ||
      actor.role === "MODERATOR" ||
      actor.role === "ADMIN")
  );
}
export function requirePostManager(actor: Principal | null, authorId: string) {
  requireActiveUser(actor);
  if (!canManagePost(actor, authorId))
    throw new AccessError(403, "You cannot change another member’s post.");
}
