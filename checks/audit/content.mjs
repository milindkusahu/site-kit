import { headings, jsonLd, NOT_CONTENT, walkJson, wordCount } from "./html.mjs";

const STOP = new Set("a an and are can do does for how i in is it my of on or the to what when where which why with you your".split(" "));

function tokens(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((t) => t && !STOP.has(t));
}

function overlap(question, heading) {
  const q = new Set(tokens(question));
  if (q.size === 0) return 0;
  const h = new Set(tokens(heading));
  return [...q].filter((t) => h.has(t)).length / q.size;
}

export function checkBrief(ctx, page, brief) {
  const heads = headings(page.main).filter((h) => h.level === 2 || h.level === 3);
  for (const { q } of brief.questions ?? []) {
    if (!heads.some((h) => overlap(q, h.text) >= 0.6)) ctx.fail("content/question", page.url, `No h2 or h3 answers the brief's question: "${q}"`);
  }
  if (page.copy.words < (brief.minWords ?? 0)) ctx.fail("content/depth", page.url, `${page.copy.words} words, the brief's floor is ${brief.minWords} (median competitor depth).`);
  checkMedia(ctx, page, brief);
  checkEntities(ctx, page, brief);
}

function checkMedia(ctx, page, brief) {
  const media = page.main.querySelectorAll("img, picture, video, svg[role=img], figure");
  const planned = brief.images ?? [];
  if (media.length < planned.length) ctx.fail("content/images", page.url, `${media.length} images or figures, the brief plans ${planned.length}.`);
  const html = page.main.toString();
  for (const img of planned) if (img.src && !html.includes(img.src)) ctx.fail("content/images", page.url, `Planned image missing: ${img.src}`);
  const steps = page.main.querySelectorAll("[data-step]");
  if ((brief.steps ?? []).length > steps.length) ctx.fail("content/howto-steps", page.url, `${steps.length} [data-step] elements, the brief has ${brief.steps.length} steps.`);
  steps.forEach((step, i) => {
    if (!step.querySelector("img, picture, video")) ctx.fail("content/howto-image", page.url, `Step ${i + 1} has no image.`);
  });
  const data = page.main.querySelectorAll("[data-original-data]");
  const needed = Math.max(1, (brief.originalData ?? []).length);
  if (data.length < needed) ctx.fail("content/original-data", page.url, `${data.length} [data-original-data] blocks, the brief needs ${needed} (measurements, real-number tables or cited statistics).`);
}

const MAX_OTHER_ENTITIES = 2;
const MIN_EXPLAINING_WORDS = 10;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function entityPattern(name) {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name.trim())}(?:e?s)?(?![\\p{L}\\p{N}])`, "iu");
}

export function entityCoverage(main, entities) {
  const clone = main.clone();
  for (const el of clone.querySelectorAll(NOT_CONTENT)) el.remove();
  const heads = clone.querySelectorAll("h2, h3, h4").map((h) => h.text.replace(/\s+/g, " ").trim());
  const body = clone
    .querySelectorAll("p, li, td, th, dd, figcaption, blockquote")
    .flatMap((el) => el.text.split(/(?<=[.!?])\s+|\n+/))
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const definitions = clone.querySelectorAll("dt").map((dt) => {
    const parts = [];
    for (let next = dt.nextElementSibling; next && next.tagName === "DD"; next = next.nextElementSibling) parts.push(next.text);
    return { term: dt.text, definition: parts.join(" ") };
  });
  const all = clone.structuredText;
  const patterns = entities.map((e) => entityPattern(e.name));
  return entities.map((entity, i) => {
    const own = patterns[i];
    if (!own.test(all)) return { entity, status: "missing" };
    if (heads.some((h) => own.test(h))) return { entity, status: "explained" };
    if (definitions.some((d) => own.test(d.term) && wordCount(d.definition) >= MIN_EXPLAINING_WORDS)) return { entity, status: "explained" };
    const explained = body.some((sentence) => {
      if (!own.test(sentence) || wordCount(sentence) < MIN_EXPLAINING_WORDS) return false;
      const rest = sentence.replace(new RegExp(own.source, "giu"), " ");
      const others = patterns.filter((p, j) => j !== i && p.test(rest)).length;
      return others <= MAX_OTHER_ENTITIES;
    });
    return { entity, status: explained ? "explained" : "name-dropped" };
  });
}

function checkEntities(ctx, page, brief) {
  for (const { entity, status } of entityCoverage(page.main, brief.entities ?? [])) {
    if (status === "missing") ctx.fail("content/entity", page.url, `Entity not covered: ${entity.name}`);
    if (status === "name-dropped") {
      ctx.fail(
        "content/entity-depth",
        page.url,
        `Entity only name-dropped: ${entity.name}. It appears only in short fragments or in lists with several other entities. Give it a heading, or a sentence of ${MIN_EXPLAINING_WORDS}+ words that says what it is or why it matters here.`,
      );
    }
  }
  const subject = (brief.mainEntity ?? "").toLowerCase();
  if (subject) {
    const h1 = (page.h1 ?? "").toLowerCase();
    const first = (page.copy.paragraphs[0] ?? "").toLowerCase();
    if (!page.title.toLowerCase().includes(subject)) ctx.fail("content/main-subject", page.url, `Main subject "${brief.mainEntity}" isn't in the title.`);
    if (!h1.includes(subject)) ctx.fail("content/main-subject", page.url, `Main subject "${brief.mainEntity}" isn't in the h1.`);
    if (!first.includes(subject)) ctx.fail("content/main-subject", page.url, `Main subject "${brief.mainEntity}" isn't in the first paragraph.`);
  }
  const sameAs = new Set();
  for (const b of jsonLd(page.root)) if (b.ok) walkJson(b.value, (n) => { for (const s of [n.sameAs].flat()) if (typeof s === "string") sameAs.add(s); });
  for (const e of brief.entities ?? []) if (e.sameAs && !sameAs.has(e.sameAs)) ctx.fail("content/entity-schema", page.url, `Entity ${e.name} has sameAs in the brief but not in the page's schema (about or mentions).`);
}

export function checkExternalLinks(ctx, page, brief) {
  const allowed = new Set((brief.externalLinks ?? []).map((l) => new URL(l.url).hostname.replace(/^www\./, "")));
  for (const a of page.main.querySelectorAll("a[href^='http']")) {
    if (a.closest("[data-share], nav, aside, footer")) continue;
    const href = a.getAttribute("href") ?? "";
    if (ctx.mapper.isInternal(href)) continue;
    const host = new URL(href).hostname.replace(/^www\./, "");
    if (!allowed.has(host)) ctx.fail("content/external-link", page.url, `External link to ${host} isn't in the brief's authority list.`);
  }
}

export function checkInternalLinkNearTop(ctx, page) {
  const h2s = page.main.querySelectorAll("h2");
  const cut = h2s[1] ? page.main.toString().indexOf(h2s[1].toString()) : -1;
  const html = cut === -1 ? page.main.toString() : page.main.toString().slice(0, cut);
  const links = [...html.matchAll(/<a\s[^>]*href="([^"]+)"/g)].map((m) => m[1]).filter((h) => ctx.mapper.isInternal(h) && !h.startsWith("#"));
  if (links.length === 0) ctx.fail("content/internal-link", page.url, "No contextual internal link before the second h2.");
}
