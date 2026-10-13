import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { publicPost, postPermissions } from "@/lib/community/service";
import { currentUser } from "@/lib/accounts/service";
import { PostMarkdown } from "@/components/community/markdown";
import { BootReferenceCard } from "@/components/community/post-card";
import { DeletePost } from "@/components/community/delete-post";
import { Avatar } from "@/components/accounts/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const post = process.env.DATABASE_URL
    ? await publicPost((await params).slug)
    : null;
  return {
    title: post?.title ?? "Discussion not found",
    description: post?.excerpt,
    robots: post ? undefined : { index: false, follow: false },
  };
}
export default async function PostDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  const post = process.env.DATABASE_URL ? await publicPost(slug) : null;
  if (!post) notFound();
  const actor = await currentUser(),
    manage = await postPermissions(slug, actor);
  return (
    <div className="shell community-page post-detail">
      <Link href="/community" className="text-link">
        Back to community
      </Link>
      <article className="post-detail-panel">
        <div className="post-labels">
          <Badge variant="outline">{post.category.name}</Badge>
          <span className="field-help">
            Community opinion · Unverified claims
          </span>
        </div>
        <h1>{post.title}</h1>
        <div className="post-meta">
          <Avatar name={post.author.displayName} />
          <Link href={`/users/${post.author.username}`}>
            {post.author.displayName}
          </Link>
          <time dateTime={post.createdAt.toISOString()}>
            {post.createdAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </time>
        </div>
        {post.version > 1 && (
          <p className="field-help">
            Edited{" "}
            {post.updatedAt.toLocaleDateString("en-GB", { timeZone: "UTC" })}
          </p>
        )}
        {post.boot && <BootReferenceCard boot={post.boot} />}
        <PostMarkdown content={post.content} />
        <div className="post-labels">
          {post.tags.map((tag) => (
            <Link
              key={tag}
              href={`/community?tag=${encodeURIComponent(tag)}`}
              className="post-tag"
            >
              #{tag}
            </Link>
          ))}
        </div>
        {manage && (
          <div className="post-owner-actions">
            <Link
              href={`/community/${slug}/edit`}
              className={buttonVariants({ variant: "outline" })}
            >
              Edit post
            </Link>
            <DeletePost slug={slug} version={post.version} />
          </div>
        )}
      </article>
      <p className="field-help mt-6">
        Comments and voting will be available later. For now, start a related
        discussion from the community feed.
      </p>
    </div>
  );
}
