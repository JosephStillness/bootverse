"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="shell section-space">
      <div className="empty-state" role="alert">
        <h1 className="text-5xl!">Something went wrong.</h1>
        <p>We couldn’t load this page. Try again to reload this page.</p>
        <Button onClick={reset} className="h-12 px-6">
          Try again
        </Button>
      </div>
    </div>
  );
}
