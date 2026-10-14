import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { boots } from "@/lib/boots/data";
import { currentUser } from "@/lib/accounts/service";
import { ReviewForm } from "@/components/reviews/review-form";
export const metadata = {
  title: "Write a boot review",
  robots: { index: false, follow: false },
};
export default async function NewReview({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    boot = boots.find((b) => b.slug === slug);
  if (!boot) notFound();
  const actor = await currentUser();
  if (!actor)
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/boots/${slug}/reviews/new`)}`,
    );
  if (actor.status !== "ACTIVE" || !actor.emailVerified)
    return (
      <div className="shell account-page">
        <h1>Account unavailable</h1>
      </div>
    );
  return (
    <div className="shell community-page post-compose">
      <Link className="text-link" href={`/boots/${slug}#reviews`}>
        Back to boot
      </Link>
      <h1>Share your experience.</h1>
      <p>
        {boot.brand.name} {boot.family.name} · {boot.generation.name} ·{" "}
        {boot.tier.name} · {boot.variant.surface ?? "Unknown surface"}
      </p>
      <p className="field-help">
        Unverified sample variant. Colorways share reviews; generations, tiers
        and outsoles remain separate.
      </p>
      <div className="post-compose-panel">
        <ReviewForm key={boot.variant.id} variantId={boot.variant.id} />
      </div>
    </div>
  );
}
