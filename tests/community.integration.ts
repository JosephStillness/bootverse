import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type pg from "pg";
type Browser = { request(path: string, init?: RequestInit): Promise<Response> };
export async function communityTests(
  t: TestContext,
  {
    alice,
    bob,
    db,
    base,
    aliceId,
    bobId,
  }: {
    alice: Browser;
    bob: Browser;
    db: pg.Client;
    base: string;
    aliceId: string;
    bobId: string;
  },
) {
  const boots = (
    await db.query('SELECT id,slug FROM "CatalogueEntry" ORDER BY slug')
  ).rows;
  assert.equal(boots.length, 8);
  const linkedBoot = boots.find((row) => row.slug === "sample-future-peach-ag");
  assert.ok(linkedBoot);
  const input = {
    title: "Questions about boots on artificial grass",
    content:
      "## My experience\n\nWhat have other players noticed on artificial grass? **Context matters.**\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert%281%29)\n\n![tracking](https://tracking.test/pixel.png)",
    categoryId: "questions",
    tags: ["Turf", "wide-fit"],
    bootEntryId: linkedBoot.id,
  };
  const write = (
    browser: Browser,
    path: string,
    method: string,
    data: unknown,
  ) =>
    browser.request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  const feed = async (query = "") =>
    (await fetch(`${base}/api/community/posts${query}`)).json();
  let slug = "",
    sibling = "";
  await t.test(
    "post authentication, CSRF, bounded input and unique creation",
    async () => {
      assert.equal(
        (
          await fetch(`${base}/api/community/posts`, {
            method: "POST",
            headers: { origin: base },
            body: JSON.stringify(input),
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await fetch(`${base}/api/community/posts`, {
            method: "POST",
            headers: { origin: "https://evil.test" },
            body: JSON.stringify(input),
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await write(bob, "/api/community/posts", "POST", {
            ...input,
            authorId: aliceId,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await write(bob, "/api/community/posts", "POST", {
            ...input,
            bootEntryId: "not-a-catalogue-entry",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await alice.request("/api/community/posts", {
            method: "POST",
            body: "x".repeat(50000),
          })
        ).status,
        413,
      );
      const created = await write(alice, "/api/community/posts", "POST", input);
      assert.equal(created.status, 201);
      slug = (await created.json()).post.slug;
      const duplicateTitle = await write(
        alice,
        "/api/community/posts",
        "POST",
        input,
      );
      assert.equal(duplicateTitle.status, 201);
      sibling = (await duplicateTitle.json()).post.slug;
      assert.notEqual(slug, sibling);
      const row = (
        await db.query(
          'SELECT "authorId","bootEntryId" FROM "Post" WHERE slug=$1',
          [slug],
        )
      ).rows[0];
      assert.equal(row.authorId, aliceId);
      assert.equal(row.bootEntryId, linkedBoot.id);
      const linked = (
        await (await fetch(`${base}/api/community/posts/${slug}`)).json()
      ).post;
      assert.equal(linked.boot.id, linkedBoot.id);
      assert.ok(linked.boot.label.includes("AG"));
      assert.ok(linked.boot.sample);
      assert.equal(linked.author.email, undefined);
      assert.equal(linked.author.id, undefined);
      assert.deepEqual(linked.tags, ["turf", "wide-fit"]);
      assert.equal(
        (await db.query('SELECT count(*)::int AS n FROM "Post"')).rows[0].n,
        2,
        "Invalid creates must not leave partial posts.",
      );
    },
  );
  await t.test(
    "owner-only editing, validation, stable slugs and concurrent version conflicts",
    async () => {
      const path = `/api/community/posts/${slug}`;
      assert.equal(
        (await write(bob, path, "PATCH", { ...input, version: 1 })).status,
        403,
      );
      assert.equal(
        (
          await write(alice, path, "PATCH", {
            ...input,
            status: "PUBLISHED",
            version: 1,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await write(alice, path, "PATCH", {
            ...input,
            categoryId: "unknown",
            version: 1,
          })
        ).status,
        400,
      );
      const next = {
        ...input,
        title: "Updated question about artificial grass",
        tags: ["fit-context"],
        version: 1,
      };
      assert.equal((await write(alice, path, "PATCH", next)).status, 200);
      assert.equal((await write(alice, path, "PATCH", next)).status, 409);
      const versions = await Promise.all([
        write(alice, path, "PATCH", {
          ...next,
          title: "Concurrent draft one",
          version: 2,
        }),
        write(alice, path, "PATCH", {
          ...next,
          title: "Concurrent draft two",
          version: 2,
        }),
      ]);
      assert.deepEqual(versions.map((row) => row.status).sort(), [200, 409]);
      const saved = (await (await fetch(`${base}${path}`)).json()).post;
      assert.equal(saved.slug, slug);
      assert.equal(saved.version, 3);
      assert.deepEqual(saved.tags, ["fit-context"]);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int AS n FROM "PostTag" pt JOIN "Post" p ON pt."postId"=p.id WHERE p.slug=$1',
            [slug],
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await t.test(
    "moderator permission comes from current server role, never client input",
    async () => {
      assert.equal(
        (
          await write(bob, "/api/community/posts", "POST", {
            ...input,
            role: "ADMIN",
          })
        ).status,
        400,
      );
      await db.query("UPDATE \"User\" SET role='MODERATOR' WHERE id=$1", [
        bobId,
      ]);
      assert.equal(
        (
          await write(bob, `/api/community/posts/${slug}`, "PATCH", {
            ...input,
            title: "Moderator updated community question",
            version: 3,
          })
        ).status,
        200,
      );
      await db.query("UPDATE \"User\" SET role='USER' WHERE id=$1", [bobId]);
      assert.equal(
        (
          await write(bob, `/api/community/posts/${slug}`, "PATCH", {
            ...input,
            version: 4,
          })
        ).status,
        403,
      );
    },
  );
  await t.test(
    "stored feed search, category/tag/boot/author filters and safe public detail",
    async () => {
      const created = await write(bob, "/api/community/posts", "POST", {
        ...input,
        title: "Written boot experience on turf",
        content:
          "This is a written experience and an unverified community opinion.",
        categoryId: "boot-reviews",
        tags: ["ownership"],
        bootEntryId: null,
      });
      assert.equal(created.status, 201);
      assert.equal((await feed("?q=ARTIFICIAL+grass")).total, 2);
      assert.equal((await feed("?category=boot-reviews")).total, 1);
      assert.equal((await feed("?tag=turf")).total, 2);
      assert.equal((await feed(`?boot=${linkedBoot.id}`)).total, 2);
      assert.equal(
        (await feed(`?boot=${linkedBoot.id}&category=boot-reviews`)).total,
        0,
      );
      const username = (
        await db.query('SELECT username FROM "UserProfile" WHERE "userId"=$1', [
          aliceId,
        ])
      ).rows[0].username;
      assert.equal((await feed(`?author=${username}`)).total, 2);
      assert.equal((await feed("?q=no-matching-text")).total, 0);
      assert.equal(
        (await feed("?q=%25")).total,
        2,
        "Only the two stored Markdown bodies containing percent-encoded links should match.",
      );
      assert.equal(
        (await feed("?q=_")).total,
        0,
        "An underscore must be searched literally, not as a SQL wildcard.",
      );
      assert.equal(
        (
          await write(alice, `/api/community/posts/${slug}`, "PATCH", {
            ...input,
            title: "👟👟👟",
            version: 4,
          })
        ).status,
        400,
        "Unicode minimum lengths must match PostgreSQL character constraints.",
      );
      assert.equal((await feed("?q=';DROP+TABLE+Post;--")).total, 0);
      assert.equal(
        (await fetch(`${base}/api/community/posts?sort=popular`)).status,
        200,
      );
      assert.equal(
        (await fetch(`${base}/api/community/posts?page=1001`)).status,
        400,
      );
      const html = await (await fetch(`${base}/community/${slug}`)).text();
      assert.ok(html.includes("Moderator updated community question"));
      assert.ok(html.includes("<strong>Context matters.</strong>"));
      assert.ok(!html.includes("<script>alert(1)</script>"));
      assert.ok(!html.includes('src="https://tracking.test'));
      assert.ok(!html.includes("alice@example.test"));
      assert.ok(!html.includes(aliceId));
      assert.ok(html.includes(`/boots/${linkedBoot.slug}`));
      const profile = await (await fetch(`${base}/users/${username}`)).text();
      assert.ok(profile.includes("Public discussions"));
      assert.ok(profile.includes(slug));
      assert.ok(!profile.includes(aliceId));
      assert.equal((await fetch(`${base}/community/not-a-post`)).status, 404);
      const fresh = await (await fetch(`${base}/api/community/posts`)).json();
      assert.equal(
        fresh.posts[0].content,
        undefined,
        "Feed carries excerpts rather than every full body.",
      );
    },
  );
  await t.test(
    "pagination and deterministic sorting use real database rows",
    async () => {
      for (let index = 0; index < 12; index++)
        await db.query(
          'INSERT INTO "Post" (id,slug,title,content,"authorId","categoryId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$7)',
          [
            `fixture-${index}`,
            `integration-pagination-${index}`,
            `Stored pagination discussion ${index}`,
            "Stored integration fixture content, confined to the disposable database.",
            index % 2 ? aliceId : bobId,
            "general-discussion",
            new Date(Date.UTC(2020, 0, 1, 0, index)),
          ],
        );
      const first = await feed("?sort=newest"),
        second = await feed("?sort=newest&page=2");
      assert.equal(first.total, 15);
      assert.equal(first.posts.length, 10);
      assert.equal(second.posts.length, 5);
      const ids = [...first.posts, ...second.posts].map((post) => post.id);
      assert.equal(new Set(ids).size, 15);
      const oldFirst = await feed("?sort=oldest"),
        oldSecond = await feed("?sort=oldest&page=2");
      assert.deepEqual(
        [...oldFirst.posts, ...oldSecond.posts].map((post) => post.id),
        ids.toReversed(),
      );
      const pageHtml = await (
        await fetch(`${base}/community?page=2&sort=oldest`)
      ).text();
      assert.ok(pageHtml.includes("Page <!-- -->2"));
      assert.ok(pageHtml.includes("sort=oldest"));
      assert.ok((await feed("?page=999")).posts.length === 0);
    },
  );
  await t.test(
    "hidden and suspended/unverified content is not public, editing cannot publish it",
    async () => {
      await db.query("UPDATE \"Post\" SET status='HIDDEN' WHERE slug=$1", [
        slug,
      ]);
      assert.equal(
        (await fetch(`${base}/api/community/posts/${slug}`)).status,
        404,
      );
      assert.equal((await fetch(`${base}/community/${slug}`)).status, 404);
      assert.equal(
        (await alice.request(`/community/${slug}/edit`)).status,
        200,
      );
      assert.equal(
        (
          await write(alice, `/api/community/posts/${slug}`, "PATCH", {
            ...input,
            version: 4,
          })
        ).status,
        200,
      );
      assert.equal(
        (await fetch(`${base}/api/community/posts/${slug}`)).status,
        404,
      );
      await db.query("UPDATE \"Post\" SET status='PUBLISHED' WHERE slug=$1", [
        slug,
      ]);
      const username = (
        await db.query('SELECT username FROM "UserProfile" WHERE "userId"=$1', [
          bobId,
        ])
      ).rows[0].username;
      await db.query("UPDATE \"User\" SET status='SUSPENDED' WHERE id=$1", [
        bobId,
      ]);
      assert.equal((await feed(`?author=${username}`)).total, 0);
      assert.equal(
        (
          await write(bob, `/api/community/posts/${sibling}`, "DELETE", {
            version: 1,
          })
        ).status,
        403,
      );
      await db.query(
        'UPDATE "User" SET status=\'ACTIVE\',"emailVerified"=NULL WHERE id=$1',
        [bobId],
      );
      assert.equal((await feed(`?author=${username}`)).total, 0);
      await db.query('UPDATE "User" SET "emailVerified"=now() WHERE id=$1', [
        bobId,
      ]);
    },
  );
  await t.test(
    "concurrent tag reuse is unique and publishing limits are enforced",
    async () => {
      const shared = {
        ...input,
        title: "Concurrent tag reuse example",
        tags: ["shared-tag"],
      };
      const responses = await Promise.all([
        write(alice, "/api/community/posts", "POST", shared),
        write(bob, "/api/community/posts", "POST", shared),
      ]);
      assert.deepEqual(
        responses.map((row) => row.status),
        [201, 201],
      );
      assert.equal(
        (
          await db.query('SELECT count(*)::int AS n FROM "Tag" WHERE name=$1', [
            "shared-tag",
          ])
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await write(alice, "/api/community/posts", "POST", {
            ...shared,
            title: "Final allowed publishing attempt",
          })
        ).status,
        201,
      );
      assert.equal(
        (await write(alice, "/api/community/posts", "POST", shared)).status,
        429,
      );
    },
  );
  await t.test(
    "author-confirmed deletion rejects stale versions and removes tag joins",
    async () => {
      const path = `/api/community/posts/${slug}`,
        row = (
          await db.query('SELECT id,version FROM "Post" WHERE slug=$1', [slug])
        ).rows[0];
      assert.equal(
        (await write(bob, path, "DELETE", { version: row.version })).status,
        403,
      );
      assert.equal(
        (await write(alice, path, "DELETE", { version: 1 })).status,
        409,
      );
      assert.equal(
        (await write(alice, path, "DELETE", { version: row.version })).status,
        204,
      );
      assert.equal((await fetch(`${base}${path}`)).status, 404);
      assert.equal((await fetch(`${base}/community/${slug}`)).status, 404);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int AS n FROM "PostTag" WHERE "postId"=$1',
            [row.id],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (await fetch(`${base}/api/community/posts/${sibling}`)).status,
        200,
      );
    },
  );
}
