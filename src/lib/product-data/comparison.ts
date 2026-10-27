import { z } from 'zod';
export const isExplicitUnknown = (v: unknown): v is {
    unknown: true;
} => !!v && typeof v === 'object' && !Array.isArray(v) && 'unknown' in v && v.unknown === true;
function weight(v: unknown) { return z.object({ amount: z.number().positive(), unit: z.enum(['g', 'oz']), size: z.string(), sizeSystem: z.string(), method: z.string().optional() }).safeParse(v); }
export function compareClaims(attribute: string, a: unknown, b: unknown): 'EQUIVALENT' | 'CONFLICT' | 'DIFFERENT_CONTEXT' | 'UNKNOWN' {
    if (isExplicitUnknown(a) || isExplicitUnknown(b))
        return 'UNKNOWN';
    if (attribute === 'weight') {
        const x = weight(a), y = weight(b);
        if (!x.success || !y.success)
            return 'UNKNOWN';
        const c = x.data, d = y.data;
        if (c.size.trim() !== d.size.trim() || c.sizeSystem !== d.sizeSystem || (c.method ?? '').trim() !== (d.method ?? '').trim())
            return 'DIFFERENT_CONTEXT';
        const grams = (w: typeof c) => w.amount * (w.unit === 'oz' ? 28.349523125 : 1);
        return Math.abs(grams(c) - grams(d)) < 0.000001 ? 'EQUIVALENT' : 'CONFLICT';
    }
    const canonical = (v: unknown) => typeof v === 'string' ? v.trim().normalize('NFC').replace(/\s+/gu, ' ').toLowerCase() : JSON.stringify(Array.isArray(v) ? [...v].sort() : v);
    return canonical(a) === canonical(b) ? 'EQUIVALENT' : 'CONFLICT';
}
