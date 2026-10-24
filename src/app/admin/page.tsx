import Link from 'next/link';
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/accounts/service";
import { AdminDashboard } from "@/components/platform/admin-dashboard";
export const metadata = { title: "Community moderation", robots: { index: false, follow: false } };
export default async function AdminPage() { await connection(); const actor = await currentUser(); if (!actor)
    redirect("/login?callbackUrl=%2Fadmin"); if (actor.status !== "ACTIVE" || !actor.emailVerified || actor.role === "USER")
    return <div className="shell account-page"><h1>Access restricted</h1><p>Moderator or administrator access is required.</p></div>; return <div className="shell community-page"><p className="eyebrow">TRUST & COMMUNITY</p><h1>Moderation desk.</h1><p>Review context before acting. Every decision is recorded. Reports never automatically delete content.</p>{actor.role === "ADMIN" && <p><Link className="text-link" href="/admin/products/import">Import product data</Link>{" · "}<Link className="text-link" href="/admin/products/enrich">Enrich product evidence</Link></p>}<AdminDashboard /></div>; }
