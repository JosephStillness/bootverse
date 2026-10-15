import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type pg from "pg";
type Browser = {
  cookies: Map<string, string>;
  request(path: string, init?: RequestInit): Promise<Response>;
};
export async function reviewsTests(
  t: TestContext,
  {
    db,
    base,
    alice,
    bob,
    aliceId,
    bobId,
  }: {
    db: pg.Client;
    base: string;
    alice: Browser;
    bob: Browser;
    aliceId: string;
    bobId: string;
  },
) {
  const variants = (
    await db.query(
      `SELECT id FROM "BootVariant" WHERE id IN ('mercurial-elite-fg','mercurial-elite-ag','mercurial-pro-tf') ORDER BY CASE id WHEN 'mercurial-elite-fg' THEN 1 WHEN 'mercurial-elite-ag' THEN 2 ELSE 3 END`,
    )
  ).rows.map((x) => x.id);
  assert.equal(variants.length, 3);
  const fixture = {
    variantId: variants[0],
    sizeWorn: "9.5",
    sizeSystem: "UK",
    ownershipMonths: 4,
    matchesPlayed: 20,
    experience:
      "Disposable integration review. This is not real community content.",
    pros: "Clear temporary test observations",
    cons: "Temporary limitations for testing",
    comfort: 5,
    fit: 4,
    traction: 3,
    ballTouch: 2,
    durability: 1,
    value: 3,
    footLengthCm: 27.1,
    footWidthCm: 10.2,
    footShape: "wide",
    shareFootInfo: false,
    playingSurface: "AG",
    widthObservation: "slightly-narrow",
  };
  const write = (
    browser: Browser,
    path: string,
    method: string,
    input: unknown,
  ) =>
    browser.request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  const read = async (path: string) => {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    return response.json();
  };
  let id = "",
    second = "",
    other = "",
    otherGeneration = "";
  await t.test(
    "reviews: empty aggregates, authentication, strict validation and origin",
    async () => {
      const zero = await read(`/api/boot-variants/${variants[0]}/ratings`);
      assert.equal(zero.count, 0);
      assert.equal(zero.overall, null);
      assert.ok(Object.values(zero.criteria).every((x) => x === null));
      assert.equal(
        (
          await fetch(base + "/api/reviews", {
            method: "POST",
            headers: { origin: base },
            body: JSON.stringify(fixture),
          })
        ).status,
        401,
      );
      assert.equal(
        (await write(alice, "/api/reviews", "POST", { ...fixture, comfort: 6 }))
          .status,
        400,
      );
      assert.equal(
        (
          await write(alice, "/api/reviews", "POST", {
            ...fixture,
            authorId: bobId,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await fetch(base + "/api/reviews", {
            method: "POST",
            headers: { origin: "https://evil.invalid" },
            body: JSON.stringify(fixture),
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await write(alice, "/api/reviews", "POST", {
            ...fixture,
            variantId: "missing",
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "missing review edit renders a review-specific not-found state",
    async () => {
      const response = await alice.request("/reviews/missing-review/edit");
      const html = await response.text();
      assert.ok(
        html.includes("Review not found."),
        "Missing review must not render a service failure",
      );
    },
  );
  await t.test(
    "reviews: persistence, exact variant, privacy and duplicate race prevention",
    async () => {
      const results = await Promise.all([
        write(alice, "/api/reviews", "POST", fixture),
        write(alice, "/api/reviews", "POST", fixture),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
      id = (await results.find((r) => r.status === 201)!.json()).review.id;
      const stored = (
        await db.query('SELECT * FROM "BootReview" WHERE id=$1', [id])
      ).rows[0];
      assert.equal(stored.variantId, variants[0]);
      assert.equal(stored.ratingTotal, 18);
      assert.equal(stored.authorId, aliceId);
      const publicData = (await read(`/api/reviews/${id}`)).review;
      assert.equal(publicData.foot, null);
      assert.ok(!JSON.stringify(publicData).includes("27.1"));
      assert.ok(!("authorId" in publicData));
      assert.equal(
        (await fetch(`${base}/api/reviews/${id}/owner`)).status,
        401,
      );
      assert.equal((await bob.request(`/api/reviews/${id}/owner`)).status, 403);
      const ownerResponse = await alice.request(`/api/reviews/${id}/owner`);
      assert.ok(
        ownerResponse.headers.get("cache-control")?.includes("no-store"),
      );
      assert.equal((await ownerResponse.json()).input.footLengthCm, 27.1);
      assert.equal(
        (await read(`/api/boot-variants/${variants[1]}/ratings`)).count,
        0,
      );
    },
  );
  await t.test(
    "reviews: ownership, stale edits, consent revocation and recalculation",
    async () => {
      assert.equal(
        (
          await write(bob, `/api/reviews/${id}`, "PATCH", {
            ...fixture,
            version: 1,
          })
        ).status,
        403,
      );
      assert.equal(
        (await write(bob, `/api/reviews/${id}`, "DELETE", { version: 1 }))
          .status,
        403,
      );
      const shared = {
        ...fixture,
        comfort: 1,
        shareFootInfo: true,
        version: 1,
      };
      assert.equal(
        (await write(alice, `/api/reviews/${id}`, "PATCH", shared)).status,
        200,
      );
      assert.equal(
        (await read(`/api/reviews/${id}`)).review.foot.footLengthCm,
        27.1,
      );
      assert.equal(
        (await read(`/api/boot-variants/${variants[0]}/ratings`)).overall,
        14 / 6,
      );
      assert.equal(
        (await write(alice, `/api/reviews/${id}`, "PATCH", shared)).status,
        409,
      );
      assert.equal(
        (
          await write(alice, `/api/reviews/${id}`, "PATCH", {
            ...fixture,
            variantId: variants[1],
            version: 2,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await write(alice, `/api/reviews/${id}`, "PATCH", {
            ...fixture,
            version: 2,
          })
        ).status,
        200,
      );
      assert.equal((await read(`/api/reviews/${id}`)).review.foot, null);
      assert.equal(
        (await read(`/api/reviews?variant=${variants[0]}&shape=wide`)).total,
        0,
      );
    },
  );
  await t.test(
    "reviews: actual aggregates, criterion averages, distribution, filtering and sorting",
    async () => {
      const response = await write(bob, "/api/reviews", "POST", {
        ...fixture,
        comfort: 5,
        fit: 5,
        traction: 5,
        ballTouch: 5,
        durability: 5,
        value: 5,
        sizeWorn: "10",
        sizeSystem: "EU",
        ownershipMonths: 18,
        playingSurface: "FG",
        shareFootInfo: true,
      });
      assert.equal(response.status, 201);
      second = (await response.json()).review.id;
      const r = await write(bob, "/api/reviews", "POST", {
        ...fixture,
        variantId: variants[1],
      });
      assert.equal(r.status, 201);
      other = (await r.json()).review.id;
      const separateGeneration = await write(bob, "/api/reviews", "POST", {
        ...fixture,
        variantId: variants[2],
      });
      assert.equal(separateGeneration.status, 201);
      otherGeneration = (await separateGeneration.json()).review.id;
      assert.equal(
        (await read(`/api/boot-variants/${variants[2]}/ratings`)).count,
        1,
      );
      const summary = await read(`/api/boot-variants/${variants[0]}/ratings`);
      assert.equal(summary.count, 2);
      assert.equal(summary.overall, 4);
      assert.equal(summary.criteria.fit, 4.5);
      assert.equal(summary.criteria.durability, 3);
      assert.equal(
        summary.distribution.find((x: { star: number }) => x.star === 3).count,
        1,
      );
      assert.equal(
        summary.distribution.find((x: { star: number }) => x.star === 5).count,
        1,
      );
      for (const [query, expected] of [
        ["size=9.5&system=UK", id],
        ["surface=FG", second],
        ["duration=over-12", second],
        ["shape=wide", second],
      ] as const) {
        const list = await read(`/api/reviews?variant=${variants[0]}&${query}`);
        assert.equal(list.total, 1);
        assert.equal(list.reviews[0].id, expected);
      }
      assert.equal(
        (await read(`/api/reviews?variant=${variants[0]}&sort=highest`))
          .reviews[0].id,
        second,
      );
      assert.equal(
        (await read(`/api/reviews?variant=${variants[0]}&sort=lowest`))
          .reviews[0].id,
        id,
      );
      assert.equal(
        (await read(`/api/boot-variants/${variants[1]}/ratings`)).count,
        1,
      );
      const username = (
        await db.query('SELECT username FROM "UserProfile" WHERE "userId"=$1', [
          aliceId,
        ])
      ).rows[0].username;
      assert.equal(
        (await read(`/api/reviews?author=${username}`)).reviews[0].id,
        id,
      );
    },
  );
  await t.test(
    "reviews: helpful voting is idempotent, authorized and changes sorting",
    async () => {
      assert.equal(
        (
          await write(alice, `/api/reviews/${id}/helpful`, "PUT", {
            helpful: true,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(`${base}/api/reviews/${id}/helpful`, {
            method: "PUT",
            headers: { origin: base },
            body: JSON.stringify({ helpful: true }),
          })
        ).status,
        401,
      );
      const votes = await Promise.all(
        Array.from({ length: 4 }, () =>
          write(bob, `/api/reviews/${id}/helpful`, "PUT", { helpful: true }),
        ),
      );
      assert.ok(votes.every((x) => x.status === 200));
      assert.equal((await read(`/api/reviews/${id}`)).review.helpfulCount, 1);
      assert.equal(
        (await read(`/api/reviews?variant=${variants[0]}&sort=helpful`))
          .reviews[0].id,
        id,
      );
      assert.equal(
        (
          await write(bob, `/api/reviews/${id}/helpful`, "PUT", {
            helpful: false,
          })
        ).status,
        200,
      );
      assert.equal((await read(`/api/reviews/${id}`)).review.helpfulCount, 0);
    },
  );
  await t.test(
    "reviews: DB constraints, pagination, XSS escaping and hidden data",
    async () => {
      await assert.rejects(
        db.query('UPDATE "BootReview" SET comfort=6 WHERE id=$1', [id]),
        /check constraint/,
      );
      await assert.rejects(
        db.query('UPDATE "BootReview" SET "ratingTotal"=30 WHERE id=$1', [id]),
        /check constraint/,
      );
      await assert.rejects(
        db.query('UPDATE "BootReview" SET "variantId"=$1 WHERE id=$2', [
          variants[1],
          id,
        ]),
        /immutable/,
      );
      await assert.rejects(
        db.query(
          'INSERT INTO "ReviewHelpfulVote" ("reviewId","userId") VALUES ($1,$2)',
          [id, aliceId],
        ),
        /cannot vote/,
      );
      for (let n = 0; n < 11; n++) {
        const uid = `review-fixture-${n}`;
        await db.query(
          'INSERT INTO "User" (id,email,"emailVerified","updatedAt") VALUES ($1,$2,now(),now())',
          [uid, `${uid}@example.test`],
        );
        await db.query(
          'INSERT INTO "UserProfile" (id,"userId",username,"displayName","updatedAt") VALUES ($1::text,$1::text,$1::varchar,$2,now())',
          [uid, "Temporary review fixture"],
        );
        await db.query(
          'INSERT INTO "BootReview" (id,"authorId","variantId","sizeWorn","sizeSystem","ownershipMonths","matchesPlayed",experience,pros,cons,comfort,fit,traction,"ballTouch",durability,value,"ratingTotal","updatedAt") VALUES ($1,$2,$3,$4,$5,1,1,$6,$7,$8,3,3,3,3,3,3,18,now())',
          [
            `test-review-${n}`,
            uid,
            variants[0],
            "8",
            "UK",
            fixture.experience,
            "test pros",
            "test cons",
          ],
        );
      }
      const p1 = await read(`/api/reviews?variant=${variants[0]}`),
        p2 = await read(`/api/reviews?variant=${variants[0]}&page=2`);
      assert.equal(p1.total, 13);
      assert.equal(p1.reviews.length, 10);
      assert.equal(p2.reviews.length, 3);
      assert.ok(
        p1.reviews.every(
          (x: { id: string }) =>
            !p2.reviews.some((y: { id: string }) => x.id === y.id),
        ),
      );
      await db.query('UPDATE "BootReview" SET experience=$1 WHERE id=$2', [
        "<script>alert('xss')</script> Disposable testing content only.",
        id,
      ]);
      const html = await (await fetch(`${base}/reviews/${id}`)).text();
      assert.ok(html.includes("&lt;script&gt;"));
      assert.ok(!html.includes("<script>alert('xss')</script>"));
      await db.query('UPDATE "BootReview" SET status=$1 WHERE id=$2', [
        "HIDDEN",
        second,
      ]);
      assert.equal((await fetch(`${base}/api/reviews/${second}`)).status, 404);
      assert.equal(
        (await read(`/api/boot-variants/${variants[0]}/ratings`)).count,
        12,
      );
      await db.query('DELETE FROM "User" WHERE id LIKE $1', [
        "review-fixture-%",
      ]);
    },
  );
  await t.test(
    "reviews: in-flight suspension is rechecked, and publishing is rate limited",
    async () => {
      const cookie = (browser: Browser) =>
        [...browser.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
      async function held(
        browser: Browser,
        userId: string,
        path: string,
        method: string,
        payload: unknown,
      ) {
        let release!: () => void;
        const ready = new Promise<void>((resolve) => (release = resolve));
        const bytes = new TextEncoder().encode(JSON.stringify(payload));
        const before = Number(
          (
            await db.query(
              'SELECT coalesce(sum(count),0) AS total FROM "RateLimit"',
            )
          ).rows[0].total,
        );
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            controller.enqueue(bytes.slice(0, 1));
            await ready;
            controller.enqueue(bytes.slice(1));
            controller.close();
          },
        });
        const response = fetch(base + path, {
          method,
          headers: {
            origin: base,
            cookie: cookie(browser),
            "Content-Type": "application/json",
          },
          body,
          duplex: "half",
        } as RequestInit & { duplex: string });
        try {
          let reached = false;
          for (let n = 0; n < 100; n++) {
            const total = Number(
              (
                await db.query(
                  'SELECT coalesce(sum(count),0) AS total FROM "RateLimit"',
                )
              ).rows[0].total,
            );
            if (total > before) {
              reached = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          assert.ok(reached, "Mutation reached initial auth before suspension");
          await db.query('UPDATE "User" SET status=$1 WHERE id=$2', [
            "SUSPENDED",
            userId,
          ]);
          release();
          assert.equal((await response).status, 403);
        } finally {
          release();
          await response.catch(() => {});
          await db.query('UPDATE "User" SET status=$1 WHERE id=$2', [
            "ACTIVE",
            userId,
          ]);
        }
      }
      const before = (await read(`/api/reviews/${id}`)).review;
      await held(alice, aliceId, `/api/reviews/${id}`, "PATCH", {
        ...fixture,
        experience:
          "This pending edit must never be saved after account suspension.",
        version: 3,
      });
      assert.equal(
        (await read(`/api/reviews/${id}`)).review.experience,
        before.experience,
      );
      await held(bob, bobId, `/api/reviews/${id}/helpful`, "PUT", {
        helpful: true,
      });
      assert.equal((await read(`/api/reviews/${id}`)).review.helpfulCount, 0);
      assert.equal(
        (
          await write(alice, "/api/reviews", "POST", {
            ...fixture,
            variantId: variants[1],
          })
        ).status,
        429,
      );
    },
  );
  await t.test(
    "reviews: deletion cascades votes and recomputes empty aggregates",
    async () => {
      await write(bob, `/api/reviews/${id}/helpful`, "PUT", { helpful: true });
      assert.equal(
        (await write(alice, `/api/reviews/${id}`, "DELETE", { version: 1 }))
          .status,
        409,
      );
      assert.equal(
        (await write(alice, `/api/reviews/${id}`, "DELETE", { version: 3 }))
          .status,
        204,
      );
      assert.equal((await fetch(`${base}/api/reviews/${id}`)).status, 404);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int AS count FROM "ReviewHelpfulVote" WHERE "reviewId"=$1',
            [id],
          )
        ).rows[0].count,
        0,
      );
      assert.equal(
        (await read(`/api/boot-variants/${variants[0]}/ratings`)).overall,
        null,
      );
      await db.query('DELETE FROM "BootReview" WHERE id IN ($1,$2,$3)', [
        second,
        other,
        otherGeneration,
      ]);
    },
  );
  await t.test("reviews: full-length Unicode content and sizing advice persist through create/edit", async () => {
    const input = {
      ...fixture,
      experience: "ử".repeat(5000),
      pros: "ố".repeat(1500),
      cons: "ề".repeat(1500),
      sizingAdvice: "Subjective test sizing observation only.",
    };
    assert.ok(Buffer.byteLength(JSON.stringify(input)) > 16 * 1024);
    const created = await write(bob, "/api/reviews", "POST", input);
    assert.equal(created.status, 201);
    const reviewId = (await created.json()).review.id;
    const persisted = (await read(`/api/reviews/${reviewId}`)).review;
    assert.equal(persisted.experience, input.experience);
    assert.equal(persisted.sizingAdvice, input.sizingAdvice);
    const edited = await write(bob, `/api/reviews/${reviewId}`, "PATCH", {
      ...input, sizingAdvice: "Updated subjective test advice.", version: 1,
    });
    assert.equal(edited.status, 200);
    assert.equal((await read(`/api/reviews/${reviewId}`)).review.sizingAdvice, "Updated subjective test advice.");
    const excessive = await write(bob, `/api/reviews/${reviewId}`, "PATCH", {
      ...input, experience: "ử".repeat(25000), version: 2,
    });
    assert.equal(excessive.status, 413);
    assert.equal((await write(bob, `/api/reviews/${reviewId}`, "DELETE", { version: 2 })).status, 204);
  });

}
