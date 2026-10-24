import Image from 'next/image';
import type {publicAssets} from '@/lib/enrichment/public';
export function ProductGallery({images}:{images:ReturnType<typeof publicAssets>}){
 return <div className="product-gallery">{images.map((image,i)=><figure key={image.id}><div className={i===0?'product-photo primary':'product-photo'}><Image src={image.src??image.externalUrl!} alt={image.altText} fill unoptimized sizes="(max-width: 767px) 100vw, 55vw" loading={i===0?'eager':'lazy'} className="object-contain" referrerPolicy="no-referrer"/></div><figcaption className="image-caption">{image.attribution} · <a href={image.sourceUrl} className="text-link" target="_blank" rel="noopener noreferrer">Source & attribution</a></figcaption></figure>)}</div>;
}
