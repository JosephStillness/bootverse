import assert from 'node:assert/strict';
import {cpus,totalmem} from 'node:os';
import {recommend} from '../src/lib/recommendations/engine';
import {analyzeReviews,type AnalysisReview} from '../src/lib/recommendations/review-analysis';
import {evaluationCandidates,evaluationScenarios,evaluationTime} from './fixtures/recommendation-evaluation';
const candidates=evaluationCandidates(100);
const reviews:AnalysisReview[]=Array.from({length:2000},(_,i)=>({id:`synthetic-review-${i}`,authorId:`synthetic-author-${i}`,variantId:candidates[0].variantId,status:'PUBLISHED',author:{status:'ACTIVE',emailVerified:new Date(evaluationTime),profile:{}},shareFootInfo:true,analysisConsent:true,analysisConsentAt:new Date(evaluationTime),sizeWorn:'9',sizeSystem:'UK',footLengthCm:28,footWidthCm:11,footShape:'wide',reviewInstep:null,reviewFitSensation:null,fit:4,comfort:4,widthObservation:'expected',toeRoomCategory:null,heelLockdownCategory:null,breakInCategory:null,sponsorship:null}));
const timings:number[]=[];let errors=0,peakRss=process.memoryUsage().rss;
function work(i:number){const p={...evaluationScenarios[i%10].preferences,sizeWorn:'9',sizeSystem:'UK'};const output=recommend(p,candidates,evaluationTime,20);assert.equal(output.counts.evaluated,100);analyzeReviews(candidates[0].variantId,p,reviews);}
for(let i=0;i<30;i++)work(i);
const before=process.memoryUsage();
for(let i=0;i<300;i++){const start=performance.now();try{work(i);}catch{errors++;}timings.push(performance.now()-start);peakRss=Math.max(peakRss,process.memoryUsage().rss);}
timings.sort((a,b)=>a-b);const percentile=(p:number)=>Math.round(timings[Math.ceil(timings.length*p)-1]*100)/100;
console.log(JSON.stringify({kind:'synthetic-pure-engine-plus-analysis',node:process.version,platform:process.platform,arch:process.arch,cpu:cpus()[0].model,cpuCount:cpus().length,ramGiB:Math.round(totalmem()/1024**3),candidates:100,evidencePerCandidate:2,reviews:2000,scenarios:10,concurrency:1,warmup:30,requests:300,p50Ms:percentile(.5),p95Ms:percentile(.95),errorRate:errors/300,rssBeforeMiB:Math.round(before.rss/1024**2),rssPeakMiB:Math.round(peakRss/1024**2),heapAfterMiB:Math.round(process.memoryUsage().heapUsed/1024**2),limitations:'In-process synthetic workload; no network, database, browser or physical fit accuracy measurement.'},null,2));
assert.equal(errors,0);
