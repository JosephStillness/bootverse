import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export default function NotFound() {
  return (
    <div className="shell section-space">
      <div className="empty-state">
        <h1 className="text-5xl!">Boot not found.</h1>
        <p>
          This entry isn’t in our sample catalogue. Explore the current
          collection instead.
        </p>
        <Link href="/boots" className={cn(buttonVariants(), "h-12 px-6")}>
          Explore Boots
        </Link>
      </div>
    </div>
  );
}
