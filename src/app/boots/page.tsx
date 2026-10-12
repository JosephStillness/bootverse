import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { boots } from "@/lib/boots/data";
import { Catalogue } from "@/components/catalogue";
import { SampleNotice } from "@/components/sample-notice";
export const metadata: Metadata = { title: "Explore Boots" };
export default async function BootsPage() {
  // Render the query-aware catalogue on the initial request, including its boot links.
  await connection();
  return (
    <section className="shell catalogue-section">
      <div className="catalogue-header">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>Boot catalogue</span>
        </nav>
        <h1>Explore boots.</h1>
        <p>
          Every brand. Every detail. A closer look at the boots behind the game.
        </p>
      </div>
      <SampleNotice />
      <Catalogue boots={boots} />
    </section>
  );
}
