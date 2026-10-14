import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import type pg from "pg";
type Browser = { request(path: string, init?: RequestInit): Promise<Response> };
export async function interactionsTests(
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
  const first = randomUUID(),
    second = randomUUID(),
    slug = `interactions-${first}`,
    otherSlug = `interactions-${second}`;
  for (const [id, path] of [
    [first, slug],
    [second, otherSlug],
  ])
    await db.query(
      'INSERT INTO "Post" (id,slug,title,content,"authorId","categoryId","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now())',
      [
        id,
        path,
        "Disposable interaction fixture",
        "This is isolated integration test content, not a real discussion.",
        aliceId,
        "questions",
      ],
    );
  const endpoint = `/api/community/posts/${slug}`;
  const write = (
    browser: Browser,
    path: string,
    method: string,
    body: unknown,
  ) =>
    browser.request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const read = async (path: string) => await (await alice.request(path)).json();
  let root = "",
    child = "",
    grandchild = "";
  try {
    await t.test(
      "comments require authentication, valid input and a public post",
      async () => {
        assert.equal(
          (
            await fetch(`${base}${endpoint}/comments`, {
              method: "POST",
              headers: { origin: base },
              body: JSON.stringify({ content: "hello" }),
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await fetch(`${base}${endpoint}/comments`, {
              method: "POST",
              headers: { origin: "https://evil.test" },
              body: "{}",
            })
          ).status,
          403,
        );
        for (const body of [
          { content: " " },
          { content: "x".repeat(3001) },
          { content: "hello", authorId: bobId },
        ])
          assert.equal(
            (await write(bob, `${endpoint}/comments`, "POST", body)).status,
            400,
          );
        const response = await write(alice, `${endpoint}/comments`, "POST", {
          content: "A stored comment <script>alert(1)</script>",
        });
        assert.equal(response.status, 201);
        root = (await response.json()).comment.id;
        assert.equal(
          (await db.query('SELECT content FROM "Comment" WHERE id=$1', [root]))
            .rows[0].content,
          "A stored comment <script>alert(1)</script>",
        );
        const page = await read(`${endpoint}/comments`);
        assert.equal(page.commentCount, 1);
        assert.equal(page.comments[0].id, root);
        assert.equal(page.comments[0].author.email, undefined);
        assert.equal(page.comments[0].authorId, undefined);
        assert.equal((await fetch(`${base}${endpoint}/comments`)).status, 200);
      },
    );
    await t.test(
      "owner-only edits reject stale versions and comment moves",
      async () => {
        assert.equal(
          (
            await write(bob, `${endpoint}/comments/${root}`, "PATCH", {
              content: "attempt",
              version: 1,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await write(bob, `${endpoint}/comments/${root}`, "DELETE", {
              version: 1,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await write(alice, `${endpoint}/comments/${root}`, "PATCH", {
              content: "moved",
              version: 1,
              parentCommentId: "other",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await write(alice, `${endpoint}/comments/${root}`, "PATCH", {
              content: "Owner edited comment",
              version: 1,
            })
          ).status,
          204,
        );
        assert.equal(
          (
            await write(alice, `${endpoint}/comments/${root}`, "PATCH", {
              content: "stale",
              version: 1,
            })
          ).status,
          409,
        );
        assert.equal(
          (await read(`${endpoint}/comments`)).comments[0].content,
          "Owner edited comment",
        );
      },
    );
    await t.test(
      "replies validate post, depth and preserve context after parent deletion",
      async () => {
        assert.equal(
          (
            await write(
              bob,
              `/api/community/posts/${otherSlug}/comments`,
              "POST",
              { content: "wrong post", parentCommentId: root },
            )
          ).status,
          400,
        );
        const response = await write(bob, `${endpoint}/comments`, "POST", {
          content: "First reply",
          parentCommentId: root,
        });
        assert.equal(response.status, 201);
        child = (await response.json()).comment.id;
        const reply = await write(alice, `${endpoint}/comments`, "POST", {
          content: "Second level reply",
          parentCommentId: child,
        });
        assert.equal(reply.status, 201);
        grandchild = (await reply.json()).comment.id;
        assert.equal(
          (
            await write(alice, `${endpoint}/comments`, "POST", {
              content: "Too deep",
              parentCommentId: grandchild,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await write(alice, `${endpoint}/comments/${root}`, "DELETE", {
              version: 1,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await write(alice, `${endpoint}/comments/${root}`, "DELETE", {
              version: 2,
            })
          ).status,
          204,
        );
        const page = await read(`${endpoint}/comments`);
        assert.equal(page.comments[0].content, null);
        assert.equal(page.comments[0].author, null);
        assert.equal(page.comments[0].replyCount, 1);
        assert.equal(page.commentCount, 2);
        assert.equal(
          (await read(`${endpoint}/comments?parent=${root}`)).comments[0].id,
          child,
        );
        assert.equal(
          (await read(`${endpoint}/comments?parent=${child}`)).comments[0].id,
          grandchild,
        );
        assert.equal(
          (
            await write(bob, `${endpoint}/comments`, "POST", {
              content: "Cannot reply to deleted",
              parentCommentId: root,
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "root and branch pages are independent; database prevents cross-post/cyclic parenting",
      async () => {
        for (let i = 0; i < 12; i++) {
          await db.query(
            'INSERT INTO "Comment" (id,"postId","authorId",content,"updatedAt") VALUES ($1,$2,$3,$4,now())',
            [randomUUID(), first, bobId, `Stored root ${i}`],
          );
          await db.query(
            'INSERT INTO "Comment" (id,"postId","authorId",content,"parentCommentId","parentDepth",depth,"updatedAt") VALUES ($1,$2,$3,$4,$5,1,2,now())',
            [randomUUID(), first, bobId, `Stored reply ${i}`, child],
          );
        }
        const roots1 = await read(`${endpoint}/comments`),
          roots2 = await read(`${endpoint}/comments?page=2`);
        assert.equal(roots1.comments.length, 10);
        assert.equal(roots2.comments.length, 3);
        assert.equal(
          new Set([...roots1.comments, ...roots2.comments].map((row) => row.id))
            .size,
          13,
        );
        assert.equal(
          (await read(`${endpoint}/comments?parent=${child}&page=2`)).comments
            .length,
          3,
        );
        assert.equal(
          (await fetch(`${base}${endpoint}/comments?parent=missing`)).status,
          404,
        );
        await db.query("BEGIN");
        try {
          for (const [sql, values] of [
            [
              'UPDATE "Comment" SET "parentCommentId"=$1,"parentDepth"=1,depth=2 WHERE id=$2',
              [child, root],
            ],
            [
              'INSERT INTO "Comment" (id,"postId","authorId",content,"parentCommentId","parentDepth",depth,"updatedAt") VALUES ($1,$2,$3,$4,$5,0,1,now())',
              [randomUUID(), second, bobId, "Invalid other post reply", root],
            ],
          ] as [string, unknown[]][]) {
            await db.query("SAVEPOINT invalid_reply");
            let rejected = false;
            try {
              await db.query(sql, values);
            } catch (error) {
              rejected = ["23503", "23514"].includes(
                (error as { code: string }).code,
              );
            }
            await db.query("ROLLBACK TO SAVEPOINT invalid_reply");
            assert.ok(rejected);
          }
        } finally {
          await db.query("ROLLBACK");
        }
      },
    );
    await t.test(
      "votes require auth, switch/remove idempotently and reject forged totals",
      async () => {
        assert.equal(
          (
            await fetch(`${base}${endpoint}/vote`, {
              method: "PUT",
              headers: { origin: base },
              body: JSON.stringify({ value: 1 }),
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await write(alice, `${endpoint}/vote`, "PUT", {
              value: 1,
              score: 1000,
            })
          ).status,
          400,
        );
        for (const [value, score] of [
          [1, 1],
          [1, 1],
          [-1, -1],
          [0, 0],
          [0, 0],
        ]) {
          const response = await write(alice, `${endpoint}/vote`, "PUT", {
            value,
          });
          assert.equal(response.status, 200);
          assert.deepEqual(await response.json(), { value, score });
          assert.deepEqual(await read(`${endpoint}/vote`), { value, score });
        }
        await write(alice, `${endpoint}/vote`, "PUT", { value: 1 });
        await write(bob, `${endpoint}/vote`, "PUT", { value: -1 });
        assert.equal((await read(`${endpoint}/vote`)).score, 0);
        assert.equal(
          (
            await db.query(
              'SELECT count(*)::int AS n FROM "PostVote" WHERE "postId"=$1',
              [first],
            )
          ).rows[0].n,
          2,
        );
      },
    );
    await t.test(
      "concurrent votes preserve uniqueness and exact aggregate score; feed activity sorts",
      async () => {
        const responses = await Promise.all(
          Array.from({ length: 12 }, (_, i) =>
            write(i % 2 ? alice : bob, `${endpoint}/vote`, "PUT", {
              value: i % 3 ? 1 : -1,
            }),
          ),
        );
        assert.ok(responses.every((response) => response.status === 200));
        const stored = (
          await db.query(
            'SELECT coalesce(sum(value),0)::int AS score,count(*)::int AS n FROM "PostVote" WHERE "postId"=$1',
            [first],
          )
        ).rows[0];
        assert.equal(stored.n, 2);
        assert.equal((await read(`${endpoint}/vote`)).score, stored.score);
        await write(alice, `${endpoint}/vote`, "PUT", { value: 1 });
        await write(bob, `${endpoint}/vote`, "PUT", { value: 1 });
        assert.equal(
          (await read("/api/community/posts?sort=popular")).posts[0].slug,
          slug,
        );
        assert.equal(
          (await read("/api/community/posts?sort=discussed")).posts[0].slug,
          slug,
        );
        const post = (await read(endpoint)).post;
        assert.equal(post.score, 2);
        assert.equal(post.commentCount, 26);
      },
    );
    await t.test(
      "hidden posts reject reads/writes; creation and voting limits are enforced",
      async () => {
        await db.query(`UPDATE "Post" SET status='HIDDEN' WHERE id=$1`, [
          second,
        ]);
        for (const path of [
          `/api/community/posts/${otherSlug}/comments`,
          `/api/community/posts/${otherSlug}/vote`,
        ])
          assert.equal((await fetch(`${base}${path}`)).status, 404);
        assert.equal(
          (
            await write(
              alice,
              `/api/community/posts/${otherSlug}/comments`,
              "POST",
              { content: "hidden" },
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await write(
              alice,
              `/api/community/posts/${otherSlug}/vote`,
              "PUT",
              { value: 1 },
            )
          ).status,
          404,
        );
        let limited = false;
        for (let i = 0; i < 12; i++)
          if (
            (await write(bob, `${endpoint}/comments`, "POST", { content: " " }))
              .status === 429
          )
            limited = true;
        assert.ok(limited);
        let voteLimited = false;
        for (let i = 0; i < 65; i++)
          if (
            (await write(bob, `${endpoint}/vote`, "PUT", { value: 0 }))
              .status === 429
          )
            voteLimited = true;
        assert.ok(voteLimited);
      },
    );
    await t.test(
      "post deletion cascades entire threads and votes without orphan records",
      async () => {
        assert.equal(
          (await write(alice, endpoint, "DELETE", { version: 1 })).status,
          204,
        );
        assert.equal(
          (
            await db.query(
              'SELECT count(*)::int AS n FROM "Comment" WHERE "postId"=$1',
              [first],
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await db.query(
              'SELECT count(*)::int AS n FROM "PostVote" WHERE "postId"=$1',
              [first],
            )
          ).rows[0].n,
          0,
        );
        assert.equal((await fetch(`${base}${endpoint}/comments`)).status, 404);
      },
    );
  } finally {
    await db.query('DELETE FROM "Post" WHERE id=ANY($1::text[])', [
      [first, second],
    ]);
  }
}
