import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
const env=dotenv.parse(readFileSync(".local/development.env"));
const loopback=new Set(["localhost","127.0.0.1","[::1]"]);
// Fail closed before starting anything: a command named local must never target cloud services.
for(const name of ["DATABASE_URL","DATABASE_URL_UNPOOLED","S3_ENDPOINT","EMAIL_SERVER","AUTH_URL"]){
  let valid=false;
  try { valid=!!env[name] && loopback.has(new URL(env[name]).hostname); } catch { valid=false; }
  assert.ok(valid,`${name} must point to localhost in the local development profile.`);
}
const command=process.argv[2];
assert.ok(command==="dev"||command==="migrate"||command==="test","Choose dev, migrate or test.");
const args=command==="test"?["--import","tsx","--test","tests/auth.integration.ts"]:command==="dev"?["node_modules/next/dist/bin/next","dev","--hostname","127.0.0.1"]:["node_modules/prisma/build/index.js","migrate","deploy"];
// Explicit local values win even when the shell has production environment variables.
const child=spawn(process.execPath,args,{stdio:"inherit",env:{...process.env,...env,...(command==="test"?{BOOTVERSE_TEST_STORAGE:"1"}:{})}});
for(const signal of ["SIGINT","SIGTERM"] as const)process.on(signal,()=>child.kill(signal));
child.on("error",()=>{console.error("Local command could not start.");process.exitCode=1;});
child.on("exit",code=>{process.exitCode=code??1;});
