"use client";
import {useEffect,useLayoutEffect,useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {Button,buttonVariants} from '@/components/ui/button';
import {FinderFields,type FieldErrors} from './finder-fields';
import {FinderResults,FinderSummary} from './finder-results';
import {loadFinderProfile,runFinder,saveFinderProfile} from './finder-client';
import {emptyFinder,finderFromProfile,finderStepErrors,finderStepKeys,type FinderValues} from '@/lib/recommendations/finder';
import type {PrivateFootProfile} from '@/lib/foot-profile/service';
import type {EngineOutput} from '@/lib/recommendations/types';
const steps=['Foot measurements','Playing preferences','Budget','Review & submit'];
export function BootFitFinder({authenticated}:{authenticated:boolean}) {
 const [values,setValues]=useState<FinderValues>(emptyFinder);
 const [profile,setProfile]=useState<PrivateFootProfile|null>(null);
 const [profileState,setProfileState]=useState<'loading'|'ready'|'error'>(authenticated?'loading':'ready');
 const [canSaveProfile,setCanSaveProfile]=useState(false);
 const [loadAttempt,setLoadAttempt]=useState(0),[step,setStep]=useState(0),[started,setStarted]=useState(false);
 const [fields,setFields]=useState<FieldErrors>({}),[error,setError]=useState(''),[saveMessage,setSaveMessage]=useState('');
 const [processingConsent,setProcessingConsent]=useState(false),[save,setSave]=useState(false),[busy,setBusy]=useState(false);
 const [output,setOutput]=useState<EngineOutput|null>(null),[submitted,setSubmitted]=useState<FinderValues|null>(null);
 const profileRequest=useRef<AbortController|null>(null);
 const busyRef=useRef(false),stepHeading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
  if(!authenticated)return;
  const controller=new AbortController();profileRequest.current=controller;
  loadFinderProfile(controller.signal).then(data=>{if(!controller.signal.aborted){setProfile(data.profile);setValues(data.profile?finderFromProfile(data.profile):emptyFinder());setProfileState('ready');setCanSaveProfile(true);}}).catch(()=>{if(!controller.signal.aborted)setProfileState('error');});
  return()=>controller.abort();
 },[authenticated,loadAttempt]);
 useLayoutEffect(()=>{
  if(!started||output)return;
  const first=Object.keys(fields).find(key=>fields[key]?.length);
  const input=first?document.getElementById(`finder-${first}`):null;
  (input??stepHeading.current)?.focus();
 },[step,fields,started,output,profileState]);
 useLayoutEffect(()=>{if(output)document.getElementById('finder-results-heading')?.focus();},[output]);
 const currentErrors=Object.keys(fields).length?finderStepErrors(values,3):{};
 const displayedFields:FieldErrors=Object.fromEntries(Object.entries(fields).filter(([key])=>key==='processingConsent'?!processingConsent:!!currentErrors[key]));
 const displayedError=error==='Check the highlighted fields before continuing.'&&!Object.keys(displayedFields).length?'':error;
 function continueManually(){profileRequest.current?.abort();setProfile(null);setValues(emptyFinder());setCanSaveProfile(false);setSave(false);setProfileState('ready');setStarted(true);}
 function edit(){if(busyRef.current)return;setOutput(null);setStep(0);setStarted(true);setError('');setFields({});}
 function invalid(errors:FieldErrors){setFields(errors);setError('Check the highlighted fields before continuing.');setStarted(true);const first=Object.keys(errors)[0];const target=finderStepKeys.findIndex(keys=>keys.includes(first));if(target>=0)setStep(target);}
 async function execute(input:FinderValues,saveProfile:boolean){
  if(busyRef.current)return;
  busyRef.current=true;setBusy(true);setError('');setSaveMessage('');
  try {
   const result=await runFinder(input);setSubmitted(input);setOutput(result);
   if(saveProfile){setSaveMessage('Recommendations are ready. Saving your private preferences…');try{const saved=await saveFinderProfile(input,profile);setProfile(saved.profile);setSaveMessage('Your preferences were saved privately and saved-profile Fit Finder use is enabled.');setSave(false);}catch{setSaveMessage('Results are ready, but your profile was not confirmed saved. Check your profile before retrying a save; your existing data may have changed.');}}
   else setSaveMessage('These inputs were used for this request. Your saved foot profile was not changed.');
  }catch(e){setError(e instanceof TypeError?'Connection lost. Your inputs are still here; try again.':e instanceof Error?e.message:'The finder is unavailable. Please try again.');}
  finally{busyRef.current=false;setBusy(false);}
 }
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busyRef.current)return;
  const errors=finderStepErrors(values,step);
  if(Object.keys(errors).length){invalid(errors);return;}
  setError('');setFields({});setStarted(true);
  if(step<3){setStep(n=>n+1);return;}
  if(!processingConsent){invalid({processingConsent:['Choose whether to allow private processing before submitting.']});return;}
  void execute(values,save);
 }
 return <div className="shell finder-page">
  <header className="finder-hero"><div><p className="eyebrow">BOOTVERSE · BOOT FIT FINDER</p><h1>Find Your<br/> Perfect Fit.</h1><p className="finder-subtitle">Discover football boots based on your foot measurements, playing preferences, and real community experiences.</p><p className="field-help">Guidance, not guaranteed physical fit. Boot size and wide-foot suitability are never inferred.</p><div className="finder-actions"><a className={buttonVariants({size:'lg'})} href="#finder-start" onClick={()=>{if(output)edit();else setStarted(true);}}>Find My Boots <span aria-hidden="true">↗</span></a><a className="text-link" href="#finder-how">How It Works</a></div></div><aside className="finder-hero-note"><p className="eyebrow">GUIDANCE, WITH CONTEXT</p><p>A better starting point.<br/>No guaranteed fit.</p><span>We separate product evidence, personal preferences and community opinions. Missing information stays unknown.</span><Link className="text-link" href="/boots">Explore the catalogue ↗</Link></aside></header>
  <noscript>Enable JavaScript to use the guided finder. The public catalogue remains available.</noscript>
  <section id="finder-how" className="finder-how" aria-labelledby="finder-how-heading"><h2 id="finder-how-heading">A little context. A clearer choice.</h2><ol><li><span>01</span><strong>Your feet, your preferences.</strong><p>Share only what you choose. Measurements stay private.</p></li><li><span>02</span><strong>Safety before ranking.</strong><p>Exact-product surface evidence comes first, followed by budget and preferences.</p></li><li><span>03</span><strong>See the evidence.</strong><p>Community observations add context. Try boots on where possible.</p></li></ol></section>
  <div id="finder-start" className="finder-workspace">
   {!authenticated?<section className="finder-guest"><p className="eyebrow">YOUR PRIVATE EXPERIENCE</p><h2>Sign in to use the finder.</h2><p>The current backend supports authenticated private recommendations. Guest recommendation queries are not supported yet. You can explore every public catalogue entry without an account.</p><div className="finder-actions"><Link href="/login?callbackUrl=%2Fboot-fit-finder" className={buttonVariants()}>Sign in to find my boots</Link><Link href="/boots" className="text-link">Browse boots</Link></div><p className="field-help">No guest foot measurements are collected or stored on this page.</p></section>:
    output&&submitted?<><p className="finder-note" role="status">{saveMessage||'Recommendations calculated from the submitted inputs.'}</p><FinderResults output={output} submitted={submitted} busy={busy} onEdit={edit} onRetry={()=>void execute(submitted,false)}/></>:
    <div className="finder-layout"><aside className="finder-sidebar"><p className="eyebrow">YOUR STARTING POINT</p><h2>Four steps.<br/>No guesswork.</h2><p>Only playing surface and permission to process your inputs are required. Add details for more useful evidence.</p><p>Optional measurements do not establish a boot size. We never infer wide-foot suitability from a label.</p><Link className="text-link" href="/profile/foot-profile">Manage private foot profile</Link><p className="field-help">No measurements in URLs or analytics. Saving your preferences is a separate choice.</p></aside>
     <section className="finder-panel" aria-label="Guided boot finder" aria-busy={busy||profileState==='loading'}>
      <ol className="finder-steps" aria-label="Finder progress">{steps.map((label,index)=><li key={label}><button type="button" disabled={busy||index>step} aria-label={`Step ${index+1}: ${label}`} aria-current={step===index?'step':undefined} onClick={()=>{setStep(index);setFields({});setError('');setStarted(true);}}><span aria-hidden="true">{String(index+1).padStart(2,'0')}</span><span>{['Measure','Play','Budget','Review'][index]}</span></button></li>)}</ol>
      {profileState==='loading'?<div className="finder-note"><p role="status">Loading your private saved profile…</p><Button variant="outline" onClick={continueManually}>Continue manually without saving</Button></div>:profileState==='error'?<div className="finder-note" role="alert"><p>Your saved profile could not be loaded. We have not replaced any of your data.</p><p>If your session expired, <Link className="text-link" href="/login?callbackUrl=%2Fboot-fit-finder">sign in again</Link>.</p><div className="finder-actions"><Button onClick={()=>{setProfileState('loading');setCanSaveProfile(false);setLoadAttempt(n=>n+1);}}>Retry profile loading</Button><Button variant="outline" onClick={continueManually}>Continue manually without saving</Button></div></div>:<>
       <p className="finder-preload" role="status">{!canSaveProfile?'Continuing without loading saved data. Saving is disabled; your existing profile has not changed.':profile?'Your own saved preferences were preloaded. Changes stay on this page until you explicitly choose to save.':'No saved foot profile. You can run a private search without creating one.'}</p>
       <form method="post" noValidate onSubmit={submit}>
        <fieldset disabled={busy} className="finder-fieldset"><legend className="sr-only">Your boot-finding preferences</legend>
         <h2 ref={stepHeading} tabIndex={-1}>Step {step+1} of 4 · {steps[step]}</h2>
         {step<3?<FinderFields step={step} values={values} fields={displayedFields} onChange={setValues} onError={setError}/>:<><p className="finder-lead">Review your starting point.</p><FinderSummary values={values}/><p className="field-help">Use the previous step buttons to edit. Manufacturer evidence, prices and comparable reviews may be missing. Submitting can return zero eligible recommendations.</p>
          <label className="finder-check"><input id="finder-processingConsent" type="checkbox" checked={processingConsent} onChange={e=>setProcessingConsent(e.target.checked)} aria-invalid={!!displayedFields.processingConsent} aria-describedby="finder-processingConsent-error"/><span>I allow BootVerse to process these inputs for my private recommendation results. Nothing is saved unless I choose the option below.</span></label><p id="finder-processingConsent-error" className="field-error" role="alert">{displayedFields.processingConsent?.[0]}</p>
          <label className="finder-check"><input type="checkbox" checked={save} disabled={!canSaveProfile} onChange={e=>setSave(e.target.checked)}/><span>Save these preferences privately and enable Fit Finder for my saved profile. This does not authorize public sharing.</span></label><p className="field-help">Saving uses the existing profile’s concurrency checks and retains other profile preferences. Changed measurements clear their old date/method context.</p>
         </>}
         <p className="field-error" role="alert">{displayedError}</p><p role="status" aria-live="polite">{busy?'Evaluating product evidence and privacy-safe community experiences…':''}</p>
         <div className="finder-form-actions">{step>0?<Button type="button" variant="outline" onClick={()=>{setStep(n=>n-1);setFields({});setError('');}}>Back</Button>:<span className="field-help">Your information stays private.</span>}<Button type="submit">{busy?'Finding your boots…':step===3?'Find My Boots':'Continue'}</Button></div>
        </fieldset>
       </form>
      </>}
     </section>
    </div>}
   {output&&error&&<div role="alert" className="finder-note"><p>{error}</p><Button variant="outline" onClick={()=>submitted&&void execute(submitted,false)} disabled={busy}>Retry recommendations</Button></div>}
  </div>
 </div>;
}
