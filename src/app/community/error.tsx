"use client";
import { Button } from "@/components/ui/button";
export default function CommunityError({ reset }: { reset: () => void }) {
  return (
    <div className="shell community-page">
      <div className="community-empty" role="alert">
        <h1>Community is temporarily unavailable.</h1>
        <p>We could not load discussions. Please try again.</p>
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
