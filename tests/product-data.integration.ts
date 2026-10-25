import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type pg from "pg";
type Browser = { request(path: string, init?: RequestInit): Promise<Response> };
export async function productDataTests(t: TestContext, { db, base, alice, bob, aliceId }: { db: pg.Client; base: string; alice: Browser; bob: Browser; aliceId: string }) {
  const sourceIds: string[] = [], entryIds: string[] = [], brandIds: string[] = [];
  const previousRole = (await db.query('SELECT role FROM "User" WHERE id=$1', [aliceId])).rows[0].role;
  const write = (browser: Browser, path: string, input: unknown, method = "POST") => browser.request(path, { method, body: JSON.stringify(input) });
  const admin = (path: string, input: unknown, method = "POST") => write(alice, path, input, method);
  const add = (id: string, kind: string, data: unknown) => admin(`/api/admin/products/${id}/records`, { kind, data });
  const note = "Synthetic isolated QA decision; no real claim or license.";
  let sourceId = "", entryId = "", otherEntry = "", colorEntry = "", claimId = "";
  const observedAt = new Date(Date.now() - 60000).toISOString(), validUntil = new Date(Date.now() + 86400000).toISOString();
  const makeEntry = async (variantId: string, colorwayId: string, slug: string) => {
    const r = await admin("/api/admin/products", { variantId, colorwayId, slug, sourceId });
    assert.equal(r.status, 201, await r.clone().text()); const row = await r.json(); entryIds.push(row.id); return row;
  };
  const decide = (id: string, status: string, version: number) => admin(`/api/admin/product-claims/${id}`, { status, version, note, sourceChecked: true }, "PATCH");
  const state = async (id: string, status: string) => {
    const current = await (await alice.request(`/api/admin/products/${id}`)).json();
    // D4: publication also requires explicit identity/evidence attestation.
    const r = await admin(`/api/admin/products/${id}`, { status, version: current.version, note, ...(status === "PUBLISHED" ? { identityConfirmed: true, evidenceChecked: true } : {}) }, "PATCH");
    assert.equal(r.status, 200, await r.clone().text()); return r.json();
  };
  try {
    await t.test("D1 admin registry denies anonymous/ordinary/moderator access, forged state and CSRF", async () => {
      for (const path of ["/api/admin/products", "/api/admin/product-sources", "/api/admin/products/missing"]) {
        assert.equal((await fetch(base + path)).status, 401);
        assert.equal((await bob.request(path)).status, 403);
      }
      await db.query(`UPDATE "User" SET role='MODERATOR' WHERE id=$1`, [aliceId]);
      assert.equal((await alice.request("/api/admin/products")).status, 403);
      await db.query(`UPDATE "User" SET role='ADMIN' WHERE id=$1`, [aliceId]);
      assert.equal((await alice.request("/api/admin/product-sources", { method: "POST", headers: { Origin: "https://evil.example.test" }, body: "{}" })).status, 403);
      assert.equal((await admin("/api/admin/products", { published: true, status: "PUBLISHED" })).status, 400);
    });
    await t.test("D1 brand/source registration preserves Unicode, uniqueness and explicit authorization evidence", async () => {
      const r = await admin("/api/admin/product-brands", { name: "Synthetic D1 brand", slug: "synthetic-d1-brand" }); assert.equal(r.status, 201); const brand = await r.json(); brandIds.push(brand.id);
      const second = await admin("/api/admin/product-brands", { name: "Giày D1 synthetic", slug: "synthetic-d1-other" }); assert.equal(second.status, 201); brandIds.push((await second.json()).id);
      assert.equal((await admin("/api/admin/product-brands", { name: "SYNTHETIC D1 BRAND", slug: "another-slug" })).status, 409);
      const input = { name: "Synthetic D1 manual source", type: "MANUAL_RESEARCH", baseUrl: "https://example.test", accessMethod: "Manual research" };
      assert.equal((await admin("/api/admin/product-sources", { ...input, baseUrl: "https://example.test?api_key=secret" })).status, 400);
      assert.equal((await admin("/api/admin/product-sources", { ...input, authorizationStatus: "GRANTED" })).status, 400);
      const response = await admin("/api/admin/product-sources", input); assert.equal(response.status, 201); const source = await response.json(); sourceId = source.id; sourceIds.push(sourceId); assert.equal(source.authorizationStatus, "UNKNOWN");
      const saved = await admin(`/api/admin/product-sources/${sourceId}`, { ...input, version: source.version, authorizationStatus: "NOT_REQUIRED", permissionNotes: note, permissionUrl: "https://example.test/research-policy" }, "PUT"); assert.equal(saved.status, 200); assert.ok((await saved.json()).authorizationCheckedAt);
      assert.equal((await admin(`/api/admin/product-sources/${sourceId}`, { ...input, version: source.version }, "PUT")).status, 409);
      assert.equal((await (await alice.request("/api/admin/product-sources?q=Synthetic%20D1")).json()).total, 1);
      assert.equal((await alice.request("/api/admin/product-sources?page=0")).status, 400);
      for (let n = 0; n < 2; n++) {
        await db.query(`INSERT INTO "BootFamily"(id,"brandId",name) VALUES($1,$2,'Synthetic D1 family')`, [`d1-family-${n}`, brandIds[n]]);
        await db.query(`INSERT INTO "BootGeneration"(id,"familyId",name) VALUES($1,$2,'Synthetic D1 generation')`, [`d1-generation-${n}`, `d1-family-${n}`]);
        await db.query(`INSERT INTO "BootTier"(id,"generationId",name) VALUES($1,$2,'Elite')`, [`d1-tier-${n}`, `d1-generation-${n}`]);
        await db.query(`INSERT INTO "BootVariant"(id,"tierModelId","generationId",surface,"manufacturerOutsole","constructionNote") VALUES($1,$2,$3,'FG','Synthetic FG label','Synthetic explicitly separate construction'),($4,$2,$3,'AG','Synthetic AG label','Synthetic AG construction')`, [`d1-fg-${n}`, `d1-tier-${n}`, `d1-generation-${n}`, `d1-ag-${n}`]);
        await db.query(`INSERT INTO "BootColorway"(id,"generationId",name,swatch,"colorNames") VALUES($1,$2,'Synthetic blue','#112233',ARRAY['Synthetic blue']),($3,$2,'Synthetic red','#CC1122',ARRAY['Synthetic red'])`, [`d1-color-${n}`, `d1-generation-${n}`, `d1-red-${n}`]);
      }
    });
    await t.test("D1 drafts enforce generation identity, stay private and expose readiness warnings to admins", async () => {
      assert.equal((await admin("/api/admin/products", { slug: "synthetic-d1-wrong", variantId: "d1-fg-0", colorwayId: "d1-color-1", sourceId })).status, 400);
      const entry = await makeEntry("d1-fg-0", "d1-color-0", "synthetic-d1-fg"); entryId = entry.id;
      otherEntry = (await makeEntry("d1-ag-0", "d1-color-0", "synthetic-d1-ag")).id;
      colorEntry = (await makeEntry("d1-fg-0", "d1-red-0", "synthetic-d1-red")).id;
      assert.equal(entry.status, "DRAFT"); assert.equal(entry.published, false);
      const info = await (await alice.request(`/api/admin/products/${entryId}`)).json(); assert.equal(info.quality.ready, true); assert.ok(info.quality.missingOptional.includes("weight")); assert.ok(info.quality.warnings.includes("missing_sku"));
      assert.equal((await fetch(base + "/boots/synthetic-d1-fg")).status, 404);
      assert.equal((await (await fetch(base + "/api/boots?q=Synthetic%20D1")).json()).total, 0);
      assert.equal((await admin(`/api/admin/products/${entryId}`, { status: "PUBLISHED", version: 1, note }, "PATCH")).status, 409);
      assert.equal((await write(bob, `/api/admin/products/${entryId}`, { status: "PENDING_REVIEW", version: 1, note }, "PATCH")).status, 403);
      const list = await alice.request("/api/admin/products?status=DRAFT&q=synthetic-d1"); assert.match(list.headers.get("cache-control") ?? "", /no-store/); assert.equal((await list.json()).total, 3);
    });
    await t.test("D1 SKUs are unique within manufacturer/region and do not merge tiers, surfaces or colorways", async () => {
      const sku = { value: "Synthetic-CaseSKU", sourceId, sourceUrl: "https://example.test/sku", region: "AU" };
      assert.equal((await add(entryId, "identifier", sku)).status, 201);
      assert.equal((await add(otherEntry, "identifier", sku)).status, 409);
      assert.equal((await add(otherEntry, "identifier", { ...sku, region: "VN" })).status, 201);
      const otherBrandEntry = await makeEntry("d1-fg-1", "d1-color-1", "synthetic-d1-other-brand");
      assert.equal((await add(otherBrandEntry.id, "identifier", sku)).status, 201);
      assert.equal((await add(entryId, "identifier", { ...sku, region: "GLOBAL" })).status, 201);
      assert.equal((await add(entryId, "identifier", { ...sku, region: "UNSPECIFIED" })).status, 201);
      assert.equal((await add(otherEntry, "identifier", { ...sku, value: "synthetic-casesku" })).status, 201);
      assert.ok((await (await alice.request(`/api/admin/products/${otherEntry}`)).json()).quality.warnings.includes("possible_case_variant_sku"));
      const count = await db.query('SELECT count(*)::int n FROM "BootVariant" WHERE id LIKE \'d1-%\''); assert.equal(count.rows[0].n, 4);
    });
    await t.test("D1 source-backed claims require review, reject conflicts and remain exact-colorway scoped", async () => {
      const claim = { entryId, sourceId, sourceUrl: "https://example.test/spec", attribute: "upperMaterial", value: "Synthetic D1 checked upper", basis: "REPORTED", observedAt };
      assert.equal((await add(entryId, "claim", { ...claim, status: "VERIFIED" })).status, 400);
      assert.equal((await add(entryId, "claim", { ...claim, entryId: otherEntry })).status, 400);
      assert.equal((await add(entryId, "claim", { ...claim, attribute: "weight", value: { amount: 200, unit: "g" } })).status, 400);
      const r = await add(entryId, "claim", claim); assert.equal(r.status, 201); const row = await r.json(); claimId = row.id; assert.equal(row.status, "UNVERIFIED");
      assert.equal((await decide(claimId, "VERIFIED", 1)).status, 409);
      assert.equal((await decide(claimId, "PENDING_REVIEW", 1)).status, 200);
      assert.equal((await decide(claimId, "VERIFIED", 2)).status, 200);
      assert.equal((await decide(claimId, "CONFLICTED", 2)).status, 409);
      const conflict = await (await add(entryId, "claim", { ...claim, value: "Synthetic conflicting upper" })).json();
      assert.equal((await decide(conflict.id, "PENDING_REVIEW", 1)).status, 200);
      assert.equal((await decide(conflict.id, "VERIFIED", 2)).status, 409);
      for (const id of [entryId, colorEntry]) { await state(id, "PENDING_REVIEW"); await state(id, "PUBLISHED"); }
      const data = await (await fetch(base + "/api/boots?q=Synthetic%20D1")).json();
      assert.equal(data.boots.find((b: { id: string }) => b.id === entryId).specifications.upper.value, claim.value);
      assert.equal(data.boots.find((b: { id: string }) => b.id === colorEntry).specifications.upper.status, "unknown");
      assert.ok((await (await fetch(base + "/boots/synthetic-d1-fg")).text()).includes("not independent scientific certification"));
      assert.equal((await (await fetch(base + "/api/boot-variants/d1-fg-0/ratings")).json()).count, 0);
      assert.equal((await decide(claimId, "CONFLICTED", 3)).status, 200);
      assert.equal((await (await fetch(base + "/api/boots?q=Synthetic%20D1")).json()).boots.find((b: { id: string }) => b.id === entryId).specifications.upper.status, "unknown");
      await state(entryId, "ARCHIVED"); await state(entryId, "PENDING_REVIEW");
      const current = await (await alice.request(`/api/admin/products/${entryId}`)).json(); assert.ok(current.quality.errors.includes("unresolved_claim_conflict"));
      assert.equal((await admin(`/api/admin/products/${entryId}`, { status: "PUBLISHED", version: current.version, note, identityConfirmed: true, evidenceChecked: true }, "PATCH")).status, 400);
    });
    await t.test("D1 licensed image metadata rejects arbitrary paths and never downloads external images", async () => {
      const image = { sourceId, sourceUrl: "https://example.test/photo", externalUrl: "https://example.test/synthetic.webp", altText: "Synthetic D1 image", attribution: "Synthetic owner", licenseStatus: "GRANTED", permissionNotes: note, permissionUrl: "https://example.test/license", isPrimary: true };
      assert.equal((await add(entryId, "image", { ...image, permissionUrl: undefined })).status, 400);
      assert.equal((await add(entryId, "image", { ...image, objectKey: "../../private" })).status, 400);
      const response = await add(entryId, "image", image); assert.equal(response.status, 201); const row = await response.json(); assert.equal(row.status, "UNVERIFIED");
      assert.equal((await add(entryId, "image", image)).status, 409);
      const path = `/api/admin/product-images/${row.id}`;
      assert.equal((await admin(path, { status: "PENDING_REVIEW", version: 1, note }, "PATCH")).status, 200);
      assert.equal((await admin(path, { status: "VERIFIED", version: 2, note, sourceChecked: true }, "PATCH")).status, 200);
      assert.equal((await db.query('SELECT count(*)::int n FROM "UploadedImage" WHERE "objectKey" LIKE \'%synthetic.webp%\'')).rows[0].n, 0);
    });
    await t.test("D1 offers retain exact entry, region, expiry and stock without automatic recommendation approval", async () => {
      const r = await admin("/api/admin/product-sources", { name: "Synthetic D1 retailer", type: "RETAILER", baseUrl: "https://example.test", accessMethod: "Manual research" }); assert.equal(r.status, 201); const retailer = await r.json(); sourceIds.push(retailer.id);
      const offer = { sourceId: retailer.id, sourceUrl: "https://example.test/offer", amount: "100", currency: "AUD", countryCode: "AU", size: "9", sizeSystem: "UK", observedAt, validUntil, available: true };
      assert.equal((await add(entryId, "offer", { ...offer, approved: true })).status, 400);
      const price = await add(entryId, "offer", offer); assert.equal(price.status, 201); const row = await price.json(); assert.equal(row.approved, false); assert.equal(row.entryId, entryId); assert.equal(row.countryCode, "AU");
      const stock = await db.query('SELECT * FROM "RecommendationEvidence" WHERE "entryId"=$1 AND kind=\'AVAILABILITY\'', [entryId]); assert.equal(stock.rows.length, 1); assert.equal(stock.rows[0].payload.available, true);
      await assert.rejects(db.query('UPDATE "RecommendationEvidence" SET "entryId"=$1 WHERE id=$2', [otherEntry, row.id]), /foreign key|check constraint/);
      await assert.rejects(db.query('UPDATE "RecommendationEvidence" SET payload=payload-\'entryId\' WHERE id=$1', [row.id]), /check constraint/);
      const second = await (await add(colorEntry, "offer", { ...offer, available: undefined })).json();
      await db.query('UPDATE "RecommendationEvidence" SET approved=true WHERE id=$1', [second.id]);
      const offers = async () => (await (await fetch(base + "/api/boots?q=Synthetic%20D1")).json()).boots.find((boot: { id: string }) => boot.id === colorEntry).offers;
      assert.equal((await offers())[0].countryCode, "AU");
      try {
        await db.query(`UPDATE "ProductSource" SET status='ARCHIVED' WHERE id=$1`, [retailer.id]);
        assert.equal((await offers()).length, 0);
      } finally { await db.query(`UPDATE "ProductSource" SET status='ACTIVE' WHERE id=$1`, [retailer.id]); }
    });
    await t.test("D1 publication keeps stable URLs, records audit, revokes permissions and denies stale/current non-admin roles", async () => {
      await assert.rejects(db.query('UPDATE "CatalogueEntry" SET slug=\'changed-public-slug\' WHERE id=$1', [colorEntry]), /immutable/);
      await state(colorEntry, "ARCHIVED"); assert.equal((await fetch(base + "/boots/synthetic-d1-red")).status, 404);
      const audits = await db.query('SELECT action FROM "ModerationAction" WHERE "targetKey"=$1', [`PRODUCT:${entryId}`]); assert.ok(audits.rows.some(r => r.action === "PRODUCT_STATUS"));
      await db.query(`UPDATE "User" SET role='USER' WHERE id=$1`, [aliceId]);
      assert.equal((await alice.request(`/api/admin/products/${entryId}`)).status, 403);
      await db.query(`UPDATE "User" SET role='ADMIN' WHERE id=$1`, [aliceId]);
      const s = (await (await alice.request("/api/admin/product-sources?q=Synthetic%20D1%20manual")).json()).records[0];
      const input = { name: s.name, type: s.type, baseUrl: s.baseUrl, brandId: s.brandId, accessMethod: s.accessMethod, authorizationStatus: s.authorizationStatus, permissionNotes: s.permissionNotes, permissionUrl: s.permissionUrl, usageRestrictions: s.usageRestrictions, status: s.status, version: s.version, lastCheckedAt: s.lastCheckedAt };
      assert.equal((await admin(`/api/admin/product-sources/${sourceId}`, { ...input, baseUrl: "https://different.example.test" }, "PUT")).status, 409);
      assert.equal((await admin(`/api/admin/product-sources/${sourceId}`, { ...input, authorizationStatus: "DENIED" }, "PUT")).status, 200);
      assert.equal((await add(otherEntry, "identifier", { value: "Synthetic new SKU", sourceId, sourceUrl: "https://example.test/sku" })).status, 400);
      const migration = (await db.query(`SELECT id,finished_at FROM "_prisma_migrations" WHERE migration_name='20261024020000_offer_entry_payload_guard'`)).rows[0];
      try { await db.query('UPDATE "_prisma_migrations" SET finished_at=NULL WHERE id=$1', [migration.id]); assert.equal((await fetch(base + "/api/health/ready")).status, 503); }
      finally { await db.query('UPDATE "_prisma_migrations" SET finished_at=$1 WHERE id=$2', [migration.finished_at, migration.id]); }
      assert.equal((await fetch(base + "/api/health/ready")).status, 200);
    });
    await t.test("D1 admin pagination and scoped claim indexes remain bounded under synthetic volume", async () => {
      const ids = Array.from({ length: 26 }, (_, n) => `d1-page-entry-${n}`); entryIds.push(...ids);
      await db.query(`INSERT INTO "BootVariant"(id,"tierModelId","generationId",surface) SELECT 'd1-page-variant-'||n,'d1-tier-0','d1-generation-0','MG' FROM generate_series(0,25) n`);
      await db.query(`INSERT INTO "CatalogueEntry"(id,slug,"outsoleVariantId","generationId","colorwayId","sourceId",sample) SELECT 'd1-page-entry-'||n,'synthetic-d1-page-'||n,'d1-page-variant-'||n,'d1-generation-0','d1-color-0',$1,false FROM generate_series(0,25) n`, [sourceId]);
      for (const [page, length] of [[1,25],[2,1]]) {
        const data = await (await alice.request(`/api/admin/products?q=synthetic-d1-page&status=DRAFT&page=${page}`)).json(); assert.equal(data.total, 26); assert.equal(data.records.length, length); assert.equal(data.pages, 2);
      }
      assert.equal((await (await fetch(base + "/api/boots?q=synthetic-d1-page")).json()).total, 0);
      await db.query(`INSERT INTO "ProductClaim"(id,"entryId",attribute,value,basis,"sourceId","sourceUrl","observedAt","updatedAt") SELECT 'd1-index-fixture-'||n,$1,'upperMaterial','"Synthetic index fixture"'::jsonb,'REPORTED',$2,'https://example.test/spec',now(),now() FROM generate_series(1,1000) n`, [entryId,sourceId]);
      await db.query('ANALYZE "ProductClaim"');
      const plan = (await db.query(`EXPLAIN (ANALYZE, FORMAT JSON) SELECT id FROM "ProductClaim" WHERE ("entryId"=$1 OR "variantId"='d1-fg-0') AND status='VERIFIED' AND attribute='upperMaterial' LIMIT 33`,[entryId])).rows[0]["QUERY PLAN"][0];
      console.log(JSON.stringify({ probe: "d1-scoped-claim-lookup", syntheticRows: 1000, executionMs: plan["Execution Time"], planningMs: plan["Planning Time"], plan: plan.Plan["Node Type"], scope: "equivalent bounded metadata lookup, not the full Prisma query" }));
      const quality = (await (await alice.request(`/api/admin/products/${entryId}`)).json()).quality; assert.ok(quality.errors.includes("claim_limit"));
      const indexes = (await db.query(`SELECT indexname FROM pg_indexes WHERE tablename='ProductClaim'`)).rows.map(r => r.indexname); assert.ok(indexes.includes("ProductClaim_entryId_status_attribute_idx")); assert.ok(indexes.includes("ProductClaim_variantId_status_attribute_idx"));
    });
    await t.test("D1 admin mutations retain rate limits", async () => {
      let status = 0;
      for (let n = 0; n < 61 && status !== 429; n++) status = (await admin("/api/admin/product-sources", { invalid: true })).status;
      assert.equal(status, 429);
    });
  } finally {
    await db.query('DELETE FROM "RecommendationEvidence" WHERE "entryId"=ANY($1::text[])', [entryIds]);
    await db.query('DELETE FROM "CatalogueEntry" WHERE id=ANY($1::text[])', [entryIds]);
    await db.query('DELETE FROM "BootVariant" WHERE id LIKE \'d1-%\'');
    await db.query('DELETE FROM "BootColorway" WHERE id LIKE \'d1-%\'');
    await db.query('DELETE FROM "BootTier" WHERE id LIKE \'d1-%\'');
    await db.query('DELETE FROM "BootGeneration" WHERE id LIKE \'d1-%\'');
    await db.query('DELETE FROM "BootFamily" WHERE id LIKE \'d1-%\'');
    await db.query('DELETE FROM "ProductSource" WHERE id=ANY($1::text[])', [sourceIds]);
    await db.query('DELETE FROM "BootBrand" WHERE id=ANY($1::text[])', [brandIds]);
    await db.query('UPDATE "User" SET role=$1 WHERE id=$2', [previousRole, aliceId]);
  }
}
