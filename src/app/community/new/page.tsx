import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/accounts/service";
import { catalogueReferences } from "@/lib/community/service";
import { PostForm } from "@/components/community/post-form";
export const metadata: Metadata = {
  title: "Create Post",
  robots: { index: false, follow: false },
};
export default async function NewPost({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await currentUser(),
    params = await searchParams;
  if (!actor)
    redirect(
      `/login?callbackUrl=${encodeURIComponent("/community/new" + (typeof params.boot === "string" ? `?boot=${encodeURIComponent(params.boot)}` : ""))}`,
    );
  if (actor.status !== "ACTIVE" || !actor.emailVerified)
    return (
      <div className="shell community-page">
        <h1>Account unavailable</h1>
        <p>This account cannot publish posts.</p>
      </div>
    );
  const boots = await catalogueReferences();
  const linkedBoot =
    typeof params.boot === "string"
      ? (boots.find((boot) => boot.id === params.boot)?.id ?? null)
      : null;
  return (
    <div className="shell community-page post-compose">
      <Link href="/community" className="text-link">
        Back to community
      </Link>
      <h1>Start a conversation.</h1>
      <p className="text-muted-foreground">
        A clear question or a thoughtful experience can help another player.
      </p>
      <div className="post-compose-panel">
        <PostForm
          boots={boots}
          initial={{
            title: "",
            sponsorship: null,
            content: "",
            categoryId: "questions",
            tags: [],
            bootEntryId: linkedBoot,
          }}
        />
      </div>
    </div>
  );
}
