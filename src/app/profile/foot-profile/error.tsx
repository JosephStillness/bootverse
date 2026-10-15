"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({reset}:{reset:()=>void}) {return <div className="shell account-page" role="alert"><h1>Foot profile unavailable</h1><p>We could not load your private profile. Please try again.</p><Button onClick={reset}>Try again</Button></div>;}
