"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PrivateFootProfile } from "@/lib/foot-profile/service";
import { footProfileSchema, convertMeasurement, measurementKeys, measurementLimits, footOptions, positions, brandOptions, tierOptions, type Unit } from "@/lib/foot-profile/validation";
import { currencyCodes } from "@/lib/foot-profile/currencies";
import { MeasurementGuide } from "./measurement-guide";

type Values = Omit<PrivateFootProfile,"unit"|"createdAt"|"updatedAt"|"fitFinderConsentAt"|"revision"> & {unit:Unit;revision:string|null};
function formValues(profile: PrivateFootProfile | null, unit: Unit = "mm"): Values {
  if (!profile) return footProfileSchema.parse({version:0});
  const keys = Object.keys(footProfileSchema.parse({version:0})) as (keyof Values)[];
  const values = Object.fromEntries(keys.map(key => [key, profile[key]])) as Values;
  return {...values,unit,...Object.fromEntries(measurementKeys.map(k=>[k,values[k]===null ? null : convertMeasurement(values[k],"mm",unit)]))};
}
const labels = {leftLengthMm:"Left foot length",rightLengthMm:"Right foot length",leftWidthMm:"Left foot width",rightWidthMm:"Right foot width"} as const;
const characteristicLabels = {footShape:"Self-reported foot shape",instep:"Instep volume",arch:"Arch description",toePreference:"Toe-box preference",heelPreference:"Heel preference",snugness:"Preferred snugness",fitSensation:"Preferred fit sensation"} as const;
const positionLabels = {GK:"Goalkeeper",DEF:"Defence",MID:"Midfield",FWD:"Forward",OTHER:"Other"};
export function FootProfileForm({profile}:{profile:PrivateFootProfile|null}) {
  const [values,setValues] = useState<Values>(()=>formValues(profile));
  const [saved,setSaved] = useState(()=>JSON.stringify(formValues(profile)));
  const [exists,setExists] = useState(!!profile);
  const [fields,setFields] = useState<Record<string,string[]>>({});
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const dirty = JSON.stringify(values)!==saved;
  useEffect(()=>{
    if(!dirty) return;
    const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};
    const navigate=(e:MouseEvent)=>{
      const a=(e.target as Element).closest?.("a[href]") as HTMLAnchorElement|null;
      if(a && !e.defaultPrevented && e.button===0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && a.target!=="_blank" && a.href!==location.href && !window.confirm("Leave without saving your foot profile changes?")){e.preventDefault();e.stopPropagation();}
    };
    window.addEventListener("beforeunload",unload);document.addEventListener("click",navigate,true);
    return()=>{window.removeEventListener("beforeunload",unload);document.removeEventListener("click",navigate,true);};
  },[dirty]);
  function change<K extends keyof Values>(key:K,value:Values[K]) {setValues(v=>({...v,[key]:value}));setMessage("");}
  function unitChange(unit:Unit) {
    try {
      const converted=Object.fromEntries(measurementKeys.map(k=>[k,values[k]===null?null:convertMeasurement(values[k],values.unit,unit)]));
      setValues(v=>({...v,...converted,unit}));setMessage("");
    } catch {setMessage("Complete each measurement before switching units. Nothing has been rounded or discarded.");}
  }
  function invalid(errors:Record<string,string[]>) {
    setFields(errors);setMessage("Please check the highlighted fields.");
    const input=document.getElementById("foot-"+Object.keys(errors)[0]);
    const details=input?.closest("details");if(details)details.open=true;input?.focus();
  }
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setFields({});setMessage("");
    const result=footProfileSchema.safeParse(values);
    if(!result.success){invalid(result.error.flatten().fieldErrors);return;}
    setBusy(true);
    try {
      const response=await fetch("/api/account/foot-profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(values)});
      const data=await response.json();
      if(!response.ok){if(data.fields)invalid(data.fields);else setMessage(data.error??"Could not save your foot profile.");return;}
      const next=formValues(data.profile,values.unit);setValues(next);setSaved(JSON.stringify(next));setExists(true);setMessage("Foot profile saved privately.");
    }catch{setMessage("Connection lost. Your inputs remain here. Reload to check the saved version before retrying.");}finally{setBusy(false);}
  }
  async function remove() {
    if(!window.confirm("Delete your private foot profile and preferences? This cannot be undone. Historical reviews will remain unchanged."))return;
    setBusy(true);setMessage("");
    try {
      const response=await fetch("/api/account/foot-profile",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:values.version,revision:values.revision})});
      const data=await response.json();if(!response.ok){setMessage(data.error??"Could not delete your profile.");return;}
      const next=formValues(null);setValues(next);setSaved(JSON.stringify(next));setExists(false);setFields({});setMessage("Foot profile deleted. Your historical reviews were not changed.");
    }catch{setMessage("Connection lost. Reload to check whether deletion completed.");}finally{setBusy(false);}
  }
  function error(key:string) {return <p className="field-error" id={`foot-${key}-error`} role="alert">{fields[key]?.[0]}</p>;}
  function select(key:keyof Values,label:string,options:readonly string[],names?:Record<string,string>) {
    return <div className="account-field" key={key}><label htmlFor={`foot-${key}`}>{label}</label><select id={`foot-${key}`} name={key} value={String(values[key]??"")} onChange={e=>change(key,e.target.value||null)} aria-invalid={!!fields[key]} aria-describedby={`foot-${key}-error`}><option value="">Not specified</option>{options.map(x=><option value={x} key={x}>{names?.[x]??x}</option>)}</select>{error(key)}</div>;
  }
  function toggle(key:"secondaryPositions"|"preferredBrands"|"preferredTiers",value:string,checked:boolean) {
    change(key,checked?[...values[key],value]:values[key].filter(x=>x!==value));
  }
  return <>
    <div className="foot-notice"><strong>Private by default.</strong> Only you can access this profile. It is separate from any foot information you choose to publish in a review. No public sharing or advertising use is enabled here.</div>
    <MeasurementGuide/>
    <form method="post" onSubmit={submit} noValidate className="account-form foot-form">
      <fieldset disabled={busy} className="foot-fieldset">
        <legend className="sr-only">Your private foot profile — all fields optional</legend>
        <section className="foot-section" aria-labelledby="foot-measurements">
          <div className="foot-section-body"><h2 id="foot-measurements">My foot measurements</h2><p className="field-help">All fields are optional. Enter each foot separately; we never infer width categories. Precision up to 0.01 mm or 0.001 cm is preserved.</p>
            <div className="account-field"><label htmlFor="foot-unit">Measurement units</label><select id="foot-unit" value={values.unit} onChange={e=>unitChange(e.target.value as Unit)}><option value="mm">Millimetres (mm)</option><option value="cm">Centimetres (cm)</option></select></div>
            <div className="foot-grid">{measurementKeys.map(key=>{
              const bounds=measurementLimits[key.includes("Length")?"length":"width"];
              return <div className="account-field" key={key}><label htmlFor={`foot-${key}`}>{labels[key]} ({values.unit})</label><Input id={`foot-${key}`} name={key} inputMode="decimal" autoComplete="off" value={values[key]??""} onChange={e=>change(key,e.target.value||null)} aria-invalid={!!fields[key]} aria-describedby={`foot-${key}-help foot-${key}-error`}/><p className="field-help" id={`foot-${key}-help`}>Input range {bounds.min/(values.unit==="cm"?10:1)}–{bounds.max/(values.unit==="cm"?10:1)} {values.unit}; not a fit classification.</p>{error(key)}</div>;
            })}
              <div className="account-field"><label htmlFor="foot-measuredOn">Measurement date (optional)</label><Input type="date" id="foot-measuredOn" name="measuredOn" min="1900-01-01" max={new Date().toISOString().slice(0,10)} value={values.measuredOn??""} onChange={e=>change("measuredOn",e.target.value||null)} aria-invalid={!!fields.measuredOn} aria-describedby="foot-measuredOn-error"/>{error("measuredOn")}</div>
              <div className="account-field"><label htmlFor="foot-measurementMethod">Measurement method (optional)</label><Input id="foot-measurementMethod" name="measurementMethod" maxLength={200} value={values.measurementMethod??""} onChange={e=>change("measurementMethod",e.target.value||null)} aria-invalid={!!fields.measurementMethod} aria-describedby="foot-measurementMethod-error"/>{error("measurementMethod")}</div>
            </div>
          </div>
        </section>
        <details className="foot-section"><summary>Foot characteristics (optional)</summary><div className="foot-section-body"><p className="field-help">Your subjective preferences, not diagnoses or verified measurements.</p><div className="foot-grid">{(Object.keys(footOptions) as (keyof typeof footOptions)[]).map(k=>select(k,characteristicLabels[k],footOptions[k]))}</div></div></details>
        <details className="foot-section"><summary>Playing profile (optional)</summary><div className="foot-section-body"><p className="field-help">Position does not determine a suitable boot. Surface preference is separate from fit: FG is not automatically safe on artificial grass. Follow the boot and pitch guidance.</p><div className="foot-grid">
          {select("primaryPosition","Primary position",positions,positionLabels)}{select("surface","Preferred playing surface",["FG","AG","TF","SG","IN"],{FG:"FG — firm ground",AG:"AG — artificial grass",TF:"TF — turf",SG:"SG — soft ground",IN:"IN — indoor"})}
          <div className="account-field"><label htmlFor="foot-budgetAmount">Typical budget amount</label><Input id="foot-budgetAmount" name="budgetAmount" inputMode="decimal" value={values.budgetAmount??""} onChange={e=>change("budgetAmount",e.target.value||null)} aria-invalid={!!fields.budgetAmount} aria-describedby="foot-budgetAmount-error"/>{error("budgetAmount")}</div>
          {select("currency","Budget currency (ISO 4217)",currencyCodes)}
          <div className="account-field"><label htmlFor="foot-sizeWorn">Current boot size</label><Input id="foot-sizeWorn" name="sizeWorn" inputMode="decimal" value={values.sizeWorn??""} onChange={e=>change("sizeWorn",e.target.value||null)} aria-invalid={!!fields.sizeWorn} aria-describedby="foot-sizeWorn-error"/>{error("sizeWorn")}</div>
          {select("sizeSystem","Sizing system",["UK","US","EU","CM"])}
        </div>
        <fieldset className="foot-choices" id="foot-secondaryPositions" tabIndex={-1} aria-describedby="foot-secondaryPositions-error"><legend>Secondary positions</legend>{positions.map(p=><label key={p}><input type="checkbox" name="secondaryPositions" value={p} checked={values.secondaryPositions.includes(p)} onChange={e=>toggle("secondaryPositions",p,e.target.checked)}/>{positionLabels[p]}</label>)}{error("secondaryPositions")}</fieldset>
        <fieldset className="foot-choices" id="foot-preferredBrands" tabIndex={-1} aria-describedby="foot-preferredBrands-error"><legend>Preferred brands (current catalogue)</legend>{brandOptions.map(b=><label key={b.id}><input type="checkbox" name="preferredBrands" value={b.id} checked={values.preferredBrands.includes(b.id)} onChange={e=>toggle("preferredBrands",b.id,e.target.checked)}/>{b.name}</label>)}{error("preferredBrands")}</fieldset>
        <fieldset className="foot-choices" id="foot-preferredTiers" tabIndex={-1} aria-describedby="foot-preferredTiers-error"><legend>Preferred tiers (current catalogue)</legend>{tierOptions.map(t=><label key={t}><input type="checkbox" name="preferredTiers" value={t} checked={values.preferredTiers.includes(t)} onChange={e=>toggle("preferredTiers",t,e.target.checked)}/>{t}</label>)}{error("preferredTiers")}</fieldset>
        </div></details>
        <section className="foot-section" aria-labelledby="foot-privacy"><div className="foot-section-body"><h2 id="foot-privacy">Privacy & data controls</h2><p className="field-help">Nothing here appears on your public profile, creator page or reviews. Editing or deleting this profile never rewrites historical reviews. Stored until you delete it or your account is deleted; backups may follow the operator’s retention policy.</p><label className="foot-consent"><input type="checkbox" name="allowFitFinder" checked={values.allowFitFinder} onChange={e=>change("allowFitFinder",e.target.checked)}/><span>Allow my private profile to be used for my own Boot Fit Finder results. Optional; the experimental preview may return no eligible products. This never permits public sharing, advertising or third-party analytics.</span></label></div></section>
        <div className="account-actions"><Button type="submit">{busy?"Please wait…":exists?"Save changes":"Save private profile"}</Button>{exists&&<Button type="button" variant="outline" onClick={remove}>Delete foot profile</Button>}</div>
      </fieldset>
      <p role="status" aria-live="polite">{message|| (dirty?"You have unsaved changes.":exists?"Your saved profile is private.":"No foot profile saved yet. Add only the details you want to keep.")}</p>
    </form>
  </>;
}
