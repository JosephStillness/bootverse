import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { ReviewPagination } from "./review-pagination";
const render = (page: number, pages: number) =>
  renderToStaticMarkup(
    createElement(ReviewPagination, { page, pages, onChange: () => {} }),
  );
describe("review pagination", () => {
  it("omits controls on the first and only page", () => {
    expect(render(1, 1)).toBe("");
    expect(render(1, 0)).toBe("");
  });
  it("allows returning from a page removed by concurrent deletion", () => {
    const html = render(2, 1);
    expect(html).toContain("Previous");
    expect(html).toContain("This page is no longer available");
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Next<\/button>/);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Previous<\/button>/);
  });
  it("allows returning when all reviews disappeared", () => {
    expect(render(2, 0)).toContain("Previous");
  });
  it("enables normal middle-page navigation", () => {
    const html = render(2, 3);
    expect(html).toContain("Page 2 of 3");
    expect(html).toContain("Previous");
    expect(html).toContain("Next");
    expect(html).not.toContain('disabled=""');
  });
});
