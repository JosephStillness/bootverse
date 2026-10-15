import Link from "next/link";
import { VerifiedCreatorBadge } from "@/components/platform/verified-badge";
import { Avatar } from "@/components/accounts/avatar";
import { criteria } from "@/lib/reviews/validation";
import type { PublicReview } from "@/lib/reviews/service";
export function ReviewCard({ review }: { review: PublicReview }) {
  const observations = [
    ["Width experience", review.widthObservation?.replaceAll("-", " ")],
    ["Toe room", review.toeRoom],
    ["Midfoot pressure", review.midfootPressure],
    ["Heel lockdown", review.heelLockdown],
    ["Break-in", review.breakIn],
    ["Sizing advice", review.sizingAdvice],
  ].filter(([, value]) => value);
  return (
    <article className="review-card">
      <VerifiedCreatorBadge verified={review.author.verifiedCreator} />
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
      {review.sponsorship && <p className="verification-note">Sponsored: {review.sponsorship}</p>}
      <p className="review-text">
        {review.experience.slice(0, 220)}
        {review.experience.length > 220 ? "…" : ""}
      </p>
      <p className="field-help">
        {review.sizeSystem} {review.sizeWorn} · {review.ownershipMonths} months
        · approximately {review.matchesPlayed} matches
      </p>
      <details className="review-optional">
        <summary>Ratings, pros & cons, and fit experience</summary>
        <dl className="review-criteria">
          {Object.entries(criteria).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{review[key as keyof typeof criteria]} / 5</dd>
            </div>
          ))}
        </dl>
        <div className="post-form-grid">
          <section><h3>Pros</h3><p className="review-text">{review.pros}</p></section>
          <section><h3>Cons</h3><p className="review-text">{review.cons}</p></section>
        </div>
        {observations.length > 0 && (
          <dl className="specification-list">
            {observations.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd className="review-text">{value}</dd></div>
            ))}
          </dl>
        )}
        {review.foot && (
          <p className="field-help">
            Voluntarily shared, self-reported foot information: length {review.foot.footLengthCm ?? "unknown"} cm,
            width {review.foot.footWidthCm ?? "unknown"} cm, shape {review.foot.footShape ?? "unknown"}.
          </p>
        )}
        <p className="field-help">Fit observations are community opinions, not verified measurements or manufacturer specifications.</p>
      </details>
      <div className="review-card-heading">
        <Avatar name={review.author.displayName} imageId={review.author.images[0]?.id} />
        <Link href={`/users/${review.author.username}`} className="text-link">
          {review.author.displayName} (@{review.author.username})
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
