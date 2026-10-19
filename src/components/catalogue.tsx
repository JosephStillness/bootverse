"use client";
import {useEffect,useState} from "react";
import { useSearchParams } from "next/navigation";
import type { CatalogueBoot } from "@/lib/boots/types";
import {
  parseFilters,
  type CatalogueFilters,
} from "@/lib/boots/catalogue";
import { BootCard } from "./boot-card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Sheet, SheetClose } from "./ui/sheet";
import { MagnifyingGlassIcon, SlidersHorizontalIcon, XIcon } from "./icons";

type FilterKey = "brand" | "silo" | "tier" | "surface";
type FilterOptions = Record<FilterKey, { value: string; label: string }[]>;
const labels: Record<FilterKey, string> = {
  brand: "Brand",
  silo: "Product silo",
  tier: "Tier",
  surface: "Playing surface",
};
const keys: FilterKey[] = ["brand", "silo", "tier", "surface"];

function FilterFields({
  options,
  filters,
  update,
  prefix,
}: {
  options: FilterOptions;
  filters: CatalogueFilters;
  update: (key: keyof CatalogueFilters, value: string) => void;
  prefix: string;
}) {
  return (
    <div className="filter-fields">
      {keys.map((key) => (
        <div key={key}>
          <label className="field-label" htmlFor={`${prefix}-${key}`}>
            {labels[key]}
          </label>
          <select
            className="select-input"
            id={`${prefix}-${key}`}
            value={filters[key]}
            onChange={(event) => update(key, event.target.value)}
          >
            <option value="">
              {key === "brand"
                ? "All brands"
                : key === "silo"
                  ? "All silos"
                  : key === "tier"
                    ? "All tiers"
                    : "All surfaces"}
            </option>
            {filters[key] &&
              !options[key].some((option) => option.value === filters[key]) && (
                <option value={filters[key]}>Unavailable selection</option>
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
  );
}

export function Catalogue({ initial, initialQuery, options }: {initial:{boots:CatalogueBoot[];total:number;page:number;pages:number};initialQuery:string;options:FilterOptions}) {
  const searchParams = useSearchParams();
  const query=searchParams.toString();
  const filters = parseFilters(new URLSearchParams(query));
  const [remote,setRemote]=useState<{query:string;data:typeof initial}|null>(null),[failure,setFailure]=useState<{query:string;message:string}|null>(null),[retry,setRetry]=useState(0);
  useEffect(()=>{
    if(query===initialQuery)return;
    const controller=new AbortController();
    fetch(`/api/boots?${query}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15_000)])}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error??'Catalogue unavailable.');if(!controller.signal.aborted){setRemote({query,data});setFailure(null);}}).catch(()=>{if(!controller.signal.aborted)setFailure({query,message:'The catalogue could not be loaded. Please retry.'});});
    return()=>controller.abort();
  },[query,initialQuery,retry]);
  const data=query===initialQuery?initial:remote?.query===query?remote.data:null;
  const results=data?.boots??[],loading=!data&&failure?.query!==query;
  function update(key: keyof CatalogueFilters, value: string) {
    const params = new URLSearchParams(window.location.search);
    params.delete("page");
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
  const active = keys.filter((key) => filters[key]);
  const hasFilters = active.length > 0 || !!filters.query;
  const returnTo = searchParams.size ? `/boots?${searchParams}` : "/boots";
  return (
    <>
      <div className="catalogue-search">
        <label className="field-label" htmlFor="boot-search">
          Search boots
        </label>
        <div className="search-input-wrap">
          <MagnifyingGlassIcon size={21} aria-hidden="true" />
          <Input
            className="pl-12"
            id="boot-search"
            type="search"
            value={filters.query}
            onChange={(event) => update("query", event.target.value)}
            placeholder="Brand, model, tier, or colorway"
          />
        </div>
      </div>
      <div className="catalogue-layout">
        <aside className="filter-sidebar" aria-label="Catalogue filters">
          <div className="filter-heading">
            <h2>Filters</h2>
            {hasFilters && (
              <Button variant="ghost" onClick={reset}>
                Reset
              </Button>
            )}
          </div>
          <FilterFields
            prefix="desktop"
            options={options}
            filters={filters}
            update={update}
          />
          <p className="filter-help">
            Sample configurations remain clearly labeled. Compare exact tiers and outsoles.
          </p>
        </aside>
        <div className="catalogue-results">
          <div className="results-toolbar">
            <p role="status" aria-live="polite">
              <strong>{data?.total??0}</strong>{" "}
              {results.length === 1 ? "boot" : "boots"}
              <span className="text-muted-foreground">
                {" "}
                published configurations
              </span>
            </p>
            <div className="results-actions">
              <div className="mobile-filter-trigger">
                <Sheet
                  title="Filters"
                  description="Refine the published catalogue. Changes apply immediately."
                  trigger={
                    <Button variant="outline">
                      <SlidersHorizontalIcon size={18} aria-hidden="true" />
                      Filters{active.length > 0 ? ` (${active.length})` : ""}
                    </Button>
                  }
                  footer={
                    <SheetClose
                      render={
                        <Button className="w-full">
                          Show {results.length}{" "}
                          {results.length === 1 ? "boot" : "boots"}
                        </Button>
                      }
                    />
                  }
                >
                  <FilterFields
                    prefix="mobile"
                    options={options}
                    filters={filters}
                    update={update}
                  />
                  {hasFilters && (
                    <Button
                      variant="outline"
                      onClick={reset}
                      className="mt-6 w-full"
                    >
                      Clear filters
                    </Button>
                  )}
                </Sheet>
              </div>
              <div className="sort-field">
                <label htmlFor="sort" className="field-label">
                  Sort by
                </label>
                <select
                  id="sort"
                  className="select-input"
                  value={filters.sort}
                  onChange={(event) => update("sort", event.target.value)}
                >
                  <option value="featured">Catalogue order</option>
                  <option value="name-asc">Name: A to Z</option>
                  <option value="name-desc">Name: Z to A</option>
                  <option value="brand">Brand: A to Z</option>
                </select>
              </div>
            </div>
          </div>
          {hasFilters && (
            <div className="active-filters">
              {active.map((key) => {
                const label =
                  options[key].find((option) => option.value === filters[key])
                    ?.label ?? `Unavailable ${labels[key].toLowerCase()}`;
                return (
                  <Button
                    key={key}
                    variant="secondary"
                    onClick={() => update(key, "")}
                    aria-label={`${label}, remove ${labels[key].toLowerCase()} filter`}
                  >
                    <span className="truncate">{label}</span>
                    <XIcon aria-hidden="true" />
                  </Button>
                );
              })}
              <Button variant="ghost" onClick={reset}>
                Clear filters
              </Button>
            </div>
          )}
          <h2 className="sr-only">Catalogue results</h2>
          {loading?<p role="status">Loading catalogue…</p>:failure?.query===query?<div role="alert"><p>{failure.message}</p><Button onClick={()=>{setFailure(null);setRetry(n=>n+1);}}>Retry catalogue</Button></div>:results.length ? (
            <div className="boot-grid">
              {results.map((boot) => (
                <BootCard
                  key={boot.id}
                  boot={boot}
                  returnTo={returnTo}
                  sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <MagnifyingGlassIcon
                size={32}
                className="mx-auto"
                aria-hidden="true"
              />
              <h2>No boots found.</h2>
              <p>
                Try a different search or clear your filters to explore the
                collection.
              </p>
              <Button onClick={reset}>Clear filters</Button>
            </div>
          )}
          {data&&data.pages>1&&<nav className="account-actions" aria-label="Catalogue pagination"><Button variant="outline" disabled={data.page<=1} onClick={()=>{const p=new URLSearchParams(query);p.set('page',String(data.page-1));window.history.pushState(null,'',`/boots?${p}`);}}>Previous</Button><span>Page {data.page} of {data.pages}</span><Button variant="outline" disabled={data.page>=data.pages} onClick={()=>{const p=new URLSearchParams(query);p.set('page',String(data.page+1));window.history.pushState(null,'',`/boots?${p}`);}}>Next</Button></nav>}
        </div>
      </div>
    </>
  );
}
