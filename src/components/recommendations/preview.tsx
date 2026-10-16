"use client";
import {useState} from "react";
import Link from "next/link";
import {Button} from "@/components/ui/button";
import type {EngineOutput,Result} from "@/lib/recommendations/types";
function CandidateDetails({result:r}:{result:Result}) {
 return <article className="account-panel">
  <h3 className="font-semibold">{r.productName}</h3>
  <p>{r.tier} · {r.outsole??"Unknown outsole"} · {r.entry.colorway}</p>
  <p className="field-help">Exact variant: {r.variantId}{r.sample?" · Sample configuration":""}</p>
  <p>Surface: {r.surfaceStatus} · Budget: {r.budgetStatus} · Availability: {r.availability}</p>
  {r.preferenceScore!==null&&<p>Preference score: {r.preferenceScore}/100 · Requested-factor evidence coverage: {r.evidenceCoverage}%</p>}
  {r.price&&<p>Scoped price: {r.price.amount} {r.price.currency} · observed {r.price.observedAt.slice(0,10)}</p>}
  <ul className="list-disc space-y-2 pl-5">{r.reasons.map(x=><li key={x}>{x}</li>)}</ul>
  <details><summary>Evidence gaps and cautions</summary><ul className="list-disc space-y-2 pl-5">{[...r.unknowns,...r.cautions].map(x=><li key={x}>{x}</li>)}</ul></details>
  {r.fitObservations.length>0&&<details><summary>Cited fit observations — not verified personal fit</summary><ul>{r.fitObservations.map((x,i)=><li key={i}>{x.observation} ({x.sourceKind})</li>)}</ul></details>}
  {r.sources.length>0&&<details><summary>Source references · evidence {r.evidenceConfidence}</summary><ul>{r.sources.map(s=><li key={s.id}><a className="text-link break-all" href={s.sourceUrl} target="_blank" rel="noopener noreferrer">{s.sourceKind} · observed {s.observedAt.slice(0,10)}</a></li>)}</ul></details>}
  {r.reviewAnalysis&&<details>
   <summary>Community fit analysis · {r.reviewAnalysis.quality}</summary>
   <p>{r.reviewAnalysis.explanation}</p>
   <p>Eligible independent reviewers: {r.reviewAnalysis.counts.eligible??"withheld"} · Similar same-size reviewers: {r.reviewAnalysis.counts.similar??"withheld"}</p>
   <p className="field-help">Overall pool may span worn sizes; similar reviewers must match your size and system. Neither pool changes ranking or outsole safety.</p>
   {r.reviewAnalysis.overall&&<p>Overall eligible pool: fit satisfaction {r.reviewAnalysis.overall.fitMean}/5 · comfort {r.reviewAnalysis.overall.comfortMean}/5.</p>}
   {r.reviewAnalysis.similarity&&<p>Reviewer-profile similarity: {r.reviewAnalysis.similarity.meanScore}/100 (rounded group mean, not fit probability).</p>}
   {r.reviewAnalysis.similar&&<dl className="space-y-2">{Object.entries({"Fit satisfaction":r.reviewAnalysis.similar.fitDistribution,"Width experience":r.reviewAnalysis.similar.widthDistribution,"Toe room":r.reviewAnalysis.similar.toeRoom,"Heel lockdown":r.reviewAnalysis.similar.heelLockdown,"Break-in":r.reviewAnalysis.similar.breakIn}).map(([label,distribution])=><div key={label}><dt className="font-medium">{label}</dt><dd>{distribution?Object.entries(distribution).map(([key,n])=>`${key.replaceAll("-"," ")}: ${n}`).join(" · "):"Breakdown withheld to protect small groups."}</dd></div>)}</dl>}
   <ul className="list-disc space-y-2 pl-5">{[...r.reviewAnalysis.conflicts,...r.reviewAnalysis.warnings].map(x=><li key={x}>{x}</li>)}</ul>
  </details>}
  <Link className="text-link" href={`/boots/${encodeURIComponent(r.entry.slug)}`}>View exact catalogue entry</Link>
 </article>;
}
export function RecommendationPreview() {
 const [result,setResult]=useState<EngineOutput|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function run(){setBusy(true);setError("");setResult(null);try{const response=await fetch("/api/boot-fit/recommendations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({limit:10})});const data=await response.json();if(!response.ok){setError(data.error??"The preview is unavailable.");return;}setResult(data);}catch{setError("Connection lost. Please try again.");}finally{setBusy(false);}}
 return <>
  <section className="account-panel"><h2>Experimental rule engine</h2><p>This is a technical preview, not the complete Boot Fit Finder. It uses your saved private preferences only with your consent. It does not determine your boot size or guarantee physical fit.</p><p>Surface approval requires exact-product manufacturer evidence. Sample products, unknown prices and missing sizing evidence stay explicitly unverified.</p><div className="account-actions"><Button onClick={run} disabled={busy}>{busy?"Evaluating evidence…":"Run private preview"}</Button><Link className="text-link" href="/profile/foot-profile">Manage foot profile & consent</Link></div><p role="alert">{error}</p><p role="status" aria-live="polite">{busy?"Loading candidate evidence…":!result&&!error?"No results calculated yet.":""}</p></section>
  {result&&<section className="grid gap-6" aria-live="polite"><h2 className="text-xl font-semibold">Recommendation results</h2><p>Rule {result.ruleVersion} · {result.counts.evaluated} variants evaluated · {result.counts.eligible} eligible · {result.counts.unverified} unverified · {result.counts.excluded} excluded.</p>{result.notices.map(x=><p key={x} className="field-help">{x}</p>)}{result.truncated&&<p>Results or evidence were bounded. This preview is not exhaustive.</p>}
   {result.eligible.map(r=><CandidateDetails key={r.variantId} result={r}/>)}
   {result.counts.evaluated===0&&<p>No catalogue variants are currently available to evaluate.</p>}
   {result.unverified.length>0&&<><h2 className="text-xl font-semibold">Unverified catalogue entries — not recommendations</h2>{result.unverified.map(r=><CandidateDetails key={r.variantId} result={r}/>)}</>}
  </section>}
 </>;
}
