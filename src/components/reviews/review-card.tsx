import Link from "next/link";
import type { PublicReview } from "@/lib/reviews/service";
export function ReviewCard({ review }: { review: PublicReview }) {
  return (
    <article className="review-card">
      <div className="review-card-heading">
        <strong>{review.overall.toFixed(1)} / 5</strong>
        <span>{review.helpfulCount} found helpful</span>
      </div>
      <Link className="text-link" href={`/reviews/${review.id}`}>
        {review.boot.label}
      </Link>
      <p className="field-help">
        Community opinion · Self-reported ownership
        {review.boot.sample ? " · Unverified sample variant" : ""}
      </p>
      <p className="review-text">
        {review.experience.slice(0, 220)}
        {review.experience.length > 220 ? "…" : ""}
      </p>
      <p className="field-help">
        {review.sizeSystem} {review.sizeWorn} · {review.ownershipMonths} months
        · approximately {review.matchesPlayed} matches
      </p>
      <div className="review-card-heading">
        <Link href={`/users/${review.author.username}`} className="text-link">
          {review.author.displayName}
        </Link>
        <time dateTime={review.createdAt}>
          {new Date(review.createdAt).toLocaleDateString("en-GB", {
            timeZone: "UTC",
          })}
        </time>
      </div>
      <Link href={`/reviews/${review.id}`} className="text-link">
        Read full review
      </Link>
    </article>
  );
}
