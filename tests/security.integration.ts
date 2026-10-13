import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import type pg from "pg";

type Browser = { requestLink(email: string): Promise<Response> };
export async function securityTests(
  t: TestContext,
  {
    db,
    base,
    aliceId,
    bob,
    secret,
  }: {
    db: pg.Client;
    base: string;
    aliceId: string;
    bob: Browser;
    secret: string;
  },
) {
  await t.test(
    "in-flight mutations recheck suspension, moderator revocation and logout",
    async () => {
      const id = `security-${randomUUID()}`,
        token = randomUUID(),
        postId = randomUUID(),
        slug = `security-${randomUUID()}`;
      await db.query(
        'INSERT INTO "User" (id,email,"emailVerified","updatedAt") VALUES ($1,$2,now(),now())',
        [id, `${id}@example.test`],
      );
      try {
        await db.query(
          'INSERT INTO "UserProfile" (id,"userId",username,"displayName","updatedAt") VALUES ($1,$2,$3,$4,now())',
          [randomUUID(), id, "security-fixture", "Security Fixture"],
        );
        await db.query(
          `INSERT INTO "Session" (id,"sessionToken","userId",expires) VALUES ($1,$2,$3,now()+interval '1 hour')`,
          [randomUUID(), token, id],
        );
        await db.query(
          'INSERT INTO "Post" (id,slug,title,content,"authorId","categoryId","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now())',
          [
            postId,
            slug,
            "Unchanged security fixture",
            "Disposable security fixture content for regression tests.",
            aliceId,
            "questions",
          ],
        );
        const input = {
          title: "Should never be saved",
          content: "This blocked request must not change any stored content.",
          categoryId: "questions",
          tags: [],
          bootEntryId: null,
        };
        async function held(
          path: string,
          method: string,
          data: unknown,
          revoke: () => Promise<unknown>,
          expected: number,
          afterBody?: () => Promise<void>,
        ) {
          const before = (
            await db.query(
              'SELECT coalesce(sum(count),0)::int AS n FROM "RateLimit"',
            )
          ).rows[0].n;
          let release!: () => void;
          const bytes = new TextEncoder().encode(JSON.stringify(data));
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(bytes.slice(0, 1));
              release = () => {
                controller.enqueue(bytes.slice(1));
                controller.close();
              };
            },
          });
          const pending = fetch(`${base}${path}`, {
            method,
            headers: {
              origin: base,
              cookie: `authjs.session-token=${token}`,
              "Content-Type": "application/json",
            },
            body: stream,
            duplex: "half",
          } as RequestInit);
          try {
            let authenticated = false;
            for (let i = 0; i < 100; i++) {
              if (
                (
                  await db.query(
                    'SELECT coalesce(sum(count),0)::int AS n FROM "RateLimit"',
                  )
                ).rows[0].n > before
              ) {
                authenticated = true;
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, 20));
            }
            assert.ok(
              authenticated,
              "Request must reach its initial authentication check before revocation",
            );
            await revoke();
          } finally {
            release();
          }
          await afterBody?.();
          assert.equal((await pending).status, expected);
        }
        const suspend = () =>
          db.query(`UPDATE "User" SET status='SUSPENDED' WHERE id=$1`, [id]);
        const activate = (role: string = "USER") =>
          db.query(
            `UPDATE "User" SET status='ACTIVE',role=$2::"Role" WHERE id=$1`,
            [id, role],
          );
        await held("/api/community/posts", "POST", input, suspend, 403);
        assert.equal(
          (
            await db.query(
              'SELECT count(*)::int AS n FROM "Post" WHERE "authorId"=$1',
              [id],
            )
          ).rows[0].n,
          0,
        );
        await activate("MODERATOR");
        await held(
          `/api/community/posts/${slug}`,
          "PATCH",
          { ...input, version: 1 },
          () => activate(),
          403,
        );
        await activate("MODERATOR");
        await held(
          `/api/community/posts/${slug}`,
          "DELETE",
          { version: 1 },
          () => activate(),
          403,
        );
        await activate("MODERATOR");
        await held(
          `/api/community/posts/${slug}`,
          "PATCH",
          { ...input, version: 1 },
          async () => {
            await db.query("BEGIN");
            await db.query(`UPDATE "User" SET role='USER' WHERE id=$1`, [id]);
          },
          403,
          async () => {
            try {
              let waiting = false;
              for (let i = 0; i < 100; i++) {
                await db.query("SELECT pg_stat_clear_snapshot()");
                waiting = (
                  await db.query(
                    `SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FOR SHARE%') AS waiting`,
                  )
                ).rows[0].waiting;
                if (waiting) break;
                await new Promise((resolve) => setTimeout(resolve, 20));
              }
              assert.ok(
                waiting,
                "Mutation must wait for a concurrent account revocation and read its committed role",
              );
            } finally {
              await db.query("COMMIT");
            }
          },
        );
        const unchanged = (
          await db.query('SELECT title,version FROM "Post" WHERE id=$1', [
            postId,
          ])
        ).rows[0];
        assert.deepEqual(unchanged, {
          title: "Unchanged security fixture",
          version: 1,
        });
        await held(
          "/api/account/profile",
          "PATCH",
          {
            username: "security-fixture",
            displayName: "Must not change",
            bio: "",
          },
          suspend,
          403,
        );
        assert.equal(
          (
            await db.query(
              'SELECT "displayName" FROM "UserProfile" WHERE "userId"=$1',
              [id],
            )
          ).rows[0].displayName,
          "Security Fixture",
        );
        await activate();
        await held(
          "/api/community/posts",
          "POST",
          input,
          () => db.query('DELETE FROM "Session" WHERE "userId"=$1', [id]),
          401,
        );
      } finally {
        await db.query('DELETE FROM "Post" WHERE id=$1', [postId]);
        await db.query('DELETE FROM "User" WHERE id=$1', [id]);
      }
    },
  );
  await t.test(
    "blocked email attempts do not consume the shared mail budget",
    async () => {
      const key = createHmac("sha256", secret)
        .update(`email:global:${Math.floor(Date.now() / 3600000)}`)
        .digest("hex");
      const before =
        (await db.query('SELECT count FROM "RateLimit" WHERE key=$1', [key]))
          .rows[0]?.count ?? 0;
      const address = `quota-${randomUUID()}@example.test`;
      for (let i = 0; i < 61; i++) await bob.requestLink(address);
      assert.equal(
        (await db.query('SELECT count FROM "RateLimit" WHERE key=$1', [key]))
          .rows[0].count,
        before + 3,
      );
      const victim = await bob.requestLink(
        `unrelated-${randomUUID()}@example.test`,
      );
      assert.ok(
        !(await victim.json()).url.includes("error="),
        "An unrelated email must still receive a sign-in link",
      );
    },
  );
  await t.test(
    "database rejects cross-generation catalogue insert and parent updates",
    async () => {
      const pair = (
        await db.query(
          `SELECT e."outsoleVariantId", v."generationId", c.id AS "colorwayId" FROM "CatalogueEntry" e JOIN "BootVariant" v ON v.id=e."outsoleVariantId" CROSS JOIN "BootColorway" c WHERE c."generationId"<>v."generationId" LIMIT 1`,
        )
      ).rows[0];
      assert.ok(pair);
      await db.query("BEGIN");
      try {
        const checks: [string, unknown[]][] = [
          [
            'INSERT INTO "CatalogueEntry" (id,slug,"outsoleVariantId","colorwayId","generationId") VALUES ($1,$2,$3,$4,$5)',
            [
              randomUUID(),
              randomUUID(),
              pair.outsoleVariantId,
              pair.colorwayId,
              pair.generationId,
            ],
          ],
          [
            'UPDATE "BootColorway" SET "generationId"=$1 WHERE id=$2',
            [pair.generationId, pair.colorwayId],
          ],
          [
            'UPDATE "BootVariant" SET "generationId"=(SELECT "generationId" FROM "BootColorway" WHERE id=$1) WHERE id=$2',
            [pair.colorwayId, pair.outsoleVariantId],
          ],
        ];
        for (const [sql, values] of checks) {
          await db.query("SAVEPOINT generation_check");
          let code = "";
          try {
            await db.query(sql, values);
          } catch (error) {
            code = (error as { code: string }).code;
          }
          await db.query("ROLLBACK TO SAVEPOINT generation_check");
          assert.ok(
            ["23503", "23001"].includes(code),
            `Expected foreign-key/restrict rejection, received ${code || "success"}`,
          );
        }
      } finally {
        await db.query("ROLLBACK");
      }
    },
  );
}
