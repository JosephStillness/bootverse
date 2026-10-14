"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function VoteControls({
  slug,
  initial,
  canInteract,
}: {
  slug: string;
  initial: { score: number; value: -1 | 0 | 1 };
  canInteract: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function vote(direction: -1 | 1) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/community/posts/${slug}/vote`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: state.value === direction ? 0 : direction,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save vote.");
      setState(data);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save vote.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="voting-area">
      <div
        className="vote-controls"
        role="group"
        aria-label="Vote on this discussion"
      >
        <Button
          variant={state.value === 1 ? "default" : "outline"}
          disabled={busy || !canInteract}
          aria-pressed={state.value === 1}
          aria-label={state.value === 1 ? "Remove upvote" : "Upvote"}
          onClick={() => vote(1)}
        >
          ↑
        </Button>
        <span role="status" aria-live="polite">
          {state.score} <span className="field-help">net votes</span>
        </span>
        <Button
          variant={state.value === -1 ? "default" : "outline"}
          disabled={busy || !canInteract}
          aria-pressed={state.value === -1}
          aria-label={state.value === -1 ? "Remove downvote" : "Downvote"}
          onClick={() => vote(-1)}
        >
          ↓
        </Button>
      </div>
      {!canInteract && (
        <Link
          className="text-link"
          href={`/login?callbackUrl=${encodeURIComponent(`/community/${slug}`)}`}
        >
          Sign in to vote
        </Link>
      )}
      <p className="field-error" role="alert">
        {error}
      </p>
    </div>
  );
}
