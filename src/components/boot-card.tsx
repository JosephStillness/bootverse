import { CompareButton } from "./comparison/selection";
import Link from "next/link";
import type { CatalogueBoot } from "@/lib/boots/types";
import { ArrowUpRightIcon } from "./icons";
import { Badge } from "./ui/badge";
import { BootArt } from "./boot-art";
export function BootCard({
  boot,
  returnTo,
  sizes,
}: {
  boot: CatalogueBoot;
  returnTo?: string;
  sizes?: string;
}) {
  const href = `/boots/${boot.slug}${returnTo ? `?from=${encodeURIComponent(returnTo)}` : ""}`;
  return (
    <article className="boot-card">
      <Link
        href={href}
        className="boot-card-link group"
        aria-label={`${boot.brand.name} ${boot.family.name} ${boot.tier.name}, ${boot.generation.name}, ${boot.variant.surface ?? "unknown surface"}, ${boot.colorway.name}${boot.sample?", sample entry":""}`}
      >
        {boot.sample?<BootArt sizes={sizes} />:<div className="finder-image-missing">No verified product image</div>}
        <div className="card-content">
          <div className="card-meta">
            <span>{boot.brand.name}</span>
            {boot.sample&&<Badge variant="outline">Sample</Badge>}
          </div>
          <div className="card-title">
            <h3>
              {boot.family.name} {boot.tier.name}
            </h3>
            <ArrowUpRightIcon size={20} aria-hidden="true" />
          </div>
          <p className="card-generation">{boot.generation.name}</p>
          <div className="card-variant">
            <span className="colorway-label">
              <span
                className="swatch"
                style={{ backgroundColor: boot.colorway.swatch }}
                aria-hidden="true"
              />
              {boot.colorway.name}
            </span>
            <span className="surface-code">
              {boot.variant.surface ?? "Unknown surface"}
            </span>
          </div>
          <p className="art-disclaimer">
            {boot.sample?"Concept artwork. Specifications unknown.":"See sourced specifications and unknowns."}
          </p>
        </div>
      </Link>
      <CompareButton entry={{entryId:boot.id,variantId:boot.variant.id,label:`${boot.brand.name} ${boot.family.name} ${boot.generation.name} ${boot.tier.name} ${boot.variant.surface??"Unknown surface"}`}}/>
    </article>
  );
}
