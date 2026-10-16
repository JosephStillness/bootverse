"use client";
import Link from 'next/link';
import {Button} from '@/components/ui/button';
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="shell account-page" role="alert"><h1>Finder unavailable</h1><p>We could not prepare the finder. Try again, or explore the public catalogue.</p><div className="finder-actions"><Button onClick={reset}>Try again</Button><Link href="/boots" className="text-link">Explore boots</Link></div></div>;}
