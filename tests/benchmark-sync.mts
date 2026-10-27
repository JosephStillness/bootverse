// D5 synchronization benchmark on a disposable local database with synthetic fixture feeds.
// Usage: node --conditions=react-server --import tsx tests/benchmark-sync.mts   (requires the local profile env)
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";

const source = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1"].includes(source.hostname)) throw Error("Benchmark runs only against local PostgreSQL.");
const name = `bootverse_sync_bench_${randomBytes(5).toString("hex")}`;
const admin = new pg.Client({ connectionString: Object.assign(new URL(source.href), { pathname: "/postgres" }).href });
await admin.connect();
await admin.query(`CREATE DATABASE "${name}"`);
const dbUrl = Object.assign(new URL(source.href), { pathname: `/${name}` }).href;
const fixtures = await mkdtemp(join(tmpdir(), "bootverse-sync-bench-"));
try {
  const migrate = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: dbUrl, DATABASE_URL_UNPOOLED: dbUrl }, encoding: "utf8" });
  if (migrate.status) throw Error("migration failed");
  Object.assign(process.env, { DATABASE_URL: dbUrl, DATABASE_URL_UNPOOLED: dbUrl, SYNC_FIXTURES_ENABLED: "1", SYNC_FIXTURE_DIR: fixtures });
  const { runSourceSync } = await import("../src/lib/source-sync/runner");
  const { getDb } = await import("../src/lib/db");
  const db = new pg.Client({ connectionString: dbUrl }); db.on("error", () => {}); await db.connect();
  const silent = console.log; console.log = () => {}; // keep benchmark output to the result lines
  const results: unknown[] = [];
  for (const size of [10, 100, 1000, 5000]) {
    const id = `bench-${size}`, half = size / 2, observedAt = new Date(Date.now() - 3_600_000).toISOString();
    await db.query(`INSERT INTO "ProductSource"(id,name,type,"baseUrl","accessMethod","authorizationStatus","permissionNotes","permissionUrl","authorizationCheckedAt","updatedAt","syncEnabled","adapterKey","syncIntervalMinutes","minIntervalMinutes","fieldPolicy") VALUES($1::text,$1::text,'PRODUCT_FEED','https://example.test','Synthetic benchmark','GRANTED','Synthetic benchmark permission','https://example.test/licence',now(),now(),true,$2,60,5,'{"prices":"AUTO","availability":"RECORD"}')`, [id, `fixture:${id}`]);
    const records = Array.from({ length: half }, (_, n) => [
      { kind: "product", recordId: `r${n}`, brand: `Synthetic bench ${size}`, family: "Family", generation: "Gen", tier: n % 2 ? "Elite" : "Pro", outsole: "FG", colorway: `Colour ${n}`, sku: `BENCH-${size}-${n}`, sourceUrl: `https://example.test/b/${n}`, observedAt, specifications: [{ attribute: "upperMaterial", value: `Synthetic material ${n % 7}`, basis: "REPORTED" }] },
      { kind: "offer", recordId: `r${n}`, countryCode: "AU", currency: "AUD", price: `${100 + (n % 50)}.95`, availability: "In stock", sourceUrl: `https://example.test/o/${n}`, observedAt },
    ]).flat();
    await writeFile(join(fixtures, `${id}.json`), JSON.stringify({ mode: "SNAPSHOT", records }));
    const runs = [];
    for (const pass of ["initial", "unchanged", "changed"]) {
      if (pass === "changed") {
        // Every price moves and every product reports one new attribute value.
        const later = new Date(Date.now() - 1_800_000).toISOString();
        const changed = records.map(r => r.kind === "offer" ? { ...r, observedAt: later, price: `${200 + Number(r.recordId.slice(1)) % 50}.95` } : { ...r, observedAt: later, specifications: [...(r as { specifications: unknown[] }).specifications, { attribute: "closureSystem", value: "Synthetic laces", basis: "REPORTED" }] });
        await writeFile(join(fixtures, `${id}.json`), JSON.stringify({ mode: "SNAPSHOT", records: changed }));
      }
      await db.query(`UPDATE "ProductSource" SET "lastSyncAttemptAt"=NULL WHERE id=$1`, [id]);
      const before = (await db.query(`SELECT (SELECT count(*) FROM "CatalogueEntry")::int e,(SELECT count(*) FROM "ProductOfferObservation")::int o,(SELECT count(*) FROM "SourceSyncChange")::int c`)).rows[0];
      const started = performance.now();
      const r = await runSourceSync({ sourceId: id, trigger: "MANUAL", entryPoint: "cli", requestId: `bench-${size}-${pass}`, notifier: { deliver: async () => "LOGGED" } });
      const after = (await db.query(`SELECT (SELECT count(*) FROM "CatalogueEntry")::int e,(SELECT count(*) FROM "ProductOfferObservation")::int o,(SELECT count(*) FROM "SourceSyncChange")::int c`)).rows[0];
      const s = "summary" in r ? r.summary as Record<string, number> : {};
      if (r.status !== "SUCCEEDED") console.error(JSON.stringify(r));
      runs.push({ pass, status: r.status, totalMs: Math.round(performance.now() - started), fetchMs: s.fetchMs, detectAndPersistMs: s.detectAndPersistMs, writeTransactionMs: s.writeMs, newDrafts: after.e - before.e, newObservations: after.o - before.o, newChangeRows: after.c - before.c, rejected: s.rejected, processHighWaterRssKb: s.processHighWaterRssKb });
    }
    results.push({ benchmark: "d5-sync", feedRecords: size, products: half, offers: half, runs });
  }
  console.log = silent;
  for (const r of results) console.log(JSON.stringify(r));
  await db.end(); await getDb().$disconnect();
} catch (error) {
  console.error("benchmark failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1", [name]);
  await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
  await admin.end();
  await rm(fixtures, { recursive: true, force: true });
}
