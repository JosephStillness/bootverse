import { Suspense } from "react";
import type { Metadata } from "next";
import { boots } from "@/lib/boots/data";
import { Catalogue } from "@/components/catalogue";
import { CatalogueSkeleton } from "@/components/catalogue-skeleton";
import { SampleNotice } from "@/components/sample-notice";
export const metadata: Metadata = { title: "Boot catalogue" };
export default function BootsPage() {
  return (
    <section className="shell catalogue-section">
      <div className="catalogue-header">
        <h1>Find your next obsession.</h1>
        <p>
          A world of boots, one catalogue. Explore by brand, silo, tier, and
          surface.
        </p>
      </div>
      <SampleNotice />
      <Suspense fallback={<CatalogueSkeleton />}>
        <Catalogue boots={boots} />
      </Suspense>
    </section>
  );
}
