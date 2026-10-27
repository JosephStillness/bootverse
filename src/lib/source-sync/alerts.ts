import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { AlertDraft } from "./alert-rules";

/** Delivery result is recorded as-is. LOGGED is not "delivered to a person"; no external channel is configured. */
export type Delivery = "LOGGED" | "NOT_CONFIGURED" | "FAILED";
export interface AlertNotifier { deliver(alert: AlertDraft & { sourceId: string | null; jobId: string | null }): Promise<Delivery> }
export const logNotifier: AlertNotifier = {
  async deliver(alert) {
    try {
      console.warn(JSON.stringify({ event: "source_alert", kind: alert.kind, severity: alert.severity, sourceId: alert.sourceId, jobId: alert.jobId, message: alert.message }));
      return "LOGGED";
    } catch { return "FAILED"; }
  },
};
/** In-memory notifier for tests and local runs; records exactly what would be sent. */
export class MemoryNotifier implements AlertNotifier {
  sent: (AlertDraft & { sourceId: string | null })[] = [];
  async deliver(alert: AlertDraft & { sourceId: string | null; jobId: string | null }): Promise<Delivery> { this.sent.push(alert); return "LOGGED"; }
}

type Db = PrismaClient | Prisma.TransactionClient;
/** Opens an alert once per condition; repeats increment the counter instead of re-notifying. */
export async function raiseAlert(db: Db, alert: AlertDraft, sourceId: string | null, jobId: string | null, notifier: AlertNotifier) {
  const open = await db.sourceAlert.findFirst({ where: { dedupeKey: alert.dedupeKey, status: { not: "RESOLVED" } } });
  if (open) return db.sourceAlert.update({ where: { id: open.id }, data: { occurrences: { increment: 1 }, lastSeenAt: new Date(), jobId: jobId ?? open.jobId } });
  const delivery = await notifier.deliver({ ...alert, sourceId, jobId });
  try {
    return await db.sourceAlert.create({ data: { ...alert, sourceId, jobId, delivery } });
  } catch {
    // A concurrent worker opened the same alert (partial unique index); count this occurrence there.
    return db.sourceAlert.updateMany({ where: { dedupeKey: alert.dedupeKey, status: { not: "RESOLVED" } }, data: { occurrences: { increment: 1 }, lastSeenAt: new Date() } });
  }
}
/** Closes alerts whose condition no longer holds (for example after a successful run). */
export async function resolveAlerts(db: Db, sourceId: string, kinds: string[]) {
  return db.sourceAlert.updateMany({ where: { sourceId, kind: { in: kinds }, status: { not: "RESOLVED" } }, data: { status: "RESOLVED", resolvedAt: new Date() } });
}
