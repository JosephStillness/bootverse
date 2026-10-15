import "dotenv/config";
import { getDb } from "../src/lib/db";
import { cleanupImages } from "../src/lib/platform/images";
try{console.log(await cleanupImages());}catch{console.error("Image cleanup failed. Check database and S3 configuration; queued deletions are retained.");process.exitCode=1;}finally{if(process.env.DATABASE_URL)await getDb().$disconnect();}
