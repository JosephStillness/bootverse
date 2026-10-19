import {ProductOffers} from '@/components/product-offers';
import Link from 'next/link';
import {RemoveComparison} from '@/components/comparison/selection';
import {connection} from 'next/server';
import {comparisonProducts} from '@/lib/boots/service';
import {comparisonHref,parseComparisonIds,MAX_COMPARISON} from '@/lib/boots/comparison';
import {ProductAttributeValue} from '@/components/product-attribute';
export const metadata={title:'Compare exact boot variants'};
export default async function ComparePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await connection();
 const raw=(await searchParams).boot,params=new URLSearchParams();for(const id of Array.isArray(raw)?raw:raw?[raw]:[])params.append('boot',id);
 const parsed=(()=>{try{return parseComparisonIds(params);}catch{return null;}})();
 const boots=parsed?await comparisonProducts(parsed):[];
 return <section className="shell community-page comparison-page"><p className="eyebrow">EXACT VARIANTS · SIDE BY SIDE</p><h1>Compare your shortlist.</h1><p>Choose up to {MAX_COMPARISON} variants from the catalogue, product details or Finder results. Each column retains its exact generation, tier and outsole. Colorways of the same variant share a column; prices are not generalized across sizes.</p><Link href="/boots" className="text-link">Choose boots from the catalogue ↗</Link>
 {!parsed?<p role="alert">Invalid comparison selection. Select up to four catalogue entries.</p>:<>
 {boots.length<(parsed?.length??0)&&<p role="status">Some entries are unpublished, missing, or duplicate variants and were omitted.</p>}
 {boots.length===0?<div className="empty-state"><h2>Your shortlist is empty.</h2><p>Use “Compare this variant” on a boot to begin. No specifications or prices are inferred.</p></div>:<div className="comparison-scroll" role="region" aria-label="Boot comparison table" tabIndex={0}><table className="comparison-table"><caption>Exact variant comparison · unknown information stays unknown</caption><thead><tr><th scope="col">Attribute</th>{boots.map(b=><th scope="col" key={b.id}><Link href={`/boots/${b.slug}`}>{b.brand.name} {b.family.name} {b.tier.name}</Link><p>{b.sample?'Sample configuration':'Published configuration'}</p><RemoveComparison entry={{entryId:b.id,variantId:b.variant.id,label:`${b.family.name} ${b.variant.surface??"unknown outsole"}`}} href={comparisonHref(boots.filter(x=>x.id!==b.id).map(x=>({entryId:x.id,variantId:x.variant.id,label:x.family.name})))}/></th>)}</tr></thead><tbody>
 {(['Brand','Model','Generation','Tier','Outsole','Colorway','Variant ID'] as const).map((label,i)=><tr key={label}><th scope="row">{label}</th>{boots.map(b=><td key={b.id}>{[b.brand.name,b.family.name,b.generation.name,b.tier.name,b.variant.surface??'Unknown',b.colorway.name,b.variant.id][i]}</td>)}</tr>)}
 {([['Upper material','upper'],['Weight','weight'],['Release date','releaseDate'],['Price','price'],['Physical fit','fit']] as const).map(([label,key])=><tr key={key}><th scope="row">{label}</th>{boots.map(b=><td key={b.id}>{key==='price'?<ProductOffers boot={b}/>:<ProductAttributeValue attribute={b.specifications[key]}/>}</td>)}</tr>)}
 </tbody></table></div>}
 <p className="field-help">Selection stays in page memory while navigating; the comparison URL contains only public entry IDs and can be shared. Source-backed specifications do not establish physical fit. Community reviews are opinions.</p></>}
 </section>;
}
