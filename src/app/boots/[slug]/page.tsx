import {ProductOffers} from "@/components/product-offers";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {surfaceLabels} from "@/lib/boots/labels";
import {getProduct,generationProducts} from "@/lib/boots/service";
import {connection} from "next/server";
import {CompareButton} from "@/components/comparison/selection";
import {ProductAttributeValue} from "@/components/product-attribute";
import { BootArt } from "@/components/boot-art";
import { SampleNotice } from "@/components/sample-notice";
import { CatalogueBackLink } from "@/components/catalogue-back-link";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftIcon, ArrowUpRightIcon } from "@/components/icons";
import { ReviewList } from "@/components/reviews/review-list";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  await connection();
  const boot = await getProduct(slug);
  return {
    title: boot
      ? `${boot.brand.name} ${boot.family.name} ${boot.generation.name} ${boot.tier.name} ${boot.variant.surface??"Unknown outsole"} (${boot.colorway.name})${boot.sample?" | Sample":""}`
      : "Boot not found",
    description: boot
      ? `${boot.sample?"Unverified sample: ":""}${boot.brand.name} ${boot.family.name}, ${boot.generation.name}, ${boot.tier.name}, ${boot.variant.surface ?? "unknown surface"}, ${boot.colorway.name}. Technical specifications and fit evidence are unknown.`
      : undefined,
  };
}
export default async function BootDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await connection();
  const boot = await getProduct(slug);
  if (!boot) notFound();
  const variants = await generationProducts(boot.generation.id);
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
          {boot.sample?<BootArt
            eager
            sizes="(max-width: 767px) 100vw, 55vw"
            className="detail-art"
          />:<div className="finder-image-missing detail-art">No verified product image</div>}
          <figcaption className="image-caption">
            {boot.sample?"Concept artwork. This image does not depict this configuration.":"Product photography has not been provided."}
          </figcaption>
        </figure>
        <div className="detail-summary">
          <div className="detail-eyeline">
            <span>{boot.brand.name}</span>
            {boot.sample&&<Badge variant="outline">Sample configuration</Badge>}
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
              <dd>{boot.tier.name}{boot.sample?" (sample)":""}</dd>
            </div>
            <div>
              <dt>Playing surface</dt>
              <dd>{surface}</dd>
            </div>
            <div>
              <dt>Colorway</dt>
              <dd>{boot.colorway.name}{boot.sample?" (sample)":""}</dd>
            </div>
          </dl>
          <p className="verification-note">
            {boot.sample?"This is an illustrative configuration. Product specifications, fit, and pricing have not been verified.":"Only sourced technical attributes are shown. Missing specifications, physical fit, and current prices remain unknown."}
          </p>
          <CompareButton entry={{entryId:boot.id,variantId:boot.variant.id,label:`${boot.brand.name} ${boot.family.name} ${boot.generation.name} ${boot.tier.name} ${boot.variant.surface??"Unknown"}`}}/>
          <a href="#specifications" className="text-link">
            View details <ArrowUpRightIcon size={18} aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="detail-notice">
        {boot.sample&&<SampleNotice />}
      </div>
      <nav className="detail-section-nav" aria-label="Boot information">
        <a href="#variants">Variants</a>
        <a href="#specifications">Specifications</a>
        <a href="#fit">Fit & evidence</a>
        <a href="#reviews">Reviews</a>
      </nav>
      <section id="variants" className="detail-section">
        <div>
          <h2>Variants & colorways</h2>
          <p>
            Published entries in the same generation. Each label identifies a tier,
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
          <p>Only sourced specifications for this configuration are shown.</p>
        </div>
        <dl className="specification-list">
          {specs.map(([label, key]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                {key==="price"?<ProductOffers boot={boot}/>:<ProductAttributeValue attribute={boot.specifications[key]}/>}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section
        className="detail-section"
        aria-labelledby="boot-community-heading"
      >
        <div>
          <h2 id="boot-community-heading">Talk about this boot.</h2>
          <p>Find discussions linked to this exact catalogue configuration.</p>
        </div>
        <div className="account-actions">
          <Link
            href={`/community?boot=${encodeURIComponent(boot.id)}`}
            className="text-link"
          >
            View discussions
          </Link>
          <Link
            href={`/community/new?boot=${encodeURIComponent(boot.id)}`}
            className="text-link"
          >
            Ask the community
          </Link>
        </div>
      </section>
      <ReviewList
        key={boot.variant.id}
        variantId={boot.variant.id}
        bootSlug={boot.slug}
      />
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
              configuration.
            </p>
          </div>
          <div>
            <Badge variant="outline">Unverified associations</Badge>
            <h3>Player associations</h3>
            <p>
              Player endorsements are unknown. Community reviews are
              self-reported experiences, not verified specifications.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
