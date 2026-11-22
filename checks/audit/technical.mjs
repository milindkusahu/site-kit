import { fetchRaw, follow } from "./fetch.mjs";
import { jsonLd, meta, walkJson } from "./html.mjs";

export async function checkSoft404(ctx) {
  const probe = new URL(`/audit-missing-page-${Date.now()}/`, ctx.base).href;
  const res = await fetchRaw(probe);
  if (res.status !== 404) ctx.fail("tech/soft-404", probe, `A missing page returned ${res.status}, not 404.`);
}

export async function checkRobots(ctx) {
  const res = await fetchRaw(new URL("/robots.txt", ctx.base).href);
  if (res.status !== 200) return ctx.fail("tech/robots", "/robots.txt", `robots.txt returned ${res.status}.`);
  if (!/^sitemap:\s*\S+/im.test(res.body)) ctx.fail("tech/robots", "/robots.txt", "robots.txt has no Sitemap: line.");
  if (/^disallow:\s*\/\s*$/im.test(res.body)) ctx.fail("tech/robots", "/robots.txt", "robots.txt blocks the whole site.");
  return undefined;
}

export async function loadSitemap(ctx) {
  const res = await fetchRaw(new URL("/sitemap.xml", ctx.base).href);
  if (res.status !== 200) {
    ctx.fail("tech/sitemap", "/sitemap.xml", `sitemap.xml returned ${res.status}.`);
    return [];
  }
  return [...res.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

export function checkHead(ctx, page) {
  const { root, url } = page;
  const canonical = meta(root, 'link[rel="canonical"]', "href");
  const expected = ctx.productionUrl(url);
  if (!canonical) ctx.fail("tech/canonical", url, "No canonical link.");
  else if (!/^https:\/\//.test(canonical) || canonical.includes("?")) ctx.fail("tech/canonical", url, `Canonical must be absolute https with no query: ${canonical}`);
  else if (expected && canonical !== expected) ctx.fail("tech/canonical", url, `Canonical ${canonical} isn't this page (${expected}).`);
  if (!root.querySelector("html")?.getAttribute("lang")) ctx.fail("tech/lang", url, "<html> has no lang attribute.");
  if (!meta(root, 'meta[name="viewport"]')) ctx.fail("tech/viewport", url, "No viewport meta tag.");
  if (!meta(root, 'meta[property="og:image"]')) ctx.fail("tech/og", url, "No og:image.");
  if (!meta(root, 'meta[name="twitter:card"]')) ctx.fail("tech/og", url, "No twitter:card.");
  if (!root.querySelector('link[rel="manifest"]')) ctx.fail("tech/pwa", url, "No web app manifest link.");
  if (!root.querySelector('link[rel~="icon"]')) ctx.fail("tech/favicon", url, "No favicon link.");
  return canonical;
}

export function checkStructuredData(ctx, page) {
  const blocks = jsonLd(page.root);
  if (blocks.length === 0) return ctx.fail("tech/schema", page.url, "No JSON-LD on the page.");
  const defined = new Set();
  const referenced = new Set();
  const types = new Set();
  for (const block of blocks) {
    if (!block.ok) ctx.fail("tech/schema", page.url, `JSON-LD doesn't parse: ${block.error}`);
    else walkJson(block.value, (node) => collect(node, { defined, referenced, types }));
  }
  for (const ref of referenced) if (!defined.has(ref)) ctx.fail("tech/schema", page.url, `JSON-LD references ${ref}, which isn't defined on the page.`);
  const isHome = new URL(page.url).pathname === "/";
  if (!isHome && !types.has("BreadcrumbList")) ctx.fail("tech/schema", page.url, "No BreadcrumbList schema.");
  if (![...types].some((t) => /Page$/.test(t))) ctx.fail("tech/schema", page.url, "No WebPage-type node.");
  return types;
}

function collect(node, sets) {
  const keys = Object.keys(node);
  const id = node["@id"];
  if (typeof id === "string") (keys.length === 1 ? sets.referenced : sets.defined).add(id);
  const type = node["@type"];
  for (const t of Array.isArray(type) ? type : [type]) if (typeof t === "string") sets.types.add(t);
}

export async function checkQueryCanonical(ctx, page, canonical) {
  if (!canonical) return;
  const variant = new URL(page.url);
  variant.searchParams.set("utm_source", "audit");
  const res = await follow(variant.href);
  const match = res.body.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
  if (res.status !== 200 || !match || match[1] !== canonical) ctx.fail("tech/query-canonical", variant.href, "A query-string variant doesn't canonicalize to the clean URL.");
}

export function checkHreflang(ctx, pages) {
  const map = new Map();
  for (const p of pages) {
    const alts = p.root.querySelectorAll('link[rel="alternate"][hreflang]').map((l) => ({ lang: l.getAttribute("hreflang"), href: l.getAttribute("href") }));
    if (alts.length > 0) map.set(ctx.productionUrl(p.url), alts);
  }
  for (const [url, alts] of map) {
    if (!alts.some((a) => a.lang === "x-default")) ctx.fail("tech/hreflang", url, "hreflang set has no x-default.");
    for (const alt of alts) {
      const back = map.get(alt.href);
      if (alt.href !== url && !(back ?? []).some((b) => b.href === url)) ctx.fail("tech/hreflang", url, `${alt.href} doesn't link back with hreflang.`);
    }
  }
}

export async function checkManifest(ctx) {
  const res = await fetchRaw(new URL("/manifest.webmanifest", ctx.base).href);
  if (res.status !== 200) return ctx.fail("tech/pwa", "/manifest.webmanifest", `Manifest returned ${res.status}.`);
  const sizes = (JSON.parse(res.body).icons ?? []).map((i) => i.sizes);
  for (const size of ["192x192", "512x512"]) if (!sizes.includes(size)) ctx.fail("tech/pwa", "/manifest.webmanifest", `Manifest has no ${size} icon.`);
  const sw = await fetchRaw(new URL("/sw.js", ctx.base).href);
  if (sw.status !== 200) ctx.fail("tech/pwa", "/sw.js", "No service worker at /sw.js.");
  return undefined;
}

function linkTargets(header, rel) {
  return header
    .split(/,(?=\s*<)/)
    .filter((part) => (/;\s*rel="?([^";]+)"?/i.exec(part)?.[1] ?? "").toLowerCase().split(/\s+/).includes(rel))
    .map((part) => /<([^>]*)>/.exec(part)?.[1])
    .filter(Boolean);
}

export async function checkAgentReadiness(ctx, { markdown = false } = {}) {
  const robots = await fetchRaw(new URL("/robots.txt", ctx.base).href);
  if (!/^content-signal:\s*\S/im.test(robots.body)) ctx.fail("agent/content-signals", "/robots.txt", "robots.txt has no Content-Signal line. site-kit's robotsTxt() writes one; set contentSignal in SITE to change the values.");
  const home = new URL("/", ctx.base).href;
  const res = await fetchRaw(home);
  const [described] = linkTargets(res.headers.get("link") ?? "", "describedby");
  if (!described) ctx.fail("agent/link-header", home, 'No Link header with rel="describedby" on the homepage (agents use it to find llms.txt). site-kit\'s securityHeaders() sends one.');
  else if ((await fetchRaw(new URL(described, home).href)).status !== 200) ctx.fail("agent/link-header", home, `The Link header's describedby target ${described} doesn't return 200.`);
  if (!markdown) return;
  const md = await fetch(home, { headers: { Accept: "text/markdown", "Cache-Control": "no-cache", "User-Agent": "workflow-site-audit" } });
  if (!(md.headers.get("content-type") ?? "").includes("text/markdown")) ctx.fail("agent/markdown", home, "Asking for Accept: text/markdown didn't return markdown. Turn on Markdown for Agents for the zone in Cloudflare (AI Crawl Control; Pro plan or above).");
}
