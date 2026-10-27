import { it, expect } from "vitest";
import { sourcedSpecifications } from "./projection";
const claim = { entryId: "entry", variantId: null, attribute: "upperMaterial", value: "Synthetic sourced upper", status: "VERIFIED", basis: "REPORTED", sourceId: "source", sourceUrl: "https://example.test/spec", observedAt: new Date("2026-10-01T00:00:00Z"), reviewedAt: new Date("2026-10-02T00:00:00Z"), source: { name: "Synthetic source", type: "MANUFACTURER", status: "ACTIVE", authorizationStatus: "UNKNOWN" } };
it("projects checked, exact-target claims with their original source type and basis", () => {
  const result = sourcedSpecifications(false, {}, "entry", "variant", [claim]);
  expect(result.upper).toMatchObject({ status: "verified", value: claim.value, provenance: { sourceType: "MANUFACTURER", basis: "REPORTED" } });
  expect(result.weight.status).toBe("unknown");
});
it("withholds unverified, conflicting, archived, unsafe, other-target and sample claims", () => {
  for (const row of [{ ...claim, status: "UNVERIFIED" }, { ...claim, status: "CONFLICTED" }, { ...claim, source: { ...claim.source, status: "ARCHIVED" } }, { ...claim, entryId: "another-colorway" }, { ...claim, sourceUrl: "javascript:alert(1)" }]) expect(sourcedSpecifications(false, {}, "entry", "variant", [row]).upper.status).toBe("unknown");
  expect(sourcedSpecifications(false, {}, "entry", "variant", [claim, { ...claim, value: "Conflicting fixture" }]).upper.status).toBe("unknown");
  expect(sourcedSpecifications(true, {}, "entry", "variant", [claim]).upper.status).toBe("unknown");
});
it("formats weight context and never lets stale legacy JSON override D1 conflicts", () => {
  const weight = { ...claim, attribute: "weight", value: { amount: 200, unit: "g", size: "9", sizeSystem: "UK", method: "Synthetic method" }, basis: "MEASURED" };
  expect(sourcedSpecifications(false, {}, "entry", "variant", [weight]).weight).toMatchObject({ status: "verified", value: "200 g · UK 9 · Synthetic method" });
  const legacy = { upper: { status: "verified", value: "Legacy curated value", sourceUrl: claim.sourceUrl, observedAt: claim.observedAt.toISOString() } };
  expect(sourcedSpecifications(false, legacy, "entry", "variant", []).upper).toMatchObject({ status: "verified", legacy: true });
  expect(sourcedSpecifications(false, legacy, "entry", "variant", [{ ...claim, status: "CONFLICTED" }]).upper.status).toBe("unknown");
});
