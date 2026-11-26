import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MARKER, writeRedirects } from "../assets/redirects.mjs";

let dir = "";

function file(rel, body = "<!doctype html>") {
  const full = path.join(dir, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, body);
}

const read = () => readFileSync(path.join(dir, "_redirects"), "utf8");

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "kit-redirects-"));
  for (const rel of ["index.html", "404.html", "square-crop/index.html", "guides/how-to/index.html", "guides/index.html", "_astro/index.html", "og/card.png"]) file(rel);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("site-kit redirects", () => {
  it("301s every built page without its slash, and /index.html, to the canonical path", () => {
    writeRedirects(dir);
    expect(read()).toBe(`${MARKER}\n/guides /guides/ 301\n/guides/how-to /guides/how-to/ 301\n/square-crop /square-crop/ 301\n/index.html / 301\n`);
  });

  it("skips asset folders and folders without a page", () => {
    writeRedirects(dir);
    expect(read()).not.toMatch(/_astro|\/og /);
  });

  it("keeps the project's own rules first and never doubles a source they already redirect", () => {
    file("_redirects", "/old-tool /square-crop/ 301\n/square-crop /square-crop/ 301\n");
    const { kept, generated } = writeRedirects(dir);
    expect(kept).toBe(2);
    expect(generated).not.toContain("/square-crop /square-crop/ 301");
    expect(read().startsWith("/old-tool /square-crop/ 301\n/square-crop /square-crop/ 301\n\n")).toBe(true);
  });

  it("gives the same file when run twice", () => {
    file("_redirects", "/old /new/ 301\r\n");
    writeRedirects(dir);
    const first = read();
    writeRedirects(dir);
    expect(read()).toBe(first);
  });

  it("fails clearly before the build has run", () => {
    expect(() => writeRedirects(path.join(dir, "missing"))).toThrow(/Run the build first/);
  });
});
