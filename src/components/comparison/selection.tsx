'use client';
import {createContext,useContext,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Button,buttonVariants} from '@/components/ui/button';
import {addComparison,comparisonHref,MAX_COMPARISON,type ComparisonSelection} from '@/lib/boots/comparison';
const Context=createContext<{selected:ComparisonSelection[];toggle:(entry:ComparisonSelection)=>void;clear:()=>void}|null>(null);
export function ComparisonProvider({children}:{children:ReactNode}){
 const router=useRouter();
 const [selected,setSelected]=useState<ComparisonSelection[]>([]);
 function toggle(entry:ComparisonSelection){setSelected(current=>current.some(b=>b.variantId===entry.variantId)?current.filter(b=>b.variantId!==entry.variantId):addComparison(current,entry));}
 return <Context value={{selected,toggle,clear:()=>setSelected([])}}>{children}{selected.length>0&&<aside className="comparison-tray" aria-label="Selected boot variants"><div className="shell comparison-tray-inner"><span role="status">{selected.length} of {MAX_COMPARISON} variants selected</span><Link className={buttonVariants()} href={comparisonHref(selected)}>Compare selected boots</Link><Button variant="outline" onClick={()=>{setSelected([]);if(window.location.pathname==="/compare")router.push("/compare");}}>Clear selection</Button></div></aside>}</Context>;
}
export function CompareButton({entry}:{entry:ComparisonSelection}){
 const state=useContext(Context);
 // Isolated component renders (e.g. previews) remain usable as direct links.
 if(!state)return <Link className="text-link" href={comparisonHref([entry])}>Compare this variant</Link>;
 const selected=state.selected.some(b=>b.variantId===entry.variantId);
 return <Button type="button" variant="outline" aria-pressed={selected} disabled={!selected&&state.selected.length>=MAX_COMPARISON} onClick={()=>state.toggle(entry)}>{selected?'Remove from comparison':'Compare this variant'}</Button>;
}

export function RemoveComparison({entry,href}:{entry:ComparisonSelection;href:string}){
 const state=useContext(Context);return <Link className="text-link" href={href} onClick={()=>{if(state?.selected.some(b=>b.variantId===entry.variantId))state.toggle(entry);}}>Remove {entry.label}</Link>;
}
