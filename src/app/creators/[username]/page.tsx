import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { creatorByUsername } from "@/lib/platform/creators";
import { routeUsername } from "@/lib/accounts/validation";
import { ReviewList } from "@/components/reviews/review-list";
import { VerifiedCreatorBadge } from "@/components/platform/verified-badge";
import { ReportControl } from "@/components/platform/report-control";
import { listPosts } from "@/lib/community/service";
import { feedSchema } from "@/lib/community/validation";
import { PostCard } from "@/components/community/post-card";
export const metadata = { title: "Creator profile", robots: { index: false, follow: true } };
export default async function CreatorPage({ params }: {
    params: Promise<{
        username: string;
    }>;
}) {
    await connection();
    const p = routeUsername((await params).username);
    if (!p.success)
        notFound();
    const creator = await creatorByUsername(p.data);
    if (!creator)
        notFound();
    const profile = creator.user.profile!, posts = await listPosts(feedSchema.parse({ author: profile.username }));
    return <div className="shell community-page"><Link className="text-link" href="/creators">Back to creators</Link>{creator.images[0] && <Image className="creator-cover" unoptimized src={`/api/images/${creator.images[0].id}`} alt="Creator cover photo" width={1600} height={600}/>}<section className="account-panel">{profile.images[0] && <Image className="creator-avatar" unoptimized src={`/api/images/${profile.images[0].id}`} alt="Creator avatar" width={80} height={80}/>}<p className="eyebrow">BOOTVERSE CREATOR</p><h1>{profile.displayName}</h1><p>@{profile.username}</p><VerifiedCreatorBadge verified={creator.verificationStatus === "APPROVED"}/><p>{creator.specialization}{creator.region ? ` · ${creator.region}` : ""}</p><p className="review-text">{profile.bio}</p><div className="account-actions">{(["youtube", "tiktok", "instagram", "website"] as const).map(k => creator[k] && <a key={k} className="text-link" href={creator[k]!} target="_blank" rel="noopener noreferrer">{k}</a>)}<Link className="text-link" href={`/users/${encodeURIComponent(profile.username)}`}>Member profile</Link></div><ReportControl kind="CREATOR" id={creator.id}/></section><h2>Community discussions ({posts.total})</h2>{posts.posts.length ? posts.posts.map(post => <PostCard key={post.id} post={post}/>) : <p>No public discussions yet.</p>}{posts.total > posts.posts.length && <Link href={`/community?author=${encodeURIComponent(profile.username)}`} className="text-link">View all discussions</Link>}<ReviewList author={profile.username}/></div>;
}
