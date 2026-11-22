import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { checkBrief, checkExternalLinks, checkInternalLinkNearTop } from "./content.mjs";
import { fetchRaw, follow, makeMapper } from "./fetch.mjs";
import { meta, parsePage } from "./html.mjs";
import { checkAds, checkCopy, checkDuplicates, checkHeadings, checkImages, checkLinks, checkParagraphs, checkPlaceholders, checkTitleAndDescription } from "./onpage.mjs";
import { headerProblems } from "../../headers/security.mjs";
import { checkSimilarity } from "./similarity.mjs";
import { checkAgentReadiness, checkHead, checkHreflang, checkManifest, checkQueryCanonical, checkRobots, checkSoft404, checkStructuredData, loadSitemap } from "./technical.mjs";

export const CONTENT_TYPES = new Set(["home", "tool", "howto", "comparison", "explainer", "hub"]);
const MAX_PAGES = 1000;

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function loadPlan(root) {
  const siloFile = path.join(root, "docs", "silo.json");
  const briefsDir = path.join(root, "docs", "briefs");
  const silo = existsSync(siloFile) ? readJson(siloFile) : null;
  const briefs = new Map();
  if (existsSync(briefsDir)) {
    for (const f of readdirSync(briefsDir).filter((x) => x.endsWith(".json"))) {
      const brief = readJson(path.join(briefsDir, f));
      briefs.set(brief.path, brief);
    }
  }
  return { silo, briefs };
}

function linksOf(page, mapper) {
  return page.root
    .querySelectorAll("a[href]")
    .map((a) => a.getAttribute("href") ?? "")
    .filter((h) => h && !h.startsWith("#") && !h.startsWith("mailto:") && !h.startsWith("tel:") && mapper.isInternal(h))
    .map((h) => {
      const u = new URL(mapper.toLocal(h));
      u.hash = "";
      u.search = "";
      return u.href;
    });
}

async function crawl(ctx, seeds) {
  const queue = [...new Set(seeds)];
  const seen = new Set(queue);
  const pages = [];
  const processed = new Set();
  const inbound = new Map();
  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const url = queue.shift();
    const res = await follow(url);
    if (res.hops.length > 0) ctx.fail(res.hops.length > 1 ? "tech/redirect-chain" : "tech/link-to-redirect", url, `Redirects ${res.hops.map((h) => `${h.status} to ${h.to}`).join(", then ")}. Link to the final URL.`);
    if (res.status !== 200) {
      ctx.fail("tech/broken", url, `Returned ${res.status}. Linked from ${[...(inbound.get(url) ?? ["the sitemap"])].slice(0, 3).join(", ")}.`);
      continue;
    }
    if (!res.type.includes("html") || processed.has(res.url)) continue;
    processed.add(res.url);
    const { root, main } = parsePage(res.body);
    const page = { url: res.url, html: res.body, root, main };
    pages.push(page);
    for (const link of linksOf(page, ctx.mapper)) {
      if (link !== page.url) inbound.set(link, new Set([...(inbound.get(link) ?? []), page.url]));
      if (!seen.has(link)) {
        seen.add(link);
        queue.push(link);
      }
    }
  }
  return { pages, inbound };
}

function pageType(page) {
  return page.root.querySelector("main")?.getAttribute("data-page-type") ?? "unknown";
}

function isNoindex(page) {
  return (meta(page.root, 'meta[name="robots"]') ?? "").includes("noindex");
}

async function checkPage(ctx, page, plan) {
  const type = pageType(page);
  const brief = plan.briefs.get(ctx.mapper.pathOf(page.url));
  const canonical = checkHead(ctx, page);
  checkStructuredData(ctx, page);
  Object.assign(page, checkTitleAndDescription(ctx, page));
  page.h1 = checkHeadings(ctx, page);
  checkImages(ctx, page);
  checkLinks(ctx, page);
  page.copy = checkCopy(ctx, page);
  page.type = type;
  page.isContent = CONTENT_TYPES.has(type) && !isNoindex(page);
  page.primaryQuery = brief?.primaryQuery ?? "";
  if (!isNoindex(page)) checkParagraphs(ctx, page, type);
  if (page.root.querySelector("body")?.getAttribute("data-ads") !== "off") checkAds(ctx, page);
  if (ctx.launch) checkPlaceholders(ctx, page, page.html);
  if (ctx.sitemapSet.has(page.url)) await checkQueryCanonical(ctx, page, canonical);
  checkPlanned(ctx, page, plan, brief);
}

function checkPlanned(ctx, page, plan, brief) {
  if (!plan.silo || !page.isContent) return;
  const planned = new Set((plan.silo.pages ?? []).map((p) => p.path));
  const p = ctx.mapper.pathOf(page.url);
  if (!planned.has(p)) ctx.fail("plan/unplanned-page", page.url, "Content page isn't in docs/silo.json. Add it to the silo plan first.");
  if (!brief) return ctx.fail("plan/brief-missing", page.url, `No brief in docs/briefs/ for ${p}.`);
  checkBrief(ctx, page, brief);
  checkExternalLinks(ctx, page, brief);
  if (page.type !== "home") checkInternalLinkNearTop(ctx, page);
  return undefined;
}

function checkSitemapAndOrphans(ctx, pages, inbound) {
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  for (const url of ctx.sitemapSet) {
    const page = byUrl.get(url);
    if (page && isNoindex(page)) ctx.fail("tech/sitemap-noindex", url, "In the sitemap but set to noindex.");
    if (new URL(url).pathname !== "/" && (inbound.get(url)?.size ?? 0) === 0) ctx.fail("tech/orphan", url, "No internal link points to this page.");
  }
  for (const page of pages) {
    if (!isNoindex(page) && !ctx.sitemapSet.has(page.url)) ctx.fail("tech/not-in-sitemap", page.url, "Indexable page missing from sitemap.xml.");
  }
}

async function checkSecurityHeaders(ctx) {
  const home = new URL("/", ctx.base).href;
  const res = await fetchRaw(home);
  for (const message of headerProblems(res.headers)) ctx.fail("tech/security-headers", home, message);
}

async function checkLaunchFiles(ctx, pages) {
  const adsOn = pages.some((p) => p.root.querySelector("body")?.getAttribute("data-ads") !== "off");
  if (!adsOn) return;
  const res = await fetchRaw(new URL("/ads.txt", ctx.base).href);
  if (res.status !== 200 || !res.body.trim()) ctx.fail("ads/ads-txt", "/ads.txt", "Ads are on but ads.txt is empty or missing.");
}

function isLocal(base) {
  const host = new URL(base).hostname;
  return host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "[::1]";
}

export async function runAudit(base, options = {}) {
  const problems = [];
  const ctx = { base, launch: options.launch === true, fail: (rule, url, message) => problems.push({ rule, url, message }) };
  const plan = loadPlan(options.root ?? process.cwd());
  const sitemap = await loadSitemap(ctx);
  const productionOrigin = sitemap[0] ? new URL(sitemap[0]).origin : null;
  ctx.mapper = makeMapper(base, productionOrigin);
  ctx.productionUrl = (local) => (productionOrigin ? new URL(new URL(local).pathname, productionOrigin).href : local);
  ctx.sitemapSet = new Set(sitemap.map((u) => ctx.mapper.toLocal(u)));
  const { pages, inbound } = await crawl(ctx, [new URL("/", base).href, ...ctx.sitemapSet]);
  for (const page of pages) await checkPage(ctx, page, plan);
  checkDuplicates(ctx, pages.filter((p) => !isNoindex(p)), "title", "onpage/duplicate-title");
  checkDuplicates(ctx, pages.filter((p) => !isNoindex(p)), "description", "onpage/duplicate-description");
  checkSitemapAndOrphans(ctx, pages, inbound);
  checkHreflang(ctx, pages);
  checkSimilarity(ctx, pages);
  await checkSoft404(ctx);
  await checkRobots(ctx);
  await checkManifest(ctx);
  await checkSecurityHeaders(ctx);
  if (ctx.launch) {
    await checkLaunchFiles(ctx, pages);
    await checkAgentReadiness(ctx, { markdown: !isLocal(base) });
  }
  return { problems, pages: pages.length };
}

export function formatProblems(problems) {
  const byRule = new Map();
  for (const p of problems) byRule.set(p.rule, [...(byRule.get(p.rule) ?? []), p]);
  return [...byRule]
    .map(([rule, list]) => `${rule} (${list.length})\n${list.map((p) => `  ${p.url}  ${p.message}`).join("\n")}`)
    .join("\n\n");
}
