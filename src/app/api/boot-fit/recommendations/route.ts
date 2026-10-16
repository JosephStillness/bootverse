import {platformInput,platformFailure,noStore} from "@/lib/platform/http";
import {recommendForUser} from "@/lib/recommendations/service";
import {recommendationTelemetry} from "@/lib/recommendations/telemetry";
export async function POST(request:Request) {
 const telemetry=recommendationTelemetry();
 try{
  const x=await platformInput(request,"recommendations:run",20);
  telemetry.stage('access');
  if(x.limited){for(const [k,v]of Object.entries(noStore))x.limited.headers.set(k,v);return telemetry.finish(x.limited);}
  if(new URL(request.url).search)return telemetry.finish(Response.json({error:"Only owner-scoped requests without query parameters are supported."},{status:400,headers:noStore}));
  const result=await recommendForUser(x.actor,x.input);
  telemetry.stage('recommendation');
  return telemetry.finish(Response.json(result,{headers:noStore}));
 }catch(e){return telemetry.finish(platformFailure(e),e);}
}
