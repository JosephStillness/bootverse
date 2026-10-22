import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { createRequire } from "node:module";
import { afterAll, describe, expect, it } from "vitest";
import { ESLint } from "eslint";

const require = createRequire(import.meta.url);
const pluginRequire = createRequire(require.resolve("@next/eslint-plugin-next"));
const { getRootDirs } = pluginRequire("./utils/get-root-dirs.js");
const fixture = mkdtempSync(join(tmpdir(), "bootverse-lint-"));
for (const app of ["web", "admin"]) {
  mkdirSync(join(fixture, app, "pages"), { recursive: true });
  writeFileSync(join(fixture, app, "pages", "index.tsx"), "export default function Home() { return null; }");
}
afterAll(() => rmSync(fixture, { recursive: true, force: true }));

describe("Next lint dependency compatibility", () => {
  it("uses the Node built-in adapter instead of the vulnerable braces chain", () => {
    const manifest = pluginRequire("fast-glob/package.json");
    expect(manifest.name).toBe("@bootverse/next-lint-glob");
  });

  it("resolves default, string, glob and array Next project roots", () => {
    const roots = (rootDir?: string | string[]) => getRootDirs({ cwd: fixture, settings: { next: { rootDir } } });
    expect(roots()).toEqual([fixture]);
    expect(roots(join(fixture, "web"))).toEqual([join(fixture, "web")]);
    expect(roots(join(fixture, "{web,admin}" )).sort()).toEqual([join(fixture, "admin"), join(fixture, "web")]);
    expect(roots([join(fixture, "web"), join(fixture, "admin")]).sort()).toEqual([join(fixture, "admin"), join(fixture, "web")]);
    expect(roots(join(fixture, "missing-*"))).toEqual([]);
    writeFileSync(join(fixture, "not-a-directory"), "fixture");
    expect(roots(join(fixture, "*")).sort()).toEqual([join(fixture, "admin"), join(fixture, "web")]);
    expect(roots(relative(process.cwd(), join(fixture, "web")))).toEqual([relative(process.cwd(), join(fixture, "web"))]);
  });

  it("still reports Next navigation violations with configured project roots", async () => {
    const plugin = pluginRequire("@next/eslint-plugin-next");
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [{
      files: ["**/*.jsx"],
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { "@next/next": plugin },
      settings: { next: { rootDir: join(fixture, "*") } },
      rules: { "@next/next/no-html-link-for-pages": "error" },
    }] });
    const [result] = await eslint.lintText('export default function Link() { return <a href="/">Home</a>; }', { filePath: join(dirname(require.resolve("../package.json")), "lint-fixture.jsx") });
    expect(result.messages.some(message => message.ruleId === "@next/next/no-html-link-for-pages")).toBe(true);
  });
});
