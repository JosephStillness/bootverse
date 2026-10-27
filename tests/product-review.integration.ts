import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import type pg from "pg";
type Browser = { request(path: string, init?: RequestInit): Promise<Response> };
type Detail = {
  id: string; slug: string; status: string; version: number; fingerprint: string;
  evaluation: { readiness: string; issues: { code: string; severity: string }[]; counts: { blocking: number } };
  duplicates: { candidateId: string; relation: string; skuCaseCollision?: boolean }[];
  conflicts: { attribute: string; claims: { id: string; version: number; status: string; value: unknown }[] }[];
  claims: { id: string; version: number; attribute: string; status: string }[];
  images: { id: string; rights: string; publicEligible: boolean }[];
  history: { kind: string; reason: string; details: Record<string, unknown> }[];
  revisions: { revision: number }[]; preview: { attributes: { attribute: string; value: string }[] };
};

// D4 approval/publication regression. Synthetic isolated fixtures only; never real products, claims or licences.
export async function productReviewTests(t: TestContext, { db, base, admin, second, member, memberId, adminId }: { db: pg.Client; base: string; admin: Browser; second: Browser; member: Browser; memberId: string; adminId: string }) {
  const reason = "Synthetic isolated D4 QA decision; no real product evidence.";
  const post = (who: Browser, path: string, body: unknown, method = "POST") => who.request(path, { method, body: JSON.stringify(body) });
  const json = async <T = Record<string, unknown>>(r: Response, status = 200): Promise<T> => { const text = await r.text(); assert.equal(r.status, status, text); return JSON.parse(text) as T; };
  const detail = async (id: string, who = admin) => json<Detail>(await who.request(`/api/admin/product-reviews/${id}`));
  const codes = (d: Detail) => d.evaluation.issues.map(i => `${i.severity}:${i.code}`);
  const act = async (id: string, action: string, extra: Record<string, unknown> = {}, who = admin) => {
    const d = await detail(id, who);
    return post(who, `/api/admin/product-reviews/${id}/transitions`, { action, version: d.version, reason, reviewFingerprint: d.fingerprint, requestId: randomUUID(), ...extra });
  };
  const attest = { identityConfirmed: true, evidenceChecked: true };
  const ids: Record<string, string> = {};
  const sources: string[] = [];
  const observedAt = new Date(Date.now() - 3600_000).toISOString();
  const addClaim = async (id: string, sourceId: string, attribute: string, value: unknown) => json<{ id: string }>(await post(admin, `/api/admin/products/${id}/records`, { kind: "claim", data: { entryId: id, sourceId, sourceUrl: "https://example.test/d4-spec", attribute, value, basis: "REPORTED", observedAt } }), 201);
  const decide = (claimId: string, status: string, version: number) => post(admin, `/api/admin/product-claims/${claimId}`, { status, version, note: reason, sourceChecked: true }, "PATCH");
  const markConflicted = async (claimId: string) => { assert.equal((await decide(claimId, "PENDING_REVIEW", 1)).status, 200); assert.equal((await decide(claimId, "CONFLICTED", 2)).status, 200); };
  const publicIds = async () => ((await (await fetch(`${base}/api/boots?q=Synthetic%20D4`)).json()).boots as { id: string }[]).map(b => b.id);

  await db.query(`UPDATE "User" SET role='ADMIN' WHERE id=$1`, [adminId]);
  try {
    await t.test("D4 setup: synthetic brand, sources and exact FG/AG, Elite/Pro and generation variants", async () => {
      const brand = await json<{ id: string }>(await post(admin, "/api/admin/product-brands", { name: "Synthetic D4 brand", slug: "synthetic-d4-brand" }), 201);
      const doc = { authorizationStatus: "NOT_REQUIRED", permissionNotes: reason, permissionUrl: "https://example.test/d4-policy" };
      const manual = await json<{ id: string }>(await post(admin, "/api/admin/product-sources", { name: "Synthetic D4 research", type: "MANUAL_RESEARCH", baseUrl: "https://example.test", accessMethod: "Manual research", ...doc }), 201);
      const retail = await json<{ id: string }>(await post(admin, "/api/admin/product-sources", { name: "Synthetic D4 retailer", type: "RETAILER", baseUrl: "https://example.test", accessMethod: "Manual research", ...doc }), 201);
      const images = await json<{ id: string }>(await post(admin, "/api/admin/product-sources", { name: "Synthetic D4 image licensor", type: "OTHER", baseUrl: "https://example.test", accessMethod: "Written licence", ...doc, authorizationStatus: "GRANTED" }), 201);
      ids.source = manual.id; ids.retail = retail.id; ids.imageSource = images.id; sources.push(manual.id, retail.id, images.id);
      await db.query(`INSERT INTO "BootFamily"(id,"brandId",name) VALUES('d4-family',$1,'Synthetic D4 family')`, [brand.id]);
      await db.query(`INSERT INTO "BootGeneration"(id,"familyId",name) VALUES('d4-gen-1','d4-family','Gen 1'),('d4-gen-2','d4-family','Gen 2')`);
      await db.query(`INSERT INTO "BootTier"(id,"generationId",name) VALUES('d4-elite','d4-gen-1','Elite'),('d4-pro','d4-gen-1','Pro'),('d4-unknown','d4-gen-1','Unknown'),('d4-elite-2','d4-gen-2','Elite')`);
      await db.query(`INSERT INTO "BootVariant"(id,"tierModelId","generationId",surface,"manufacturerOutsole") VALUES
        ('d4-elite-fg','d4-elite','d4-gen-1','FG','FG'),('d4-elite-ag','d4-elite','d4-gen-1','AG','AG'),('d4-pro-fg','d4-pro','d4-gen-1','FG',NULL),
        ('d4-elite-fg-b','d4-elite','d4-gen-1','FG',NULL),('d4-unknown-fg','d4-unknown','d4-gen-1','FG',NULL),('d4-elite-null','d4-elite','d4-gen-1',NULL,NULL),
        ('d4-g2-elite-fg','d4-elite-2','d4-gen-2','FG',NULL)`);
      await db.query(`INSERT INTO "BootColorway"(id,"generationId",name) VALUES('d4-blue','d4-gen-1','Synthetic D4 blue'),('d4-red','d4-gen-1','Synthetic D4 red'),('d4-blue-2','d4-gen-2','Synthetic D4 blue')`);
      const make = async (key: string, variantId: string, colorwayId: string) => { ids[key] = (await json<{ id: string }>(await post(admin, "/api/admin/products", { slug: `synthetic-d4-${key}`, variantId, colorwayId, sourceId: manual.id }), 201)).id; };
      await make("a", "d4-elite-fg", "d4-blue"); await make("b", "d4-elite-ag", "d4-blue"); await make("c", "d4-pro-fg", "d4-blue"); await make("d", "d4-g2-elite-fg", "d4-blue-2");
      await make("e", "d4-elite-fg-b", "d4-blue"); await make("f", "d4-unknown-fg", "d4-blue"); await make("g", "d4-elite-null", "d4-blue"); await make("h", "d4-elite-fg", "d4-red");
      await make("i", "d4-pro-fg", "d4-red"); await make("j", "d4-elite-ag", "d4-red");
    });

    await t.test("D4 review APIs reject anonymous, member, moderator, cross-origin and forged-state access", async () => {
      for (const path of ["/api/admin/product-reviews", "/api/admin/product-reviews/summary", `/api/admin/product-reviews/${ids.a}`]) {
        assert.equal((await fetch(base + path)).status, 401);
        assert.equal((await member.request(path)).status, 403);
      }
      assert.equal((await fetch(`${base}/api/admin/product-reviews/${ids.a}/transitions`, { method: "POST", body: "{}" })).status, 403);
      assert.equal((await post(member, `/api/admin/product-reviews/${ids.a}/transitions`, { action: "SUBMIT", version: 1, reason })).status, 403);
      assert.equal((await post(member, "/api/admin/product-reviews/bulk", { action: "PREVIEW", items: [{ id: ids.a }] })).status, 403);
      await db.query(`UPDATE "User" SET role='MODERATOR' WHERE id=$1`, [memberId]);
      try { assert.equal((await post(member, "/api/admin/product-reviews/bulk", { action: "PREVIEW", items: [{ id: ids.a }] })).status, 403); }
      finally { await db.query(`UPDATE "User" SET role='USER' WHERE id=$1`, [memberId]); }
      assert.equal((await admin.request(`/api/admin/product-reviews/${ids.a}/transitions`, { method: "POST", headers: { Origin: "https://evil.example.test" }, body: "{}" })).status, 403);
      assert.equal((await post(admin, `/api/admin/product-reviews/${ids.a}/transitions`, { action: "SUBMIT", version: 1, reason, status: "PUBLISHED" })).status, 400);
      assert.equal((await post(admin, `/api/admin/product-reviews/${ids.a}/transitions`, { action: "APPROVE", version: 1, reason })).status, 400);
      assert.equal((await admin.request("/api/admin/product-reviews?page=0")).status, 400);
    });

    await t.test("D4 validation blocks missing/unknown identity but not missing optional specifications", async () => {
      const f = await detail(ids.f);
      assert.equal(f.evaluation.readiness, "BLOCKED"); assert.ok(codes(f).includes("BLOCKING_ERROR:unknown_tier"));
      assert.equal((await act(ids.f, "SUBMIT")).status, 400);
      const g = await detail(ids.g);
      assert.ok(codes(g).includes("BLOCKING_ERROR:unknown_outsole")); assert.equal(g.evaluation.readiness, "BLOCKED");
      const h = await detail(ids.h);
      assert.equal(h.evaluation.readiness, "READY_FOR_REVIEW");
      assert.ok(codes(h).includes("INFORMATION:missing_optional_specifications"));
      assert.ok(codes(h).includes("WARNING:missing_sku")); assert.ok(codes(h).includes("WARNING:placeholder_image"));
      await db.query(`UPDATE "BootVariant" SET "manufacturerOutsole"='Artificial Grass' WHERE id='d4-elite-fg'`);
      try { assert.ok(codes(await detail(ids.h)).includes("BLOCKING_ERROR:outsole_inconsistent")); }
      finally { await db.query(`UPDATE "BootVariant" SET "manufacturerOutsole"='FG' WHERE id='d4-elite-fg'`); }
    });

    await t.test("D4 duplicate detection separates Elite/Pro, FG/AG, generations and SKU case collisions", async () => {
      const a = await detail(ids.a);
      assert.deepEqual(a.duplicates.find(d => d.candidateId === ids.e)?.relation, "SAME_IDENTITY");
      assert.ok(codes(a).includes("BLOCKING_ERROR:possible_duplicate")); assert.equal(a.evaluation.readiness, "NEEDS_CORRECTION");
      assert.equal(a.duplicates.find(d => d.candidateId === ids.b)?.relation, "DIFFERENT_OUTSOLE");
      assert.equal(a.duplicates.find(d => d.candidateId === ids.c)?.relation, "DIFFERENT_TIER");
      assert.equal(a.duplicates.find(d => d.candidateId === ids.d)?.relation, "DIFFERENT_GENERATION");
      const sku = { value: "SYN-D4-SKU", region: "AU", sourceId: ids.source, sourceUrl: "https://example.test/d4-sku" };
      await json(await post(admin, `/api/admin/products/${ids.a}/records`, { kind: "identifier", data: sku }), 201);
      assert.equal((await post(admin, `/api/admin/products/${ids.b}/records`, { kind: "identifier", data: sku })).status, 409, "exact duplicate SKU is refused at write time");
      await json(await post(admin, `/api/admin/products/${ids.b}/records`, { kind: "identifier", data: { ...sku, value: "syn-d4-sku" } }), 201);
      const b = await detail(ids.b);
      assert.ok(b.duplicates.find(d => d.candidateId === ids.a)?.skuCaseCollision); assert.ok(codes(b).includes("WARNING:sku_case_collision"));
      assert.equal(b.evaluation.counts.blocking, 0, "FG and AG remain separate, publishable products");
      // A different-tier candidate can never be linked.
      const e = await detail(ids.e);
      assert.equal((await post(admin, `/api/admin/product-reviews/${ids.e}/duplicates`, { outcome: "LINK_EXISTING", targetEntryId: ids.c, version: e.version, reviewFingerprint: e.fingerprint, reason })).status, 400);
      const linked = await json<{ status: string }>(await post(admin, `/api/admin/product-reviews/${ids.e}/duplicates`, { outcome: "LINK_EXISTING", targetEntryId: ids.a, version: e.version, reviewFingerprint: e.fingerprint, reason, requestId: randomUUID() }));
      assert.equal(linked.status, "REJECTED");
      assert.equal((await db.query(`SELECT count(*)::int n FROM "CatalogueEntry" WHERE id=ANY($1)`, [[ids.a, ids.e]])).rows[0].n, 2, "no destructive merge");
      assert.equal((await detail(ids.a)).evaluation.counts.blocking, 0);
    });

    await t.test("D4 lifecycle: submit, stale-review protection, attested approval, idempotent replay and public visibility", async () => {
      assert.ok(!(await publicIds()).includes(ids.a));
      assert.equal((await fetch(`${base}/boots/synthetic-d4-a`)).status, 404);
      const submitted = await json<{ entry: { status: string } }>(await act(ids.a, "SUBMIT"));
      assert.equal(submitted.entry.status, "PENDING_REVIEW");
      assert.ok((await db.query(`SELECT "submittedAt" FROM "CatalogueEntry" WHERE id=$1`, [ids.a])).rows[0].submittedAt);
      assert.equal((await fetch(`${base}/boots/synthetic-d4-a`)).status, 404, "pending products stay private");
      const seen = await detail(ids.a);
      assert.equal(seen.evaluation.readiness, "READY_FOR_APPROVAL");
      await addClaim(ids.a, ids.source, "weight", { amount: 190, unit: "g", size: "8", sizeSystem: "UK" });
      const stale = await post(admin, `/api/admin/product-reviews/${ids.a}/transitions`, { action: "APPROVE", version: seen.version, reason, reviewFingerprint: seen.fingerprint, requestId: randomUUID(), ...attest });
      assert.equal(stale.status, 409, "new evidence after review invalidates the approval");
      assert.equal((await act(ids.a, "APPROVE")).status, 400, "approval requires explicit identity/evidence attestation");
      const fresh = await detail(ids.a), requestId = randomUUID();
      const body = { action: "APPROVE", version: fresh.version, reason, reviewFingerprint: fresh.fingerprint, requestId, ...attest };
      const approved = await json<{ entry: { status: string; slug: string }; replayed: boolean }>(await post(admin, `/api/admin/product-reviews/${ids.a}/transitions`, body));
      assert.equal(approved.entry.status, "PUBLISHED"); assert.equal(approved.replayed, false);
      const replay = await json<{ replayed: boolean }>(await post(admin, `/api/admin/product-reviews/${ids.a}/transitions`, body));
      assert.equal(replay.replayed, true);
      assert.equal((await post(admin, `/api/admin/product-reviews/${ids.a}/transitions`, { ...body, reason: `${reason} changed` })).status, 409, "same request ID with a different payload is refused");
      assert.equal((await act(ids.a, "APPROVE", attest)).status, 409, "already published: duplicate publication is refused");
      assert.equal((await db.query(`SELECT count(*)::int n FROM "ProductReviewDecision" WHERE "entryId"=$1 AND kind='APPROVE'`, [ids.a])).rows[0].n, 1);
      assert.equal((await db.query(`SELECT count(*)::int n FROM "ProductRevision" WHERE "entryId"=$1`, [ids.a])).rows[0].n, 1);
      assert.ok((await publicIds()).includes(ids.a));
      assert.equal((await fetch(`${base}/boots/synthetic-d4-a`)).status, 200);
      assert.ok((await db.query(`SELECT 1 FROM "ModerationAction" WHERE "targetKey"=$1 AND action='PRODUCT_STATUS'`, [`PRODUCT:${ids.a}`])).rowCount);
    });

    await t.test("D4 invalid transitions, rejection, return for correction and reopening", async () => {
      assert.equal((await act(ids.h, "ARCHIVE")).status, 409);
      assert.equal((await act(ids.h, "APPROVE", attest)).status, 409);
      assert.equal((await act(ids.a, "REOPEN")).status, 409);
      assert.equal((await post(admin, `/api/admin/products/${ids.h}`, { status: "PUBLISHED", version: (await detail(ids.h)).version, note: reason, ...attest }, "PATCH")).status, 409, "legacy PATCH cannot skip review");
      await json(await act(ids.h, "SUBMIT"));
      assert.equal((await act(ids.h, "RETURN", { reason: "short" })).status, 400, "a reason is required");
      assert.equal((await json<{ entry: { status: string } }>(await act(ids.h, "RETURN"))).entry.status, "DRAFT");
      await json(await act(ids.h, "SUBMIT"));
      assert.equal((await json<{ entry: { status: string } }>(await act(ids.h, "REJECT"))).entry.status, "REJECTED");
      assert.equal((await fetch(`${base}/boots/synthetic-d4-h`)).status, 404);
      assert.ok(!(await publicIds()).includes(ids.h));
      assert.equal((await json<{ entry: { status: string } }>(await act(ids.h, "REOPEN"))).entry.status, "DRAFT");
      const kinds = (await detail(ids.h)).history.map(h => h.kind);
      for (const kind of ["SUBMIT", "RETURN", "REJECT", "REOPEN"]) assert.ok(kinds.includes(kind), kind);
    });

    await t.test("D4 hidden drafts are not exposed by direct URL, search, comparison or ratings", async () => {
      assert.equal((await fetch(`${base}/boots/synthetic-d4-b`)).status, 404);
      assert.ok(!(await publicIds()).includes(ids.b));
      assert.match(await (await fetch(`${base}/compare?boot=${ids.b}`)).text(), /omitted|unpublished/i);
      assert.notEqual((await fetch(`${base}/api/boot-variants/d4-elite-ag/ratings`)).status, 200);
    });

    await t.test("D4 conflicts: published value preserved, side-by-side resolution keeps history and records revisions", async () => {
      const knit = await addClaim(ids.a, ids.source, "upperMaterial", "Synthetic D4 knit");
      let a = await detail(ids.a);
      const versions = (attribute: string, d: Detail) => Object.fromEntries(d.claims.filter(c => c.attribute === attribute).map(c => [c.id, c.version]));
      assert.equal((await post(admin, `/api/admin/product-reviews/${ids.a}/conflicts`, { attribute: "upperMaterial", action: "SELECT", claimId: knit.id, claimVersions: versions("upperMaterial", a), reason })).status, 400, "selection requires a source check");
      await json(await post(admin, `/api/admin/product-reviews/${ids.a}/conflicts`, { attribute: "upperMaterial", action: "SELECT", claimId: knit.id, claimVersions: versions("upperMaterial", a), reason, sourceChecked: true }));
      const page = async () => (await (await fetch(`${base}/boots/synthetic-d4-a`)).text());
      assert.match(await page(), /Synthetic D4 knit/);
      assert.equal((await detail(ids.a)).revisions.length, 2, "approved public change creates a revision");
      const leather = await addClaim(ids.a, ids.retail, "upperMaterial", "Synthetic D4 retailer leather");
      await markConflicted(leather.id);
      a = await detail(ids.a);
      assert.equal(a.status, "PUBLISHED", "a disagreeing source never unpublishes");
      assert.match(await page(), /Synthetic D4 knit/, "lower-trust incoming data does not overwrite the verified value");
      assert.doesNotMatch(await page(), /retailer leather/);
      assert.ok(codes(a).includes("BLOCKING_ERROR:unresolved_conflict"));
      const group = a.conflicts.find(g => g.attribute === "upperMaterial")!;
      assert.equal(group.claims.length, 2);
      assert.equal((await post(admin, `/api/admin/product-reviews/${ids.a}/conflicts`, { attribute: "upperMaterial", action: "SELECT", claimId: knit.id, claimVersions: { [knit.id]: 1 }, reason, sourceChecked: true })).status, 409, "stale comparison is refused");
      const resolved = await json<{ changes: { id: string; to: string }[] }>(await post(admin, `/api/admin/product-reviews/${ids.a}/conflicts`, { attribute: "upperMaterial", action: "SELECT", claimId: knit.id, claimVersions: versions("upperMaterial", a), reason, sourceChecked: true }));
      assert.deepEqual(resolved.changes.map(c => [c.id, c.to]), [[leather.id, "REJECTED"]]);
      const kept = await db.query(`SELECT status,value FROM "ProductClaim" WHERE id=$1`, [leather.id]);
      assert.equal(kept.rows[0].status, "REJECTED"); assert.equal(kept.rows[0].value, "Synthetic D4 retailer leather", "contradictory evidence is preserved");
      const decision = (await detail(ids.a)).history.find(h => h.kind === "CONFLICT_RESOLUTION")!;
      assert.ok(decision.details.selected && decision.details.observations);
      assert.equal((await detail(ids.a)).evaluation.counts.blocking, 0);
      // Weights for different sizes are context, not contradiction.
      await addClaim(ids.a, ids.source, "weight", { amount: 205, unit: "g", size: "9", sizeSystem: "UK" });
      const weights = await detail(ids.a);
      assert.ok(!weights.conflicts.some(g => g.attribute === "weight")); assert.ok(codes(weights).includes("INFORMATION:measurement_context_differs"));
    });

    await t.test("D4 image rights: confirmed, revoked-source blocking and safe placeholder publication", async () => {
      const add = async (id: string, sourceId: string) => json<{ id: string }>(await post(admin, `/api/admin/products/${id}/records`, { kind: "image", data: { sourceId, sourceUrl: "https://example.test/d4-photo", externalUrl: `https://example.test/${id}.webp`, altText: "Synthetic D4 image", attribution: "Synthetic licensor", licenseStatus: "GRANTED", permissionNotes: reason, permissionUrl: "https://example.test/d4-licence", isPrimary: true } }), 201);
      const image = await add(ids.b, ids.imageSource);
      for (const [status, version] of [["PENDING_REVIEW", 1], ["VERIFIED", 2]] as const) assert.equal((await post(admin, `/api/admin/product-images/${image.id}`, { status, version, note: reason, sourceChecked: true }, "PATCH")).status, 200);
      assert.equal((await detail(ids.b)).images[0].rights, "PERMISSION_CONFIRMED");
      await db.query(`UPDATE "ProductSource" SET "authorizationStatus"='DENIED' WHERE id=$1`, [ids.imageSource]);
      try {
        const b = await detail(ids.b);
        assert.equal(b.images[0].rights, "PERMISSION_DENIED"); assert.equal(b.images[0].publicEligible, false);
        assert.ok(codes(b).includes("BLOCKING_ERROR:image_rights_invalid"));
      } finally { await db.query(`UPDATE "ProductSource" SET "authorizationStatus"='GRANTED' WHERE id=$1`, [ids.imageSource]); }
      const unknown = await json<{ id: string }>(await post(admin, `/api/admin/products/${ids.c}/records`, { kind: "image", data: { sourceId: ids.imageSource, sourceUrl: "https://example.test/d4-photo", externalUrl: "https://example.test/d4-unlicensed.webp", altText: "Synthetic D4 pending image", attribution: "Unknown", isPrimary: true } }), 201);
      const c = await detail(ids.c);
      assert.equal(c.images.find(i => i.id === unknown.id)?.rights, "PERMISSION_PENDING");
      assert.ok(codes(c).includes("WARNING:placeholder_image")); assert.equal(c.evaluation.counts.blocking, 0, "no authorized image still allows a placeholder");
    });

    await t.test("D4 publication revalidates immediately before commit and serializes concurrent approvals", async () => {
      await json(await act(ids.c, "SUBMIT"));
      const seen = await detail(ids.c);
      const [x, y] = await Promise.all([admin, second].map(who => post(who, `/api/admin/product-reviews/${ids.c}/transitions`, { action: "APPROVE", version: seen.version, reason, reviewFingerprint: seen.fingerprint, requestId: randomUUID(), ...attest })));
      assert.deepEqual([x.status, y.status].sort(), [200, 409]);
      assert.equal((await db.query(`SELECT count(*)::int n FROM "ProductReviewDecision" WHERE "entryId"=$1 AND kind='APPROVE'`, [ids.c])).rows[0].n, 1);
      await json(await act(ids.b, "SUBMIT"));
      const one = await addClaim(ids.b, ids.source, "closureSystem", "Synthetic D4 laces");
      const two = await addClaim(ids.b, ids.retail, "closureSystem", "Synthetic D4 laceless");
      await markConflicted(two.id); void one;
      assert.equal((await act(ids.b, "APPROVE", attest)).status, 400, "unresolved conflict blocks publication server-side");
      assert.equal((await detail(ids.b)).status, "PENDING_REVIEW");
    });

    await t.test("D4 failed publication rolls back status, decision and revision together", async () => {
      await json(await act(ids.d, "SUBMIT"));
      const before = await detail(ids.d);
      const probe = "Synthetic D4 rollback probe reason";
      await db.query(`ALTER TABLE "ProductRevision" ADD CONSTRAINT d4_rollback_probe CHECK (reason <> '${probe}') NOT VALID`);
      try {
        const r = await post(admin, `/api/admin/product-reviews/${ids.d}/transitions`, { action: "APPROVE", version: before.version, reason: probe, reviewFingerprint: before.fingerprint, requestId: randomUUID(), ...attest });
        assert.ok(r.status >= 500, `expected failure, got ${r.status}`);
      } finally { await db.query(`ALTER TABLE "ProductRevision" DROP CONSTRAINT d4_rollback_probe`); }
      const after = await detail(ids.d);
      assert.equal(after.status, "PENDING_REVIEW"); assert.equal(after.version, before.version);
      assert.equal((await db.query(`SELECT count(*)::int n FROM "ProductReviewDecision" WHERE "entryId"=$1 AND kind='APPROVE'`, [ids.d])).rows[0].n, 0);
      assert.ok(!(await publicIds()).includes(ids.d));
    });

    await t.test("D4 bulk review reports mixed outcomes, enforces limits/confirmation and is idempotent", async () => {
      await json(await act(ids.i, "SUBMIT"));
      await json(await act(ids.j, "SUBMIT"));
      const conflict = await addClaim(ids.j, ids.source, "collarType", "Synthetic D4 mid collar");
      await addClaim(ids.j, ids.retail, "collarType", "Synthetic D4 low collar"); await markConflicted(conflict.id);
      const items = [ids.i, ids.j, ids.h].map(id => ({ id }));
      const preview = await json<{ results: { id: string; version: number; fingerprint: string; eligible: boolean }[] }>(await post(admin, "/api/admin/product-reviews/bulk", { action: "PREVIEW", items }));
      assert.deepEqual(preview.results.map(r => r.eligible), [true, false, false]);
      const reviewed = preview.results.map(r => ({ id: r.id, version: r.version, reviewFingerprint: r.fingerprint }));
      assert.equal((await post(admin, "/api/admin/product-reviews/bulk", { action: "APPROVE", items: reviewed, reason, requestId: randomUUID(), ...attest })).status, 400, "explicit confirmation is required");
      assert.equal((await post(admin, "/api/admin/product-reviews/bulk", { action: "PREVIEW", items: Array.from({ length: 26 }, (_, n) => ({ id: `d4-limit-${n}` })) })).status, 400);
      assert.equal((await post(member, "/api/admin/product-reviews/bulk", { action: "APPROVE", items: reviewed, reason, requestId: randomUUID(), confirmed: true, ...attest })).status, 403);
      const body = { action: "APPROVE", items: reviewed, reason, requestId: randomUUID(), confirmed: true, ...attest };
      const first = await json<{ results: { id: string; outcome: string }[]; counts: Record<string, number> }>(await post(admin, "/api/admin/product-reviews/bulk", body));
      assert.deepEqual(first.results.map(r => r.outcome), ["APPROVED", "SKIPPED_BLOCKED", "SKIPPED_STATUS"]);
      const again = await json<{ results: { outcome: string }[] }>(await post(admin, "/api/admin/product-reviews/bulk", body));
      assert.equal(again.results[0].outcome, "ALREADY_APPLIED");
      assert.ok((await publicIds()).includes(ids.i)); assert.ok(!(await publicIds()).includes(ids.j));
    });

    await t.test("D4 archive preserves review associations and stable URLs; republishing keeps identity", async () => {
      await db.query(`INSERT INTO "User"(id,email,"updatedAt") VALUES('d4-reviewer','d4-reviewer@example.test',now()) ON CONFLICT DO NOTHING`);
      await db.query(`INSERT INTO "BootReview"(id,"authorId","variantId","sizeWorn","sizeSystem","ownershipMonths","matchesPlayed",experience,pros,cons,comfort,fit,traction,"ballTouch",durability,value,"ratingTotal","updatedAt") VALUES('d4-review','d4-reviewer','d4-elite-fg','9','UK',1,1,'Synthetic D4 regression fixture only; not a real community review.','QA pros','QA cons',3,3,3,3,3,3,18,now())`);
      const ratings = async () => (await fetch(`${base}/api/boot-variants/d4-elite-fg/ratings`)).status;
      assert.equal(await ratings(), 200);
      await json(await act(ids.a, "ARCHIVE"));
      assert.equal((await fetch(`${base}/boots/synthetic-d4-a`)).status, 404);
      assert.ok(!(await publicIds()).includes(ids.a));
      assert.equal((await db.query(`SELECT count(*)::int n FROM "BootReview" WHERE id='d4-review' AND "variantId"='d4-elite-fg'`)).rows[0].n, 1, "review retained");
      await assert.rejects(db.query(`UPDATE "CatalogueEntry" SET slug='synthetic-d4-renamed' WHERE id=$1`, [ids.a]), /immutable/);
      await json(await act(ids.a, "RESUBMIT"));
      await json(await act(ids.a, "APPROVE", attest));
      const row = (await db.query(`SELECT slug,"outsoleVariantId" FROM "CatalogueEntry" WHERE id=$1`, [ids.a])).rows[0];
      assert.deepEqual(row, { slug: "synthetic-d4-a", outsoleVariantId: "d4-elite-fg" });
      assert.equal((await fetch(`${base}/boots/synthetic-d4-a`)).status, 200); assert.equal(await ratings(), 200);
    });

    await t.test("D4 private review notes, audit immutability and real dashboard counts", async () => {
      const marker = `Private D4 moderation note ${randomUUID()}`;
      await json(await post(admin, `/api/admin/product-reviews/${ids.a}/notes`, { note: marker, version: (await detail(ids.a)).version }));
      assert.ok((await detail(ids.a)).history.some(h => h.reason === marker));
      assert.doesNotMatch(await (await fetch(`${base}/boots/synthetic-d4-a`)).text(), new RegExp(marker));
      assert.doesNotMatch(await (await fetch(`${base}/api/boots?q=Synthetic%20D4`)).text(), new RegExp(marker));
      await assert.rejects(db.query(`UPDATE "ProductReviewDecision" SET reason='Tampered synthetic reason' WHERE "entryId"=$1`, [ids.a]), /append-only/);
      await assert.rejects(db.query(`DELETE FROM "ProductReviewDecision" WHERE "entryId"=$1`, [ids.a]), /append-only/);
      const summary = await json<{ statuses: Record<string, number>; unresolvedConflicts: number; possibleDuplicates: number; missingAuthorizedImages: number }>(await admin.request("/api/admin/product-reviews/summary"));
      const actual = Object.fromEntries((await db.query(`SELECT status::text,count(*)::int n FROM "CatalogueEntry" GROUP BY status`)).rows.map(r => [r.status, r.n]));
      for (const status of ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"]) assert.equal(summary.statuses[status], actual[status] ?? 0, status);
      assert.ok(summary.unresolvedConflicts >= 2); // B and J carry unresolved synthetic conflicts.
      const queue = await json<{ records: { id: string; readiness: string }[]; total: number }>(await admin.request(`/api/admin/product-reviews?q=${encodeURIComponent("Synthetic D4 brand")}&status=PENDING_REVIEW`));
      assert.deepEqual(new Set(queue.records.map(r => r.id)), new Set([ids.b, ids.d, ids.j]));
      const bySku = await json<{ records: { id: string }[] }>(await admin.request("/api/admin/product-reviews?q=SYN-D4-SKU"));
      assert.ok(bySku.records.some(r => r.id === ids.a));
      const conflicts = await json<{ records: { id: string }[] }>(await admin.request("/api/admin/product-reviews?quality=conflicts&q=synthetic-d4"));
      assert.ok(conflicts.records.some(r => r.id === ids.b) && !conflicts.records.some(r => r.id === ids.a));
      const bySource = await json<{ total: number }>(await admin.request(`/api/admin/product-reviews?sourceId=${ids.source}`));
      assert.equal(bySource.total, 10);
    });

    await t.test("D4 duplicate detection reports candidates for every product on a page, even in a large identity group", async () => {
      await db.query(`INSERT INTO "BootGeneration"(id,"familyId",name) VALUES('d4-gen-dup','d4-family','Gen dup')`);
      await db.query(`INSERT INTO "BootTier"(id,"generationId",name) VALUES('d4-dup-tier','d4-gen-dup','Elite')`);
      await db.query(`INSERT INTO "BootVariant"(id,"tierModelId","generationId",surface) SELECT 'd4-dup-v'||n,'d4-dup-tier','d4-gen-dup','FG' FROM generate_series(1,60) n`);
      await db.query(`INSERT INTO "BootColorway"(id,"generationId",name) SELECT 'd4-dup-c'||n,'d4-gen-dup','Synthetic D4 shared colour' FROM generate_series(1,60) n`);
      await db.query(`INSERT INTO "CatalogueEntry"(id,slug,"outsoleVariantId","colorwayId","generationId",sample) SELECT 'd4-dup-e'||lpad(n::text,2,'0'),'synthetic-d4-dup-'||lpad(n::text,2,'0'),'d4-dup-v'||n,'d4-dup-c'||n,'d4-gen-dup',false FROM generate_series(1,60) n`);
      const page = await json<{ records: { id: string; readiness: string; counts: { blocking: number } }[] }>(await admin.request("/api/admin/product-reviews?q=synthetic-d4-dup&status=DRAFT&sort=created_desc"));
      assert.equal(page.records.length, 25);
      assert.ok(page.records.every(r => r.counts.blocking > 0 && r.readiness !== "READY_FOR_REVIEW"), "no product on the page may look duplicate-free");
      const summary = await json<{ possibleDuplicates: number }>(await admin.request("/api/admin/product-reviews/summary"));
      assert.ok(summary.possibleDuplicates >= 60);
    });
  } finally {
    await db.query(`DELETE FROM "BootReview" WHERE id='d4-review'`);
    await db.query(`DELETE FROM "User" WHERE id='d4-reviewer'`);
    await db.query(`DELETE FROM "CatalogueEntry" WHERE slug LIKE 'synthetic-d4-%'`);
    await db.query(`DELETE FROM "ProductClaim" WHERE "variantId" LIKE 'd4-%'`);
    await db.query(`DELETE FROM "CatalogueEntry" WHERE id LIKE 'd4-dup-%'`);
    await db.query(`DELETE FROM "BootVariant" WHERE id LIKE 'd4-%'`);
    await db.query(`DELETE FROM "BootColorway" WHERE id LIKE 'd4-%'`);
    await db.query(`DELETE FROM "BootTier" WHERE id LIKE 'd4-%'`);
    await db.query(`DELETE FROM "BootGeneration" WHERE id LIKE 'd4-%'`);
    await db.query(`DELETE FROM "BootFamily" WHERE id='d4-family'`);
  }
}
