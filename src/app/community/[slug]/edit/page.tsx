import Link from "next/link";
import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/accounts/service";
import { AccessError } from "@/lib/accounts/authorization";
import {
  editablePost,
  catalogueReferences,
  CommunityError,
} from "@/lib/community/service";
import { postSchema } from "@/lib/community/validation";
import { PostForm } from "@/components/community/post-form";
export const metadata: Metadata = {
  title: "Edit Post",
  robots: { index: false, follow: false },
};
export default async function EditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    actor = await currentUser();
  if (!actor)
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/community/${slug}/edit`)}`,
    );
  let result;
  try {
    result = await editablePost(slug, actor);
  } catch (error) {
    if (error instanceof CommunityError && error.status === 404) notFound();
    if (error instanceof AccessError)
      return (
        <div className="shell community-page">
          <h1>You cannot edit this post.</h1>
          <Link href="/community" className="text-link">
            Back to community
          </Link>
        </div>
      );
    throw error;
  }
  const { post, status } = result,
    boots = await catalogueReferences();
  return (
    <div className="shell community-page post-compose">
      <Link href={`/community/${slug}`} className="text-link">
        Back to post
      </Link>
      <h1>Edit your post.</h1>
      {status === "HIDDEN" && (
        <p className="field-help">
          This post is hidden. Editing it does not make it public.
        </p>
      )}
      <div className="post-compose-panel">
        <PostForm
          boots={boots}
          initial={{
            title: post.title,
            content: post.content,
            categoryId: postSchema.shape.categoryId.parse(post.category.id),
            tags: post.tags,
            bootEntryId: post.boot?.id ?? null,
          }}
          editing={{ slug, version: post.version }}
        />
      </div>
    </div>
  );
}
