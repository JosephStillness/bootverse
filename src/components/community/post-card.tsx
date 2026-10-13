import Link from "next/link";
import { Avatar } from "@/components/accounts/avatar";
import { Badge } from "@/components/ui/badge";
import type { CommunityPost, BootReference } from "@/lib/community/service";
export function BootReferenceCard({ boot }: { boot: BootReference }) {
  return (
    <Link className="post-boot-reference" href={`/boots/${boot.slug}`}>
      <span>Linked boot{boot.sample ? " · Unverified sample" : ""}</span>
      <strong>{boot.label}</strong>
    </Link>
  );
}
export function PostCard({ post }: { post: Omit<CommunityPost, "content"> }) {
  return (
    <article className="post-card">
      <div className="post-meta">
        <Avatar name={post.author.displayName} />
        <Link href={`/users/${post.author.username}`}>
          {post.author.displayName}
        </Link>
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
    </article>
  );
}
