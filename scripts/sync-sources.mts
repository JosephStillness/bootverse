import "dotenv/config";
import { randomUUID } from "node:crypto";
import { getDb } from "../src/lib/db";
import { runDueSources, runSourceSync, sweep } from "../src/lib/source-sync/runner";

// D5 scheduler entrypoint. Safe to run from cron, a container task (future EventBridge) or by hand:
//   sync:due   run every due source once (duplicate concurrent invocations are harmless: per-source DB lock)
//   sync:sweep recover expired leases, raise time-based alerts, apply payload retention
//   sync:run <sourceId> [--preview]   manual run; RUN_ID makes a retried invocation idempotent
const [command, ...args] = process.argv.slice(2);
const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { console.error(JSON.stringify({ event: "sync_shutdown_requested", entryPoint: "cli", signal })); controller.abort(); });
try {
  let result: unknown;
  if (command === "due") result = await runDueSources({ entryPoint: "scheduler", signal: controller.signal });
  else if (command === "sweep") result = await sweep();
  else if (command === "run" && args[0]) result = await runSourceSync({ sourceId: args[0], trigger: "MANUAL", entryPoint: "cli", mode: args.includes("--preview") ? "PREVIEW" : "RUN", requestId: process.env.RUN_ID ?? `cli-${randomUUID()}`, signal: controller.signal });
  else { console.error("Usage: sync:due | sync:sweep | sync:run <sourceId> [--preview]"); process.exitCode = 2; }
  if (result !== undefined) {
    console.log(JSON.stringify(result));
    const list = Array.isArray(result) ? result : [result];
    if (list.some(r => (r as { status?: string }).status === "FAILED")) process.exitCode = 1;
  }
} catch (error) {
  // Category only: never print provider responses, URLs or credentials.
  console.error(JSON.stringify({ event: "sync_command_failed", entryPoint: "cli", command, category: error instanceof Error ? error.constructor.name : "unknown" }));
  process.exitCode = 1;
} finally { if (process.env.DATABASE_URL) await getDb().$disconnect(); }
