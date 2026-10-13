import Link from "next/link";
import { Suspense } from "react";
import { FeedSkeleton } from "@/components/community/feed-skeleton";
import type { Metadata } from "next";
import { connection } from "next/server";
import { listPosts } from "@/lib/community/service";
import {
  categories,
  feedSchema,
  feedHref,
  type FeedFilters,
} from "@/lib/community/validation";
import { PostCard } from "@/components/community/post-card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
export const metadata: Metadata = {
  title: "Community",
  description:
    "Ask questions, share experiences and discuss football boots with the BootVerse community.",
};
export default async function Community({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const parsed = feedSchema.safeParse(await searchParams),
    filters = parsed.success ? parsed.data : feedSchema.parse({});
  return (
    <div className="shell community-page">
      <header className="community-header">
        <div>
          <p className="eyebrow">THE CONVERSATION STARTS HERE</p>
          <h1>BootVerse Community</h1>
          <p>Ask questions. Share experiences. Find your perfect boots.</p>
        </div>
        <Link href="/community/new" className={buttonVariants()}>
          Create Post
        </Link>
      </header>
      <div className="community-layout">
        <aside className="community-sidebar">
          <nav aria-label="Discussion categories">
            <Link
              href={feedHref(filters, { category: "", page: 1 })}
              aria-current={!filters.category ? "page" : undefined}
            >
              All Discussions
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={feedHref(filters, { category: category.id, page: 1 })}
                aria-current={
                  filters.category === category.id ? "page" : undefined
                }
              >
                {category.name}
              </Link>
            ))}
          </nav>
          <div className="community-guidance">
            <h2>Boot talk, with context.</h2>
            <p>
              Share what you wore, where you played and what you noticed.
              Personal experiences are community opinions, not verified
              specifications.
            </p>
            <p>
              Voting, comments and structured reviews will be available later.
            </p>
          </div>
        </aside>
        <div className="community-feed">
          <form action="/community" method="get" className="community-search">
            <div className="account-field">
              <label htmlFor="discussion-search">Search discussions</label>
              <Input
                type="search"
                id="discussion-search"
                name="q"
                defaultValue={filters.q}
                maxLength={100}
                placeholder="Search titles, posts or tags"
              />
            </div>
            <div className="account-field">
              <label htmlFor="discussion-sort">Sort by</label>
              <select
                id="discussion-sort"
                name="sort"
                defaultValue={filters.sort}
                className="community-select"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
            {(["category", "tag", "boot", "author"] as const)
              .filter((key) => filters[key])
              .map((key) => (
                <input
                  key={key}
                  type="hidden"
                  name={key}
                  value={filters[key]}
                />
              ))}
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
          <p className="field-help">
            Popularity and discussion sorting will arrive with votes and
            comments.
          </p>
          {(filters.q ||
            filters.category ||
            filters.tag ||
            filters.boot ||
            filters.author) && (
            <div className="feed-active-filters">
              <span>
                {[
                  filters.q && `Search: ${filters.q}`,
                  filters.category &&
                    categories.find((c) => c.id === filters.category)?.name,
                  filters.tag && `#${filters.tag}`,
                  filters.boot && "Linked boot",
                  filters.author && `Author: @${filters.author}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <Link href="/community" className="text-link">
                Clear filters
              </Link>
            </div>
          )}
          {!parsed.success ? (
            <div className="community-empty" role="alert">
              <h2>Check your filters.</h2>
              <p>The search or page selection is invalid.</p>
              <Link href="/community" className="text-link">
                Reset filters
              </Link>
            </div>
          ) : !process.env.DATABASE_URL ? (
            <div className="community-empty">
              <h2>Community setup is pending.</h2>
              <p>
                The database has not been configured. The boot catalogue is
                still available.
              </p>
              <Link href="/boots" className="text-link">
                Explore boots
              </Link>
            </div>
          ) : (
            <>
              <Suspense fallback={<FeedSkeleton />}>
                <FeedResults filters={filters} />
              </Suspense>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

async function FeedResults({ filters }: { filters: FeedFilters }) {
  const result = await listPosts(filters);
  return (
    <>
      <p className="feed-count" role="status">
        {result.total} {result.total === 1 ? "discussion" : "discussions"}
      </p>
      {result.posts.length ? (
        <div className="post-list">
          {result.posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="community-empty">
          <h2>
            {filters.page > 1
              ? "No discussions on this page."
              : result.total === 0 &&
                  !filters.q &&
                  !filters.category &&
                  !filters.tag &&
                  !filters.boot &&
                  !filters.author
                ? "Be the first to start a conversation."
                : "No discussions match your filters."}
          </h2>
          <p>Ask a boot question or share an experience with the community.</p>
          <div className="account-actions">
            <Link href="/community/new" className={buttonVariants()}>
              Create Post
            </Link>
            <Link
              href={feedHref(filters, {
                page: 1,
                q: "",
                category: "",
                tag: "",
                boot: "",
                author: "",
              })}
              className="text-link"
            >
              Reset filters
            </Link>
          </div>
        </div>
      )}
      {(result.pages > 1 || filters.page > 1) && (
        <nav
          className="community-pagination"
          aria-label="Discussion pagination"
        >
          {filters.page > 1 ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={feedHref(filters, { page: filters.page - 1 })}
            >
              Previous
            </Link>
          ) : (
            <span aria-disabled="true">Previous</span>
          )}
          <span>
            Page {filters.page}
            {filters.page <= result.pages
              ? ` of ${result.pages}`
              : " (out of range)"}
          </span>
          {filters.page < result.pages ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={feedHref(filters, { page: filters.page + 1 })}
            >
              Next
            </Link>
          ) : (
            <span aria-disabled="true">Next</span>
          )}
        </nav>
      )}
    </>
  );
}
