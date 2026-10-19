import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { SMTPServer } from "smtp-server";
import pg from "pg";
import { recommendationPerformanceTests } from "./recommendation-performance.integration";
import { finderTests } from "./finder.integration";
import { reviewAnalysisTests } from "./review-analysis.integration";
import { recommendationTests } from "./recommendations.integration";
import { footProfileTests } from "./foot-profile.integration";
import { reviewsTests } from "./reviews.integration";
import { interactionsTests } from "./interactions.integration";
import {catalogueTests} from "./catalogue.integration";
import { communityTests } from "./community.integration";
import { platformTests } from "./platform.integration";
import { S3Client, CreateBucketCommand, ListObjectsV2Command, DeleteObjectsCommand, DeleteBucketCommand } from "@aws-sdk/client-s3";
import { securityTests } from "./security.integration";

// Disposable local PostgreSQL database; never writes fixtures to the app database.
test(
  "Sprint 2.1/2.2/2.3/2.4 real HTTP, PostgreSQL and SMTP lifecycle",
  { timeout: 180000 },
  async (t) => {
    assert.ok(
      process.env.DATABASE_URL,
      "Configure a local PostgreSQL DATABASE_URL first.",
    );
    const source = new URL(process.env.DATABASE_URL);
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(source.hostname),
      "Integration tests only run against local PostgreSQL.",
    );
    const database = `bootverse_auth_test_${randomBytes(6).toString("hex")}`;
    const adminUrl = new URL(source);
    adminUrl.pathname = "/postgres";
    const admin = new pg.Client({ connectionString: adminUrl.href });
    await admin.connect();
    let created = false;
    let databaseConnected = false;
    let smtpListening = false;
    const dbUrl = new URL(source);
    dbUrl.pathname = `/${database}`;
    const db = new pg.Client({ connectionString: dbUrl.href });
    let app: ChildProcess | undefined;
    let testStorage: S3Client | undefined;
    let testBucket: string | undefined;
    const mail: string[] = [];
    const smtp = new SMTPServer({
      authOptional: true,
      disabledCommands: ["AUTH", "STARTTLS"],
      logger: false,
      onData(stream, _session, callback) {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => {
          mail.push(
            Buffer.concat(chunks)
              .toString("utf8")
              .replace(/=\r?\n/g, "")
              .replace(/=([0-9A-F]{2})/g, (_match, hex: string) =>
                String.fromCharCode(parseInt(hex, 16)),
              ),
          );
          callback();
        });
        stream.on("error", callback);
      },
    });
    async function unusedPort() {
      const server = createServer();
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const port = address.port;
      await new Promise<void>((resolve) => server.close(() => resolve()));
      return port;
    }
    t.after(async () => {
      if (app && app.exitCode === null) {
        app.kill("SIGTERM");
        await once(app, "exit");
      }
      if (smtpListening)
        await new Promise<void>((resolve) => smtp.close(() => resolve()));
      if (databaseConnected) await db.end();
      if (created) {
        await admin.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",
          [database],
        );
        await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
      }
      await admin.end();
      if (testStorage && testBucket) {
        const objects = await testStorage.send(new ListObjectsV2Command({Bucket:testBucket}));
        if(objects.Contents?.length)await testStorage.send(new DeleteObjectsCommand({Bucket:testBucket,Delete:{Objects:objects.Contents.map(x=>({Key:x.Key!}))}}));
        await testStorage.send(new DeleteBucketCommand({Bucket:testBucket}));
      }
    });
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    await db.connect();
    databaseConnected = true;
    const port = await unusedPort(),
      smtpPort = await unusedPort(),
      base = `http://localhost:${port}`;
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: dbUrl.href,
      DATABASE_URL_UNPOOLED: dbUrl.href,
      AUTH_SECRET: randomBytes(48).toString("base64url"),
      AUTH_URL: base,
      EMAIL_SERVER: `smtp://127.0.0.1:${smtpPort}`,
      EMAIL_FROM: "BootVerse <noreply@bootverse.local>",
      NODE_ENV: "production",
      BOOT_FIT_TIMING_LOGS: process.env.BOOTVERSE_BENCHMARK === "1" ? "1" : "0",
    };
    if(process.env.BOOTVERSE_TEST_STORAGE === "1") {
      assert.ok(env.S3_ENDPOINT && ["localhost","127.0.0.1"].includes(new URL(env.S3_ENDPOINT).hostname), "Platform tests require local S3 storage.");
      assert.ok(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY, "Configure local storage credentials first.");
      testBucket = `bootverse-qa-${randomBytes(8).toString("hex")}`;
      testStorage = new S3Client({endpoint:env.S3_ENDPOINT,region:env.S3_REGION ?? "us-east-1",forcePathStyle:true,credentials:{accessKeyId:env.S3_ACCESS_KEY_ID!,secretAccessKey:env.S3_SECRET_ACCESS_KEY!}});
      await testStorage.send(new CreateBucketCommand({Bucket:testBucket}));
      Object.assign(env,{S3_BUCKET:testBucket,UPLOAD_MAX_BYTES:String(1024*1024),UPLOAD_MAX_PER_CONTENT:"2",UPLOAD_MAX_PER_USER:"8",UPLOAD_USER_QUOTA_BYTES:String(1024*1024)});
    }
    let appOutput = "";
    try {
      const migration = spawn(
        process.execPath,
        ["node_modules/prisma/build/index.js", "migrate", "deploy"],
        { env, stdio: "pipe" },
      );
      migration.stdout?.resume();
      migration.stderr?.resume();
      const [migrationCode] = await once(migration, "exit");
      assert.equal(
        migrationCode,
        0,
        "Migration must apply cleanly to an empty database.",
      );
      const catalogue = spawn(
        process.execPath,
        ["--import", "tsx", "scripts/import-catalogue.mts"],
        { env:{...env,NODE_ENV:"test"}, stdio: "pipe" },
      );
      catalogue.stdout?.resume();
      catalogue.stderr?.resume();
      const [catalogueCode] = await once(catalogue, "exit");
      assert.equal(
        catalogueCode,
        0,
        "Catalogue identities must import cleanly.",
      );
      await new Promise<void>((resolve) =>
        smtp.listen(smtpPort, "127.0.0.1", resolve),
      );
      smtpListening = true;
      app = spawn(
        process.execPath,
        ["node_modules/next/dist/bin/next", "start", "--port", String(port)],
        { env, stdio: "pipe" },
      );
      app.stdout?.on("data", (data: Buffer) => {
        appOutput += data.toString();
      });
      app.stderr?.on("data", (data: Buffer) => {
        appOutput += data.toString();
      });
      const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
      for (let i = 0; i < 300; i++) {
        try {
          const r = await fetch(`${base}/login`);
          if (r.ok) break;
        } catch {}
        await pause();
      }
      assert.equal(
        (await fetch(`${base}/login`)).status,
        200,
        "Production server must be ready.",
      );
      class Browser {
        cookies = new Map<string, string>();
        async request(path: string, init: RequestInit = {}) {
          const headers = new Headers(init.headers);
          headers.set(
            "cookie",
            [...this.cookies]
              .map(([key, value]) => `${key}=${value}`)
              .join("; "),
          );
          if (init.method && init.method !== "GET") headers.set("origin", base);
          const response = await fetch(new URL(path, base), {
            ...init,
            headers,
            redirect: "manual",
          });
          for (const cookie of response.headers.getSetCookie()) {
            const pair = cookie.split(";")[0],
              index = pair.indexOf("=");
            this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
          }
          return response;
        }
        async csrf() {
          return (await (await this.request("/api/auth/csrf")).json())
            .csrfToken as string;
        }
        async requestLink(email: string) {
          const csrfToken = await this.csrf();
          return this.request("/api/auth/signin/nodemailer", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "X-Auth-Return-Redirect": "1",
            },
            body: new URLSearchParams({
              email,
              csrfToken,
              callbackUrl: `${base}/account`,
            }),
          });
        }
        async verifyLastLink() {
          const message = mail.at(-1);
          assert.ok(message);
          const url = message
            .split(/\r?\n/)
            .find(
              (line) =>
                line.startsWith(base) &&
                line.includes("/api/auth/callback/nodemailer"),
            );
          assert.ok(
            url,
            "SMTP message must contain the actual verification link.",
          );
          const response = await this.request(url);
          assert.equal(response.status, 302);
          assert.ok(
            [...this.cookies.keys()].some((key) =>
              key.includes("session-token"),
            ),
          );
          return url;
        }
        async session() {
          return (await this.request("/api/auth/session")).json();
        }
      }
      const alice = new Browser(),
        bob = new Browser();
      let aliceId = "",
        bobId = "",
        aliceUsername = "",
        originalLink = "";
      await t.test(
        "anonymous access, CSRF, registration and email delivery",
        async () => {
          assert.equal((await alice.request("/account")).status, 307);
          assert.equal(
            (
              await alice.request("/api/account/profile", {
                method: "PATCH",
                body: "{}",
              })
            ).status,
            401,
          );
          assert.equal(
            (
              await fetch(`${base}/api/account/profile`, {
                method: "PATCH",
                headers: { origin: "https://evil.test" },
                body: "{}",
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await alice.request("/api/auth/signin/nodemailer", {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: "email=alice@example.test",
              })
            ).status,
            302,
          );
          const before = mail.length;
          const response = await alice.requestLink("alice@example.test");
          assert.equal(response.status, 200);
          assert.equal(
            mail.length,
            before + 1,
            "SMTP must actually receive email.",
          );
          assert.equal(
            (await db.query('SELECT count(*)::int AS n FROM "User"')).rows[0].n,
            0,
            "No user before verification.",
          );
          originalLink = await alice.verifyLastLink();
          const row = (
            await db.query(
              'SELECT u.id, u."emailVerified", p.username FROM "User" u JOIN "UserProfile" p ON p."userId"=u.id',
            )
          ).rows[0];
          assert.ok(row.emailVerified);
          aliceId = row.id;
          aliceUsername = row.username;
          assert.equal((await alice.request("/account")).status, 200);
          const session = await alice.session();
          assert.equal(session.user.id, aliceId);
          assert.equal(session.user.email, undefined);
        },
      );
      await t.test(
        "single-use links, persistent sessions, existing-user login",
        async () => {
          const replay = new Browser();
          const response = await replay.request(originalLink);
          assert.equal(response.status, 302);
          assert.ok(response.headers.get("location")?.includes("error="));
          assert.equal((await replay.session())?.user, undefined);
          const reopened = new Browser();
          reopened.cookies = new Map(alice.cookies);
          assert.equal((await reopened.session()).user.id, aliceId);
          await alice.requestLink("alice@example.test");
          await alice.verifyLastLink();
          assert.equal(
            (await db.query('SELECT count(*)::int AS n FROM "User"')).rows[0].n,
            1,
          );
        },
      );
      await t.test(
        "profile editing, strict ownership input, unique usernames and public privacy",
        async () => {
          await bob.requestLink("bob@example.test");
          await bob.verifyLastLink();
          bobId = (await bob.session()).user.id;
          const values = {
            username: "football-fan",
            displayName: "Alice",
            bio: "<script>alert(1)</script>",
          };
          const save = await alice.request("/api/account/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          });
          assert.equal(save.status, 200);
          const dto = (await save.json()).profile;
          assert.equal(dto.username, "football-fan");
          assert.equal(dto.userId, undefined);
          assert.equal(dto.email, undefined);
          aliceUsername = dto.username;
          const forbidden = await bob.request("/api/account/profile", {
            method: "PATCH",
            body: JSON.stringify({ ...values, userId: aliceId, role: "ADMIN" }),
          });
          assert.equal(forbidden.status, 400);
          const collision = await bob.request("/api/account/profile", {
            method: "PATCH",
            body: JSON.stringify(values),
          });
          assert.equal(collision.status, 409);
          assert.equal(
            (
              await alice.request("/api/account/profile", {
                method: "PATCH",
                body: "x".repeat(5000),
              })
            ).status,
            413,
          );
          const html = await (
            await fetch(`${base}/users/${aliceUsername}`)
          ).text();
          assert.ok(html.includes("Alice"));
          assert.ok(html.includes("&lt;script&gt;"));
          assert.ok(!html.includes("alice@example.test"));
          assert.ok(!html.includes(aliceId));
          assert.ok(!html.includes("<script>alert(1)</script>"));
          assert.equal(
            (await db.query('SELECT role FROM "User" WHERE id=$1', [bobId]))
              .rows[0].role,
            "USER",
          );
          assert.equal(
            (await fetch(`${base}/users/nonexistent-member`)).status,
            404,
          );
        },
      );
      await securityTests(t, {
        db,
        base,
        aliceId,
        bob,
        secret: env.AUTH_SECRET!,
      });
      await t.test(
        "configured trusted proxy rejects spoofing and limits client auth/email traffic",
        async () => {
          const clientPort = await unusedPort(),
            clientBase = `http://localhost:${clientPort}`;
          const preview = spawn(
            process.execPath,
            [
              "node_modules/next/dist/bin/next",
              "start",
              "--port",
              String(clientPort),
            ],
            {
              env: {
                ...env,
                AUTH_URL: clientBase,
                AUTH_TRUSTED_IP_HEADER: "x-real-ip",
              },
              stdio: "pipe",
            },
          );
          preview.stdout?.resume();
          preview.stderr?.resume();
          try {
            for (let i = 0; i < 100; i++) {
              try {
                if ((await fetch(`${clientBase}/login`)).ok) break;
              } catch {}
              await pause();
            }
            assert.equal(
              (
                await fetch(`${clientBase}/api/auth/csrf`, {
                  headers: { "x-forwarded-for": "192.0.2.1" },
                })
              ).status,
              403,
            );
            const csrf = await fetch(`${clientBase}/api/auth/csrf`, {
              headers: { "x-real-ip": "192.0.2.1" },
            });
            assert.equal(csrf.status, 200);
            const csrfToken = (await csrf.json()).csrfToken;
            const cookie = csrf.headers
              .getSetCookie()
              .map((value) => value.split(";")[0])
              .join("; ");
            const headers = {
              origin: clientBase,
              cookie,
              "x-real-ip": "192.0.2.1",
              "Content-Type": "application/x-www-form-urlencoded",
            };
            for (let i = 0; i < 30; i++)
              assert.equal(
                (
                  await fetch(`${clientBase}/api/auth/signout`, {
                    method: "POST",
                    headers,
                    body: new URLSearchParams({ csrfToken }),
                    redirect: "manual",
                  })
                ).status,
                302,
              );
            // A fixed-window limit may reset during the test. At most two windows fit this burst.
            let authLimited = false;
            for (let i = 0; i < 31 && !authLimited; i++) {
              const response = await fetch(`${clientBase}/api/auth/signout`, {
                method: "POST",
                headers: { ...headers, "x-forwarded-for": "192.0.2.99" },
                body: new URLSearchParams({ csrfToken }),
                redirect: "manual",
              });
              assert.ok([302, 429].includes(response.status));
              authLimited = response.status === 429;
            }
            assert.ok(authLimited);
            for (let i = 0; i < 10; i++) {
              const result = await fetch(
                `${clientBase}/api/auth/signin/nodemailer`,
                {
                  method: "POST",
                  headers: {
                    ...headers,
                    "x-real-ip": "192.0.2.2",
                    "X-Auth-Return-Redirect": "1",
                  },
                  body: new URLSearchParams({
                    csrfToken,
                    email: `proxy-${i}@example.test`,
                  }),
                },
              );
              assert.equal(result.status, 200);
              assert.ok(!(await result.json()).url.includes("error="));
            }
            let emailLimited = false;
            for (let i = 0; i < 11 && !emailLimited; i++) {
              const response = await fetch(
                `${clientBase}/api/auth/signin/nodemailer`,
                {
                  method: "POST",
                  headers: { ...headers, "x-real-ip": "192.0.2.2" },
                  body: new URLSearchParams({
                    csrfToken,
                    email: `proxy-extra-${i}@example.test`,
                  }),
                  redirect: "manual",
                },
              );
              emailLimited = response.status === 429;
            }
            assert.ok(emailLimited);
          } finally {
            if (preview.exitCode === null) {
              preview.kill("SIGTERM");
              await once(preview, "exit");
            }
          }
        },
      );
      await catalogueTests(t,{db,base});
      await communityTests(t, { alice, bob, db, base, aliceId, bobId });
      await interactionsTests(t, { db, base, alice, bob, aliceId, bobId });
      await reviewsTests(t, { db, base, alice, bob, aliceId, bobId });
      await footProfileTests(t, { db, base, alice, bob, aliceId, bobId });
      await recommendationTests(t, { db, base, alice, bob, aliceId });
      await reviewAnalysisTests(t, { db, alice, bob, aliceId, bobId, secret: env.AUTH_SECRET! });
      await finderTests(t, { db, base, alice, bob, aliceId, bobId, secret: env.AUTH_SECRET! });
      if(process.env.BOOTVERSE_BENCHMARK === "1") await recommendationPerformanceTests(t,{db,alice,aliceId,secret:env.AUTH_SECRET!});
      if (testStorage) await platformTests(t, { db, base, alice, bob, aliceId, bobId, env });
      await t.test(
        "expired sessions and concurrent unique-username updates",
        async () => {
          await db.query(
            'UPDATE "Session" SET expires=now()-interval \'1 minute\' WHERE "userId"=$1',
            [bobId],
          );
          assert.equal((await bob.session())?.user, undefined);
          assert.equal(
            (
              await bob.request("/api/account/profile", {
                method: "PATCH",
                body: "{}",
              })
            ).status,
            401,
          );
          await bob.requestLink("bob@example.test");
          await bob.verifyLastLink();
          assert.equal((await bob.session()).user.id, bobId);
          const values = {
            username: "concurrent-player",
            displayName: "Temporary integration member",
            bio: "",
          };
          const responses = await Promise.all(
            [alice, bob].map((browser) =>
              browser.request("/api/account/profile", {
                method: "PATCH",
                body: JSON.stringify(values),
              }),
            ),
          );
          assert.deepEqual(
            responses.map((response) => response.status).sort(),
            [200, 409],
          );
          assert.equal(
            (
              await db.query(
                'SELECT count(*)::int AS n FROM "UserProfile" WHERE username=$1',
                [values.username],
              )
            ).rows[0].n,
            1,
          );
        },
      );
      await t.test("expired links and email rate limiting", async () => {
        await alice.requestLink("alice@example.test");
        await db.query(
          "UPDATE \"VerificationToken\" SET expires=now()-interval '1 minute' WHERE identifier=$1",
          ["alice@example.test"],
        );
        const expiredMessage = mail.at(-1)!;
        const expired = expiredMessage
          .split(/\r?\n/)
          .find(
            (line) =>
              line.startsWith(base) &&
              line.includes("/api/auth/callback/nodemailer"),
          )!;
        const expiryRow = (
          await db.query(
            'SELECT expires FROM \"VerificationToken\" WHERE identifier=$1',
            ["alice@example.test"],
          )
        ).rows[0];
        assert.ok(
          expiryRow && expiryRow.expires.valueOf() < Date.now(),
          "Stored token must be expired in UTC.",
        );
        const expiredBrowser = new Browser();
        const response = await expiredBrowser.request(expired);
        const destination = new URL(
          response.headers.get("location") ?? "/",
          base,
        );
        assert.ok(
          destination.searchParams.has("error"),
          `Expired link status=${response.status} destination=${destination.pathname}`,
        );
        assert.equal((await expiredBrowser.session())?.user, undefined);
        const count = mail.length;
        const denied = await alice.requestLink("alice@example.test");
        assert.equal(denied.status, 200);
        assert.ok((await denied.json()).url.includes("error="));
        assert.equal(mail.length, count);
        const keys = (await db.query('SELECT key FROM "RateLimit"')).rows;
        assert.ok(keys.every((row) => /^[0-9a-f]{64}$/.test(row.key)));
      });
      await t.test(
        "suspended accounts are blocked server-side and hidden publicly",
        async () => {
          await db.query("UPDATE \"User\" SET status='SUSPENDED' WHERE id=$1", [
            bobId,
          ]);
          assert.equal(
            (
              await bob.request("/api/account/profile", {
                method: "PATCH",
                body: JSON.stringify({
                  username: "bob-player",
                  displayName: "Bob",
                  bio: "",
                }),
              })
            ).status,
            403,
          );
          const username = (
            await db.query(
              'SELECT username FROM "UserProfile" WHERE "userId"=$1',
              [bobId],
            )
          ).rows[0].username;
          assert.equal((await fetch(`${base}/users/${username}`)).status, 404);
        },
      );
      await t.test(
        "logout revokes sessions and existing cookies cannot authorize writes",
        async () => {
          const copied = new Browser();
          copied.cookies = new Map(alice.cookies);
          assert.equal(
            (await alice.request("/api/account/sessions", { method: "DELETE" }))
              .status,
            204,
          );
          assert.equal((await copied.session())?.user, undefined);
          assert.equal(
            (
              await copied.request("/api/account/profile", {
                method: "PATCH",
                body: "{}",
              })
            ).status,
            401,
          );
          const csrfToken = await alice.csrf();
          assert.equal(
            (
              await alice.request("/api/auth/signout", {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  csrfToken,
                  callbackUrl: `${base}/login`,
                }),
              })
            ).status,
            302,
          );
          assert.equal(
            (
              await db.query(
                'SELECT count(*)::int AS n FROM "Session" WHERE "userId"=$1',
                [aliceId],
              )
            ).rows[0].n,
            0,
          );
        },
      );
      await t.test(
        "catalogue remains usable when account services are unconfigured",
        async () => {
          const previewPort = await unusedPort();
          const previewBase = `http://localhost:${previewPort}`;
          const preview = spawn(
            process.execPath,
            [
              "node_modules/next/dist/bin/next",
              "start",
              "--port",
              String(previewPort),
            ],
            {
              env: {
                ...env,
                DATABASE_URL: "",
                AUTH_SECRET: "",
                AUTH_URL: "",
                EMAIL_SERVER: "",
                EMAIL_FROM: "",
              },
              stdio: "pipe",
            },
          );
          preview.stdout?.resume();
          preview.stderr?.resume();
          try {
            for (let i = 0; i < 100; i++) {
              try {
                if ((await fetch(`${previewBase}/login`)).ok) break;
              } catch {}
              await pause();
            }
            const html = await (await fetch(`${previewBase}/login`)).text();
            assert.ok(html.includes("Account setup is pending"));
            assert.equal(
              (await fetch(`${previewBase}/api/auth/session`)).status,
              503,
            );
            assert.equal(
              (await fetch(`${previewBase}/account`, { redirect: "manual" }))
                .status,
              307,
            );
            assert.equal((await fetch(`${previewBase}/boots`)).status, 200);
            assert.ok(
              (await (await fetch(`${previewBase}/community`)).text()).includes(
                "Community setup is pending",
              ),
            );
            assert.equal(
              (await fetch(`${previewBase}/api/community/posts`)).status,
              503,
            );
            assert.equal(
              (await fetch(`${previewBase}/api/reviews`)).status,
              503,
            );
            assert.equal(
              (
                await fetch(
                  `${previewBase}/api/boot-variants/mercurial-elite-fg/ratings`,
                )
              ).status,
              503,
            );
          } finally {
            preview.kill("SIGTERM");
            await once(preview, "exit");
          }
        },
      );
      if(process.env.BOOTVERSE_BENCHMARK === "1") {
        const events=appOutput.split("\n").filter(line=>line.startsWith('{"event":"boot_fit_request"')).map(line=>JSON.parse(line));
        assert.ok(events.some(event=>event.category === "success"));
        assert.ok(events.some(event=>event.category === "database" && event.status === 503));
        for(const event of events){
          assert.deepEqual(Object.keys(event).sort(),["category","durationMs","entryPoint","event","requestId","stages","status"]);
          assert.match(event.requestId,/^[\da-f-]{36}$/);
        }
      }
      const warnings = appOutput
        .split("\n")
        .filter((line) => line.includes("DeprecationWarning:"));
      for (const warning of warnings)
        console.warn("Observed runtime warning:", warning);
      assert.ok(
        !appOutput.includes("AdapterError"),
        "Revoked sessions should not raise adapter errors on logout.",
      );
      await t.test(
        "security response headers protect pages, assets and APIs",
        async () => {
          for (const path of [
            "/",
            "/boots",
            "/community",
            "/api/reviews",
            "/icon.svg",
          ]) {
            const response = await fetch(`${base}${path}`);
            assert.equal(
              response.headers.get("x-content-type-options"),
              "nosniff",
              path,
            );
            assert.equal(response.headers.get("x-frame-options"), "DENY", path);
            assert.equal(
              response.headers.get("referrer-policy"),
              "no-referrer",
              path,
            );
            assert.ok(
              response.headers
                .get("content-security-policy")
                ?.includes("frame-ancestors 'none'"),
              path,
            );
            assert.ok(
              response.headers.get("permissions-policy")?.includes("camera=()"),
              path,
            );
            assert.equal(response.headers.get("x-powered-by"), null, path);
          }
        },
      );
      await t.test("Phase 1 routes and catalogue still render", async () => {
        assert.equal((await fetch(`${base}/`)).status, 200);
        const catalogue = await (
          await fetch(`${base}/boots?brand=nike&surface=FG`)
        ).text();
        assert.ok(catalogue.includes("sample-mercurial-volt-fg"));
        assert.ok(catalogue.includes("sample-mercurial-onyx-fg"));
        assert.ok(!catalogue.includes('href="/boots/sample-future-peach-ag'));
        assert.equal(
          (await fetch(`${base}/boots/sample-future-peach-ag`)).status,
          200,
        );
      });
    } catch (error) {
      // Logs are sanitized by the app; never print SMTP messages, cookies or environment.
      console.error(appOutput.replace(/token=[^\s&]+/g, "token=[redacted]"));
      throw error;
    }
  },
);
