"use client";
import { useSearchParams } from "next/navigation";
import { bootData, surfaceLabels } from "@/lib/boots/data";
import type { CatalogueBoot } from "@/lib/boots/types";
import {
  filterBoots,
  parseFilters,
  defaultFilters,
  type CatalogueFilters,
} from "@/lib/boots/catalogue";
import { BootCard } from "./boot-card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { MagnifyingGlassIcon, XIcon, SlidersHorizontalIcon } from "./icons";

export function Catalogue({ boots }: { boots: CatalogueBoot[] }) {
  const searchParams = useSearchParams();
  const filters = parseFilters(new URLSearchParams(searchParams.toString()));
  const results = filterBoots(boots, filters);
  const tiers = [...new Set(bootData.tiers.map((t) => t.name))];
  const options = {
    brand: bootData.brands.map((b) => ({ value: b.id, label: b.name })),
    silo: bootData.families.map((f) => ({ value: f.id, label: f.name })),
    tier: tiers.map((t) => ({ value: t, label: t })),
    surface: [
      ...Object.entries(surfaceLabels).map(([value, label]) => ({
        value,
        label: `${value} · ${label}`,
      })),
      { value: "unknown", label: "Unknown surface" },
    ],
  };
  const labels = {
    brand: "Brand",
    silo: "Product silo",
    tier: "Tier",
    surface: "Outsole surface",
  };
  function update(key: keyof CatalogueFilters, value: string) {
    const params = new URLSearchParams(window.location.search);
    const param = key === "query" ? "q" : key;
    if (!value || (key === "sort" && value === "featured"))
      params.delete(param);
    else params.set(param, value);
    const url = params.size ? `/boots?${params}` : "/boots";
    if (key === "query") window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }
  function reset() {
    window.history.pushState(null, "", "/boots");
  }
  const active = (Object.keys(options) as (keyof typeof options)[]).filter(
    (key) => filters[key],
  );
  const hasFilters =
    active.length > 0 || filters.query !== defaultFilters.query;
  return (
    <>
      <div className="catalogue-controls">
        <div className="flex items-end gap-4">
          <div className="min-w-0 flex-1">
            <label htmlFor="boot-search" className="field-label">
              Search the catalogue
            </label>
            <div className="relative">
              <MagnifyingGlassIcon
                size={21}
                className="pointer-events-none absolute top-3 left-3 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="boot-search"
                type="search"
                value={filters.query}
                onChange={(e) => update("query", e.target.value)}
                placeholder="Search brands, silos, tiers, or colorways…"
                className="h-[46px] rounded-md bg-background pl-11 text-base placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <SlidersHorizontalIcon
            size={24}
            className="mb-3 hidden text-muted-foreground sm:block"
            aria-hidden="true"
          />
        </div>
        <div className="filter-grid">
          {(Object.keys(options) as (keyof typeof options)[]).map((key) => (
            <div key={key}>
              <label className="field-label" htmlFor={`filter-${key}`}>
                {labels[key]}
              </label>
              <select
                id={`filter-${key}`}
                className="select-input"
                value={filters[key]}
                onChange={(e) => update(key, e.target.value)}
              >
                <option value="">
                  All{" "}
                  {key === "silo"
                    ? "silos"
                    : key === "surface"
                      ? "surfaces"
                      : `${key}s`}
                </option>
                {filters[key] &&
                  !options[key].some(
                    (option) => option.value === filters[key],
                  ) && (
                    <option value={filters[key]}>
                      Unavailable: {filters[key]}
                    </option>
                  )}
                {options[key].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {hasFilters && (
          <div className="active-filters">
            {active.map((key) => (
              <Button
                key={key}
                variant="secondary"
                className="h-11 rounded-md"
                onClick={() => update(key, "")}
                aria-label={`Remove ${labels[key]} filter`}
              >
                {options[key].find((option) => option.value === filters[key])
                  ?.label ?? filters[key]}
                <XIcon aria-hidden="true" />
              </Button>
            ))}
            <Button
              variant="ghost"
              className="h-11 text-primary"
              onClick={reset}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>
      <div className="results-toolbar">
        <p role="status" aria-live="polite">
          <strong>{results.length}</strong> of {boots.length} sample entries
        </p>
        <div className="flex items-center gap-3">
          <label
            htmlFor="sort"
            className="whitespace-nowrap text-muted-foreground"
          >
            Sort by
          </label>
          <select
            id="sort"
            className="select-input min-w-[175px]"
            value={filters.sort}
            onChange={(e) => update("sort", e.target.value)}
          >
            <option value="featured">Catalogue order</option>
            <option value="name-asc">Name: A to Z</option>
            <option value="name-desc">Name: Z to A</option>
            <option value="brand">Brand: A to Z</option>
          </select>
        </div>
      </div>
      {results.length ? (
        <div className="boot-grid">
          {results.map((boot) => (
            <BootCard key={boot.id} boot={boot} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <MagnifyingGlassIcon
            size={40}
            className="mx-auto mb-5 text-muted-foreground"
            aria-hidden="true"
          />
          <h2>No boots found.</h2>
          <p>
            Try another search or clear your filters to explore all eight sample
            entries.
          </p>
          <Button onClick={reset} className="h-12 px-6">
            Clear filters
          </Button>
        </div>
      )}
    </>
  );
}
