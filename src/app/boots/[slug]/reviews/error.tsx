"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="shell community-page" role="alert">
      <h1>Reviews are unavailable</h1>
      <p>Please try again. Your catalogue remains available.</p>
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
