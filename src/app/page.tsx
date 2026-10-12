import Link from "next/link";
import { boots } from "@/lib/boots/data";
import { BootArt } from "@/components/boot-art";
import { BootCard } from "@/components/boot-card";
import { SampleNotice } from "@/components/sample-notice";
import { buttonVariants } from "@/components/ui/button";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  StackIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";
export default function Home() {
  return (
    <>
      <section className="shell hero">
        <div className="hero-copy">
          <p className="eyebrow">The football boot catalogue</p>
          <h1>
            Every boot.
            <br />
            <span className="text-primary">Every detail.</span>
          </h1>
          <p className="hero-description">
            Explore the silos, generations, and details behind the boots that
            make the game yours.
          </p>
          <Link
            href="/boots"
            className={cn(
              buttonVariants(),
              "h-12 gap-6 rounded-md px-6 text-base",
            )}
          >
            Explore catalogue <ArrowUpRightIcon size={20} />
          </Link>
        </div>
        <figure className="hero-figure">
          <BootArt hero />
          <figcaption>
            AI concept artwork. Unbranded and illustrative.
          </figcaption>
        </figure>
      </section>
      <div className="shell">
        <SampleNotice />
      </div>
      <section
        className="shell section-space"
        aria-labelledby="collection-title"
      >
        <div className="section-heading">
          <div>
            <h2 id="collection-title">Start your exploration.</h2>
            <p>Three sample configurations from the catalogue.</p>
          </div>
          <Link href="/boots" className="text-link">
            Explore catalogue <ArrowRightIcon size={19} />
          </Link>
        </div>
        <div className="boot-grid">
          {[boots[0], boots[4], boots[6]].map((boot) => (
            <BootCard key={boot.id} boot={boot} />
          ))}
        </div>
      </section>
      <section id="about" className="shell about-section">
        <div className="about-title">
          <StackIcon size={36} className="text-primary" aria-hidden="true" />
          <h2>
            The details
            <br />
            make the difference.
          </h2>
        </div>
        <div className="about-copy">
          <p>
            BootVerse is a growing home for football boot enthusiasts. This
            first chapter is a public catalogue, built around clear product
            identities and honest information.
          </p>
          <div className="about-facts">
            <div>
              <strong>Family & generation</strong>
              <span>A silo can span several distinct model generations.</span>
            </div>
            <div>
              <strong>Tier & outsole</strong>
              <span>Each tier and surface variant has its own identity.</span>
            </div>
            <div>
              <strong>Colorway</strong>
              <span>
                A different finish is a colorway, not a new generation.
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Community, reviews, and fit tools are planned for later. Today,
            explore eight clearly labeled samples.
          </p>
        </div>
      </section>
    </>
  );
}
