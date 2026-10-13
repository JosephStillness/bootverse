"use client";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { emailSchema } from "@/lib/accounts/validation";

export function EmailForm({
  returnTo,
  registering,
}: {
  returnTo: string;
  registering: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = new FormData(event.currentTarget).get("email");
    const email = emailSchema.safeParse(
      typeof input === "string" ? input.trim() : input,
    );
    if (!email.success) {
      setError("Enter a valid email address.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await signIn("nodemailer", {
        email: email.data,
        redirectTo: returnTo,
        redirect: false,
      });
      if (result?.error || !result?.ok) {
        setError(
          "We could not send a link. Try again later; repeated requests are limited.",
        );
        return;
      }
      router.push("/check-email");
    } catch {
      setError("Account services are unavailable. Please try again later.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="account-form">
      <div className="account-field">
        <label htmlFor="email">Email address</label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          aria-invalid={!!error}
          aria-describedby="email-help email-error"
          disabled={pending}
        />
        <p id="email-help" className="field-help">
          We will send a sign-in link valid for 15 minutes.
        </p>
        <p id="email-error" role="alert" className="field-error">
          {error}
        </p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending
          ? "Sending link…"
          : registering
            ? "Create account by email"
            : "Send sign-in link"}
      </Button>
      <p className="field-help">
        Your email stays private.{" "}
        {registering
          ? "Your account is created after you verify the link."
          : "New here? Verifying your first link also creates an account."}
      </p>
    </form>
  );
}
