import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
import { S3Client, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
mkdirSync(".local",{recursive:true});
if(!existsSync(".local/storage.env"))writeFileSync(".local/storage.env",`S3_ENDPOINT=http://127.0.0.1:9000\nS3_BUCKET=bootverse-local\nS3_REGION=us-east-1\nS3_ACCESS_KEY_ID=${randomBytes(12).toString("hex")}\nS3_SECRET_ACCESS_KEY=${randomBytes(24).toString("hex")}\n`,{mode:0o600});
const env=dotenv.parse(readFileSync(".local/storage.env"));
if(new URL(env.S3_ENDPOINT).hostname!=="127.0.0.1")throw Error("Local storage setup requires the loopback endpoint.");
const result=spawnSync("docker",["compose","--env-file",".local/storage.env","-f","compose.storage.yaml","up","-d"],{stdio:"inherit"});
if(result.status)throw Error("Start Docker Desktop, then retry npm run dev:storage.");
const client=new S3Client({endpoint:env.S3_ENDPOINT,region:env.S3_REGION,forcePathStyle:true,credentials:{accessKeyId:env.S3_ACCESS_KEY_ID,secretAccessKey:env.S3_SECRET_ACCESS_KEY}});
let ready=false;
for(let i=0;i<30;i++){try{await client.send(new HeadBucketCommand({Bucket:env.S3_BUCKET}));ready=true;break;}catch(e){if((e as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode===404){await client.send(new CreateBucketCommand({Bucket:env.S3_BUCKET}));ready=true;break;}await new Promise(r=>setTimeout(r,1000));}}
if(!ready)throw Error("Local S3 service did not become ready.");
console.log("Private local S3 bucket ready. Copy S3_* from ignored .local/storage.env into your local env configuration. No cloud resource was created.");
