import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {ImportInputError} from './types';
const schema=z.object({actorId:z.string(),requestHash:z.string(),planHash:z.string(),expiresAt:z.number().int()}).strict();
function signature(payload:string,secret:string){if(secret.length<32)throw new ImportInputError('Import signing is not configured.');return createHmac('sha256',secret).update('bootverse-import-v1:'+payload).digest('base64url');}
export function signPreview(actorId:string,requestHash:string,planHash:string,secret:string,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({actorId,requestHash,planHash,expiresAt:now+15*60*1000})).toString('base64url');return payload+'.'+signature(payload,secret);
}
export function verifyPreview(token:string,actorId:string,requestHash:string,secret:string,now=Date.now(),allowExpired=false){
 try{if(token.length>2000)throw Error();const [payload,sig,...extra]=token.split('.');const expected=signature(payload,secret);if(extra.length||!sig||sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))throw Error();const data=schema.parse(JSON.parse(Buffer.from(payload,'base64url').toString('utf8')));if(data.actorId!==actorId||data.requestHash!==requestHash||(!allowExpired&&data.expiresAt<now))throw Error();return data;}catch{throw new ImportInputError('Preview is invalid or expired. Validate the file again.');}
}
