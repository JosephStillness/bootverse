import {getDb} from '@/lib/db';
import {serviceFailure} from '@/lib/observability/failure';
export async function GET(){
 try{
  const rows=await getDb().$queryRaw<{ready:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20261024020000_offer_entry_payload_guard' AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS ready`;
  if(!rows[0]?.ready)throw Error('Required schema migration is absent.');
  return Response.json({status:'ready'},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return serviceFailure(Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}}),error);}
}
