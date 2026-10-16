"use client";
import {Button} from "@/components/ui/button";
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="shell account-page" role="alert"><h1>Preview unavailable</h1><p>Please try again.</p><Button onClick={reset}>Try again</Button></div>;}
