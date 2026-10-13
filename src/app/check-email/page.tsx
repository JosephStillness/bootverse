import Link from "next/link";
import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";
export const metadata: Metadata = {
  title: "Check your email",
  robots: { index: false, follow: false },
};
export default function CheckEmail() {
  return (
    <div className="shell account-page">
      <section className="account-panel">
        <p className="eyebrow">ONE MORE STEP</p>
        <h1>Check your inbox.</h1>
        <p>
          Open the BootVerse sign-in link in your email. It expires in 15
          minutes and can be used once.
        </p>
        <p className="field-help">
          Check your spam folder. If it has expired, request a fresh link. Your
          account is created only after you verify your email.
        </p>
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Back to sign in
        </Link>
      </section>
    </div>
  );
}
