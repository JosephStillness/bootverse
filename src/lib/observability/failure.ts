// No exception strings, URLs, user identifiers or request input are permitted here.
export function serviceFailure(response:Response,error:unknown){
 const requestId=crypto.randomUUID();response.headers.set('x-request-id',requestId);
 const database=error!==null&&typeof error==='object'&&'code' in error&&typeof error.code==='string'&&['P1000','P1001','P1002','P1008','P1017','P2010','P2021','P2022','P2024','P2028','ECONNREFUSED','ETIMEDOUT'].includes(error.code);
 console.error(JSON.stringify({event:'service_failure',requestId,status:response.status,category:database?'database':'unavailable'}));
 return response;
}
