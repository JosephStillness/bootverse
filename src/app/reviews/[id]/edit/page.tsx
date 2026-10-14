import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/accounts/service";
import { ownedReview, publicReview } from "@/lib/reviews/service";
import { CommunityError } from "@/lib/community/service";
import { AccessError } from "@/lib/accounts/authorization";
import { ReviewForm } from "@/components/reviews/review-form";
export const metadata = {
  title: "Edit review",
  robots: { index: false, follow: false },
};
export default async function EditReview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    actor = await currentUser();
  if (!actor)
    redirect(`/login?callbackUrl=${encodeURIComponent(`/reviews/${id}/edit`)}`);
  let owned, review;
  try {
    owned = await ownedReview(id, actor);
    review = await publicReview(id);
  } catch (e) {
    if (e instanceof CommunityError && e.status === 404) notFound();
    if (e instanceof AccessError)
      return (
        <div className="shell account-page">
          <h1>Review access denied</h1>
          <p>You can only edit your own review with an active account.</p>
        </div>
      );
    throw e;
  }
  return (
    <div className="shell community-page post-compose">
      <Link href={`/reviews/${id}`} className="text-link">
        Back to review
      </Link>
      <h1>Update your experience.</h1>
      <p>{review.boot.label}</p>
      <div className="post-compose-panel">
        <ReviewForm
          key={`${id}:${owned.version}`}
          variantId={owned.input.variantId}
          initial={owned.input}
          editing={{ id, version: owned.version }}
        />
      </div>
    </div>
  );
}
