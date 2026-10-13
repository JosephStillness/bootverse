import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
export default function MemberNotFound() {
  return (
    <div className="shell account-page">
      <section className="account-panel">
        <h1>Member not found.</h1>
        <p>This profile is unavailable or the username has changed.</p>
        <Link href="/boots" className={buttonVariants({ variant: "outline" })}>
          Explore boots
        </Link>
      </section>
    </div>
  );
}
