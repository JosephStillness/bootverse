import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import type { TestContext } from "node:test";
import type pg from "pg";
import { sign } from "../src/lib/source-sync/scheduler-auth";
type Browser = { request(path: string, init?: RequestInit): Promise<Response> };

// D5 synchronization regression. Synthetic fixture feeds only: no real source, product, price or stock is accessed.
export async function sourceSyncTests(t: TestContext, ctx: { db: pg.Client; base: string; admins: Browser[]; member: Browser; adminId: string; fixtureDir: string; schedulerSecret: string; env: NodeJS.ProcessEnv }) {
  const { db, base, admins, member, fixtureDir } = ctx;
  const admin = admins[0];
  const reason = "Synthetic isolated D5 QA decision only.";
  let turn = 0;
  const nextAdmin = () => admins[turn++ % admins.length];
  const post = (who: Browser, path: string, body: unknown, method = "POST") => who.request(path, { method, body: JSON.stringify(body) });
  const json = async <T = Record<string, unknown>>(r: Response, status = 200): Promise<T> => { const text = await r.text(); assert.equal(r.status, status, text); return JSON.parse(text) as T; };
  const feed = (name: string, records: unknown[], mode = "SNAPSHOT", failure?: unknown) => writeFile(join(fixtureDir, `${name}.json`), JSON.stringify({ mode, records, ...(failure ? { failure } : {}) }));
  const iso = (offsetMinutes = 0) => new Date(Date.now() - 3_600_000 + offsetMinutes * 60_000).toISOString();
  const product = (recordId: string, over: Record<string, unknown> = {}) => ({ kind: "product", recordId, brand: "Synthetic D5 brand", family: "Synthetic D5 family", generation: "Gen 1", tier: "Elite", outsole: "FG", colorway: "Synthetic D5 blue", sku: `SYN-D5-${recordId}`, sourceUrl: `https://example.test/d5/${recordId}`, observedAt: iso(), ...over });
  const offer = (recordId: string, over: Record<string, unknown> = {}) => ({ kind: "offer", recordId, countryCode: "AU", currency: "AUD", price: "199.95", availability: "In stock", sourceUrl: `https://example.test/d5/offer/${recordId}`, observedAt: iso(), ...over });
  const ready = (id: string) => db.query(`UPDATE "ProductSource" SET "lastSyncAttemptAt"=NULL,"backoffUntil"=NULL,"nextSyncAt"=now()-interval '1 minute' WHERE id=$1`, [id]);
  const run = async (id: string, mode: "RUN" | "PREVIEW" = "RUN", expected = 200, who = nextAdmin()) => { await ready(id); return json<{ status: string; jobId: string; summary: Record<string, number>; errorCategory?: string; reason?: string; preview?: Record<string, unknown> }>(await post(who, `/api/admin/data-sources/${id}/sync`, { mode, requestId: randomUUID(), confirmed: true }), expected); };
  const detail = async (id: string) => json<{ source: Record<string, unknown>; jobs: { status: string; errorCategory: string | null }[]; alerts: { kind: string; status: string; delivery: string; id: string }[]; offers: { countryCode: string; amount: string | null; previousAmount: string | null; availability: string; status: string; missingSince: string | null; priceFreshness: string; entry: { slug: string } }[] }>(await admin.request(`/api/admin/data-sources/${id}`));
  const configure = async (id: string, adapterKey: string, over: Record<string, unknown> = {}) => {
    const current = (await detail(id)).source;
    return post(admin, `/api/admin/data-sources/${id}`, { expectedUpdatedAt: current.updatedAt, syncEnabled: true, adapterKey, syncIntervalMinutes: 60, minIntervalMinutes: 5, fieldPolicy: { prices: "AUTO", availability: "RECORD", availabilityLabels: {} }, reason, ...over }, "PATCH");
  };
  const scheduler = (body: unknown, over: Record<string, string> = {}) => {
    const text = JSON.stringify(body), ts = String(Math.floor(Date.now() / 1000)), nonce = randomUUID().replace(/-/g, "");
    return fetch(`${base}/api/internal/source-sync`, { method: "POST", body: text, headers: { "Content-Type": "application/json", "x-bootverse-timestamp": ts, "x-bootverse-nonce": nonce, "x-bootverse-signature": sign(ctx.schedulerSecret, ts, nonce, text), ...over } });
  };
  const ids: Record<string, string> = {};
  const count = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0].n as number;
  const publicBoots = async () => (await (await fetch(`${base}/api/boots?q=Synthetic%20D5`)).json()).boots as { id: string; slug: string; offers: { amount: string; currency: string }[] }[];
  const entryOf = async (recordId: string) => (await db.query(`SELECT "entryId" FROM "ProductSourceRecord" WHERE "sourceId"=$1 AND "recordId"=$2`, [ids.source, recordId])).rows[0]?.entryId as string | undefined;

  try {
    await t.test("D5 setup: documented sources and fixture adapters only", async () => {
      const documented = { authorizationStatus: "GRANTED", permissionNotes: reason, permissionUrl: "https://example.test/d5-licence" };
      const make = async (name: string, extra: Record<string, unknown> = documented) => (await json<{ id: string }>(await post(admin, "/api/admin/product-sources", { name, type: "PRODUCT_FEED", baseUrl: "https://example.test", accessMethod: "Synthetic fixture feed", ...extra }), 201)).id;
      ids.source = await make("Synthetic D5 feed"); ids.failing = await make("Synthetic D5 failing feed"); ids.unknown = await make("Synthetic D5 undocumented feed", {});
      await feed("d5-main", [product("a", { specifications: [{ attribute: "upperMaterial", value: "Synthetic D5 knit", basis: "REPORTED" }] }), product("b", { tier: "Pro", outsole: "AG" }), offer("a"), offer("b", { price: "149", availability: "Sold out" }), offer("unmapped-record")]);
      assert.equal((await configure(ids.source, "fixture:d5-main")).status, 200);
    });

    await t.test("D5 access control: anonymous, member, CSRF, unsafe keys, undocumented sources", async () => {
      assert.equal((await fetch(`${base}/api/admin/data-sources`)).status, 401);
      assert.equal((await member.request("/api/admin/data-sources")).status, 403);
      assert.equal((await post(member, `/api/admin/data-sources/${ids.source}/sync`, { mode: "RUN", requestId: randomUUID(), confirmed: true })).status, 403);
      assert.equal((await admin.request(`/api/admin/data-sources/${ids.source}/sync`, { method: "POST", headers: { Origin: "https://evil.example.test" }, body: "{}" })).status, 403);
      for (const key of ["http://evil.example.test/feed", "fixture:../../etc/passwd", "file:x"]) assert.equal((await configure(ids.source, key)).status, 400, key);
      assert.equal((await configure(ids.source, "http:not-configured")).status, 400, "unregistered adapters are refused");
      assert.equal((await configure(ids.unknown, "fixture:d5-main")).status, 400, "sync cannot be enabled without documented permission");
      // Even if forced on in the database, an undocumented source is never synchronized.
      await db.query(`UPDATE "ProductSource" SET "syncEnabled"=true,"adapterKey"='fixture:d5-main',"syncIntervalMinutes"=60 WHERE id=$1`, [ids.unknown]);
      const r = await run(ids.unknown, "RUN", 409);
      assert.equal(r.reason, "NOT_AUTHORIZED");
      assert.equal(await count(`SELECT count(*)::int n FROM "SourceSyncJob" WHERE "sourceId"=$1`, [ids.unknown]), 0);
      await db.query(`UPDATE "ProductSource" SET "syncEnabled"=false WHERE id=$1`, [ids.unknown]);
    });

    await t.test("D5 signed scheduler endpoint: authentication, replay protection and due-source run", async () => {
      assert.equal((await fetch(`${base}/api/internal/source-sync`, { method: "POST", body: JSON.stringify({ action: "due" }) })).status, 401);
      assert.equal((await scheduler({ action: "due" }, { "x-bootverse-signature": "0".repeat(64) })).status, 401);
      const text = JSON.stringify({ action: "sweep" }), ts = String(Math.floor(Date.now() / 1000)), nonce = randomUUID().replace(/-/g, "");
      const headers = { "x-bootverse-timestamp": ts, "x-bootverse-nonce": nonce, "x-bootverse-signature": sign(ctx.schedulerSecret, ts, nonce, text) };
      assert.equal((await fetch(`${base}/api/internal/source-sync`, { method: "POST", body: text, headers })).status, 200);
      assert.equal((await fetch(`${base}/api/internal/source-sync`, { method: "POST", body: text, headers })).status, 409, "replayed nonce");
      const due = await json<{ results: { sourceId: string; status: string }[] }>(await scheduler({ action: "due" }));
      assert.deepEqual(due.results.filter(r => r.sourceId === ids.source).map(r => r.status), ["SUCCEEDED"]);
      const again = await json<{ results: { sourceId: string }[] }>(await scheduler({ action: "due" }));
      assert.equal(again.results.filter(r => r.sourceId === ids.source).length, 0, "not due again until the interval passes");
    });

    await t.test("D5 new products are private drafts with review items; unmapped offers are never inferred", async () => {
      ids.a = (await entryOf("a"))!; ids.b = (await entryOf("b"))!;
      assert.ok(ids.a && ids.b && ids.a !== ids.b, "Elite FG and Pro AG stay separate products");
      assert.deepEqual((await db.query(`SELECT DISTINCT status::text FROM "CatalogueEntry" WHERE id=ANY($1)`, [[ids.a, ids.b]])).rows, [{ status: "DRAFT" }]);
      assert.equal((await publicBoots()).length, 0);
      assert.equal(await count(`SELECT count(*)::int n FROM "SourceSyncChange" WHERE "sourceId"=$1 AND kind='NEW_PRODUCT' AND disposition='PENDING_REVIEW'`, [ids.source]), 2);
      const job = (await detail(ids.source)).jobs[0];
      assert.equal(job.status, "SUCCEEDED");
      assert.equal(await count(`SELECT count(*)::int n FROM "ProductOffer" WHERE "sourceId"=$1`, [ids.source]), 2);
      assert.equal(await count(`SELECT ("summary"->>'offersUnresolved')::int n FROM "SourceSyncJob" WHERE "sourceId"=$1 ORDER BY "startedAt" DESC LIMIT 1`, [ids.source]), 1);
      assert.equal(await count(`SELECT count(*)::int n FROM "RecommendationEvidence" WHERE "sourceId"=$1`, [ids.source]), 0, "draft products never receive public prices");
    });

    await t.test("D5 publish product A through D4, then verify its evidence", async () => {
      const claim = (await db.query(`SELECT id FROM "ProductClaim" WHERE "entryId"=$1 AND attribute='upperMaterial'`, [ids.a])).rows[0].id;
      for (const [status, version] of [["PENDING_REVIEW", 1], ["VERIFIED", 2]] as const) assert.equal((await post(admin, `/api/admin/product-claims/${claim}`, { status, version, note: reason, sourceChecked: true }, "PATCH")).status, 200);
      for (const action of ["SUBMIT", "APPROVE"]) {
        const d = await json<{ version: number; fingerprint: string }>(await admin.request(`/api/admin/product-reviews/${ids.a}`));
        assert.equal((await post(admin, `/api/admin/product-reviews/${ids.a}/transitions`, { action, version: d.version, reason, reviewFingerprint: d.fingerprint, requestId: randomUUID(), identityConfirmed: true, evidenceChecked: true })).status, 200, action);
      }
      assert.equal(await count(`SELECT count(*)::int n FROM "SourceSyncChange" WHERE "entryId"=$1 AND kind='NEW_PRODUCT' AND disposition='RESOLVED'`, [ids.a]), 1, "approval resolves the new-product notice");
      assert.match(await (await fetch(`${base}/boots/${(await publicBoots())[0].slug}`)).text(), /Synthetic D5 knit/);
    });

    await t.test("D5 change detection routes material/critical changes to D4 and keeps published values", async () => {
      const image = { externalUrl: "https://example.test/d5/a.webp", sourceUrl: "https://example.test/d5/a", altText: "Synthetic D5 image", attribution: "Synthetic" };
      await feed("d5-main", [
        product("a", { observedAt: iso(10), specifications: [{ attribute: "upperMaterial", value: "  synthetic d5 KNIT  ", basis: "REPORTED" }, { attribute: "closureSystem", value: "Synthetic laces", basis: "REPORTED" }], images: [image] }),
        product("b", { tier: "Pro", outsole: "AG", sku: "SYN-D5-b-CORRECTED", observedAt: iso(10) }),
        product("c", { tier: "Pro", outsole: "FG", observedAt: iso(10) }),
        product("dup", { sku: null, observedAt: iso(10) }),
        offer("a", { price: "219.95", observedAt: iso(10) }), offer("a", { countryCode: "NZ", currency: "NZD", price: "250", listingId: "a-nz", observedAt: iso(10) }),
        offer("b", { price: "149.00", availability: "In stock", observedAt: iso(10) }),
      ]);
      const r = await run(ids.source);
      assert.equal(r.status, "SUCCEEDED", JSON.stringify(r));
      const kinds = (await db.query(`SELECT kind,severity,disposition FROM "SourceSyncChange" WHERE "sourceId"=$1 AND "jobId"=$2 ORDER BY kind`, [ids.source, r.jobId])).rows.map(x => `${x.kind}:${x.severity}`);
      for (const k of ["NEW_PRODUCT:MATERIAL", "POSSIBLE_DUPLICATE:MATERIAL", "SKU_CHANGE:CRITICAL", "SPEC_NEW_VALUE:MATERIAL", "IMAGE_ADDED:MATERIAL"]) assert.ok(kinds.includes(k), `${k} in ${kinds}`);
      assert.ok(!kinds.some(k => k.startsWith("SPEC_CORROBORATION") || k.startsWith("SPEC_CONTRADICTION")), "whitespace/case-only re-observation is not a change");
      assert.equal(await count(`SELECT count(*)::int n FROM "ProductIdentifier" WHERE value='SYN-D5-b-CORRECTED'`), 0, "SKU corrections are proposed, never applied");
      assert.equal((await db.query(`SELECT status::text FROM "CatalogueEntry" WHERE id=$1`, [ids.a])).rows[0].status, "PUBLISHED");
      const queue = await json<{ records: { id: string }[] }>(await admin.request("/api/admin/product-reviews?quality=sync_changes&q=synthetic-d5"));
      assert.ok(queue.records.some(x => x.id === ids.b), "critical SKU change appears in the D4 queue");
      const b = await json<{ evaluation: { issues: { code: string }[] }; syncChanges: { kind: string; disposition: string }[] }>(await admin.request(`/api/admin/product-reviews/${ids.b}`));
      assert.ok(b.evaluation.issues.some(i => i.code === "source_change_critical"));
      assert.ok(b.syncChanges.some(c => c.kind === "SKU_CHANGE" && c.disposition === "PENDING_REVIEW"));
    });

    await t.test("D5 contradiction of a verified published claim stays private until review", async () => {
      await feed("d5-main", [product("a", { observedAt: iso(20), specifications: [{ attribute: "upperMaterial", value: "Synthetic D5 leather", basis: "REPORTED" }] }), offer("a", { price: "219.95", observedAt: iso(20) })]);
      await run(ids.source);
      const change = (await db.query(`SELECT id,"claimId",disposition FROM "SourceSyncChange" WHERE "entryId"=$1 AND kind='SPEC_CONTRADICTION'`, [ids.a])).rows[0];
      assert.ok(change?.claimId); assert.equal(change.disposition, "PENDING_REVIEW");
      assert.equal((await db.query(`SELECT status::text FROM "ProductClaim" WHERE id=$1`, [change.claimId])).rows[0].status, "CONFLICTED");
      const html = await (await fetch(`${base}/boots/${(await publicBoots()).find(x => x.id === ids.a)!.slug}`)).text();
      assert.match(html, /Synthetic D5 knit/); assert.doesNotMatch(html, /Synthetic D5 leather/);
      // Selecting the established value in D4 rejects the incoming claim and resolves the sync item.
      const d = await json<{ claims: { id: string; version: number; attribute: string }[] }>(await admin.request(`/api/admin/product-reviews/${ids.a}`));
      const versions = Object.fromEntries(d.claims.filter(c => c.attribute === "upperMaterial").map(c => [c.id, c.version]));
      const keep = d.claims.find(c => c.attribute === "upperMaterial" && c.id !== change.claimId)!.id;
      assert.equal((await post(admin, `/api/admin/product-reviews/${ids.a}/conflicts`, { attribute: "upperMaterial", action: "SELECT", claimId: keep, claimVersions: versions, reason, sourceChecked: true })).status, 200);
      assert.equal((await db.query(`SELECT disposition FROM "SourceSyncChange" WHERE id=$1`, [change.id])).rows[0].disposition, "RESOLVED");
    });

    await t.test("D5 price and availability monitoring: currency-safe, history, public evidence for published products", async () => {
      const offers = (await detail(ids.source)).offers;
      const au = offers.find(o => o.entry.slug && o.countryCode === "AU" && o.amount === "219.95")!;
      assert.equal(au.previousAmount, "199.95");
      const nz = offers.find(o => o.countryCode === "NZ")!;
      assert.equal(nz.amount, "250.00"); assert.equal(nz.previousAmount, null, "a new country listing is never compared with another currency");
      assert.ok(offers.some(o => o.availability === "IN_STOCK" && o.amount === "149.00"), "stock change recorded for B");
      assert.ok(await count(`SELECT count(*)::int n FROM "ProductOfferObservation" WHERE change='PRICE_INCREASE'`) >= 1);
      assert.ok(await count(`SELECT count(*)::int n FROM "ProductOfferObservation" WHERE change='AVAILABILITY'`) >= 1);
      const a = (await publicBoots()).find(x => x.id === ids.a)!;
      assert.ok(a.offers.some(o => o.amount === "219.95" && o.currency === "AUD"), JSON.stringify(a.offers));
      assert.equal(await count(`SELECT count(*)::int n FROM "RecommendationEvidence" WHERE "sourceId"=$1 AND "entryId"=$2`, [ids.source, ids.b]), 0, "unpublished B gets no public price");
    });

    await t.test("D5 repeated synchronization is idempotent", async () => {
      const snapshot = async () => (await db.query(`SELECT (SELECT count(*) FROM "CatalogueEntry")::int e,(SELECT count(*) FROM "ProductClaim")::int c,(SELECT count(*) FROM "SourceSyncChange")::int s,(SELECT count(*) FROM "ProductOfferObservation")::int o,(SELECT count(*) FROM "RecommendationEvidence")::int r,(SELECT count(*) FROM "ProductImage")::int i`)).rows[0];
      const before = await snapshot();
      const r = await run(ids.source);
      assert.equal(r.summary.newProducts, 0);
      assert.deepEqual(await snapshot(), before);
    });

    await t.test("D5 D4 acknowledgement/dismissal of non-evidence changes is audited and never re-raised", async () => {
      const sku = (await db.query(`SELECT id FROM "SourceSyncChange" WHERE "entryId"=$1 AND kind='SKU_CHANGE'`, [ids.b])).rows[0].id;
      const d = await json<{ version: number }>(await admin.request(`/api/admin/product-reviews/${ids.b}`));
      assert.equal((await post(member, `/api/admin/product-reviews/${ids.b}/sync-changes`, { changeId: sku, action: "DISMISS", reason, version: d.version })).status, 403);
      assert.equal((await post(admin, `/api/admin/product-reviews/${ids.b}/sync-changes`, { changeId: sku, action: "DISMISS", reason, version: d.version })).status, 200);
      assert.equal((await post(admin, `/api/admin/product-reviews/${ids.b}/sync-changes`, { changeId: sku, action: "ACKNOWLEDGE", reason, version: d.version })).status, 409);
      assert.equal(await count(`SELECT count(*)::int n FROM "ProductReviewDecision" WHERE "entryId"=$1 AND kind='SYNC_CHANGE'`, [ids.b]), 1);
      await feed("d5-main", [product("b", { tier: "Pro", outsole: "AG", sku: "SYN-D5-b-CORRECTED", observedAt: iso(30) })], "DELTA");
      await run(ids.source);
      assert.equal(await count(`SELECT count(*)::int n FROM "SourceSyncChange" WHERE "entryId"=$1 AND kind='SKU_CHANGE'`, [ids.b]), 1);
      assert.equal((await db.query(`SELECT disposition FROM "SourceSyncChange" WHERE id=$1`, [sku])).rows[0].disposition, "DISMISSED");
    });

    await t.test("D5 partial feeds never imply removal; complete snapshots note absence; only explicit delisting removes", async () => {
      // A complete snapshot that includes B's listing clears any earlier "missing" note.
      await feed("d5-main", [product("a", { observedAt: iso(35) }), offer("a", { price: "219.95", observedAt: iso(35) }), offer("b", { price: "149.00", availability: "In stock", observedAt: iso(35) })]);
      await run(ids.source);
      assert.equal((await detail(ids.source)).offers.find(o => o.amount === "149.00")!.missingSince, null);
      await feed("d5-main", [offer("a", { price: "189.95", observedAt: iso(40) })], "DELTA");
      await run(ids.source);
      let offers = (await detail(ids.source)).offers;
      assert.ok(offers.find(o => o.amount === "149.00")!.missingSince === null, "absent from a delta feed: untouched");
      assert.ok(offers.some(o => o.amount === "189.95" && o.previousAmount === "219.95"), "price decrease");
      await feed("d5-main", [product("a", { observedAt: iso(50) }), offer("a", { price: "189.95", observedAt: iso(50) }), offer("a", { countryCode: "NZ", currency: "NZD", listingId: "a-nz", status: "DELISTED", observedAt: iso(50) }), offer("a", { price: null, availability: null, countryCode: "GB", currency: "GBP", observedAt: iso(50) })]);
      await run(ids.source);
      offers = (await detail(ids.source)).offers;
      const b = offers.find(o => o.amount === "149.00")!;
      assert.ok(b.missingSince, "noted as missing from the complete snapshot"); assert.equal(b.availability, "IN_STOCK", "never converted to out of stock");
      assert.equal(offers.find(o => o.countryCode === "NZ")!.status, "REMOVED");
      const gb = offers.find(o => o.countryCode === "GB")!;
      assert.equal(gb.amount, null); assert.equal(gb.availability, "UNKNOWN", "a missing stock signal stays unknown");
      await db.query(`UPDATE "ProductOffer" SET "firstSeenAt"=now()-interval '4 days',"lastObservedAt"=now()-interval '3 days' WHERE "countryCode"='AU' AND "sourceId"=$1`, [ids.source]);
      assert.ok((await detail(ids.source)).offers.filter(o => o.countryCode === "AU").every(o => o.priceFreshness === "STALE"));
      await db.query(`UPDATE "RecommendationEvidence" SET "observedAt"=now()-interval '10 days',"validUntil"=now()-interval '1 day' WHERE "sourceId"=$1`, [ids.source]);
      assert.equal((await publicBoots()).find(x => x.id === ids.a)!.offers.length, 0, "expired prices are never shown as current");
    });

    await t.test("D5 concurrency: one running job per source; expired leases are recovered", async () => {
      await feed("d5-main", [product("a", { observedAt: iso(60) })]);
      await ready(ids.source);
      const fire = (who: Browser) => post(who, `/api/admin/data-sources/${ids.source}/sync`, { mode: "RUN", requestId: randomUUID(), confirmed: true }).then(async r => ({ status: r.status, body: await r.json() }));
      const results = await Promise.all([fire(admins[1]), fire(admins[2])]);
      assert.deepEqual(results.map(r => r.body.status).sort(), ["SKIPPED", "SUCCEEDED"], JSON.stringify(results));
      assert.ok(["ALREADY_RUNNING", "MIN_INTERVAL"].includes(results.find(r => r.body.status === "SKIPPED")!.body.reason));
      await db.query(`INSERT INTO "SourceSyncJob"(id,"sourceId",trigger,"entryPoint","idempotencyKey","leaseOwner","leaseExpiresAt",status) VALUES('d5-crashed',$1,'SCHEDULED','scheduler','crashed-worker-key','dead-worker',now()-interval '1 minute','RUNNING')`, [ids.source]);
      const r = await run(ids.source);
      assert.equal(r.status, "SUCCEEDED");
      assert.equal((await db.query(`SELECT status,"errorCategory" FROM "SourceSyncJob" WHERE id='d5-crashed'`)).rows[0].status, "ABANDONED");
      assert.equal((await db.query(`SELECT "syncFailureCount" FROM "ProductSource" WHERE id=$1`, [ids.source])).rows[0].syncFailureCount, 0, "reset by the successful run");
    });

    await t.test("D5 failures: rate limit, authorization, malformed feed, database failure; backoff and alerts", async () => {
      assert.equal((await configure(ids.failing, "fixture:d5-failing")).status, 200);
      await feed("d5-failing", [], "SNAPSHOT", { status: 429, retryAfterSeconds: 3600 });
      let r = await run(ids.failing);
      assert.equal(r.status, "FAILED"); assert.equal(r.errorCategory, "RATE_LIMITED");
      const src = (await db.query(`SELECT "backoffUntil","syncFailureCount" FROM "ProductSource" WHERE id=$1`, [ids.failing])).rows[0];
      assert.ok(new Date(src.backoffUntil).getTime() - Date.now() > 55 * 60_000, "provider Retry-After honoured");
      const blocked = await json<{ status: string; reason: string }>(await post(nextAdmin(), `/api/admin/data-sources/${ids.failing}/sync`, { mode: "RUN", requestId: randomUUID(), confirmed: true }), 409);
      assert.equal(blocked.reason, "BACKOFF", "manual runs cannot bypass provider backoff");
      await feed("d5-failing", [], "SNAPSHOT", { status: 503 });
      r = await run(ids.failing); assert.equal(r.errorCategory, "UNAVAILABLE");
      await writeFile(join(fixtureDir, "d5-failing.json"), "{not json");
      r = await run(ids.failing); assert.equal(r.errorCategory, "INVALID_FEED");
      const alerts = (await detail(ids.failing)).alerts;
      assert.ok(alerts.some(a => a.kind === "REPEATED_FAILURES" && a.status === "OPEN" && a.delivery === "LOGGED"), JSON.stringify(alerts));
      assert.equal((await detail(ids.failing)).source.health, "FAILING");
      await feed("d5-failing", [], "SNAPSHOT", { status: 401 });
      r = await run(ids.failing); assert.equal(r.errorCategory, "AUTHORIZATION");
      const auth = (await detail(ids.failing)).alerts.find(a => a.kind === "AUTHORIZATION_EXPIRED")!;
      assert.equal((await post(admin, `/api/admin/source-alerts/${auth.id}`, { action: "ACKNOWLEDGE" }, "PATCH")).status, 200);
      assert.ok(!JSON.stringify(await detail(ids.failing)).includes("synthetic-secret"), "no provider text stored");
      // Mostly-invalid feeds are refused entirely.
      await feed("d5-failing", [{ kind: "product" }, { kind: "offer" }, { kind: "html" }, product("ok-1")]);
      r = await run(ids.failing); assert.equal(r.errorCategory, "INVALID_FEED");
      assert.equal(await entryOf("ok-1"), undefined);
      // Database failure mid-write rolls everything back.
      await feed("d5-failing", [product("rollback-1", { brand: "Synthetic D5 rollback brand" })]);
      await db.query(`ALTER TABLE "SourceSyncChange" ADD CONSTRAINT d5_failure_probe CHECK (kind<>'NEW_PRODUCT') NOT VALID`);
      try { r = await run(ids.failing); } finally { await db.query(`ALTER TABLE "SourceSyncChange" DROP CONSTRAINT d5_failure_probe`); }
      assert.equal(r.status, "FAILED"); assert.ok(["DATABASE", "BUSY"].includes(r.errorCategory!), r.errorCategory);
      assert.equal(await count(`SELECT count(*)::int n FROM "BootBrand" WHERE name='Synthetic D5 rollback brand'`), 0, "no partial writes");
    });

    await t.test("D5 preview and CLI entrypoints never write catalogue data", async () => {
      await feed("d5-main", [product("preview-only", { brand: "Synthetic D5 preview brand" })]);
      const p = await run(ids.source, "PREVIEW");
      assert.equal(p.status, "SUCCEEDED"); assert.deepEqual(p.preview!.outcomes, { NEW_PRODUCT: 1 });
      assert.equal(await count(`SELECT count(*)::int n FROM "BootBrand" WHERE name='Synthetic D5 preview brand'`), 0);
      const cli = async (...args: string[]) => {
        const child = spawn(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/sync-sources.mts", ...args], { env: { ...ctx.env, NODE_ENV: "test" }, stdio: ["ignore", "pipe", "pipe"] });
        let out = ""; child.stdout.on("data", c => { out += c; });
        const [code] = await once(child, "exit");
        return { code, last: JSON.parse(out.trim().split("\n").filter(l => l.startsWith("{") || l.startsWith("[")).pop() ?? "null") };
      };
      await ready(ids.source);
      const preview = await cli("run", ids.source, "--preview");
      assert.equal(preview.code, 0); assert.equal(preview.last.mode, "PREVIEW");
      assert.equal(await count(`SELECT count(*)::int n FROM "BootBrand" WHERE name='Synthetic D5 preview brand'`), 0);
      const swept = await cli("sweep");
      assert.equal(swept.code, 0); assert.equal(typeof swept.last.recoveredLeases, "number");
      assert.equal(await count(`SELECT count(*)::int n FROM "SourceSyncJob" WHERE "entryPoint"='cli'`), 1);
    });

    await t.test("D5 admin overview derives health from real records", async () => {
      const list = await json<{ sources: { id: string; health: string }[] }>(await admin.request("/api/admin/data-sources"));
      assert.equal(list.sources.find(s => s.id === ids.source)!.health, "HEALTHY");
      assert.equal(list.sources.find(s => s.id === ids.failing)!.health, "FAILING");
      assert.equal(list.sources.find(s => s.id === ids.unknown)!.health, "DISABLED");
    });
  } finally {
    const entries = (await db.query(`SELECT "entryId" FROM "ProductSourceRecord" WHERE "sourceId"=ANY($1) AND "entryId" IS NOT NULL`, [[ids.source, ids.failing]])).rows.map(r => r.entryId);
    await db.query(`DELETE FROM "SourceAlert" WHERE "sourceId"=ANY($1)`, [Object.values(ids)]);
    await db.query(`DELETE FROM "RecommendationEvidence" WHERE "sourceId"=ANY($1)`, [Object.values(ids)]);
    await db.query(`DELETE FROM "ProductOffer" WHERE "sourceId"=ANY($1)`, [Object.values(ids)]);
    await db.query(`DELETE FROM "SourceSyncChange" WHERE "sourceId"=ANY($1)`, [Object.values(ids)]);
    if (entries.length) await db.query(`DELETE FROM "CatalogueEntry" WHERE id=ANY($1)`, [entries]);
  }
}
