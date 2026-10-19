"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { criteria } from "@/lib/reviews/validation";
import type { PublicReview, ReviewSummary } from "@/lib/reviews/service";
import { ReviewCard } from "./review-card";
import { ReviewPagination } from "./review-pagination";
type List = {
  reviews: PublicReview[];
  total: number;
  page: number;
  pages: number;
};
export function ReviewList({
  variantId,
  bootSlug,
  author,
}: {
  variantId?: string;
  bootSlug?: string;
  author?: string;
}) {
  const [filters, setFilters] = useState({
    sort: "recent",
    size: "",
    shape: "",
    surface: "",
    duration: "",
    page: 1,
  });
  const [result, setResult] = useState<{
    key: string;
    list?: List;
    summary?: ReviewSummary;
    error?: string;
  }>();
  const summaryCache=useRef<{key:string;summary:ReviewSummary}|null>(null);
  const [retry, setRetry] = useState(0);
  const query = new URLSearchParams({
    ...(variantId ? { variant: variantId } : {}),
    ...(author ? { author } : {}),
    sort: filters.sort,
    page: String(filters.page),
    shape: filters.shape,
    surface: filters.surface,
    duration: filters.duration,
  });
  if (filters.size) {
    const [system, size] = filters.size.split(":");
    query.set("system", system);
    query.set("size", size);
  }
  const key = query.toString() + `&retry=${retry}`;
  useEffect(() => {
    const controller = new AbortController();
    const summaryKey=`${variantId}:${retry}`;
    async function load() {
      try {
        const [response, aggregate] = await Promise.all([
          fetch(`/api/reviews?${key}`, { signal: controller.signal }),
          variantId&&summaryCache.current?.key!==summaryKey
            ? fetch(
                `/api/boot-variants/${encodeURIComponent(variantId)}/ratings`,
                { signal: controller.signal },
              )
            : null,
        ]);
        if (!response.ok || (aggregate && !aggregate.ok))
          throw new Error("Reviews are unavailable. Please try again.");
        const list: List = await response.json(),
          summary: ReviewSummary | undefined = aggregate
            ? await aggregate.json()
            : summaryCache.current?.key===summaryKey?summaryCache.current.summary:undefined;
        if (!controller.signal.aborted){if(summary)summaryCache.current={key:summaryKey,summary};setResult({ key, list, summary });}
      } catch (e) {
        if (!controller.signal.aborted)
          setResult({
            key,
            error: e instanceof Error ? e.message : "Unable to load reviews.",
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [key, variantId, retry]);
  const loading = result?.key !== key;
  const summary = result?.summary;
  function change(name: string, value: string) {
    setFilters((f) => ({ ...f, [name]: value, page: 1 }));
  }
  return (
    <section
      id="reviews"
      className="reviews-section"
      aria-labelledby={`reviews-heading-${variantId ?? author}`}
    >
      <div className="review-section-heading">
        <div>
          <p className="eyebrow">COMMUNITY EXPERIENCES</p>
          <h2 id={`reviews-heading-${variantId ?? author}`}>
            {author ? "Review history" : "Boot reviews"}
          </h2>
        </div>
        {bootSlug && (
          <Link className="text-link" href={`/boots/${bootSlug}/reviews/new`}>
            Write a review →
          </Link>
        )}
      </div>
      {!author && (
        <p className="field-help">
          Exact generation, tier and outsole only. Colorways of this variant
          share reviews. Opinions and ownership are self-reported, not verified
          specifications or fit recommendations.
        </p>
      )}
      {summary?.options.sizesTruncated&&<p className="field-help">Showing the first 200 worn-size filter options. Other sizes remain accessible through the review API.</p>}
      {summary && (
        <div className="review-summary">
          <div>
            <strong className="review-score">
              {summary.overall === null
                ? "Not yet rated"
                : `${summary.overall.toFixed(1)} / 5`}
            </strong>
            <p>
              {summary.count} {summary.count === 1 ? "review" : "reviews"}
              {summary.count > 0 && summary.count < 5 ? " · Small sample" : ""}
            </p>
            <p className="field-help">
              Six criteria, equal weight. Summary includes all public reviews
              for this variant; filters apply to the list.
            </p>
          </div>
          <dl className="review-criteria">
            {Object.entries(criteria).map(([k, label]) => (
              <div key={k}>
                <dt>{label}</dt>
                <dd>
                  {summary.criteria[k as keyof typeof criteria]?.toFixed(1) ??
                    "Not yet rated"}
                </dd>
              </div>
            ))}
          </dl>
          <div
            className="review-distribution"
            aria-label="Distribution of rounded overall ratings"
          >
            {[...summary.distribution].reverse().map((d) => (
              <div key={d.star}>
                <span>{d.star} ★</span>
                <progress
                  value={d.count}
                  max={summary.count || 1}
                  aria-label={`${d.star} stars: ${d.count} reviews`}
                />
                <span>{d.count}</span>
              </div>
            ))}
            <p className="field-help">
              Overall averages rounded to nearest star.
            </p>
          </div>
        </div>
      )}
      <div className="review-filters">
        <label>
          Sort
          <select
            className="community-select"
            value={filters.sort}
            onChange={(e) => change("sort", e.target.value)}
          >
            <option value="recent">Most recent</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
            <option value="helpful">Most helpful</option>
          </select>
        </label>
        {summary && summary.options.sizes.length > 0 && (
          <label>
            Size worn
            <select
              className="community-select"
              value={filters.size}
              onChange={(e) => change("size", e.target.value)}
            >
              <option value="">All sizes</option>
              {summary.options.sizes.map((x) => (
                <option key={x} value={x}>
                  {x.replace(":", " ")}
                </option>
              ))}
            </select>
          </label>
        )}
        {summary && summary.options.shapes.length > 0 && (
          <label>
            Shared foot shape
            <select
              className="community-select"
              value={filters.shape}
              onChange={(e) => change("shape", e.target.value)}
            >
              <option value="">All shapes</option>
              {summary.options.shapes.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        )}
        {summary && summary.options.surfaces.length > 0 && (
          <label>
            Playing surface
            <select
              className="community-select"
              value={filters.surface}
              onChange={(e) => change("surface", e.target.value)}
            >
              <option value="">All surfaces</option>
              {summary.options.surfaces.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        )}
        {summary && summary.options.durations.length > 0 && (
          <label>
            Ownership
            <select
              className="community-select"
              value={filters.duration}
              onChange={(e) => change("duration", e.target.value)}
            >
              <option value="">All durations</option>
              {summary.options.durations.map((x) => (
                <option key={x} value={x}>
                  {x === "under-3"
                    ? "Under 3 months"
                    : x === "3-12"
                      ? "3–12 months"
                      : "Over 12 months"}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {(filters.size ||
        filters.shape ||
        filters.surface ||
        filters.duration) && (
        <Button
          variant="outline"
          onClick={() =>
            setFilters({
              sort: "recent",
              size: "",
              shape: "",
              surface: "",
              duration: "",
              page: 1,
            })
          }
        >
          Clear filters
        </Button>
      )}
      <div aria-busy={loading} aria-live="polite">
        {loading ? (
          <p className="field-help">Loading reviews…</p>
        ) : result?.error ? (
          <div role="alert">
            <p>{result.error}</p>
            <Button variant="outline" onClick={() => setRetry((x) => x + 1)}>
              Retry
            </Button>
          </div>
        ) : (
          result?.list && (
            <>
              {result.list.reviews.length ? (
                result.list.reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))
              ) : (
                <p className="review-empty">
                  {result.list.total
                    ? "No reviews on this page."
                    : "No reviews match yet. Share your own experience."}
                </p>
              )}
              <ReviewPagination
                page={filters.page}
                pages={result.list.pages}
                onChange={(page) => setFilters((f) => ({ ...f, page }))}
              />
            </>
          )
        )}
      </div>
    </section>
  );
}
