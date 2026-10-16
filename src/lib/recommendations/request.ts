import {z} from 'zod';
import {rules} from './config';
import {finderPreferencesSchema} from './finder';
export const recommendationRequest=z.object({
 limit:z.number().int().min(1).max(rules.maxResults).default(10),
 preferences:finderPreferencesSchema.optional(),
 processingConsent:z.literal(true).optional(),
}).strict().superRefine((request,ctx)=>{
 if(!!request.preferences!==!!request.processingConsent)ctx.addIssue({code:'custom',path:['processingConsent'],message:'Explicit processing consent must accompany preferences for this request.'});
});
