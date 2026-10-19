import type {ProductAttribute} from '@/lib/boots/types';
export function ProductAttributeValue({attribute}:{attribute:ProductAttribute}){
 return attribute.status==='unknown'?<><span>Unknown</span><span>{attribute.reason}</span></>:<><span>{attribute.value}</span><a href={attribute.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link">Source · observed {attribute.observedAt.slice(0,10)}</a></>;
}
