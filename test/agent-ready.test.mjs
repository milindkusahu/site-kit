import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isPreviewHost } from "../checks/audit/fetch.mjs";
import { checkAgentReadiness } from "../checks/audit/technical.mjs";

const GOOD_ROBOTS = "User-agent: *\nAllow: /\nContent-Signal: search=yes, ai-input=yes, ai-train=yes\n\nSitemap: https://x.example/sitemap.xml\n";
let site = {};
let server;
let base = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    const reply = site[req.url ?? "/"];
    if (!reply) return void res.writeHead(404).end("missing");
    if (reply.redirect) return void res.writeHead(301, { location: reply.redirect }).end();
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

  it("reads the Link header where the homepage redirects to (www to apex, http to https)", async () => {
    const live = ready();
    site = { ...live, "/": { redirect: "/home/" }, "/home/": live["/"] };
    expect(await run({ markdown: false })).toEqual([]);
  });
});

describe("launch audit: which hosts get the Cloudflare zone checks", () => {
  it.each(["http://localhost:4321", "http://app.localhost", "http://mac.local:4321", "http://127.0.1.1:4321", "http://0.0.0.0:4321", "http://10.0.0.5", "http://172.20.1.2", "http://192.168.1.20:4321", "http://169.254.1.1", "http://[::1]:4321", "http://[fd12::1]", "http://[fe80::1]", "https://my-site.acct.workers.dev", "https://abc.my-site.pages.dev"])("treats %s as a preview", (url) => {
    expect(isPreviewHost(url)).toBe(true);
  });

  it.each(["https://example.com", "https://www.example.com", "http://8.8.8.8", "http://172.32.0.1", "https://localhost.example.com"])("treats %s as live", (url) => {
    expect(isPreviewHost(url)).toBe(false);
  });
});
