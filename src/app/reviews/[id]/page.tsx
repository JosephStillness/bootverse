import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { publicReview, helpfulState } from "@/lib/reviews/service";
import { CommunityError } from "@/lib/community/service";
import { currentUser } from "@/lib/accounts/service";
import { getDb } from "@/lib/db";
import { criteria } from "@/lib/reviews/validation";
import { ReviewActions } from "@/components/reviews/review-actions";
export const metadata = {
  title: "Community boot review",
  robots: { index: false, follow: true },
};
export default async function ReviewDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await connection();
  const { id } = await params;
  let review;
  try {
    review = await publicReview(id);
  } catch (e) {
    if (e instanceof CommunityError && e.status === 404) notFound();
    throw e;
  }
  const actor = await currentUser(),
    state = await helpfulState(id, actor),
    record = await getDb().bootReview.findUnique({
      where: { id },
      select: { authorId: true },
    }),
    owned =
      !!actor &&
      actor.status === "ACTIVE" &&
      !!actor.emailVerified &&
      record?.authorId === actor.id;
  const href = review.boot.slug
    ? `/boots/${review.boot.slug}#reviews`
    : `/users/${review.author.username}`;
  return (
    <div className="shell community-page post-detail">
      <Link href={href} className="text-link">
        Back to boot reviews
      </Link>
      {(await searchParams).saved === "1" && (
        <p role="status">Your review has been saved.</p>
      )}
      <p className="eyebrow">COMMUNITY OPINION · SELF-REPORTED OWNERSHIP</p>
      <h1>{review.boot.label}</h1>
      {review.boot.sample && (
        <p className="verification-note">
          This catalogue variant is an unverified sample configuration.
        </p>
      )}
      <p>
        <strong>{review.overall.toFixed(1)} / 5</strong> · Six equally weighted
        criteria
      </p>
      <p>
        <Link href={`/users/${review.author.username}`} className="text-link">
          {review.author.displayName}
        </Link>{" "}
        ·{" "}
        <time dateTime={review.createdAt}>
          {new Date(review.createdAt).toLocaleDateString("en-GB", {
            timeZone: "UTC",
          })}
        </time>
      </p>
      <p className="field-help">
        Updated{" "}
        {new Date(review.updatedAt).toLocaleDateString("en-GB", {
          timeZone: "UTC",
        })}{" "}
        · {review.sizeSystem} {review.sizeWorn} · {review.ownershipMonths}{" "}
        months · Approximately {review.matchesPlayed} matches
      </p>
      <dl className="review-criteria">
        {Object.entries(criteria).map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{review[key as keyof typeof criteria]} / 5</dd>
          </div>
        ))}
      </dl>
      <h2>Overall experience</h2>
      <p className="review-text">{review.experience}</p>
      <div className="post-form-grid">
        <section>
          <h2>Pros</h2>
          <p className="review-text">{review.pros}</p>
        </section>
        <section>
          <h2>Cons</h2>
          <p className="review-text">{review.cons}</p>
        </section>
      </div>
      {review.foot && (
        <section>
          <h2>Voluntarily shared foot information</h2>
          <p className="field-help">
            Self-reported, not verified measurements.
          </p>
          <p>
            Length: {review.foot.footLengthCm ?? "Not shared"}
            {review.foot.footLengthCm !== null ? " cm" : ""} · Width:{" "}
            {review.foot.footWidthCm ?? "Not shared"}
            {review.foot.footWidthCm !== null ? " cm" : ""} · Shape:{" "}
            {review.foot.footShape ?? "Not shared"}
          </p>
        </section>
      )}
      <section>
        <h2>Playing context & fit experience</h2>
        <p className="field-help">
          Subjective observations. No authoritative sizing conclusion.
        </p>
        <dl className="specification-list">
          {[
            ["Position", review.position],
            ["Typical surface", review.playingSurface],
            ["Width experience", review.widthObservation?.replaceAll("-", " ")],
            ["Toe room", review.toeRoom],
            ["Midfoot pressure", review.midfootPressure],
            ["Heel lockdown", review.heelLockdown],
            ["Break-in", review.breakIn],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className="review-text">{value ?? "Not shared"}</dd>
            </div>
          ))}
        </dl>
      </section>
      {review.purchasePrice !== null && (
        <p>
          Self-reported price paid: {review.currency}{" "}
          {review.purchasePrice.toFixed(2)}. This is not a current catalogue
          price.
        </p>
      )}
      <ReviewActions
        key={`${id}:${review.version}:${review.helpfulCount}:${state.helpful}:${actor?.id ?? "anonymous"}`}
        id={id}
        version={review.version}
        owned={owned}
        helpful={state.helpful}
        canVote={state.canVote}
        count={review.helpfulCount}
        returnHref={href}
      />
    </div>
  );
}
