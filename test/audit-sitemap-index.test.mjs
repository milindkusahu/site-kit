import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULTS, lengthLimits } from "../bin/config.mjs";
import { parsePage } from "../checks/audit/html.mjs";
import { checkTitleAndDescription } from "../checks/audit/onpage.mjs";
import { loadSitemap } from "../checks/audit/technical.mjs";

const PROD = "https://example.com";
const urlset = (...paths) => `<urlset>${paths.map((p) => `<url><loc>${PROD}${p}</loc><image:image><image:loc>${PROD}/img.png</image:loc></image:image></url>`).join("")}</urlset>`;
const index = (...paths) => `<sitemapindex>${paths.map((p) => `<sitemap><loc>${PROD}${p}</loc></sitemap>`).join("")}</sitemapindex>`;

let server;
let base;
let routes;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const body = routes[req.url];
    res.writeHead(body === undefined ? 404 : 200, { "content-type": "application/xml" });
    res.end(body ?? "");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server.close());

async function load() {
  const problems = [];
  const ctx = { base, fail: (rule, url, message) => problems.push({ rule, url, message }) };
  return { urls: await loadSitemap(ctx), problems };
}

describe("audit sitemap index", () => {
  it("crawls the child sitemaps of an index as pages, deduped, ignoring image locs", async () => {
    routes = {
      "/sitemap.xml": index("/sitemap-a.xml", "/sitemap-b.xml"),
      "/sitemap-a.xml": urlset("/", "/one/"),
      "/sitemap-b.xml": urlset("/one/", "/two/"),
    };
    const { urls, problems } = await load();
    expect(urls).toEqual([`${PROD}/`, `${PROD}/one/`, `${PROD}/two/`]);
    expect(problems).toEqual([]);
  });

  it("reports a child that fails to fetch, naming it", async () => {
    routes = { "/sitemap.xml": index("/sitemap-a.xml", "/sitemap-gone.xml"), "/sitemap-a.xml": urlset("/") };
    const { urls, problems } = await load();
    expect(urls).toEqual([`${PROD}/`]);
    expect(problems).toHaveLength(1);
    expect(problems[0].rule).toBe("tech/sitemap");
    expect(problems[0].message).toContain("sitemap-gone.xml");
  });

  it("still reads a plain urlset", async () => {
    routes = { "/sitemap.xml": urlset("/", "/one/") };
    expect((await load()).urls).toEqual([`${PROD}/`, `${PROD}/one/`]);
  });
});

describe("audit title and description limits", () => {
  const run = (titleLen, descLen, limits) => {
    const problems = [];
    const ctx = { fail: (rule, url, message) => problems.push({ rule, message }) };
    const html = `<html><head><title>${"t".repeat(titleLen)}</title><meta name="description" content="${"d".repeat(descLen)}"></head><body></body></html>`;
    checkTitleAndDescription(ctx, { url: "http://x/", root: parsePage(html).root }, limits);
    return problems;
  };

  it("defaults to 15 to 55 and 70 to 150", () => {
    expect(lengthLimits(DEFAULTS)).toEqual({ title: { min: 15, max: 55 }, description: { min: 70, max: 150 } });
    expect(run(15, 70)).toEqual([]);
    expect(run(55, 150)).toEqual([]);
    expect(run(14, 69).map((p) => p.rule)).toEqual(["onpage/title", "onpage/description"]);
    expect(run(56, 151).map((p) => p.rule)).toEqual(["onpage/title", "onpage/description"]);
    expect(run(14, 70)[0].message).toContain("(15 to 55)");
  });

  it("honours configured limits and shows the range", () => {
    const limits = lengthLimits({ ...DEFAULTS, minTitleChars: 10, maxTitleChars: 70, minDescriptionChars: 50, maxDescriptionChars: 200 });
    expect(run(70, 200, limits)).toEqual([]);
    expect(run(10, 50, limits)).toEqual([]);
    const problems = run(71, 201, limits);
    expect(problems[0].message).toContain("(10 to 70)");
    expect(problems[1].message).toContain("(50 to 200)");
  });
});
