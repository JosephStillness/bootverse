import { connection } from "next/server";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/accounts/service";
import { DataSourceDetail } from "@/components/source-sync/detail";
export const metadata = { title: "Data source", robots: { index: false, follow: false } };
export default async function DataSourcePage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const actor = await currentUser();
  if (!actor) redirect(`/login?callbackUrl=${encodeURIComponent(`/admin/data-sources/${id}`)}`);
  if (actor.role !== "ADMIN" || actor.status !== "ACTIVE" || !actor.emailVerified)
    return <div className="shell account-page"><h1>Access restricted</h1><p>Administrator access is required.</p></div>;
  return <div className="shell community-page import-page review-page"><DataSourceDetail id={id} /></div>;
}
