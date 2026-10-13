import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/accounts/service";
import { requireActiveUser } from "@/lib/accounts/authorization";
import { getDb } from "@/lib/db";
import { ProfileForm } from "@/components/accounts/profile-form";
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
    select: { username: true, displayName: true, bio: true },
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
          Your avatar uses your display-name initial. Image uploads arrive in
          Sprint 2.5.
        </p>
        <ProfileForm profile={profile} />
      </section>
    </div>
  );
}
