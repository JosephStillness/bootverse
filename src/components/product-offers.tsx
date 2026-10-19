import type {CatalogueBoot} from '@/lib/boots/types';
export function ProductOffers({boot}:{boot:CatalogueBoot}){
 return boot.offers?.length?<div><p>Recent sourced offers · up to 8. Availability is unknown; verify at the source.</p>{boot.offers.map((offer,i)=><p key={i}><a className="text-link" href={offer.sourceUrl} target="_blank" rel="noopener noreferrer">{offer.amount} {offer.currency} · {offer.sizeSystem&&offer.size?`${offer.sizeSystem} ${offer.size}`:'Size unspecified'}</a><small> · observed {offer.observedAt.slice(0,10)}</small></p>)}</div>:<p>Unknown · no current sourced offer for this exact colorway.</p>;
}
