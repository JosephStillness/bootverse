import Link from "next/link";
import { EmailForm } from "./email-form";
import { buttonVariants } from "@/components/ui/button";

export function AuthPanel({
  configured,
  returnTo,
  registering,
  failed,
}: {
  configured: boolean;
  returnTo: string;
  registering: boolean;
  failed: boolean;
}) {
  return (
    <div className="shell account-page">
      <div className="account-intro">
        <p className="eyebrow">YOUR BOOTVERSE ACCOUNT</p>
        <h1>{registering ? "Make yourself at home." : "Welcome back."}</h1>
        <p>
          One account for your football boot journey. Sign in securely with your
          email.
        </p>
      </div>
      <section className="account-panel" aria-labelledby="auth-title">
        <h2 id="auth-title">
          {registering ? "Join BootVerse" : "Sign in to BootVerse"}
        </h2>
        {failed && (
          <p role="alert" className="field-error">
            This link could not be used. It may have expired, already been used,
            or requests may be limited. Request a new link below.
          </p>
        )}
        {configured ? (
          <EmailForm returnTo={returnTo} registering={registering} />
        ) : (
          <div className="account-notice">
            <h3>Account setup is pending</h3>
            <p>
              Email sign-in is unavailable until the database, mail service and
              authentication secret are configured. You can still explore every
              catalogue page.
            </p>
            <Link
              href="/boots"
              className={buttonVariants({ variant: "outline" })}
            >
              Explore boots
            </Link>
          </div>
        )}
        <p className="account-switch">
          {registering ? "Already a member? " : "First time here? "}
          <Link href={registering ? "/login" : "/register"}>
            {registering ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </div>
  );
}
