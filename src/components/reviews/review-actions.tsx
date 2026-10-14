"use client";
import Link from "next/link";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function ReviewActions({
  id,
  version,
  owned,
  helpful,
  canVote,
  count,
  returnHref,
}: {
  id: string;
  version: number;
  owned: boolean;
  helpful: boolean;
  canVote: boolean;
  count: number;
  returnHref: string;
}) {
  const router = useRouter(),
    lock = useRef(false),
    deleteTrigger = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [vote, setVote] = useState(helpful),
    [total, setTotal] = useState(count);
  async function act(deleting = false) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/reviews/${id}${deleting ? "" : "/helpful"}`,
        {
          method: deleting ? "DELETE" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deleting ? { version } : { helpful: !vote }),
        },
      );
      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Unable to save change.");
        return;
      }
      if (deleting) {
        router.push(returnHref);
        router.refresh();
      } else {
        const body = await response.json();
        setVote(body.helpful);
        setTotal(body.count);
        router.refresh();
      }
    } catch {
      setError("Connection lost. Try again.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <div>
      <div className="account-actions">
        {owned ? (
          <>
            <Link className="text-link" href={`/reviews/${id}/edit`}>
              Edit your review
            </Link>
            <Button
              ref={deleteTrigger}
              variant="outline"
              disabled={pending}
              onClick={() => setConfirm((x) => !x)}
              aria-expanded={confirm}
              aria-controls={`review-delete-${id}`}
            >
              Delete review
            </Button>
          </>
        ) : canVote ? (
          <Button
            variant="outline"
            disabled={pending}
            aria-pressed={vote}
            onClick={() => act()}
          >
            {vote ? "Marked helpful" : "Mark helpful"} ({total})
          </Button>
        ) : (
          <p className="field-help">
            {total} found helpful. Sign in to mark another member’s review
            helpful.
          </p>
        )}
      </div>
      {confirm && (
        <div id={`review-delete-${id}`} className="review-delete">
          <p>Permanently delete your review and helpful votes?</p>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => act(true)}
          >
            Confirm deletion
          </Button>{" "}
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              setConfirm(false);
              deleteTrigger.current?.focus();
            }}
          >
            Cancel
          </Button>
        </div>
      )}
      <p role="alert" className="field-error">
        {error}
      </p>
    </div>
  );
}
