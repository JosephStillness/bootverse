import { z } from "zod";
import { currencyCodes } from "./currencies";
import { bootData } from "@/lib/boots/data";

// Broad input-error guardrails, not medical ranges or fit classifications. Adjust centrally.
export const measurementLimits = { length: { min: 80, max: 400 }, width: { min: 30, max: 180 } } as const;
export const positions = ["GK", "DEF", "MID", "FWD", "OTHER"] as const;
export const footOptions = {
  footShape: ["Narrow", "Regular", "Wide", "Unsure"],
  instep: ["Low", "Medium", "High", "Unsure"],
  arch: ["Low", "Neutral", "High", "Unsure"],
  toePreference: ["Close", "Roomy", "Unsure"],
  heelPreference: ["Secure", "Relaxed", "Unsure"],
  snugness: ["Snug", "Balanced", "Relaxed", "Unsure"],
  fitSensation: ["Barefoot-like", "Cushioned", "Structured", "Unsure"],
} as const;
export const brandOptions = bootData.brands;
export const tierOptions = [...new Set(bootData.tiers.map(t => t.name))];
export type Unit = "mm" | "cm";
export const measurementKeys = ["leftLengthMm", "rightLengthMm", "leftWidthMm", "rightWidthMm"] as const;
export function convertMeasurement(value: string, from: Unit, to: Unit): string {
  if (value === "") return "";
  const precision = from === "mm" ? 2 : 3;
  if (!new RegExp(`^\\d{1,6}(?:\\.\\d{1,${precision}})?$`).test(value)) throw Error("Use a complete decimal number; precision is 0.01 mm (0.001 cm).");
  const [whole, fraction = ""] = value.split(".");
  const base = from === "mm" ? 100 : 1000;
  const integer = Number(whole) * base + Number(fraction.padEnd(precision, "0"));
  const target = to === "mm" ? 100 : 1000;
  const rest = String(integer % target).padStart(to === "mm" ? 2 : 3, "0").replace(/0+$/, "");
  return `${Math.floor(integer / target)}${rest ? "." + rest : ""}`;
}
const text = (max: number) => z.string().trim().max(max).nullable().optional().transform(v => v || null);
const choice = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values).nullable().default(null);
const unique = z.array(z.string().min(1).max(30)).max(12).refine(x => new Set(x).size === x.length, "Choose each preference once.").default([]);
const currencies = new Set<string>(currencyCodes);
export const footProfileBaseSchema = z.object({
  version: z.number().int().nonnegative(),
  revision: z.string().min(1).max(50).nullable().default(null),
  unit: z.enum(["mm", "cm"]).default("mm"),
  leftLengthMm: text(16), rightLengthMm: text(16), leftWidthMm: text(16), rightWidthMm: text(16),
  measuredOn: text(10), measurementMethod: text(200),
  footShape: choice(footOptions.footShape), instep: choice(footOptions.instep), arch: choice(footOptions.arch),
  toePreference: choice(footOptions.toePreference), heelPreference: choice(footOptions.heelPreference), snugness: choice(footOptions.snugness), fitSensation: choice(footOptions.fitSensation),
  primaryPosition: choice(positions), secondaryPositions: z.array(z.enum(positions)).max(5).default([]),
  surface: choice(["FG", "AG", "TF", "SG", "IN"]),
  budgetAmount: text(16).refine(v => v === null || (/^\d{1,7}(\.\d{1,2})?$/.test(v) && Number(v) <= 1000000), "Use an amount from 0 to 1,000,000 with at most two decimal places."),
  currency: text(3).refine(v => v === null || currencies.has(v), "Choose a supported ISO 4217 currency."),
  preferredBrands: unique.refine(v => v.every(x => brandOptions.some(b => b.id === x)), "Choose catalogue brands."),
  preferredTiers: unique.refine(v => v.every(x => tierOptions.includes(x)), "Choose catalogue tiers."),
  sizeWorn: text(8).refine(v => v === null || (/^\d{1,2}(\.\d{1,2})?$/.test(v) && Number(v) > 0 && Number(v) <= 60), "Use a size above 0 and no more than 60; no automatic size conversion is applied."),
  sizeSystem: choice(["US", "UK", "EU", "CM"]),
  allowFitFinder: z.boolean().default(false),
}).strict();
export const footProfileSchema = footProfileBaseSchema.superRefine((v, ctx) => {
  for (const key of measurementKeys) {
    if (v[key] === null) continue;
    try {
      const mm = convertMeasurement(v[key], v.unit, "mm"), n = Number(mm);
      const limits = measurementLimits[key.includes("Length") ? "length" : "width"];
      if (n < limits.min || n > limits.max) throw Error(`Enter ${limits.min}–${limits.max} mm, or the equivalent in cm.`);
    } catch (e) { ctx.addIssue({ code: "custom", path: [key], message: (e as Error).message }); }
  }
  if (v.measuredOn && (!/^\d{4}-\d{2}-\d{2}$/.test(v.measuredOn) || !Number.isFinite(Date.parse(v.measuredOn)) || new Date(v.measuredOn).toISOString().slice(0, 10) !== v.measuredOn || v.measuredOn > new Date().toISOString().slice(0, 10) || v.measuredOn < "1900-01-01"))
    ctx.addIssue({code:"custom",path:["measuredOn"],message:"Use a real date from 1900 through today (UTC)."});
  if ((v.budgetAmount === null) !== (v.currency === null)) ctx.addIssue({code:"custom",path:["currency"],message:"Provide both budget and currency, or leave both blank."});
  if ((v.sizeWorn === null) !== (v.sizeSystem === null)) ctx.addIssue({code:"custom",path:["sizeSystem"],message:"Provide both boot size and sizing system, or neither."});
  if (new Set(v.secondaryPositions).size !== v.secondaryPositions.length || (v.primaryPosition && v.secondaryPositions.includes(v.primaryPosition))) ctx.addIssue({code:"custom",path:["secondaryPositions"],message:"Choose distinct secondary positions, excluding the primary position."});
}).transform(v => ({...v, ...Object.fromEntries(measurementKeys.map(k => [k, v[k] === null ? null : convertMeasurement(v[k], v.unit, "mm")]))} as Omit<typeof v, typeof measurementKeys[number]> & Record<typeof measurementKeys[number], string | null>));
export type FootProfileInput = z.input<typeof footProfileSchema>;
export const deleteFootProfileSchema = z.object({ version: z.number().int().positive(), revision: z.string().min(1).max(50) }).strict();
