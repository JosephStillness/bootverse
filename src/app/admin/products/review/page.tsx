import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/accounts/service";
import { ReviewQueue } from "@/components/product-review/queue";
export const metadata = { title: "Product approval queue", robots: { index: false, follow: false } };
export default async function ReviewQueuePage() {
  await connection();
  const actor = await currentUser();
  if (!actor) redirect("/login?callbackUrl=%2Fadmin%2Fproducts%2Freview");
  // UI gate only; every API call re-checks the active ADMIN role server-side.
  if (actor.role !== "ADMIN" || actor.status !== "ACTIVE" || !actor.emailVerified)
    return <div className="shell account-page"><h1>Access restricted</h1><p>Administrator access is required.</p></div>;
  return <div className="shell community-page import-page review-page">
    <Link href="/admin" className="text-link">Back to moderation</Link>
    <p className="eyebrow">PRODUCT DATA · D4</p>
    <h1>Approval queue.</h1>
    <p className="import-intro">Every public boot record is identified, checked against its evidence and approved by an administrator. Nothing is published automatically.</p>
    <ReviewQueue />
  </div>;
}
