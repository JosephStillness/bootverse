import Link from "next/link";
import { ImageManager } from "@/components/platform/image-manager";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/accounts/service";
import { requireActiveUser } from "@/lib/accounts/authorization";
import { getDb } from "@/lib/db";
import { ProfileForm } from "@/components/accounts/profile-form";
// Session access must remain request-time even when auth is unconfigured at build.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Account settings",
  robots: { index: false, follow: false },
};
export default async function Account() {
  const user = await currentUser();
  if (!user) redirect("/login?callbackUrl=%2Faccount");
  if (user.status !== "ACTIVE" || !user.emailVerified)
    return (
      <div className="shell account-page">
        <section className="account-panel">
          <h1>Account unavailable</h1>
          <p>This account cannot access settings.</p>
        </section>
      </div>
    );
  requireActiveUser(user);
  const profile = await getDb().userProfile.findUniqueOrThrow({
    where: { userId: user.id },
    select: { id: true, username: true, displayName: true, bio: true },
  });
  return (
    <div className="shell account-page">
      <div className="account-intro">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>A little about you.</h1>
        <p>
          Choose how you appear on BootVerse. Your email and account identifiers
          stay private.
        </p>
      </div>
      <section className="account-panel" aria-labelledby="profile-heading">
        <h2 id="profile-heading">Public profile</h2>
        <p className="field-help">
          Your public avatar is optional. Images are processed to remove metadata.
        </p>
        <ImageManager kind="AVATAR" id={profile.id} editable />
        <ProfileForm profile={profile} />
        <Link className="text-link" href="/profile/foot-profile">My private foot profile</Link>
        <Link className="text-link" href="/boot-fit-finder">Boot Fit Finder</Link>
        <Link className="text-link" href="/boot-fit/preview">Recommendation engine preview</Link>
        <Link className="text-link" href="/account/creator">Manage creator profile</Link>
        {user.role !== "USER" && <Link className="text-link" href="/admin">Moderation dashboard</Link>}
      </section>
    </div>
  );
}
