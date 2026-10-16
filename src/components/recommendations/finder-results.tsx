"use client";
import {useState} from 'react';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {BootArt} from '@/components/boot-art';
import {catalogueReference,filterResults,defaultRefinements,type Refinements,type FinderValues} from '@/lib/recommendations/finder';
import {brandOptions} from '@/lib/foot-profile/validation';
import type {EngineOutput,Result} from '@/lib/recommendations/types';

export function FinderSummary({values}:{values:FinderValues}) {
 const size=values.sizeWorn&&values.sizeSystem?`${values.sizeSystem} ${values.sizeWorn}`:'Not supplied';
 return <dl className="finder-summary">
  <div><dt>Left foot · length / width</dt><dd>{values.leftLengthMm??'Unknown'} / {values.leftWidthMm??'Unknown'} {values.unit}</dd></div>
  <div><dt>Right foot · length / width</dt><dd>{values.rightLengthMm??'Unknown'} / {values.rightWidthMm??'Unknown'} {values.unit}</dd></div>
  <div><dt>Self-reported traits</dt><dd>{values.footShape??'Shape unknown'} · {values.instep??'Instep unknown'}</dd></div>
  <div><dt>Playing context</dt><dd>{values.surface??'Surface missing'} · {values.primaryPosition??'Position optional'}</dd></div>
  <div><dt>Fit preferences</dt><dd>{values.fitSensation??'Not specified'} · {values.snugness??'Not specified'}</dd></div>
  <div><dt>Budget</dt><dd>{values.budgetAmount&&values.currency?`${values.budgetAmount} ${values.currency}`:'Not supplied'}</dd></div>
  <div><dt>Brands / tiers</dt><dd>{values.preferredBrands.map(id=>brandOptions.find(b=>b.id===id)?.name??id).join(', ')||'No brand preference'} · {values.preferredTiers.join(', ')||'No tier preference'}</dd></div>
  <div><dt>Current worn size</dt><dd>{size}</dd></div>
 </dl>;
}
function CommunityEvidence({result}:{result:Result}) {
 const a=result.reviewAnalysis;
 if(!a)return <p>Community fit analysis is currently unavailable. No review evidence is inferred.</p>;
 return <>
  <p className="finder-status">{a.quality}</p><p>{a.explanation}</p>
  <dl className="finder-summary"><div><dt>Eligible reviewers · all worn sizes</dt><dd>{a.counts.eligible??'Withheld for privacy'}</dd></div><div><dt>Comparable reviewers · same worn size</dt><dd>{a.counts.similar??'Withheld for privacy'}</dd></div></dl>
  {a.overall&&<p>Overall eligible pool: fit satisfaction {a.overall.fitMean}/5 · comfort {a.overall.comfortMean}/5.</p>}
  {a.similar&&<><p>Comparable pool: fit satisfaction {a.similar.fitMean}/5 · comfort {a.similar.comfortMean}/5.</p><dl className="finder-summary">{Object.entries({'Width experience':a.similar.widthDistribution,'Toe room':a.similar.toeRoom,'Heel lockdown':a.similar.heelLockdown,'Break-in':a.similar.breakIn}).map(([label,cells])=><div key={label}><dt>{label}</dt><dd>{cells?Object.entries(cells).map(([key,n])=>`${key.replaceAll('-',' ')}: ${n}`).join(' · '):'Breakdown withheld for privacy'}</dd></div>)}</dl></>}
  {a.conflicts.length>0&&<div className="finder-note"><strong>Experiences conflict</strong><ul>{a.conflicts.map(x=><li key={x}>{x}</li>)}</ul></div>}
  <details className="finder-disclosure"><summary>Analysis policy and limitations</summary><ul>{a.warnings.map(x=><li key={x}>{x}</li>)}</ul></details>
 </>;
}
export function FinderResultCard({result:r,rank}:{result:Result;rank?:number}) {
 const boot=catalogueReference(r);
 const showScore=r.surfaceStatus==='compatible'&&r.preferenceScore!==null&&r.evidenceCoverage>=75;
 return <article className="finder-result">
  <div className="finder-product">
   {r.sample?<div className="finder-sample-art"><BootArt sizes="(max-width: 767px) 100vw, 240px"/><p className="art-disclaimer">Concept artwork · not a product photo</p></div>:<div className="finder-image-missing">No verified product image</div>}
   <div className="finder-product-body">
    <div className="finder-card-meta"><span>{rank?`Recommendation ${rank}`:'Unverified catalogue entry'}</span><span>{r.sample?'Sample configuration':r.brand}</span></div>
    <h3>{r.productName}</h3><p>{r.tier} · {r.outsole??'Unknown outsole'} · {r.entry.colorway}</p>
    <p className="field-help">Exact variant: {r.variantId}</p>
    <div className="finder-status-list"><span>Surface: {r.surfaceStatus==='compatible'?'Evidence supported':'Unverified'}</span><span>Budget: {r.budgetStatus==='not-requested'?'Not supplied':r.budgetStatus}</span><span>Availability: {r.availability}</span></div>
    <p className="finder-price">{r.price?`${r.price.amount} ${r.price.currency}`:'Verified price unavailable'}{r.price&&<small>Source observed {r.price.observedAt.slice(0,10)} · exact listed colorway/size scope</small>}</p>
    <p>{showScore?`Preference-ranking score: ${r.preferenceScore}/100`:'Preference evidence is incomplete; no numerical ranking score shown.'}</p><p className="field-help">Requested-factor evidence coverage: {r.evidenceCoverage}%. This is not a fit probability. Physical fit remains unverified.</p>
    {boot?<div className="finder-card-actions"><Link href={`/boots/${boot.slug}`} className="text-link">View Boot Details</Link><Link href={`/boots/${boot.slug}#reviews`} className="text-link">Read Community Reviews</Link></div>:<p className="field-help">A public detail page is not available for this exact database entry.</p>}
   </div>
  </div>
  <details className="finder-explanation"><summary>View Supporting Evidence<span aria-hidden="true"> +</span></summary>
   <div className="finder-explanation-body"><section><h4>Why this boot appeared</h4><ul>{r.reasons.map(x=><li key={x}>{x}</li>)}</ul></section>
   <section><h4>Community experience</h4><CommunityEvidence result={r}/></section>
   <section><h4>What we don’t know</h4><ul>{r.unknowns.map(x=><li key={x}>{x}</li>)}</ul></section>
   <section><h4>Before you play</h4><ul>{r.cautions.map(x=><li key={x}>{x}</li>)}</ul></section>
   {r.fitObservations.length>0&&<section><h4>Cited product observations</h4><ul>{r.fitObservations.map((o,i)=><li key={i}>{o.observation} · {o.sourceKind}</li>)}</ul></section>}
   <section><h4>Source references</h4>{r.sources.length?<ul>{r.sources.map(source=><li key={source.id}><a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link">{source.sourceKind} · observed {source.observedAt.slice(0,10)}</a></li>)}</ul>:<p>No usable cited product evidence is available.</p>}</section>
   </div>
  </details>
 </article>;
}
export function FinderResults({output,submitted,onEdit,onRetry,busy}:{output:EngineOutput;submitted:FinderValues;onEdit:()=>void;onRetry:()=>void;busy:boolean}) {
 const [filters,setFilters]=useState({...defaultRefinements});
 const eligible=filterResults(output.eligible,filters),unverified=filterResults(output.unverified,filters);
 const all=[...output.eligible,...output.unverified];
 function filter(key:keyof Refinements,label:string,options:{value:string;label:string}[]){return <div className="account-field"><label htmlFor={`result-${key}`}>{label}</label><select id={`result-${key}`} value={filters[key]} onChange={e=>setFilters(f=>({...f,[key]:e.target.value}))}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;}
 return <section aria-labelledby="finder-results-heading" className="finder-results">
  <div className="finder-results-heading"><div><p className="eyebrow">YOUR DISCOVERY RESULTS</p><h2 id="finder-results-heading" tabIndex={-1}>Evidence before certainty.</h2></div><div className="finder-actions"><Button variant="outline" onClick={onEdit} disabled={busy}>Edit preferences</Button><Button variant="outline" onClick={onRetry} disabled={busy}>{busy?'Please wait…':'Refresh evidence'}</Button></div></div>
  <p>Eligible variants: {output.counts.eligible} · Unverified: {output.counts.unverified} · Excluded by safety rules: {output.counts.excluded}.</p>
  <details className="finder-disclosure"><summary>Your private input summary</summary><FinderSummary values={submitted}/><p className="field-help">Inputs and results stay in this page’s memory. They are not placed in a share link.</p></details>
  <details className="finder-disclosure"><summary>How ranking works</summary><p>Outsole compatibility is checked first. Budget and stated preferences influence ranking; community reviews add observational context without boosting popularity. Unknown information limits conclusions. Check physical fit in person where possible.</p><p className="field-help">Rule {output.ruleVersion} · evidence snapshot {output.asOf}. Numeric scores are hidden below 75% requested-factor coverage.</p><ul>{output.notices.map(x=><li key={x}>{x}</li>)}</ul></details>
  {output.truncated&&<p className="finder-note">The engine bounded its catalogue scan or returned list. These results are not exhaustive. Refinements apply only to this returned set.</p>}
  <details className="finder-refinements" open><summary>Refine these results</summary><div className="finder-filter-grid">
   {filter('brand','Brand',[{value:'',label:'All brands'},...Array.from(new Map(all.map(r=>[r.brandId,{value:r.brandId,label:r.brand}])).values())])}
   {filter('tier','Tier',[{value:'',label:'All tiers'},...[...new Set(all.map(r=>r.tier))].map(value=>({value,label:value}))])}
   {filter('outsole','Outsole',[{value:'',label:'All outsoles'},...[...new Set(all.flatMap(r=>r.outsole?[r.outsole]:[]))].map(value=>({value,label:value}))])}
   {filter('budget','Budget status',[{value:'all',label:'All, including unknown'},{value:'within',label:'Verified within budget'},{value:'near',label:'Within or up to 10% above'}])}
   {filter('quality','Community evidence',[{value:'',label:'All evidence labels'},...['Insufficient Evidence','Limited Evidence','Moderate Evidence','Stronger Evidence'].map(value=>({value,label:value}))])}
   {filter('reviews','Review availability',[{value:'all',label:'All, including withheld'},{value:'available',label:'At least 5 eligible reviewers'}])}
  </div><Button variant="ghost" onClick={()=>setFilters({...defaultRefinements})}>Reset refinements</Button></details>
  <p role="status">Showing {eligible.length} {eligible.length===1?'recommendation':'recommendations'} and {unverified.length} unverified catalogue {unverified.length===1?'entry':'entries'} from the returned set.</p>
  {output.counts.eligible===0?<div className="finder-empty"><h3>No boots currently meet the verified criteria.</h3><p>Product-specific surface evidence is missing or the safety rules excluded the available variants. Changing budget cannot establish missing manufacturer evidence. You can adjust your preferences or explore the catalogue while fit remains unverified.</p><Link className="text-link" href="/boots">Explore the catalogue</Link></div>:eligible.length===0?<div className="finder-empty"><h3>No recommendations match these refinements.</h3><p>Reset the filters to see the engine’s returned eligible candidates. Safety exclusions remain in force.</p><Button variant="outline" onClick={()=>setFilters({...defaultRefinements})}>Show all returned recommendations</Button></div>:eligible.map(r=><FinderResultCard key={r.variantId} result={r} rank={output.eligible.findIndex(x=>x.variantId===r.variantId)+1}/>)}
  {unverified.length>0&&<section className="finder-unverified"><h2>Explore with caution.</h2><p>These are unverified catalogue entries, not fit recommendations. Sample configurations do not establish real manufacturer specifications or community fit evidence.</p>{unverified.map(r=><FinderResultCard key={r.variantId} result={r}/>)}</section>}
  <p className="field-help">Comparison is not implemented in the current catalogue. Boot Details and Community Reviews open the exact linked entry; no variants are silently combined.</p>
 </section>;
}
