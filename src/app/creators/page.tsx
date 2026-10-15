import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { creators } from "@/lib/platform/creators";
import { directoryQuery } from "@/lib/platform/validation";
import { VerifiedCreatorBadge } from "@/components/platform/verified-badge";
export const metadata = { title: "Football boot creators", description: "Discover football boot creators and their community contributions." };
export default async function CreatorDirectory({ searchParams }: {
    searchParams: Promise<{
        q?: string;
        specialization?: string;
        page?: string;
    }>;
}) {
    await connection();
    const parsed = directoryQuery.safeParse(await searchParams);
    if (!parsed.success)
        return <div className="shell community-page"><h1>Check your creator search</h1><Link href="/creators" className="text-link">Reset search</Link></div>;
    const q = parsed.data, result = await creators(q);
    const href = (page: number) => `/creators?${new URLSearchParams({ q: q.q, specialization: q.specialization, page: String(page) })}`;
    return <div className="shell community-page"><div className="community-heading"><div><p className="eyebrow">THE PEOPLE BEHIND THE REVIEWS</p><h1>Boot creators.</h1><p>Independent voices. Real contributions. Ownership verification never certifies review accuracy.</p></div><Link className="text-link" href="/account/creator">Create your creator profile →</Link></div><form className="review-filters" action="/creators"><label>Search creators<input name="q" defaultValue={q.q} maxLength={100}/></label><label>Specialization (exact)<input name="specialization" defaultValue={q.specialization} maxLength={80}/></label><button className="platform-button" type="submit">Search</button><Link className="text-link" href="/creators">Reset</Link></form><p>{result.total} creators</p>{!result.creators.length ? <section className="account-panel"><h2>{q.q || q.specialization ? "No creators match your search." : "The next voice could be yours."}</h2><p>No profiles to show yet. Build your profile and share your own football boot experiences.</p><Link className="text-link" href="/account/creator">Join as a creator</Link></section> : <div className="creator-grid">{result.creators.map(c => { const p = c.user.profile!; return <article className="review-card" key={c.id}>{p.images[0] && <Image unoptimized src={`/api/images/${p.images[0].id}`} alt="Creator avatar" width={64} height={64} className="creator-avatar"/>}<Link className="text-link" href={`/creators/${encodeURIComponent(p.username)}`}><h2>{p.displayName}</h2><span>@{p.username}</span></Link><VerifiedCreatorBadge verified={c.verificationStatus === "APPROVED"}/><p>{c.specialization}</p>{c.region && <p className="field-help">{c.region}</p>}<div className="account-actions">{(["youtube", "tiktok", "instagram", "website"] as const).map(k => c[k] && <a href={c[k]!} target="_blank" rel="noopener noreferrer" className="text-link" key={k}>{k}</a>)}</div></article>; })}</div>}<nav aria-label="Creator pagination" className="account-actions">{q.page > 1 && <Link href={href(q.page - 1)} className="text-link">Previous</Link>}<span>Page {q.page}</span>{q.page < result.pages && <Link href={href(q.page + 1)} className="text-link">Next</Link>}</nav></div>;
}
