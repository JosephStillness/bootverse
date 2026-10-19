'use client';
import {useState,type FormEvent} from 'react';
import {adminQuery,targetKinds} from '@/lib/platform/validation';
import {Button} from '@/components/ui/button';
type Filters=ReturnType<typeof adminQuery.parse>;
export function AdminFilters({filters,onApply}:{filters:Filters;onApply:(next:Filters)=>void}){
 const filterKey=JSON.stringify(filters);
 const [draft,setDraft]=useState(filters),[appliedKey,setAppliedKey]=useState(filterKey);
 // URL navigation replaces the applied filter state, including cached back/forward views.
 if(appliedKey!==filterKey){setAppliedKey(filterKey);setDraft(filters);}
 function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();onApply({...draft,page:1});}
 return <form method="get" autoComplete="off" className="review-filters" onSubmit={submit}>
  <label>Search reason or explanation<input name="q" maxLength={100} value={draft.q} onChange={e=>setDraft(f=>({...f,q:e.target.value}))}/></label>
  <label>Status<select name="status" className="community-select" value={draft.status} onChange={e=>setDraft(f=>({...f,status:adminQuery.shape.status.parse(e.target.value)}))}>{['OPEN','ACTIONED','DISMISSED','ALL'].map(value=><option key={value}>{value}</option>)}</select></label>
  <label>Content type<select name="kind" className="community-select" value={draft.kind} onChange={e=>setDraft(f=>({...f,kind:adminQuery.shape.kind.parse(e.target.value)}))}><option value="">All content</option>{targetKinds.map(value=><option key={value}>{value}</option>)}</select></label>
  <Button type="submit">Filter reports</Button><Button type="button" variant="outline" onClick={()=>{const empty=adminQuery.parse({});setDraft(empty);onApply(empty);}}>Reset filters</Button>
 </form>;
}
