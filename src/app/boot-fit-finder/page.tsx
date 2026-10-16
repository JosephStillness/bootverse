import type {Metadata} from 'next';
import {currentUser} from '@/lib/accounts/service';
import {BootFitFinder} from '@/components/recommendations/finder';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Boot Fit Finder',description:'Explore football boots using your private preferences and transparent product and community evidence. Physical fit is not guaranteed.',robots:{index:false,follow:true}};
export default async function Page(){
 const user=await currentUser();
 if(user&&(user.status!=='ACTIVE'||!user.emailVerified))return <div className="shell account-page"><h1>Account unavailable</h1><p>The private finder requires an active, email-verified account.</p></div>;
 return <BootFitFinder authenticated={!!user}/>;
}
