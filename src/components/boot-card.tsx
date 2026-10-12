import Link from "next/link";
import type { CatalogueBoot } from "@/lib/boots/types";
import { ArrowUpRightIcon } from "./icons";
import { Badge } from "./ui/badge";
import { BootArt } from "./boot-art";
export function BootCard({ boot }: { boot: CatalogueBoot }) {
  return (
    <article className="boot-card">
      <Link
        href={`/boots/${boot.slug}`}
        className="group block"
        aria-label={`${boot.brand.name} ${boot.family.name}, ${boot.generation.name}, ${boot.tier.name}, ${boot.variant.surface ?? "unknown surface"}, ${boot.colorway.name}, sample entry`}
      >
        <BootArt />
        <div className="card-content">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="brand-label">{boot.brand.name}</span>
            <Badge variant="outline" className="rounded-sm">
              Sample entry
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[29px] font-semibold leading-tight">
              {boot.family.name}{" "}
              <span className="text-muted-foreground">{boot.tier.name}</span>
            </h3>
            <ArrowUpRightIcon
              size={23}
              className="text-muted-foreground transition-colors group-hover:text-primary"
              aria-hidden="true"
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {boot.generation.name}
          </p>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
            <span className="flex items-center gap-2 text-sm">
              <span
                className="size-3 rounded-full border border-white/20"
                style={{ backgroundColor: boot.colorway.swatch }}
                aria-hidden="true"
              />
              {boot.colorway.name}
            </span>
            <span className="surface-code">
              {boot.variant.surface ?? "Unknown surface"}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Concept artwork · Specifications unknown
          </p>
        </div>
      </Link>
    </article>
  );
}
