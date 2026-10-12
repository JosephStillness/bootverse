import { describe, expect, it } from "vitest";
import { boots } from "./data";
import {
  defaultFilters,
  filterBoots,
  parseFilters,
  catalogueReturnPath,
} from "./catalogue";

describe("catalogue filtering", () => {
  it("shows all eight entries by default without modifying the source", () => {
    expect(filterBoots(boots, defaultFilters)).toEqual(boots);
    expect(filterBoots(boots, defaultFilters)).not.toBe(boots);
  });
  it.each([
    ["brand", "nike", 4],
    ["silo", "mercurial", 4],
    ["tier", "Elite", 5],
    ["surface", "FG", 3],
    ["surface", "AG", 2],
    ["surface", "unknown", 1],
  ])("filters %s=%s", (key, value, count) => {
    expect(
      filterBoots(boots, { ...defaultFilters, [key]: value }),
    ).toHaveLength(count);
  });
  it("combines all filters with case insensitive multiword search", () => {
    expect(
      filterBoots(boots, {
        query: "  NIKE  volt ",
        brand: "nike",
        silo: "mercurial",
        tier: "Elite",
        surface: "FG",
        sort: "featured",
      }).map((boot) => boot.colorway.id),
    ).toEqual(["volt"]);
  });
  it("returns an empty result for incompatible filters and unmatched search", () => {
    expect(
      filterBoots(boots, {
        ...defaultFilters,
        brand: "nike",
        silo: "predator",
      }),
    ).toEqual([]);
    expect(
      filterBoots(boots, { ...defaultFilters, query: "no-such-boot" }),
    ).toEqual([]);
  });
  it("sorts deterministically in both directions without changing fixture order", () => {
    const before = boots.map((b) => b.id);
    const asc = filterBoots(boots, { ...defaultFilters, sort: "name-asc" });
    const desc = filterBoots(boots, { ...defaultFilters, sort: "name-desc" });
    expect(asc.map((b) => b.id)).toEqual(desc.map((b) => b.id).reverse());
    expect(boots.map((b) => b.id)).toEqual(before);
    const branded = filterBoots(boots, { ...defaultFilters, sort: "brand" });
    expect(branded[0].brand.name).toBe("adidas");
  });
  it("parses shareable query state and falls back from invalid sorts", () => {
    expect(
      parseFilters(
        new URLSearchParams(
          "q=volt&brand=nike&silo=mercurial&tier=Elite&surface=FG&sort=name-desc",
        ),
      ),
    ).toEqual({
      query: "volt",
      brand: "nike",
      silo: "mercurial",
      tier: "Elite",
      surface: "FG",
      sort: "name-desc",
    });
    expect(parseFilters(new URLSearchParams("sort=price")).sort).toBe(
      "featured",
    );
    expect(
      filterBoots(boots, parseFilters(new URLSearchParams("brand=invalid"))),
    ).toEqual([]);
  });
});

describe("catalogue navigation and search labels", () => {
  it.each([
    ["firm ground", 3],
    ["artificial grass", 2],
    ["turf", 1],
  ])("searches full surface label %s", (query, count) => {
    expect(filterBoots(boots, { ...defaultFilters, query })).toHaveLength(
      count,
    );
  });
  it("preserves catalogue query state in a safe return link", () => {
    expect(catalogueReturnPath("/boots?brand=nike&surface=FG")).toBe(
      "/boots?brand=nike&surface=FG",
    );
  });
  it.each([
    null,
    "https://example.com/boots",
    "//example.com/boots",
    "javascript:alert(1)",
    "/boots/other",
    "/",
  ])("rejects unsafe return path %s", (value) => {
    expect(catalogueReturnPath(value)).toBe("/boots");
  });
});
