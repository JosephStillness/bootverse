'use client';
import {Button} from '@/components/ui/button';
export default function ErrorState({reset}:{reset:()=>void}){return <section className="shell community-page"><h1>Comparison unavailable.</h1><p>Your selected products could not be loaded.</p><Button onClick={reset}>Retry comparison</Button></section>;}
