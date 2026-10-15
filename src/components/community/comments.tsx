"use client";
import Link from "next/link";
import { ReportControl } from "@/components/platform/report-control";
import { useEffect, useId, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/accounts/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose } from "@/components/ui/sheet";
import type { CommentItem, CommentPage } from "@/lib/community/interactions";
import { commentSchema } from "@/lib/community/interactions-validation";

function CommentForm({
  slug,
  parent = null,
  editing,
  done,
  cancel,
}: {
  slug: string;
  parent?: string | null;
  editing?: CommentItem;
  done: (page?: number) => void;
  cancel?: () => void;
}) {
  const id = useId(),
    [content, setContent] = useState(editing?.content ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  return (
    <form
      className="comment-form"
      method="post"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setSuccess("");
        const parsed = commentSchema.safeParse({
          content,
          parentCommentId: parent,
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          return;
        }
        setBusy(true);
        try {
          const response = await fetch(
            `/api/community/posts/${slug}/comments${editing ? `/${editing.id}` : ""}`,
            {
              method: editing ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                editing
                  ? { content: parsed.data.content, version: editing.version }
                  : parsed.data,
              ),
            },
          );
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error ?? "Could not save comment.");
          }
          setContent("");
          setSuccess(
            editing
              ? "Comment updated."
              : "Comment posted. New comments appear at the end of this thread.",
          );
          const result = editing ? null : await response.json();
          done(result?.comment.page);
        } catch (error) {
          setError(
            error instanceof Error ? error.message : "Could not save comment.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <noscript>Enable JavaScript to submit comments.</noscript>
      <label htmlFor={id}>
        {editing
          ? "Edit comment"
          : parent
            ? "Your reply"
            : "Join the conversation"}
      </label>
      <textarea
        id={id}
        className="account-textarea"
        rows={3}
        required
        maxLength={3000}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={busy}
        aria-invalid={!!error}
        aria-describedby={`${id}-help ${id}-error`}
      />
      <p className="field-help" id={`${id}-help`}>
        Plain text · 1–3,000 characters. Share context; keep personal contact
        details private.
      </p>
      <p role="alert" className="field-error" id={`${id}-error`}>
        {error}
      </p>
      <p role="status" className="field-help">
        {success}
      </p>
      <div className="account-actions">
        <Button type="submit" disabled={busy}>
          {busy
            ? "Saving…"
            : editing
              ? "Save comment"
              : parent
                ? "Post reply"
                : "Post comment"}
        </Button>
        {cancel && (
          <Button
            type="button"
            variant="outline"
            onClick={cancel}
            disabled={busy}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
function CommentRow({
  item,
  slug,
  canInteract,
  refresh,
  changed,
}: {
  item: CommentItem;
  slug: string;
  canInteract: boolean;
  refresh: number;
  changed: () => void;
}) {
  const articleRef = useRef<HTMLElement>(null);
  const [replying, setReplying] = useState(false),
    [editing, setEditing] = useState(false),
    [expanded, setExpanded] = useState(false),
    [replyPage, setReplyPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <li className="comment-row">
      <article ref={articleRef} tabIndex={-1}>
        <div className="post-meta">
          {item.author ? (
            <>
              <Avatar name={item.author.displayName} imageId={item.author.images[0]?.id} />
              <Link href={`/users/${item.author.username}`}>
                {item.author.displayName}
              </Link>
            </>
          ) : (
            <span>
              {item.deleted ? "Deleted comment" : "Comment unavailable"}
            </span>
          )}
          <time dateTime={item.createdAt}>
            {new Date(item.createdAt).toLocaleDateString("en-GB", {
              timeZone: "UTC",
            })}
          </time>
          {item.version > 1 && !item.deleted && <span>Edited</span>}
        </div>
        {editing && item.canEdit ? (
          <CommentForm
            slug={slug}
            editing={item}
            cancel={() => setEditing(false)}
            done={() => {
              setEditing(false);
              changed();
            }}
          />
        ) : (
          <p className="comment-content">
            {item.content ??
              (item.deleted
                ? "This comment was removed. Replies are preserved."
                : "This comment is no longer public. Replies are preserved.")}
          </p>
        )}
        {item.content && <ReportControl kind="COMMENT" id={item.id} />}
        <div className="comment-actions">
          {canInteract && item.content && item.depth < 2 && (
            <Button
              variant="ghost"
              onClick={() => setReplying(!replying)}
              aria-expanded={replying}
            >
              Reply
            </Button>
          )}
          {item.canEdit && (
            <>
              <Button variant="ghost" onClick={() => setEditing(!editing)}>
                Edit
              </Button>
              <Sheet
                trigger={
                  <Button variant="ghost" data-comment-delete>
                    Delete
                  </Button>
                }
                finalFocus={() =>
                  articleRef.current?.querySelector<HTMLElement>(
                    ":scope > .comment-actions [data-comment-delete]",
                  ) ?? articleRef.current
                }
                title="Delete this comment?"
                description="Your text will be removed. Replies remain in the conversation."
              >
                <p role="alert" className="field-error">
                  {error}
                </p>
                <div className="account-actions">
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        const response = await fetch(
                          `/api/community/posts/${slug}/comments/${item.id}`,
                          {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ version: item.version }),
                          },
                        );
                        if (!response.ok) {
                          const data = await response.json();
                          throw new Error(
                            data.error ?? "Could not delete comment.",
                          );
                        }
                        changed();
                      } catch (error) {
                        setError(
                          error instanceof Error
                            ? error.message
                            : "Could not delete comment.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Confirm delete
                  </Button>
                  <SheetClose
                    render={
                      <Button variant="outline" disabled={busy}>
                        Cancel
                      </Button>
                    }
                  />
                </div>
              </Sheet>
            </>
          )}
          {item.replyCount > 0 && (
            <Button
              variant="ghost"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
            >
              {expanded ? "Hide replies" : `Show replies (${item.replyCount})`}
            </Button>
          )}
        </div>
        {replying && item.content && (
          <CommentForm
            slug={slug}
            parent={item.id}
            cancel={() => setReplying(false)}
            done={(page) => {
              setReplyPage(page ?? 1);
              setReplying(false);
              setExpanded(true);
              changed();
            }}
          />
        )}
        {expanded && (
          <CommentList
            key={replyPage}
            initialPage={replyPage}
            slug={slug}
            parent={item.id}
            canInteract={canInteract}
            refresh={refresh}
            changed={changed}
          />
        )}
      </article>
    </li>
  );
}
function CommentList({
  slug,
  parent = null,
  initialPage = 1,
  canInteract,
  refresh,
  changed,
}: {
  slug: string;
  parent?: string | null;
  initialPage?: number;
  canInteract: boolean;
  refresh: number;
  changed: () => void;
}) {
  const [page, setPage] = useState(initialPage),
    [data, setData] = useState<CommentPage | null>(null),
    [loadedKey, setLoadedKey] = useState<string | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const requestKey = `${slug}/${parent ?? ""}/${page}/${refresh}/${retry}`;
  const loading = loadedKey !== requestKey;
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      page: String(page),
      ...(parent ? { parent } : {}),
    });
    fetch(`/api/community/posts/${slug}/comments?${query}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error ?? "Could not load comments.");
        if (!controller.signal.aborted) {
          setData(body);
          setError("");
          setLoadedKey(requestKey);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setLoadedKey(requestKey);
          setError(
            error instanceof Error ? error.message : "Could not load comments.",
          );
        }
      });
    return () => controller.abort();
  }, [slug, parent, page, refresh, retry, requestKey]);
  return (
    <div
      className={parent ? "comment-replies" : "comment-list"}
      aria-busy={loading}
    >
      {loading && !data ? (
        <div
          className="comments-skeleton"
          role="status"
          aria-label="Loading comments"
        >
          <div />
          <div />
        </div>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <Button variant="outline" onClick={() => setRetry(retry + 1)}>
            Retry comments
          </Button>
        </div>
      ) : (
        data && (
          <>
            {!parent && (
              <p className="field-help" role="status">
                {data.commentCount} comments · Oldest first
              </p>
            )}
            {data.comments.length ? (
              <ol>
                {data.comments.map((item) => (
                  <CommentRow
                    key={item.id}
                    item={item}
                    slug={slug}
                    canInteract={canInteract}
                    refresh={refresh}
                    changed={changed}
                  />
                ))}
              </ol>
            ) : (
              <p className="field-help">
                {parent
                  ? "No replies on this page."
                  : "No comments on this page. Start the conversation."}
              </p>
            )}
            {(data.pages > 1 || page > 1) && (
              <nav
                className="community-pagination"
                aria-label={parent ? "Reply pages" : "Comment pages"}
              >
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span>
                  Page {page} of {data.pages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= Math.min(data.pages, 1000)}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        )
      )}
    </div>
  );
}
export function Comments({
  slug,
  canInteract,
}: {
  slug: string;
  canInteract: boolean;
}) {
  const router = useRouter(),
    [refresh, setRefresh] = useState(0),
    [newestPage, setNewestPage] = useState(1);
  const changed = () => {
    setRefresh((value) => value + 1);
    router.refresh();
  };
  return (
    <section
      className="discussion-comments"
      aria-labelledby="comments-heading"
      id="comments"
    >
      <h2 id="comments-heading">The conversation</h2>
      {canInteract ? (
        <CommentForm
          slug={slug}
          done={(page) => {
            setNewestPage(page ?? 1);
            changed();
          }}
        />
      ) : (
        <p>
          <Link
            className="text-link"
            href={`/login?callbackUrl=${encodeURIComponent(`/community/${slug}#comments`)}`}
          >
            Sign in to comment
          </Link>
        </p>
      )}
      <CommentList
        key={newestPage}
        initialPage={newestPage}
        slug={slug}
        canInteract={canInteract}
        refresh={refresh}
        changed={changed}
      />
    </section>
  );
}
