import { footProfileSchema } from "@/lib/foot-profile/validation";
import type { Preferences } from "./types";
export function normalizeProfile(input:unknown):Preferences {
  const x=footProfileSchema.parse(input);
  return {leftLengthMm:x.leftLengthMm,rightLengthMm:x.rightLengthMm,leftWidthMm:x.leftWidthMm,rightWidthMm:x.rightWidthMm,
    footShape:x.footShape,instep:x.instep,fitSensation:x.fitSensation,snugness:x.snugness,surface:x.surface as Preferences["surface"],
    budgetAmount:x.budgetAmount,currency:x.currency,preferredBrands:x.preferredBrands,preferredTiers:x.preferredTiers,
    primaryPosition:x.primaryPosition,sizeWorn:x.sizeWorn,sizeSystem:x.sizeSystem};
}
