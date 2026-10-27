export class ImportInputError extends Error {}
export type ImportFormat='CSV'|'JSON';
export type ImportOutcome='NEW_RECORD'|'EXACT_MATCH'|'POSSIBLE_MATCH'|'CONFLICT'|'INSUFFICIENT_IDENTITY'|'INVALID';
export type ImportAction='CREATE_DRAFT'|'NOOP'|'STAGE'|'QUARANTINE'|'REJECT';
export type DiagnosticRow={row:number;recordId:string|null;outcome:ImportOutcome;diagnostics:string[]};
export const defaultLimits={maxBytes:10*1024*1024,maxRows:5000};
export function importLimits(){
 const bounded=(name:string,fallback:number,min:number,max:number)=>{const value=process.env[name];if(!value)return fallback;const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)throw new ImportInputError(`Invalid ${name} configuration.`);return n;};
 return {maxBytes:bounded('PRODUCT_IMPORT_MAX_BYTES',defaultLimits.maxBytes,1024,20*1024*1024),maxRows:bounded('PRODUCT_IMPORT_MAX_ROWS',defaultLimits.maxRows,1,5000)};
}
