// Explicit fields only: exceptions, URLs, users and preference inputs must never enter this log.
export function recommendationTelemetry() {
 const requestId=crypto.randomUUID(),start=performance.now();
 let previous=start;
 const stages:Partial<Record<'access'|'recommendation',number>>={};
 return {
  stage(name:'access'|'recommendation') {const now=performance.now();stages[name]=Math.round((now-previous)*100)/100;previous=now;},
  finish(response:Response,error?:unknown) {
   response.headers.set('x-request-id',requestId);
   const status=response.status;
   const database=error!==null&&typeof error==='object'&&'code' in error&&typeof error.code==='string'&&['P1000','P1001','P1002','P1008','P1017','P2021','P2022','P2024','P2028','ECONNREFUSED','ETIMEDOUT'].includes(error.code);
   const category=database?'database':status<400?'success':status===401?'authentication':status===403?'authorization':status===429?'rate_limit':status===409?'conflict':status<500?'validation':'unavailable';
   const log={event:'boot_fit_request',entryPoint:'recommendation_api',requestId,status,category,durationMs:Math.round((performance.now()-start)*100)/100,stages};
   if(status>=500)console.error(JSON.stringify(log));
   else if(status>=400)console.warn(JSON.stringify(log));
   else if(process.env.BOOT_FIT_TIMING_LOGS==='1')console.info(JSON.stringify(log));
   return response;
  },
 };
}
