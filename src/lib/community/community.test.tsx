import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  postSchema,
  editPostSchema,
  feedQuery,
  feedHref,
  safeMarkdownUrl,
  postExcerpt,
} from "./validation";
import { requirePostManager, canManagePost } from "./authorization";
import type { Principal } from "../accounts/authorization";
import { PostMarkdown } from "../../components/community/markdown";
const valid = {
  title: "A question about turf boots",
  content: "What have you noticed when playing on older turf pitches?",
  categoryId: "questions",
  tags: ["Turf", "turf", "Sizing-Help"],
  bootEntryId: null,
};
const owner: Principal = {
  id: "alice",
  role: "USER",
  status: "ACTIVE",
  emailVerified: new Date(),
};
describe("community validation", () => {
  it("normalizes, deduplicates and orders tags", () =>
    expect(postSchema.parse(valid).tags).toEqual(["sizing-help", "turf"]));
  it.each([
    { title: "hi" },
    { title: "👟👟👟" },
    { content: "short" },
    { content: "x".repeat(10001) },
    { categoryId: "made-up" },
    { tags: ["bad tag"] },
    { tags: Array(6).fill("turf") },
    { tags: ["x".repeat(25)] },
    { bootEntryId: "" },
    { status: "PUBLISHED" },
    { authorId: "bob" },
  ])("rejects invalid post input %j", (fields) =>
    expect(postSchema.safeParse({ ...valid, ...fields }).success).toBe(false),
  );
  it("requires a version for updates", () => {
    expect(editPostSchema.safeParse(valid).success).toBe(false);
    expect(editPostSchema.safeParse({ ...valid, version: 1 }).success).toBe(
      true,
    );
    expect(editPostSchema.safeParse({ ...valid, version: -1 }).success).toBe(
      false,
    );
  });
  it("parses bounded filters and encodes shareable pagination links", () => {
    const filters = feedQuery(
      new URLSearchParams(
        "q=wide+feet&tag=Turf&category=sizing-help&page=2&sort=oldest",
      ),
    );
    expect(filters.tag).toBe("turf");
    expect(filters.page).toBe(2);
    const url = feedHref(filters, { page: 3 });
    expect(new URL(url, "https://bootverse.local").searchParams.get("q")).toBe(
      "wide feet",
    );
    expect(url).toContain("page=3");
  });
  it.each([
    "page=0",
    "page=1001",
    "page=nope",
    "page=1.5",
    "sort=unsupported",
    "category=unknown",
    "q=" + "x".repeat(101),
  ])("rejects invalid filter %s", (query) =>
    expect(() => feedQuery(new URLSearchParams(query))).toThrow(),
  );
  it("makes excerpts plain bounded text", () => {
    expect(
      postExcerpt("**Boots** [link](https://example.com) <img src=x>"),
    ).toBe("Boots link");
    expect(postExcerpt("a".repeat(500))).toHaveLength(220);
    expect(postExcerpt("**Visible** <script>alert(1)</script>")).toBe(
      "Visible",
    );
  });
});
describe("post authorization", () => {
  it("rejects anonymous and other authors", () => {
    expect(() => requirePostManager(null, "alice")).toThrow();
    expect(() =>
      requirePostManager({ ...owner, id: "bob" }, "alice"),
    ).toThrow();
  });
  it("allows owners and authorized moderators, blocks inactive roles", () => {
    expect(canManagePost(owner, "alice")).toBe(true);
    expect(
      canManagePost({ ...owner, id: "bob", role: "MODERATOR" }, "alice"),
    ).toBe(true);
    expect(
      canManagePost({ ...owner, role: "ADMIN", status: "SUSPENDED" }, "alice"),
    ).toBe(false);
    expect(canManagePost({ ...owner, emailVerified: null }, "alice")).toBe(
      false,
    );
  });
});
describe("safe Markdown", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,bad",
    "vbscript:msgbox(1)",
    "https://user:pass@example.com",
    "https:\\evil.test",
    "mailto:private@example.com",
  ])("blocks unsafe URL %s", (value) =>
    expect(safeMarkdownUrl(value)).toBe(""),
  );
  it("preserves normal web and internal links", () => {
    expect(safeMarkdownUrl("https://example.com/boots")).toBe(
      "https://example.com/boots",
    );
    expect(safeMarkdownUrl("/boots?brand=nike")).toBe("/boots?brand=nike");
  });
  it("drops raw HTML, unsafe links and remote image loads", () => {
    const html = renderToStaticMarkup(
      createElement(PostMarkdown, {
        content:
          "**Experience**\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert%281%29)\n\n![photo](https://tracking.test/private.png)\n\n[safe](https://example.com)",
      }),
    );
    expect(html).toContain("<strong>Experience</strong>");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("tracking.test");
    expect(html).toContain('rel="ugc nofollow noopener noreferrer"');
  });
});
