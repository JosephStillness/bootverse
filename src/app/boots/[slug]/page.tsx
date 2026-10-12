import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { boots, surfaceLabels } from "@/lib/boots/data";
import { BootArt } from "@/components/boot-art";
import { SampleNotice } from "@/components/sample-notice";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftIcon } from "@/components/icons";
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
  const boot = boots.find((b) => b.slug === slug);
  return {
    title: boot
      ? `${boot.brand.name} ${boot.family.name} ${boot.tier.name} (${boot.colorway.name}) | Sample`
      : "Boot not found",
  };
}
export default async function BootDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const boot = boots.find((b) => b.slug === slug);
  if (!boot) notFound();
  const related = boots.filter(
    (b) => b.id !== boot.id && b.generation.id === boot.generation.id,
  );
  const facts = [
    ["Brand", boot.brand.name],
    ["Family / product silo", boot.family.name],
    ["Generation", boot.generation.name],
    ["Tier", `${boot.tier.name} (sample)`],
    [
      "Outsole surface",
      boot.variant.surface
        ? `${boot.variant.surface} · ${surfaceLabels[boot.variant.surface]}`
        : "Unknown",
    ],
    ["Colorway", `${boot.colorway.name} (sample)`],
  ];
  const groups = [
    {
      title: "Construction",
      attributes: [
        ["Upper material", "upper"],
        ["Boot weight", "weight"],
        ["Release date", "releaseDate"],
      ],
    },
    {
      title: "Price & feedback",
      attributes: [
        ["Price", "price"],
        ["Rating", "rating"],
      ],
    },
    {
      title: "Fit & players",
      attributes: [
        ["Fit information", "fit"],
        ["Player endorsements", "endorsements"],
      ],
    },
  ] as const;
  return (
    <div className="shell section-space">
      <Link href="/boots" className="text-link">
        <ArrowLeftIcon size={18} />
        Back to catalogue
      </Link>
      <div className="detail-layout">
        <figure>
          <BootArt className="detail-art" />
          <figcaption className="mt-3 text-xs text-muted-foreground">
            AI concept artwork. This image does not depict this sample
            configuration.
          </figcaption>
        </figure>
        <div>
          <Badge variant="outline" className="mb-4 h-6 rounded-sm text-primary">
            Sample configuration
          </Badge>
          <p className="brand-label mb-3">{boot.brand.name}</p>
          <h1>
            {boot.family.name}
            <br />
            <span className="text-primary">{boot.tier.name}</span>
          </h1>
          <p className="mt-5 flex items-center gap-3 text-muted-foreground">
            <span
              className="size-4 rounded-full"
              style={{ backgroundColor: boot.colorway.swatch }}
              aria-hidden="true"
            />
            {boot.colorway.name}
          </p>
          <dl className="detail-facts">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="mt-9">
        <SampleNotice />
      </div>
      <section className="mt-12" aria-labelledby="specifications">
        <h2 id="specifications">What we know.</h2>
        <p className="mt-3 text-muted-foreground">
          Technical and experiential attributes have not been verified for this
          sample.
        </p>
        <div className="spec-grid">
          {groups.map((group) => (
            <div className="spec-group" key={group.title}>
              <h3>{group.title}</h3>
              <dl>
                {group.attributes.map(([label, key]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd title={boot.specifications[key].reason}>Unknown</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-12" aria-labelledby="identity">
        <h2 id="identity">One family. Distinct identities.</h2>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          This colorway belongs to {boot.generation.name} of {boot.brand.name}{" "}
          {boot.family.name}. Its {boot.tier.name} tier and{" "}
          {boot.variant.surface ?? "unknown"} outsole are separate entities. A
          different surface is a different variant; a different colorway can
          share that variant.
        </p>
        {related.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            {related.map((entry) => (
              <Link
                key={entry.id}
                className="text-link rounded-md border border-border px-4"
                href={`/boots/${entry.slug}`}
              >
                {entry.colorway.name} / {entry.variant.surface ?? "Unknown"}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
