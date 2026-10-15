import Link from "next/link";
import { VerifiedCreatorBadge } from "@/components/platform/verified-badge";
import { Avatar } from "@/components/accounts/avatar";
import { Badge } from "@/components/ui/badge";
import type { CommunityPost, BootReference } from "@/lib/community/service";
export function BootReferenceCard({ boot }: { boot: BootReference }) {
  return (
    <div>
      <Link className="post-boot-reference" href={`/boots/${boot.slug}`}>
        <span>Linked boot{boot.sample ? " · Unverified sample" : ""}</span>
        <strong>{boot.label}</strong>
      </Link>
      <Link href={`/boots/${boot.slug}#reviews`} className="text-link">
        Read structured boot reviews
      </Link>
    </div>
  );
}
export function PostCard({ post }: { post: Omit<CommunityPost, "content"> }) {
  return (
    <article className="post-card">
      <div className="post-meta">
        <Avatar name={post.author.displayName} imageId={post.author.images[0]?.id} />
        <Link href={`/users/${post.author.username}`}>
          {post.author.displayName}
        </Link>
        <VerifiedCreatorBadge verified={post.author.verifiedCreator} />
        <time dateTime={post.createdAt.toISOString()}>
          {post.createdAt.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })}
        </time>
      </div>
      <Link className="post-title" href={`/community/${post.slug}`}>
        <h2>{post.title}</h2>
      </Link>
      {post.sponsorship && <p className="verification-note">Sponsored: {post.sponsorship}</p>}
      <p className="post-excerpt">{post.excerpt}</p>
      <div className="post-labels">
        <Link href={`/community?category=${post.category.id}`}>
          <Badge variant="outline">{post.category.name}</Badge>
        </Link>
        {post.tags.map((tag) => (
          <Link
            key={tag}
            className="post-tag"
            href={`/community?tag=${encodeURIComponent(tag)}`}
          >
            #{tag}
          </Link>
        ))}
      </div>
      {post.boot && <BootReferenceCard boot={post.boot} />}
      <div className="post-engagement">
        <span>{post.score} net votes</span>
        <Link href={`/community/${post.slug}#comments`}>
          {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
        </Link>
      </div>
    </article>
  );
}
