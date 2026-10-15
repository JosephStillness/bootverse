import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/accounts/service";
import { FootProfileForm } from "@/components/foot-profile/foot-profile-form";
import { getOwnFootProfile } from "@/lib/foot-profile/service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {title:"My foot profile",robots:{index:false,follow:false}};
export default async function FootProfilePage() {
  const actor=await currentUser();
  if(!actor)redirect("/login?callbackUrl=%2Fprofile%2Ffoot-profile");
  if(actor.status!=="ACTIVE"||!actor.emailVerified)return <div className="shell account-page"><h1>Account unavailable</h1><p>This account cannot access foot profile settings.</p></div>;
  const profile=await getOwnFootProfile(actor);
  return <div className="shell foot-page"><Link className="text-link" href="/account">← Account settings</Link><div className="account-intro"><p className="eyebrow">YOUR PRIVATE FIT FOUNDATION</p><h1>My foot profile.</h1><p>Your measurements. Your preferences. Kept private, with no guessed fit conclusions.</p></div><FootProfileForm profile={profile}/></div>;
}
