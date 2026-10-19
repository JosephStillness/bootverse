import {ZodError} from "zod";
import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import {listCatalogue,catalogueQuery,catalogueOptions} from "@/lib/boots/service";
import { Catalogue } from "@/components/catalogue";
import { SampleNotice } from "@/components/sample-notice";
export const metadata: Metadata = { title: "Explore Boots" };
export default async function BootsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  // Render the query-aware catalogue on the initial request, including its boot links.
  await connection();
  const params=new URLSearchParams();for(const [key,value] of Object.entries(await searchParams)){if(typeof value==="string")params.set(key,value);}
  const query=(()=>{try{return catalogueQuery(params);}catch(error){if(error instanceof ZodError)return null;throw error;}})();
  if(!query)return <section className="shell catalogue-section"><h1>Check catalogue filters.</h1><p>One or more filter values is invalid. Clear the filters and try again.</p><Link href="/boots" className="text-link">Clear catalogue filters</Link></section>;
  const [initial,options]=await Promise.all([listCatalogue(query),catalogueOptions()]);
  return (
    <section className="shell catalogue-section">
      <div className="catalogue-header">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>Boot catalogue</span>
        </nav>
        <h1>Explore boots.</h1>
        <p>
          Every brand. Every detail. A closer look at the boots behind the game.
        </p>
      </div>
      {initial.boots.some(b=>b.sample)&&<SampleNotice />}
      <Catalogue initial={initial} initialQuery={params.toString()} options={options} />
    </section>
  );
}
