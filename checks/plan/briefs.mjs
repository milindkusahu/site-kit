import { readdirSync } from "node:fs";
import { arr, isUrl, median, tokens, words } from "./util.mjs";

export const CONTENT_TYPES = new Set(["home", "tool", "howto", "comparison", "explainer", "hub"]);
const Q_SOURCES = new Set(["paa", "ai-fanout", "competitor", "reddit", "gsc", "autocomplete"]);
const IMAGE_KINDS = new Set(["screenshot", "annotated-step", "chart", "before-after", "photo", "diagram", "demo-video"]);
const DATA_KINDS = new Set(["measurement", "table", "statistic", "test"]);

function checkBasics(ctx, rel, b, planned) {
  if (!planned) ctx.fail("briefs", rel, `Path ${b.path} isn't a page in docs/silo.json.`);
  else if (planned.type !== b.type) ctx.fail("briefs", rel, `Type ${b.type} doesn't match the silo's ${planned.type}.`);
  if (!b.primaryQuery || !b.mainEntity) ctx.fail("briefs", rel, "primaryQuery and mainEntity are required.");
  if (arr(b.questions).length < 3) ctx.fail("briefs", rel, `${arr(b.questions).length} questions, at least 3 real questions needed.`);
  for (const q of arr(b.questions)) if (!q.q || !Q_SOURCES.has(q.source)) ctx.fail("briefs", rel, `Question "${q.q}" needs a source: ${[...Q_SOURCES].join(", ")}.`);
  if (words(b.informationGain) < 12) ctx.fail("briefs", rel, "informationGain: 12+ words on what this page adds that the top results don't.");
  if (arr(b.aiFanOut).length < 2 && words(b.aiFanOutUnavailable) < 6) ctx.fail("briefs", rel, "aiFanOut: 2+ follow-up queries from AI answers (or aiFanOutUnavailable with a reason).");
}

function checkDepth(ctx, rel, b) {
  const comps = arr(b.competitors);
  if (comps.length < 3) ctx.fail("briefs", rel, `${comps.length} competitors, at least 3 needed.`);
  for (const c of comps) if (!isUrl(c.url) || typeof c.wordCount !== "number") ctx.fail("briefs", rel, "Each competitor needs url and wordCount.");
  const floor = Math.round(median(comps.map((c) => c.wordCount)) * 0.9);
  if (typeof b.minWords !== "number" || b.minWords < floor) ctx.fail("briefs", rel, `minWords ${b.minWords} is below 90% of the median competitor (${floor}).`);
}

function checkAssets(ctx, rel, b) {
  const images = arr(b.images);
  if (images.length < 3) ctx.fail("briefs", rel, `${images.length} planned images, at least 3 (screenshots, annotated steps, charts, before-and-after).`);
  for (const i of images) {
    if (!IMAGE_KINDS.has(i.kind)) ctx.fail("briefs", rel, `Image ${i.src}: kind must be one of ${[...IMAGE_KINDS].join(", ")}.`);
    if (!i.src || words(i.alt) < 4) ctx.fail("briefs", rel, `Image ${i.src ?? "(no src)"}: src and a 4+ word alt are required.`);
  }
  const data = arr(b.originalData);
  if (data.length < 1) ctx.fail("briefs", rel, "originalData: at least one measurement, real-number table, test or cited statistic.");
  for (const d of data) if (!DATA_KINDS.has(d.kind) || words(d.description) < 5 || !d.source) ctx.fail("briefs", rel, "Each originalData item needs kind, a 5+ word description and source (how it was measured or a URL).");
  const entities = arr(b.entities);
  if (entities.length < 5) ctx.fail("briefs", rel, `${entities.length} entities, at least 5 (from the top-ranking pages).`);
  if (entities.filter((e) => isUrl(e.sameAs)).length < 2) ctx.fail("briefs", rel, "At least 2 entities need a sameAs link (Wikipedia or Wikidata).");
}

function checkShape(ctx, rel, b, siloPaths) {
  const outline = arr(b.outline);
  if (b.type !== "home" && b.type !== "tool" && outline.length < 4) ctx.fail("briefs", rel, "outline: 4+ h2s, shaped to this page's intent.");
  if (b.type === "howto") {
    if (arr(b.steps).length < 2) ctx.fail("briefs", rel, "How-to needs 2+ steps.");
    for (const s of arr(b.steps)) if (!s.image) ctx.fail("briefs", rel, `Step "${s.name}" has no image. Every how-to step gets one.`);
  }
  if (b.type === "comparison" && !arr(b.originalData).some((d) => d.kind === "table")) ctx.fail("briefs", rel, "A comparison needs a real-number table in originalData.");
  if ((b.type === "tool" || b.type === "home") && words(b.resultState) < 6) ctx.fail("briefs", rel, "resultState: describe what the visitor sees after using the tool.");
  const minLinks = b.type === "hub" ? 6 : 2;
  const links = arr(b.internalLinks);
  if (links.length < minLinks) ctx.fail("briefs", rel, `${links.length} internal links, at least ${minLinks}.`);
  for (const l of links) if (!siloPaths.has(l.to) || words(l.anchor) < 3 || words(l.anchor) > 7) ctx.fail("briefs", rel, `Internal link to ${l.to}: must be a planned page with a 3 to 7 word anchor.`);
  for (const l of arr(b.externalLinks)) if (!isUrl(l.url) || words(l.why) < 3) ctx.fail("briefs", rel, "External links need url and why (authority sources only).");
}

function outlineSimilarity(a, b) {
  const strip = (brief) => new Set(arr(brief.outline).map((h) => tokens(h).filter((t) => !tokens(brief.primaryQuery).includes(t)).join(" ")));
  const sa = strip(a);
  const sb = strip(b);
  if (sa.size < 4 || sb.size < 4) return 0;
  return [...sa].filter((x) => sb.has(x)).length / Math.max(sa.size, sb.size);
}

export function checkBriefs(ctx, required, silo) {
  const dir = "docs/briefs";
  const planned = new Map(arr(silo?.pages).map((p) => [p.path, p]));
  const siloPaths = new Set(planned.keys());
  const briefs = ctx.exists(dir) ? readdirSync(ctx.file(dir)).filter((f) => f.endsWith(".json")).map((f) => ({ rel: `${dir}/${f}`, b: ctx.json(`${dir}/${f}`) })).filter((x) => x.b) : [];
  for (const { rel, b } of briefs) {
    checkBasics(ctx, rel, b, planned.get(b.path));
    checkDepth(ctx, rel, b);
    checkAssets(ctx, rel, b);
    checkShape(ctx, rel, b, siloPaths);
  }
  const have = new Set(briefs.map((x) => x.b.path));
  if (required) for (const p of planned.values()) if (CONTENT_TYPES.has(p.type) && !have.has(p.path)) ctx.fail("briefs", dir, `No brief for planned page ${p.path}.`);
  for (let i = 0; i < briefs.length; i += 1) {
    for (let j = i + 1; j < briefs.length; j += 1) {
      const [a, b] = [briefs[i].b, briefs[j].b];
      if (a.type === b.type && outlineSimilarity(a, b) > 0.7) ctx.fail("briefs", briefs[i].rel, `Outline matches ${b.path}. Same-type pages still need their own shape.`);
    }
  }
}
