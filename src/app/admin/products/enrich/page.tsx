import Link from 'next/link';
import {connection} from 'next/server';
import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/accounts/service';
import {EnrichmentWorkbench} from '@/components/enrichment/workbench';
export const metadata={title:'Product enrichment',robots:{index:false,follow:false}};
export default async function EnrichPage(){await connection();const actor=await currentUser();if(!actor)redirect('/login?callbackUrl=%2Fadmin%2Fproducts%2Fenrich');if(actor.role!=='ADMIN'||actor.status!=='ACTIVE'||!actor.emailVerified)return <div className="shell account-page"><h1>Access restricted</h1><p>Administrator access is required.</p></div>;return <div className="shell community-page import-page"><Link href="/admin" className="text-link">Back to moderation</Link><p className="eyebrow">PRODUCT DATA · D3</p><h1>Evidence before claims.</h1><p className="import-intro">Enrich an exact product configuration. Preserve observations, review conflicts and document photo rights before anything becomes public.</p><EnrichmentWorkbench/></div>;}
