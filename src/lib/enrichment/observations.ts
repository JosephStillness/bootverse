import { z } from 'zod';
import { normalizeOutsole } from '@/lib/data-import/normalize';
import { claimSchema, allAttributes } from '@/lib/product-data/validation';
import { ImportInputError } from '@/lib/data-import/types';
import { isExplicitUnknown } from '@/lib/product-data/comparison';
export { isExplicitUnknown } from '@/lib/product-data/comparison';
export function normalizeObservation(input: unknown) {
    const raw = z.object({ attribute: z.enum(allAttributes), value: z.unknown() }).passthrough().parse(input);
    if (raw.value === undefined)
        throw new ImportInputError('Omit missing attributes; use null only for explicitly unknown observations.');
    const changes: string[] = [];
    let value = raw.value;
    if (value === null)
        value = { unknown: true };
    else if (raw.attribute === 'normalizedOutsoleCategory') {
        const normalized = normalizeOutsole(z.string().parse(value));
        value = normalized ?? { unknown: true };
        if (value !== raw.value)
            changes.push('outsole_label');
    }
    else if (typeof value === 'string' && raw.attribute !== 'releaseDate') {
        const normalized = value.trim().normalize('NFC').replace(/\s+/gu, ' ');
        if (normalized !== value)
            changes.push('text_whitespace');
        value = normalized;
    }
    else if (raw.attribute === 'weight' && value && typeof value === 'object' && !isExplicitUnknown(value)) {
        const w = z.object({ amount: z.number().finite().positive(), unit: z.string(), size: z.string(), sizeSystem: z.string(), method: z.string().optional() }).strict().parse(value);
        const unit = w.unit.toLowerCase().trim(), factor = ({ g: 1, grams: 1, kg: 1000, kilograms: 1000, oz: 28.349523125, ounces: 28.349523125 } as Record<string, number>)[unit];
        if (!factor)
            throw new ImportInputError('Unsupported weight unit.');
        value = { ...w, amount: Number((w.amount * factor).toPrecision(12)), unit: 'g' };
        if (w.unit !== 'g')
            changes.push('weight_unit');
    }
    const checked = claimSchema.parse({ ...raw, value });
    return { ...checked, originalObservation: { value: raw.value, changes } };
}
export { compareClaims } from '@/lib/product-data/comparison';
