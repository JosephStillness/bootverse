import type { CatalogueBoot } from "./types";
export const sorts = ["featured", "name-asc", "name-desc", "brand"] as const;
export type Sort = (typeof sorts)[number];
export interface CatalogueFilters {
  query: string;
  brand: string;
  silo: string;
  tier: string;
  surface: string;
  sort: Sort;
}
export const defaultFilters: CatalogueFilters = {
  query: "",
  brand: "",
  silo: "",
  tier: "",
  surface: "",
  sort: "featured",
};
export function parseFilters(params: URLSearchParams): CatalogueFilters {
  const sort = params.get("sort");
  return {
    query: params.get("q") ?? "",
    brand: params.get("brand") ?? "",
    silo: params.get("silo") ?? "",
    tier: params.get("tier") ?? "",
    surface: params.get("surface") ?? "",
    sort: sorts.includes(sort as Sort) ? (sort as Sort) : "featured",
  };
}
export function filterBoots(
  boots: CatalogueBoot[],
  filters: CatalogueFilters,
): CatalogueBoot[] {
  const words = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const result = boots.filter((boot) => {
    const text = [
      boot.brand.name,
      boot.family.name,
      boot.generation.name,
      boot.tier.name,
      boot.variant.surface ?? "unknown",
      boot.colorway.name,
    ]
      .join(" ")
      .toLowerCase();
    return (
      words.every((word) => text.includes(word)) &&
      (!filters.brand || boot.brand.id === filters.brand) &&
      (!filters.silo || boot.family.id === filters.silo) &&
      (!filters.tier || boot.tier.name === filters.tier) &&
      (!filters.surface ||
        (boot.variant.surface ?? "unknown") === filters.surface)
    );
  });
  const name = (boot: CatalogueBoot) =>
    `${boot.family.name} ${boot.tier.name} ${boot.colorway.name}`;
  if (filters.sort === "name-asc")
    result.sort((a, b) => name(a).localeCompare(name(b)));
  if (filters.sort === "name-desc")
    result.sort((a, b) => name(b).localeCompare(name(a)));
  if (filters.sort === "brand")
    result.sort(
      (a, b) =>
        a.brand.name.localeCompare(b.brand.name) ||
        name(a).localeCompare(name(b)),
    );
  return result;
}
