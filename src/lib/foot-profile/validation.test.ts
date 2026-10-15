import { describe, it, expect } from "vitest";
import { footProfileSchema, convertMeasurement, measurementLimits } from "./validation";
describe("private foot profile input", () => {
  it("preserves exact left/right cm to mm conversion", () => {
    const x = footProfileSchema.parse({ version: 0, unit: "cm", leftLengthMm: "26.735", rightLengthMm: "27.01", leftWidthMm: "9.123" });
    expect(x.leftLengthMm).toBe("267.35"); expect(x.rightLengthMm).toBe("270.1"); expect(x.leftWidthMm).toBe("91.23");
    expect(convertMeasurement("267.35", "mm", "cm")).toBe("26.735");
  });
  it("allows a completely optional private profile without fabricated values", () => {
    const x = footProfileSchema.parse({version:0});
    expect(x.leftLengthMm).toBeNull(); expect(x.budgetAmount).toBeNull(); expect(x.allowFitFinder).toBe(false);
  });
  it("rejects out-of-range, negative and excessive precision rather than rounding", () => {
    for (const v of ["-1","0","401","267.351","NaN","1e2"])
      expect(footProfileSchema.safeParse({version:0,leftLengthMm:v}).success).toBe(false);
    expect(measurementLimits.length.min).toBeLessThan(100);
    expect(footProfileSchema.safeParse({version:0,unit:"cm",leftWidthMm:"9.1234"}).success).toBe(false);
  });
  it("rejects forged identities, unsupported units, invented classifications and surfaces", () => {
    for(const x of [{userId:"other"},{unit:"in"},{footShape:"diagnosed-wide"},{surface:"FG/AG"}])
      expect(footProfileSchema.safeParse({version:0,...x}).success).toBe(false);
  });
  it("validates budget/currency and optional boot sizing as pairs", () => {
    for(const x of [{budgetAmount:"12.001",currency:"USD"},{budgetAmount:"-1",currency:"USD"},{budgetAmount:"10",currency:"ZZZ"},{budgetAmount:"10"},{currency:"USD"},{sizeWorn:"9"}])
      expect(footProfileSchema.safeParse({version:0,...x}).success).toBe(false);
    expect(footProfileSchema.parse({version:0,budgetAmount:"125.50",currency:"VND",sizeWorn:"42.5",sizeSystem:"EU"}).currency).toBe("VND");
  });
  it("validates real nonfuture calendar dates, deduplicated positions and known catalogue brands", () => {
    for(const x of [{measuredOn:"2026-02-30"},{measuredOn:"2999-01-01"},{primaryPosition:"GK",secondaryPositions:["GK"]},{preferredBrands:["invented"]}])
      expect(footProfileSchema.safeParse({version:0,...x}).success).toBe(false);
    expect(footProfileSchema.parse({version:0,measuredOn:"2025-12-31",preferredBrands:["nike"],surface:"IN"}).measuredOn).toBe("2025-12-31");
  });
  it("does not round partially entered values on unit changes",()=>{
    expect(()=>convertMeasurement("26.","cm","mm")).toThrow();
    expect(convertMeasurement("26.735","cm","mm")).toBe("267.35");
    expect(convertMeasurement("","cm","mm")).toBe("");
  });
});
