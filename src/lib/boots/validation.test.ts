import { describe, expect, it } from "vitest";
import { bootData, boots } from "./data";
import { validateBootData } from "./validation";
const copy = () => structuredClone(bootData);
describe("boot data validation", () => {
  it("accepts eight sample entries with explicitly unknown attributes", () => {
    expect(validateBootData(bootData)).toEqual([]);
    expect(bootData.entries).toHaveLength(8);
    expect(
      boots.every(
        (b) =>
          b.sample &&
          Object.values(b.specifications).every(
            (value) => value.status === "unknown",
          ),
      ),
    ).toBe(true);
  });
  it("keeps generations, tiers, outsole variants, and colorways distinct", () => {
    expect(boots[0].variant.id).toBe(boots[1].variant.id);
    expect(boots[0].colorway.id).not.toBe(boots[1].colorway.id);
    expect(boots[0].tier.id).toBe(boots[2].tier.id);
    expect(boots[0].variant.id).not.toBe(boots[2].variant.id);
    expect(boots[0].family.id).toBe(boots[3].family.id);
    expect(boots[0].generation.id).not.toBe(boots[3].generation.id);
  });
  it("rejects missing foreign keys at every identity level", () => {
    const data = copy();
    data.families[0].brandId = "missing";
    data.generations[0].familyId = "missing";
    data.tiers[0].generationId = "missing";
    data.variants[0].tierModelId = "missing";
    data.colorways[0].generationId = "missing";
    data.entries[0].outsoleVariantId = "missing";
    data.entries[0].colorwayId = "missing";
    expect(
      validateBootData(data).filter((e) => e.startsWith("Unknown")),
    ).toHaveLength(7);
  });
  it("rejects duplicate IDs, slugs, and variant/colorway combinations", () => {
    const data = copy();
    data.entries.push({ ...data.entries[0] });
    expect(validateBootData(data).join(" ")).toContain("duplicate id");
    expect(validateBootData(data).join(" ")).toContain("duplicate slug");
    expect(validateBootData(data).join(" ")).toContain(
      "Duplicate variant/colorway",
    );
  });
  it("rejects colorways from a different generation", () => {
    const data = copy();
    data.entries[0].colorwayId = "red";
    expect(validateBootData(data)).toContain(
      "Colorway generation mismatch: sample-mercurial-volt-fg",
    );
  });
  it("rejects unknown attributes without an explanation and invalid slugs", () => {
    const data = copy();
    data.entries[0].specifications.weight.reason = "";
    data.entries[0].slug = "../boot";
    expect(validateBootData(data).join(" ")).toContain(
      "Unverified sample attribute",
    );
    expect(validateBootData(data).join(" ")).toContain(
      "Invalid or duplicate slug",
    );
  });
});
