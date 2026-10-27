import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/accounts/service";
import { DataSourceList } from "@/components/source-sync/list";
export const metadata = { title: "Data sources", robots: { index: false, follow: false } };
export default async function DataSourcesPage() {
  await connection();
  const actor = await currentUser();
  if (!actor) redirect("/login?callbackUrl=%2Fadmin%2Fdata-sources");
  // UI gate only; every API call re-checks the active ADMIN role server-side.
  if (actor.role !== "ADMIN" || actor.status !== "ACTIVE" || !actor.emailVerified)
    return <div className="shell account-page"><h1>Access restricted</h1><p>Administrator access is required.</p></div>;
  return <div className="shell community-page import-page review-page">
    <Link href="/admin" className="text-link">Back to moderation</Link>
    <p className="eyebrow">PRODUCT DATA · D5</p>
    <h1>Data sources.</h1>
    <p className="import-intro">Scheduled synchronization from explicitly authorized sources. New products become private drafts and material changes go to the approval queue; nothing is published automatically.</p>
    <DataSourceList />
  </div>;
}
