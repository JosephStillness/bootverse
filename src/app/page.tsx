import Link from "next/link";
import { boots, bootData, surfaceLabels } from "@/lib/boots/data";
import { BootArt } from "@/components/boot-art";
import { BootCard } from "@/components/boot-card";
import { SampleNotice } from "@/components/sample-notice";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRightIcon, ArrowUpRightIcon } from "@/components/icons";
import { surfaces } from "@/lib/boots/types";
export default function Home() {
  const featured = [
    "sample-mercurial-volt-fg",
    "sample-predator-red-fg",
    "sample-future-peach-ag",
  ]
    .map((id) => boots.find((boot) => boot.id === id))
    .filter((boot) => boot !== undefined);
  return (
    <>
      <section className="shell hero">
        <div className="hero-copy">
          <p className="eyebrow">Football boot discovery</p>
          <h1>
            Find Your
            <br />
            Perfect Fit.
          </h1>
          <p className="hero-description">
            Explore football boots by brand, generation, tier, and surface. A
            catalogue built for the curious.
          </p>
          <Link href="/boots" className={buttonVariants({ size: "lg" })}>
            Explore Boots <ArrowUpRightIcon size={19} aria-hidden="true" />
          </Link>
        </div>
        <figure className="hero-figure">
          <BootArt hero />
          <figcaption>
            Unbranded concept artwork. Product images are not yet available.
          </figcaption>
        </figure>
      </section>
      <div className="shell">
        <SampleNotice />
      </div>
      <section className="shell section-space" aria-labelledby="featured-title">
        <div className="section-heading">
          <div>
            <h2 id="featured-title">Featured football boots</h2>
            <p>A first look at our sample collection.</p>
          </div>
          <Link href="/boots" className="text-link">
            Explore Boots <ArrowRightIcon size={18} aria-hidden="true" />
          </Link>
        </div>
        <div className="boot-grid">
          {featured.map((boot) => (
            <BootCard key={boot.id} boot={boot} />
          ))}
        </div>
      </section>
      <section className="shell brand-section" aria-labelledby="brand-title">
        <h2 id="brand-title">Explore by brand</h2>
        <p>Different names. One shared love for the game.</p>
        <div className="brand-grid">
          {bootData.brands.map((brand) => (
            <Link
              href={`/boots?brand=${brand.id}`}
              key={brand.id}
              className="brand-tile"
            >
              <span>{brand.name}</span>
              <span>
                {boots.filter((boot) => boot.brand.id === brand.id).length}{" "}
                {boots.filter((boot) => boot.brand.id === brand.id).length === 1 ? "sample" : "samples"} <ArrowUpRightIcon size={17} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section
        id="surfaces"
        className="shell section-space"
        aria-labelledby="surface-title"
      >
        <div className="section-heading">
          <div>
            <h2 id="surface-title">Explore by playing surface</h2>
            <p>
              Start with an outsole category. Check the details of each variant.
            </p>
          </div>
        </div>
        <div className="surface-grid">
          {surfaces.map((surface) => (
            <Link
              href={`/boots?surface=${surface}`}
              className="surface-tile"
              key={surface}
            >
              <span className="surface-tile-top">
                <strong>{surface}</strong>
                <ArrowUpRightIcon size={21} aria-hidden="true" />
              </span>
              <h3>{surfaceLabels[surface]}</h3>
              <span>
                {
                  boots.filter((boot) => boot.variant.surface === surface)
                    .length
                }{" "}
                sample{" "}
                {boots.filter((boot) => boot.variant.surface === surface)
                  .length === 1
                  ? "entry"
                  : "entries"}
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section id="about" className="shell about-section">
        <div>
          <p className="about-kicker">Precision. Performance. Community.</p>
          <h2>
            Get to know
            <br />
            your next pair.
          </h2>
          <p>
            BootVerse is a growing catalogue for people who care about football
            boots. Clear identities, useful details, and honest information come
            first.
          </p>
        </div>
        <div className="how-list">
          <div>
            <h3>Explore the collection</h3>
            <p>
              Search by name or narrow the catalogue by brand, silo, tier, and
              surface.
            </p>
          </div>
          <div>
            <h3>Check the full identity</h3>
            <p>
              Keep generations, tiers, outsole variants, and colorways distinct.
            </p>
          </div>
          <div>
            <h3>Know what’s verified</h3>
            <p>
              Our current entries are samples. Unknown specifications stay
              unknown. Fit tools and community features are planned for later.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
