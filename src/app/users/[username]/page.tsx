import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { publicProfileSelect } from "@/lib/accounts/service";
import { usernameSchema } from "@/lib/accounts/validation";
import { Avatar } from "@/components/accounts/avatar";
import { listPosts } from "@/lib/community/service";
import { feedSchema } from "@/lib/community/validation";
import { PostCard } from "@/components/community/post-card";
export const metadata: Metadata = {
  title: "Member profile",
  robots: { index: false, follow: true },
};
export default async function UserProfile({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  await connection();
  const { username } = await params;
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) notFound();
  if (!process.env.DATABASE_URL)
    return (
      <div className="shell account-page">
        <section className="account-panel">
          <h1>Profiles are unavailable</h1>
          <p>Account services have not been configured yet.</p>
        </section>
      </div>
    );
  const profile = await getDb().userProfile.findFirst({
    where: {
      username: parsed.data,
      user: { status: "ACTIVE", emailVerified: { not: null } },
    },
    select: publicProfileSelect,
  });
  if (!profile) notFound();
  const activity = await listPosts(
    feedSchema.parse({ author: profile.username }),
  );
  return (
    <div className="shell account-page">
      <section className="account-panel public-profile">
        <Avatar name={profile.displayName} />
        <p className="eyebrow">BOOTVERSE MEMBER</p>
        <h1>{profile.displayName}</h1>
        <p className="text-muted-foreground">@{profile.username}</p>
        <p className="field-help">
          Joined{" "}
          {profile.createdAt.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </p>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        <section
          className="profile-posts"
          aria-labelledby="member-posts-heading"
        >
          <h2 id="member-posts-heading">
            Public discussions ({activity.total})
          </h2>
          {activity.posts.length ? (
            activity.posts
              .slice(0, 5)
              .map((post) => <PostCard key={post.id} post={post} />)
          ) : (
            <p className="field-help">
              This member has not published any discussions yet.
            </p>
          )}
          {activity.total > 5 && (
            <Link
              href={`/community?author=${encodeURIComponent(profile.username)}`}
              className="text-link"
            >
              View all discussions
            </Link>
          )}
          <p className="field-help">
            Review history will be available when structured reviews launch.
          </p>
        </section>
      </section>
    </div>
  );
}
