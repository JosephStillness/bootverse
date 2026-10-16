"use client";
import {Input} from '@/components/ui/input';
import {MeasurementGuide} from '@/components/foot-profile/measurement-guide';
import {brandOptions,tierOptions,footOptions,positions,convertMeasurement,measurementKeys,type Unit} from '@/lib/foot-profile/validation';
import {currencyCodes} from '@/lib/foot-profile/currencies';
import type {FinderValues} from '@/lib/recommendations/finder';

export type FieldErrors=Record<string,string[]|undefined>;
export function FinderFields({step,values,fields,onChange,onError}:{step:number;values:FinderValues;fields:FieldErrors;onChange:(values:FinderValues)=>void;onError:(message:string)=>void}) {
 function change<K extends keyof FinderValues>(key:K,value:FinderValues[K]){onChange({...values,[key]:value});}
 function error(key:string){return <p className="field-error" id={`finder-${key}-error`} role="alert">{fields[key]?.[0]}</p>;}
 function input(key:keyof FinderValues,label:string,hint?:string){return <div className="account-field"><label htmlFor={`finder-${key}`}>{label}</label><Input id={`finder-${key}`} name={key} value={String(values[key]??'')} inputMode="decimal" autoComplete="off" onChange={e=>change(key,e.target.value||null)} aria-invalid={!!fields[key]} aria-describedby={`finder-${key}-hint finder-${key}-error`}/><p className="field-help" id={`finder-${key}-hint`}>{hint}</p>{error(key)}</div>;}
 function select(key:keyof FinderValues,label:string,options:readonly string[],names?:Record<string,string>){return <div className="account-field"><label htmlFor={`finder-${key}`}>{label}</label><select id={`finder-${key}`} name={key} value={String(values[key]??'')} onChange={e=>change(key,e.target.value||null)} aria-invalid={!!fields[key]} aria-describedby={`finder-${key}-error`}><option value="">Not specified</option>{options.map(value=><option value={value} key={value}>{names?.[value]??value}</option>)}</select>{error(key)}</div>;}
 function choices(key:'preferredBrands'|'preferredTiers',legend:string,options:{id:string;name:string}[]){return <fieldset className="finder-choices"><legend>{legend}</legend><div>{options.map(option=><label key={option.id}><input type="checkbox" name={key} value={option.id} checked={values[key].includes(option.id)} onChange={e=>change(key,e.target.checked?[...values[key],option.id]:values[key].filter(v=>v!==option.id))}/>{option.name}</label>)}</div>{error(key)}</fieldset>;}
 function changeUnit(unit:Unit){try{const converted=Object.fromEntries(measurementKeys.map(key=>[key,values[key]===null?null:convertMeasurement(values[key],values.unit,unit)]));onChange({...values,...converted,unit});}catch{onError('Complete the measurements before switching units. Your values have not been discarded.');}}
 if(step===0)return <>
  <p className="finder-lead">Start with your measurements.</p><p className="field-help">All measurements are optional and self-reported. Both feet are needed for comparable-reviewer matching; partial inputs still allow catalogue discovery.</p>
  <MeasurementGuide/>
  <div className="account-field"><label htmlFor="finder-unit">Measurement units</label><select id="finder-unit" value={values.unit} onChange={e=>changeUnit(e.target.value as Unit)}><option value="mm">Millimetres (mm)</option><option value="cm">Centimetres (cm)</option></select></div>
  <div className="finder-input-grid">{input('leftLengthMm',`Left foot length (${values.unit})`)}{input('leftWidthMm',`Left foot width (${values.unit})`)}</div>
  <details className="finder-disclosure" open={!!fields.rightLengthMm||!!fields.rightWidthMm||!!values.rightLengthMm||!!values.rightWidthMm}><summary>Separate right-foot measurements (optional)</summary><div className="finder-input-grid">{input('rightLengthMm',`Right foot length (${values.unit})`)}{input('rightWidthMm',`Right foot width (${values.unit})`)}</div></details>
  <div className="finder-input-grid">{select('footShape','Self-reported foot shape',footOptions.footShape)}{select('instep','Instep volume',footOptions.instep)}</div>
 </>;
 if(step===1)return <>
  <p className="finder-lead">Tell us how you play.</p><p className="field-help">Playing surface is required for this finder. All other preferences are optional; position never restricts which boots you can see.</p>
  {select('surface','Playing surface (required)',['FG','AG','TF','SG','IN'],{FG:'FG — firm ground',AG:'AG — artificial grass',TF:'TF — turf',SG:'SG — soft ground',IN:'IN — indoor'})}
  <details className="finder-disclosure"><summary>Which outsole should I choose?</summary><p>FG: firm natural grass. AG: artificial grass. TF: short synthetic turf. SG: soft natural grass. IN: indoor courts. These are catalogue labels, not product-specific approval. FG is not universally suitable for AG; follow the exact manufacturer and pitch requirements.</p></details>
  <div className="finder-input-grid">{select('primaryPosition','Preferred playing position',positions,{GK:'Goalkeeper',DEF:'Defence',MID:'Midfield',FWD:'Forward',OTHER:'Other'})}{select('fitSensation','Preferred fit sensation',footOptions.fitSensation)}</div>
  {select('snugness','Preferred snugness (optional)',footOptions.snugness)}
  {choices('preferredBrands','Preferred brands (optional)',brandOptions)}
  {choices('preferredTiers','Preferred product tiers (optional)',tierOptions.map(name=>({id:name,name})))}
  <details className="finder-disclosure" open={!!fields.sizeWorn||!!fields.sizeSystem||!!values.sizeWorn}><summary>Current boot size for scoped evidence (optional)</summary><p className="field-help">Use the size you actually wear and its system. No sizing recommendation or automatic conversion is made. Comparable reviews require the same worn size/system.</p><div className="finder-input-grid">{input('sizeWorn','Current boot size')}{select('sizeSystem','Size system',['UK','US','EU','CM'])}</div></details>
 </>;
 return <>
  <p className="finder-lead">Set a comfortable budget.</p><p className="field-help">Optional. Enter an amount and currency together, or leave both blank. Prices are compared in the original currency; no exchange rate is assumed.</p>
  <div className="finder-input-grid">{input('budgetAmount','Budget amount')}{select('currency','Budget currency',currencyCodes)}</div>
  <p className="finder-note">Budget influences preference ranking, not outsole safety. Results can be refined to verified prices within budget or up to 10% above. Unknown prices stay unknown.</p>
 </>;
}
