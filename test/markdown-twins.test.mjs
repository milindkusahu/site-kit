import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeMarkdownTwins } from "../assets/markdown.mjs";

let dir = "";

function page(rel, { title = "Page", canonical, main }) {
  const file = path.join(dir, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  const link = canonical ? `<link rel="canonical" href="${canonical}">` : "";
  writeFileSync(file, `<!doctype html><html><head><title>${title}</title><meta name="description" content="About &quot;it&quot;">${link}</head><body><header>Menu</header>${main ?? ""}</body></html>`);
}

const read = (rel) => readFileSync(path.join(dir, rel), "utf8");

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "kit-md-"));
  page("index.html", { title: "Home", canonical: "https://x.example/", main: '<main><h1>Home</h1><p>See <a href="/tool/">the tool</a>.</p><script>x()</script></main>' });
  page("404.html", { title: "Not found", main: "<main><h1>Not here</h1></main>" });
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("site-kit markdown", () => {
  it("writes a copy with front matter, only the main content and absolute links", () => {
    writeMarkdownTwins(dir);
    const home = read("index.md");
    expect(home).toMatch(/^---\ntitle: "Home"\ndescription: "About \\"it\\""\nurl: https:\/\/x.example\/\n---\n\n# Home\n/);
    expect(home).toContain("[the tool](https://x.example/tool/)");
    expect(home).not.toContain("Menu");
    expect(home).not.toContain("x()");
  });

  it("replaces the tool with a note that links to the page, and drops controls", () => {
    page("tool/index.html", { canonical: "https://x.example/tool/", main: '<main><h1>Tool</h1><div data-tool><input><button>Go</button></div><button><b>Save</b></button><svg></svg></main>' });
    writeMarkdownTwins(dir, { toolNote: "Use the cropper at {url}." });
    const tool = read("tool/index.md");
    expect(tool).toContain("Use the cropper at <https://x.example/tool/>.");
    expect(tool).toContain("**Save**");
    expect(tool).not.toContain("Go");
  });

  it("gives the 404 copy links to the sitemap and llms.txt", () => {
    writeMarkdownTwins(dir);
    const missing = read("404.md");
    expect(missing).toContain("url: https://x.example/404");
    expect(missing).toContain("(https://x.example/sitemap.xml)");
    expect(missing).toContain("(https://x.example/llms.txt)");
  });

  it("skips the offline page and files without a main element, and handles flat .html pages", () => {
    page("offline/index.html", { main: "<main><h1>Offline</h1></main>" });
    page("google123.html", {});
    page("about.html", { main: "<main><h1>About</h1></main>" });
    const written = writeMarkdownTwins(dir);
    expect(existsSync(path.join(dir, "offline", "index.md"))).toBe(false);
    expect(existsSync(path.join(dir, "google123.md"))).toBe(false);
    expect(read("about.md")).toContain("url: https://x.example/about\n");
    expect(written).toHaveLength(3);
  });

  it("fails clearly without a 404 page or an origin", () => {
    rmSync(path.join(dir, "404.html"));
    expect(() => writeMarkdownTwins(dir)).toThrow(/404\.md/);
    rmSync(path.join(dir, "index.html"));
    expect(() => writeMarkdownTwins(dir)).toThrow(/markdown\.origin/);
    expect(() => writeMarkdownTwins(path.join(dir, "nope"))).toThrow(/Run the build first/);
  });
});
