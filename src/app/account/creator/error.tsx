"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: {
    reset: () => void;
}) { return <div className="shell community-page" role="alert"><h1>This section is temporarily unavailable.</h1><p>Check database configuration and try again.</p><Button onClick={reset}>Try again</Button></div>; }
