"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { profileSchema, type ProfileInput } from "@/lib/accounts/validation";

type Fields = Partial<Record<keyof ProfileInput, string[]>>;
export function ProfileForm({ profile }: { profile: ProfileInput }) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>({});
  const [message, setMessage] = useState("");
  const [savedUsername, setSavedUsername] = useState(profile.username);
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = profileSchema.safeParse({
      username: form.get("username"),
      displayName: form.get("displayName"),
      bio: form.get("bio"),
    });
    setMessage("");
    setFields({});
    if (!result.success) {
      setFields(result.error.flatten().fieldErrors);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const data = await response.json();
      if (!response.ok) {
        setFields(data.fields ?? {});
        setMessage(data.error ?? "Your profile could not be saved.");
        return;
      }
      setMessage("Profile saved.");
      setSavedUsername(data.profile.username);
      router.refresh();
    } catch {
      setMessage("Connection lost. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function logout(all: boolean) {
    setBusy(true);
    setLogoutError("");
    try {
      if (all) {
        const response = await fetch("/api/account/sessions", {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Session revocation failed.");
      }
      await signOut({ redirectTo: "/login" });
    } catch {
      setLogoutError("Could not sign out. Please try again.");
      setBusy(false);
    }
  }
  return (
    <>
      <form onSubmit={submit} className="account-form">
        <div className="account-field">
          <label htmlFor="displayName">Display name</label>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={profile.displayName}
            minLength={2}
            maxLength={50}
            required
            autoComplete="nickname"
            aria-invalid={!!fields.displayName}
            aria-describedby="displayName-error"
            disabled={busy}
          />
          <p className="field-error" id="displayName-error" role="alert">
            {fields.displayName?.[0]}
          </p>
        </div>
        <div className="account-field">
          <label htmlFor="username">Username</label>
          <Input
            id="username"
            name="username"
            defaultValue={profile.username}
            minLength={3}
            maxLength={30}
            required
            autoComplete="username"
            aria-invalid={!!fields.username}
            aria-describedby="username-help username-error"
            disabled={busy}
          />
          <p className="field-help" id="username-help">
            3–30 characters. Letters, numbers, hyphens or underscores. Changing
            it changes your public profile URL.
          </p>
          <p className="field-error" id="username-error" role="alert">
            {fields.username?.[0]}
          </p>
        </div>
        <div className="account-field">
          <label htmlFor="bio">
            About you{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={profile.bio}
            rows={4}
            maxLength={300}
            className="account-textarea"
            aria-invalid={!!fields.bio}
            aria-describedby="bio-help bio-error"
            disabled={busy}
          />
          <p className="field-help" id="bio-help">
            Up to 300 characters. This text is public; keep personal contact
            details private.
          </p>
          <p className="field-error" id="bio-error" role="alert">
            {fields.bio?.[0]}
          </p>
        </div>
        <p role="status" aria-live="polite" className="text-sm">
          {message}
        </p>
        <div className="account-actions">
          <Button type="submit" disabled={busy}>
            {busy ? "Please wait…" : "Save profile"}
          </Button>
          <Link href={`/users/${savedUsername}`} className="text-link">
            View public profile
          </Link>
        </div>
      </form>
      <div className="account-security">
        <h3>Sessions</h3>
        <p className="field-help">
          Stay signed in for up to 30 days. Sign out of every device if you have
          used a shared computer.
        </p>
        <div className="account-actions">
          <Button
            variant="outline"
            onClick={() => logout(false)}
            disabled={busy}
          >
            Sign out
          </Button>
          <Button
            variant="outline"
            onClick={() => logout(true)}
            disabled={busy}
          >
            Sign out of all devices
          </Button>
        </div>
        <p role="alert" className="field-error">
          {logoutError}
        </p>
      </div>
    </>
  );
}
