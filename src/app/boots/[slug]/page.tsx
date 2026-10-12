import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { boots, surfaceLabels } from "@/lib/boots/data";
import { BootArt } from "@/components/boot-art";
import { SampleNotice } from "@/components/sample-notice";
import { CatalogueBackLink } from "@/components/catalogue-back-link";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftIcon, ArrowUpRightIcon } from "@/components/icons";
export const dynamicParams = false;
export function generateStaticParams() {
  return boots.map((boot) => ({ slug: boot.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const boot = boots.find((boot) => boot.slug === slug);
  return {
    title: boot
      ? `${boot.brand.name} ${boot.family.name} ${boot.tier.name} (${boot.colorway.name}) | Sample`
      : "Boot not found",
    description: boot
      ? `Unverified sample: ${boot.brand.name} ${boot.family.name}, ${boot.generation.name}, ${boot.tier.name}, ${boot.variant.surface ?? "unknown surface"}, ${boot.colorway.name}. Technical specifications and fit evidence are unknown.`
      : undefined,
  };
}
export default async function BootDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const boot = boots.find((boot) => boot.slug === slug);
  if (!boot) notFound();
  const variants = boots.filter(
    (entry) => entry.generation.id === boot.generation.id,
  );
  const surface = boot.variant.surface
    ? `${boot.variant.surface} · ${surfaceLabels[boot.variant.surface]}`
    : "Unknown surface";
  const specs = [
    ["Upper material", "upper"],
    ["Weight", "weight"],
    ["Release date", "releaseDate"],
    ["Price", "price"],
  ] as const;
  return (
    <div className="shell detail-page">
      <div className="detail-back">
        <Suspense
          fallback={
            <Link href="/boots" className="text-link">
              <ArrowLeftIcon size={18} aria-hidden="true" />
              Back to boots
            </Link>
          }
        >
          <CatalogueBackLink />
        </Suspense>
      </div>
      <div className="detail-layout">
        <figure>
          <BootArt
            eager
            sizes="(max-width: 767px) 100vw, 55vw"
            className="detail-art"
          />
          <figcaption className="image-caption">
            Concept artwork. This image does not depict this configuration.
          </figcaption>
        </figure>
        <div className="detail-summary">
          <div className="detail-eyeline">
            <span>{boot.brand.name}</span>
            <Badge variant="outline">Sample configuration</Badge>
          </div>
          <h1>
            {boot.family.name} {boot.tier.name}
          </h1>
          <p className="detail-generation">{boot.generation.name}</p>
          <p className="detail-colorway">
            <span
              className="swatch"
              style={{ backgroundColor: boot.colorway.swatch }}
              aria-hidden="true"
            />
            {boot.colorway.name}
          </p>
          <dl className="detail-facts">
            <div>
              <dt>Collection</dt>
              <dd>{boot.family.name}</dd>
            </div>
            <div>
              <dt>Tier</dt>
              <dd>{boot.tier.name} (sample)</dd>
            </div>
            <div>
              <dt>Playing surface</dt>
              <dd>{surface}</dd>
            </div>
            <div>
              <dt>Colorway</dt>
              <dd>{boot.colorway.name} (sample)</dd>
            </div>
          </dl>
          <p className="verification-note">
            This is an illustrative configuration. Product specifications, fit,
            and pricing have not been verified.
          </p>
          <a href="#specifications" className="text-link">
            View details <ArrowUpRightIcon size={18} aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="detail-notice">
        <SampleNotice />
      </div>
      <nav className="detail-section-nav" aria-label="Boot information">
        <a href="#variants">Variants</a>
        <a href="#specifications">Specifications</a>
        <a href="#fit">Fit & evidence</a>
      </nav>
      <section id="variants" className="detail-section">
        <div>
          <h2>Variants & colorways</h2>
          <p>
            Sample entries in the same generation. Each label identifies a tier,
            outsole, and colorway.
          </p>
        </div>
        <div className="variant-grid">
          {variants.map((entry) => (
            <Link
              href={`/boots/${entry.slug}`}
              key={entry.id}
              className="variant-link"
              aria-current={entry.id === boot.id ? "page" : undefined}
            >
              <span
                className="swatch"
                style={{ backgroundColor: entry.colorway.swatch }}
                aria-hidden="true"
              />
              <span>
                <strong>{entry.colorway.name}</strong>
                <span>
                  {entry.tier.name} /{" "}
                  {entry.variant.surface ?? "Unknown surface"}
                </span>
              </span>
              {entry.id === boot.id ? (
                <span className="variant-selected">Selected</span>
              ) : (
                <ArrowUpRightIcon size={18} aria-hidden="true" />
              )}
            </Link>
          ))}
        </div>
      </section>
      <section id="specifications" className="detail-section">
        <div>
          <h2>Technical specifications</h2>
          <p>Manufacturer specifications are not available for this sample.</p>
        </div>
        <dl className="specification-list">
          {specs.map(([label, key]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                <span>Unknown</span>
                <span>{boot.specifications[key].reason}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section id="fit" className="detail-section">
        <div>
          <h2>Fit & evidence</h2>
          <p>
            Clear sources matter. A boot family or brand alone does not
            establish its fit.
          </p>
        </div>
        <div className="evidence-grid">
          <div>
            <Badge variant="outline">No verified evidence</Badge>
            <h3>Fit information</h3>
            <p>
              Unknown. No width or sizing conclusion is available for this
              sample.
            </p>
          </div>
          <div>
            <Badge variant="outline">No community data</Badge>
            <h3>Ratings & player associations</h3>
            <p>
              Ratings and player endorsements are unknown. Community reviews
              have not been implemented.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
