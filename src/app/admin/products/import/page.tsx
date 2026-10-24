import Link from 'next/link';
import {connection} from 'next/server';
import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/accounts/service';
import {ImportWorkbench} from '@/components/data-import/import-workbench';
export const metadata={title:'Product imports',robots:{index:false,follow:false}};
export default async function ImportPage(){await connection();const actor=await currentUser();if(!actor)redirect('/login?callbackUrl=%2Fadmin%2Fproducts%2Fimport');if(actor.role!=='ADMIN'||actor.status!=='ACTIVE'||!actor.emailVerified)return <div className="shell account-page"><h1>Access restricted</h1><p>Administrator access is required.</p></div>;return <div className="shell community-page import-page"><Link href="/admin" className="text-link">Back to moderation</Link><p className="eyebrow">PRODUCT DATA · D2</p><h1>Import with provenance.</h1><p className="import-intro">Inspect structured source data, resolve identity, then commit drafts with a complete import report.</p><ImportWorkbench/></div>;}
