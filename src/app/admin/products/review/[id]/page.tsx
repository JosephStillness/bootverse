import { connection } from "next/server";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/accounts/service";
import { ReviewDetail } from "@/components/product-review/detail";
export const metadata = { title: "Product review", robots: { index: false, follow: false } };
export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const actor = await currentUser();
  if (!actor) redirect(`/login?callbackUrl=${encodeURIComponent(`/admin/products/review/${id}`)}`);
  if (actor.role !== "ADMIN" || actor.status !== "ACTIVE" || !actor.emailVerified)
    return <div className="shell account-page"><h1>Access restricted</h1><p>Administrator access is required.</p></div>;
  return <div className="shell community-page import-page review-page"><ReviewDetail id={id} /></div>;
}
