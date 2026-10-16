import Link from "next/link";
import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {currentUser} from "@/lib/accounts/service";
import {RecommendationPreview} from "@/components/recommendations/preview";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Recommendation engine preview",robots:{index:false,follow:false}};
export default async function Page(){const user=await currentUser();if(!user)redirect("/login?callbackUrl=%2Fboot-fit%2Fpreview");if(user.status!=="ACTIVE"||!user.emailVerified)return <div className="shell account-page"><h1>Account unavailable</h1><p>This preview requires an active verified account.</p></div>;return <div className="shell foot-page"><Link className="text-link" href="/account">← Account settings</Link><div className="account-intro"><p className="eyebrow">BOOT FIT FINDER · ENGINE PREVIEW</p><h1>Evidence before answers.</h1><p>A deterministic preference preview. Missing product information stays unknown.</p></div><div className="grid gap-8"><RecommendationPreview/></div></div>;}
