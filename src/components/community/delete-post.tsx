"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
export function DeletePost({
  slug,
  version,
}: {
  slug: string;
  version: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function remove() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/community/posts/${slug}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Could not delete your post.");
        return;
      }
      router.replace("/community");
      router.refresh();
    } catch {
      setError("Connection lost. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Sheet
      trigger={<Button variant="destructive">Delete post</Button>}
      title="Delete this post?"
      description="The post will be permanently deleted. This cannot be undone."
    >
      <p className="field-help">
        If you only want to change your wording, cancel and edit the post
        instead.
      </p>
      <p role="alert" className="field-error mt-4">
        {error}
      </p>
      <div className="account-actions mt-6">
        <Button variant="destructive" disabled={pending} onClick={remove}>
          {pending ? "Deleting…" : "Confirm delete"}
        </Button>
        <SheetClose
          render={
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          }
        />
      </div>
    </Sheet>
  );
}
