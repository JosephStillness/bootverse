'use client';
import {Button} from '@/components/ui/button';
export default function CatalogueError({reset}:{reset:()=>void}){
 return <section className="shell community-page"><h1>Catalogue unavailable.</h1><p>The product database could not be read. Please try again; no sample fallback has replaced the catalogue.</p><Button onClick={reset}>Retry catalogue</Button></section>;
}
