import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkAgentReadiness } from "../checks/audit/technical.mjs";

const GOOD_ROBOTS = "User-agent: *\nAllow: /\nContent-Signal: search=yes, ai-input=yes, ai-train=yes\n\nSitemap: https://x.example/sitemap.xml\n";
let site = {};
let server;
let base = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    const reply = site[req.url ?? "/"];
    if (!reply) return void res.writeHead(404).end("missing");
    const wantsMarkdown = (req.headers.accept ?? "").includes("text/markdown");
    const type = wantsMarkdown && site.markdown ? "text/markdown; charset=utf-8" : reply.type;
    res.writeHead(200, { "content-type": type, ...(reply.link ? { link: reply.link } : {}) }).end(reply.body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

async function run(options) {
  const problems = [];
  await checkAgentReadiness({ base, fail: (rule, url, message) => problems.push({ rule, url, message }) }, options);
  return problems.map((p) => p.rule);
}

const ready = () => ({
  "/robots.txt": { type: "text/plain", body: GOOD_ROBOTS },
  "/": { type: "text/html", body: "<h1>Hi</h1>", link: '</llms.txt>; rel="describedby"; type="text/markdown", </sitemap.xml>; rel="sitemap"' },
  "/llms.txt": { type: "text/plain", body: "# Site" },
  markdown: true,
});

describe("launch audit: agent readiness", () => {
  it("passes a site with Content Signals, a describedby Link header and markdown negotiation", async () => {
    site = ready();
    expect(await run({ markdown: true })).toEqual([]);
  });

  it("fails robots.txt without a Content-Signal line", async () => {
    site = { ...ready(), "/robots.txt": { type: "text/plain", body: "User-agent: *\nAllow: /\n" } };
    expect(await run({ markdown: false })).toEqual(["agent/content-signals"]);
  });

  it("fails a homepage without a describedby Link header, even with a sitemap link", async () => {
    site = { ...ready(), "/": { type: "text/html", body: "<h1>Hi</h1>", link: '</sitemap.xml>; rel="sitemap"' } };
    expect(await run({ markdown: false })).toEqual(["agent/link-header"]);
  });

  it("fails a describedby link whose target is missing", async () => {
    site = ready();
    delete site["/llms.txt"];
    expect(await run({ markdown: false })).toEqual(["agent/link-header"]);
  });

  it("checks markdown negotiation only when asked (the live site, not a local build)", async () => {
    site = { ...ready(), markdown: false };
    expect(await run({ markdown: false })).toEqual([]);
    expect(await run({ markdown: true })).toEqual(["agent/markdown"]);
  });

  it("fails a Content-Signal line with no value, even when another line follows", async () => {
    site = { ...ready(), "/robots.txt": { type: "text/plain", body: "User-agent: *\nAllow: /\nContent-Signal: \n\nSitemap: https://x.example/sitemap.xml\n" } };
    expect(await run({ markdown: false })).toEqual(["agent/content-signals"]);
  });
});
