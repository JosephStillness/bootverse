import { connection } from "next/server";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/accounts/service";
import { requireActiveUser } from "@/lib/accounts/authorization";
import { ownCreator } from "@/lib/platform/creators";
import { CreatorForm } from "@/components/platform/creator-form";
export const metadata = { title: "Manage creator profile", robots: { index: false, follow: false } };
export default async function ManageCreator() { await connection(); const actor = await currentUser(); if (!actor)
    redirect("/login?callbackUrl=%2Faccount%2Fcreator"); requireActiveUser(actor); const creator = await ownCreator(actor); return <div className="shell community-page post-compose"><h1>Your creator profile.</h1><section className="account-panel"><CreatorForm creator={creator}/></section></div>; }
