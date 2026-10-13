import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
export default function PostNotFound() {
  return (
    <div className="shell community-page">
      <div className="community-empty">
        <h1>Discussion not found.</h1>
        <p>This post may have been removed or is no longer public.</p>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href="/community"
        >
          Back to community
        </Link>
      </div>
    </div>
  );
}
