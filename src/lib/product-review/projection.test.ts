import { expect, it } from "vitest";
import { sourcedSpecifications } from "@/lib/product-data/projection";
import { publicTechnical } from "@/lib/enrichment/public";

// Synthetic values only.
const verified = { entryId: "entry", variantId: null, attribute: "upperMaterial", value: "Synthetic verified upper", status: "VERIFIED", basis: "REPORTED", sourceId: "s", sourceUrl: "https://example.test/spec", observedAt: new Date("2026-10-01T00:00:00Z"), reviewedAt: new Date("2026-10-02T00:00:00Z"), source: { name: "Synthetic", type: "MANUFACTURER", status: "ACTIVE", authorizationStatus: "GRANTED" } };
const incoming = { ...verified, value: "Synthetic lower-trust retailer upper", status: "CONFLICTED", reviewedAt: null, source: { ...verified.source, type: "RETAILER" } };

it("keeps a verified published value while a conflicting incoming observation awaits review", () => {
  expect(sourcedSpecifications(false, {}, "entry", "variant", [verified, incoming]).upper).toMatchObject({ status: "verified", value: verified.value });
  expect(publicTechnical([verified, incoming], "entry", "variant").map(a => a.value)).toEqual([verified.value]);
});
it("hides the value once an administrator moves the verified claim itself out of VERIFIED", () => {
  expect(sourcedSpecifications(false, {}, "entry", "variant", [{ ...verified, status: "CONFLICTED" }, incoming]).upper.status).toBe("unknown");
  expect(publicTechnical([{ ...verified, status: "CONFLICTED" }, incoming], "entry", "variant")).toEqual([]);
});
