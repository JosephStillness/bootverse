import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import type { TestContext } from "node:test";
import pg from "pg";

export async function productMigrationTests(t: TestContext, localUrl: string) {
  const url = new URL(localUrl);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  const name = `bootverse_d1_migration_${randomBytes(6).toString("hex")}`;
  url.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: url.href });
  await admin.connect();
  let created = false;
  url.pathname = `/${name}`;
  const db = new pg.Client({ connectionString: url.href });
  try {
    await admin.query(`CREATE DATABASE "${name}"`); created = true;
    await db.connect();
    const names = (await readdir("prisma/migrations")).filter(n => /^\d/.test(n)).sort();
    for (const migration of names.filter(n => n < "20261024010000_product_sources"))
      await db.query(await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"));
    await db.query(`INSERT INTO "BootBrand"(id,name) VALUES('d1-brand','Synthetic legacy brand')`);
    await db.query(`INSERT INTO "BootFamily"(id,"brandId",name) VALUES('d1-family','d1-brand','Synthetic family')`);
    await db.query(`INSERT INTO "BootGeneration"(id,"familyId",name) VALUES('d1-generation','d1-family','Synthetic generation')`);
    await db.query(`INSERT INTO "BootTier"(id,"generationId",name) VALUES('d1-tier','d1-generation','Elite')`);
    await db.query(`INSERT INTO "BootVariant"(id,"tierModelId","generationId",surface) VALUES('d1-fg','d1-tier','d1-generation','FG'),('d1-ag','d1-tier','d1-generation','AG')`);
    await db.query(`INSERT INTO "BootColorway"(id,"generationId",name,swatch) VALUES('d1-color','d1-generation','Synthetic blue','#112233')`);
    await db.query(`INSERT INTO "CatalogueEntry"(id,slug,"outsoleVariantId","generationId","colorwayId",published) VALUES('d1-public','synthetic-public','d1-fg','d1-generation','d1-color',true),('d1-private','synthetic-private','d1-ag','d1-generation','d1-color',false)`);
    const migration = await readFile("prisma/migrations/20261024010000_product_sources/migration.sql", "utf8");
    await t.test("D1 migration aborts duplicate brands atomically without merging legacy data", async () => {
      await db.query(`INSERT INTO "BootBrand"(id,name) VALUES('d1-duplicate','SYNTHETIC LEGACY BRAND')`);
      await assert.rejects(db.query(migration), /duplicate normalized brand/);
      await db.query("ROLLBACK");
      assert.equal((await db.query(`SELECT to_regclass('"ProductSource"') AS table_name`)).rows[0].table_name, null);
      assert.equal((await db.query(`SELECT count(*)::int n FROM "BootBrand"`)).rows[0].n, 2);
      await db.query(`DELETE FROM "BootBrand" WHERE id='d1-duplicate'`);
    });
    await t.test("D1 upgrade preserves IDs, slugs, visibility and explicit unknown provenance", async () => {
      await db.query(migration);
      await db.query(await readFile("prisma/migrations/20261024020000_offer_entry_payload_guard/migration.sql", "utf8"));
      const rows = (await db.query(`SELECT id,slug,published,status,"sourceId","slugLocked" FROM "CatalogueEntry" ORDER BY id`)).rows;
      assert.deepEqual(rows.map(r => [r.id,r.slug,r.published,r.status,r.sourceId,r.slugLocked]), [
        ["d1-private","synthetic-private",false,"DRAFT",null,false],
        ["d1-public","synthetic-public",true,"PUBLISHED",null,true],
      ]);
      assert.equal((await db.query(`SELECT count(*)::int n FROM "ProductClaim"`)).rows[0].n, 0);
      await assert.rejects(db.query(`UPDATE "CatalogueEntry" SET slug='changed' WHERE id='d1-public'`), /immutable/);
      await db.query(`UPDATE "CatalogueEntry" SET published=false WHERE id='d1-public'`);
      await assert.rejects(db.query(`UPDATE "CatalogueEntry" SET slug='changed-after-archive' WHERE id='d1-public'`), /immutable/);
      assert.equal((await db.query(`SELECT status FROM "CatalogueEntry" WHERE id='d1-public'`)).rows[0].status, "ARCHIVED");
      await assert.rejects(db.query(`INSERT INTO "BootBrand"(id,name) VALUES('duplicate',' SYNTHETIC LEGACY BRAND ')`), /unique/);
    });
    await t.test("D1 database rejects undocumented permissions, invalid claims and cross-brand SKUs", async () => {
      await db.query(`INSERT INTO "ProductSource"(id,name,type,"baseUrl","accessMethod","updatedAt") VALUES('d1-source','Synthetic source','MANUAL_RESEARCH','https://example.test','Manual research',now())`);
      await assert.rejects(db.query(`UPDATE "ProductSource" SET "authorizationStatus"='GRANTED',"permissionNotes"='Synthetic permission',"authorizationCheckedAt"=now() WHERE id='d1-source'`), /check constraint/);
      const insert = `INSERT INTO "ProductClaim"(id,"entryId",attribute,value,basis,"sourceId","sourceUrl","observedAt","updatedAt") VALUES('d1-claim','d1-private',$1,$2::jsonb,'MEASURED','d1-source','https://example.test/spec',now(),now())`;
      for (const [attribute,value] of [["weight",{amount:200,unit:"g"}],["weight",{amount:-1,unit:"g",size:"9",sizeSystem:"UK",method:"Synthetic"}],["releaseDate","2026-02-31"],["inventedAttribute","Synthetic"]])
        await assert.rejects(db.query(insert,[attribute,JSON.stringify(value)]), /check constraint/);
      await db.query(insert,["weight",JSON.stringify({amount:200,unit:"g",size:"9",sizeSystem:"UK",method:"Synthetic fixture"})]);
      await db.query(`INSERT INTO "BootBrand"(id,name) VALUES('d1-other','Synthetic other brand')`);
      await assert.rejects(db.query(`INSERT INTO "ProductIdentifier"(id,"entryId","brandId",value,"sourceId","sourceUrl","updatedAt") VALUES('d1-sku','d1-private','d1-other','SyntheticSKU','d1-source','https://example.test/sku',now())`), /manufacturer/);
      await db.query(`INSERT INTO "ProductIdentifier"(id,"entryId","brandId",value,"sourceId","sourceUrl","updatedAt") VALUES('d1-sku','d1-private','d1-brand','SyntheticSKU','d1-source','https://example.test/sku',now())`);
      await assert.rejects(db.query(`UPDATE "BootFamily" SET "brandId"='d1-other' WHERE id='d1-family'`), /across brands/);
      await assert.rejects(db.query(`INSERT INTO "ProductClaim"(id,"entryId","variantId",attribute,value,basis,"sourceId","sourceUrl","observedAt","updatedAt") VALUES('d1-mixed','d1-private','d1-ag','upperMaterial','"Synthetic"','REPORTED','d1-source','https://example.test/spec',now(),now())`), /check constraint/);
    });
    await t.test('D2 additive tracking preserves existing D1 identities and allows explicit unknown swatches',async()=>{
      const before=(await db.query('SELECT id,slug,status,published FROM "CatalogueEntry" ORDER BY id')).rows;
      await db.query(await readFile('prisma/migrations/20261024030000_product_imports/migration.sql','utf8'));
      assert.deepEqual((await db.query('SELECT id,slug,status,published FROM "CatalogueEntry" ORDER BY id')).rows,before);
      assert.equal((await db.query('SELECT count(*)::int n FROM "ProductImportBatch"')).rows[0].n,0);
      await db.query('UPDATE "BootColorway" SET swatch=NULL WHERE id=\'d1-color\'');
      await assert.rejects(db.query(`INSERT INTO "ProductImportBatch"(id,"sourceId",format,checksum,"idempotencyKey",status) VALUES('bad','d1-source','JSON','bad','short','SUCCEEDED')`),/check constraint/);
    });
    await t.test('D3 expansion preserves legacy claims and adds bounded original observations and private product targets',async()=>{
      const before=(await db.query('SELECT id,slug,status,published FROM "CatalogueEntry" ORDER BY id')).rows;
      const claims=(await db.query('SELECT id,attribute,value,status FROM "ProductClaim" ORDER BY id')).rows;
      await db.query(await readFile('prisma/migrations/20261024040000_product_enrichment/migration.sql','utf8'));
      assert.deepEqual((await db.query('SELECT id,slug,status,published FROM "CatalogueEntry" ORDER BY id')).rows,before);
      assert.deepEqual((await db.query('SELECT id,attribute,value,status FROM "ProductClaim" ORDER BY id')).rows,claims);
      await db.query(`INSERT INTO "ProductClaim"(id,"entryId",attribute,value,basis,"sourceId","sourceUrl","observedAt","updatedAt") VALUES('d3-unknown','d1-private','heelStructure','{"unknown":true}','REPORTED','d1-source','https://example.test/spec',now(),now())`);
      assert.equal((await db.query(`SELECT value FROM "ProductClaim" WHERE id='d3-unknown'`)).rows[0].value.unknown,true);
      await assert.rejects(db.query(`UPDATE "ProductClaim" SET "observationKey"='invalid' WHERE id='d3-unknown'`),/check constraint/);
    });
    await t.test('D4 approval expansion preserves every product state, publishes nothing and keeps review history append-only',async()=>{
      const before=(await db.query('SELECT id,slug,status,published,version,"slugLocked" FROM "CatalogueEntry" ORDER BY id')).rows;
      const claims=(await db.query('SELECT id,status,version FROM "ProductClaim" ORDER BY id')).rows;
      await db.query(await readFile('prisma/migrations/20261025010000_product_approval/migration.sql','utf8'));
      assert.deepEqual((await db.query('SELECT id,slug,status,published,version,"slugLocked" FROM "CatalogueEntry" ORDER BY id')).rows,before);
      assert.deepEqual((await db.query('SELECT id,status,version FROM "ProductClaim" ORDER BY id')).rows,claims);
      assert.equal((await db.query('SELECT count(*)::int n FROM "CatalogueEntry" WHERE "submittedAt" IS NOT NULL')).rows[0].n,0);
      assert.equal((await db.query('SELECT count(*)::int n FROM "ProductReviewDecision"')).rows[0].n,0);
      const entry=before[0].id;
      await db.query(`INSERT INTO "ProductReviewDecision"(id,"entryId","entryKey",kind,reason,"entryVersion") VALUES('d4-note',$1::text,$1::text,'NOTE','Synthetic migration note only',1)`,[entry]);
      await assert.rejects(db.query(`UPDATE "ProductReviewDecision" SET reason='Tampered synthetic note' WHERE id='d4-note'`),/append-only/);
      await assert.rejects(db.query(`DELETE FROM "ProductReviewDecision" WHERE id='d4-note'`),/append-only/);
      await assert.rejects(db.query(`INSERT INTO "ProductReviewDecision"(id,"entryId","entryKey",kind,reason,"entryVersion","toStatus","fromStatus") VALUES('d4-bad',$1::text,$1::text,'APPROVE','Approval without fingerprint',1,'PUBLISHED','PENDING_REVIEW')`,[entry]),/check constraint/);
    });
    await t.test('D5 sync expansion keeps every source and product unchanged and leaves synchronization disabled',async()=>{
      const products=(await db.query('SELECT id,slug,status,published,version FROM "CatalogueEntry" ORDER BY id')).rows;
      const sources=(await db.query('SELECT id,"authorizationStatus",status,version FROM "ProductSource" ORDER BY id')).rows;
      await db.query(await readFile('prisma/migrations/20261027010000_source_sync/migration.sql','utf8'));
      assert.deepEqual((await db.query('SELECT id,slug,status,published,version FROM "CatalogueEntry" ORDER BY id')).rows,products);
      assert.deepEqual((await db.query('SELECT id,"authorizationStatus",status,version FROM "ProductSource" ORDER BY id')).rows,sources);
      assert.equal((await db.query('SELECT count(*)::int n FROM "ProductSource" WHERE "syncEnabled"')).rows[0].n,0);
      await assert.rejects(db.query(`UPDATE "ProductSource" SET "syncEnabled"=true WHERE id=$1`,[sources[0].id]),/check constraint/);
      // The D4 decision log accepts the new SYNC_CHANGE kind and is still append-only.
      await db.query(`INSERT INTO "ProductReviewDecision"(id,"entryId","entryKey",kind,reason,"entryVersion") VALUES('d5-sync',$1::text,$1::text,'SYNC_CHANGE','Synthetic migration sync decision',1)`,[products[0].id]);
      await assert.rejects(db.query(`DELETE FROM "ProductReviewDecision" WHERE id='d5-sync'`),/append-only/);
    });
  } finally {
    await db.end();
    if (created) await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
  }
}
