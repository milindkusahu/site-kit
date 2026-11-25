import { arr, isDate, isUrl, words } from "./util.mjs";

export const MIN_REFERENCES = 8;
const REQUIRED_SECTIONS = ["hero-tool", "result", "how-it-works", "guides-hub", "faq", "author"];
const BAD_AD_PLACEMENTS = new Set(["above-tool", "inside-tool", "next-to-button", "hero"]);

export function checkReferences(ctx, required) {
  const rel = "docs/design/references.json";
  const data = ctx.json(rel);
  if (!data) return required ? ctx.fail("design-references", rel, "Missing. Collect real references before drawing anything.") : undefined;
  const refs = arr(data.references);
  if (refs.length < MIN_REFERENCES) ctx.fail("design-references", rel, `${refs.length} references, at least ${MIN_REFERENCES} needed.`);
  const sources = (s) => refs.filter((r) => r.source === s).length;
  if (sources("dribbble") < 2) ctx.fail("design-references", rel, "At least 2 references from Dribbble.");
  if (sources("site") < 3) ctx.fail("design-references", rel, "At least 3 references from real live sites in the niche.");
  for (const r of refs) {
    if (!isUrl(r.url)) ctx.fail("design-references", rel, `A reference has no URL.`);
    if (!r.screenshot || !ctx.exists(r.screenshot)) ctx.fail("design-references", rel, `${r.url}: screenshot file missing (${r.screenshot}).`);
    if (words(r.borrow) < 6) ctx.fail("design-references", rel, `${r.url}: say what to borrow in 6+ words.`);
  }
  if (data.version === 2) checkCraftReferences(ctx, rel, refs);
  return undefined;
}

export const MIN_CRAFT_REFERENCES = 6;
export const MIN_GALLERY_REFERENCES = 2;
const CRAFT_NOTES = ["type", "spacing", "icons"];
const MEASURED_SOURCES = new Set(["site", "gallery"]);

function checkCraftReferences(ctx, rel, refs) {
  const craft = refs.filter((r) => r.competitor !== true);
  if (craft.length < MIN_CRAFT_REFERENCES) {
    ctx.fail("design-references", rel, `${craft.length} craft references, at least ${MIN_CRAFT_REFERENCES} needed. Competitors (competitor: true) show what to offer, never how it should look.`);
  }
  if (craft.filter((r) => r.source === "gallery").length < MIN_GALLERY_REFERENCES) {
    ctx.fail("design-references", rel, `At least ${MIN_GALLERY_REFERENCES} references from a curated gallery of real sites (godly.website, land-book.com, saaspo.com, mobbin.com), source "gallery".`);
  }
  for (const r of craft) {
    for (const note of CRAFT_NOTES) {
      if (words(r.craft?.[note]) < 4) ctx.fail("design-references", rel, `${r.url}: craft.${note} says in 4+ words what makes its ${note} good (sizes, rhythm, weights, stroke).`);
    }
    if (MEASURED_SOURCES.has(r.source) && (!r.measured || !ctx.exists(r.measured))) {
      ctx.fail("design-references", rel, `${r.url}: measured file missing (${r.measured}). Run the workflow's measure-reference.mjs on the live page.`);
    }
  }
}

export const MIN_CRITIC_SCORE = 4;
const CRITIC_SCORES = ["type", "spacing", "clutter", "icons", "hierarchy", "originality"];

function checkCritique(ctx) {
  const rel = "docs/design/critique.json";
  const data = ctx.json(rel);
  if (!data) return ctx.fail("design-critique", rel, "Missing. The design-critic agent scores every direction before Milind sees it.");
  const directions = arr(data.directions);
  if (directions.length < 2) ctx.fail("design-critique", rel, "Score each of the 2 or 3 directions.");
  for (const d of directions) {
    for (const key of CRITIC_SCORES) {
      const score = d.scores?.[key];
      if (typeof score !== "number") ctx.fail("design-critique", rel, `Direction ${d.id}: scores.${key} missing.`);
      else if (score < MIN_CRITIC_SCORE) ctx.fail("design-critique", rel, `Direction ${d.id}: ${key} scored ${score}, below ${MIN_CRITIC_SCORE}. Redo it before Milind sees it.`);
    }
    const audit = d.audit ? ctx.json(d.audit) : null;
    if (!audit) ctx.fail("design-critique", rel, `Direction ${d.id}: design audit file missing (${d.audit}). Run the workflow's design-audit.mjs on the mockup.`);
    else if (audit.pass !== true) ctx.fail("design-critique", rel, `Direction ${d.id}: its design audit (${d.audit}) fails. Fix the mockup and rerun it.`);
  }
  return undefined;
}

function checkHomepage(ctx, rel, homepage) {
  const sections = arr(homepage?.sections);
  if (sections[0] !== "hero-tool") ctx.fail("design-consolidated", rel, "homepage.sections must start with hero-tool: the tool sits in the hero, above the fold on a phone.");
  for (const s of REQUIRED_SECTIONS) if (!sections.includes(s)) ctx.fail("design-consolidated", rel, `homepage.sections is missing "${s}".`);
  if (homepage?.toolAboveFoldMobile !== true) ctx.fail("design-consolidated", rel, "homepage.toolAboveFoldMobile must be true.");
}

function checkAdPlan(ctx, rel, slots) {
  if (arr(slots).length === 0) ctx.fail("design-consolidated", rel, "adSlots is empty. Plan where ads will go now, even though they stay off at launch.");
  for (const s of arr(slots)) {
    if (BAD_AD_PLACEMENTS.has(s.placement)) ctx.fail("design-consolidated", rel, `Ad slot ${s.id}: placement "${s.placement}" is never allowed (accidental clicks, tool pushed down).`);
    if (typeof s.minHeightMobile !== "number" || typeof s.minHeightDesktop !== "number") ctx.fail("design-consolidated", rel, `Ad slot ${s.id}: reserve minHeightMobile and minHeightDesktop.`);
  }
}

export function checkConsolidated(ctx, required) {
  const rel = "docs/design/consolidated.json";
  const data = ctx.json(rel);
  if (!data) return required ? ctx.fail("design-consolidated", rel, "Missing. Merge the chosen parts into one final design and get it approved.") : undefined;
  if (!isUrl(data.canvas)) ctx.fail("design-consolidated", rel, "canvas link missing.");
  if (!data.localCopy || !ctx.exists(data.localCopy)) ctx.fail("design-consolidated", rel, `localCopy folder missing (${data.localCopy}).`);
  if (arr(data.directions).length < 2) ctx.fail("design-consolidated", rel, "directions: list the 2 or 3 directions that were shown.");
  if (arr(data.takes).length < 1) ctx.fail("design-consolidated", rel, "takes: list what was taken from which direction.");
  if (!isDate(data.approvedOn)) ctx.fail("design-consolidated", rel, "approvedOn must be the date Milind approved the final design.");
  checkHomepage(ctx, rel, data.homepage);
  checkAdPlan(ctx, rel, data.adSlots);
  return undefined;
}

export function checkDesignDecisions(ctx, required) {
  if (required && !ctx.exists("docs/DESIGN-DECISIONS.md")) ctx.fail("design-directions", "docs/DESIGN-DECISIONS.md", "Missing.");
  if (required && ctx.json("docs/design/references.json")?.version === 2) checkCritique(ctx);
}
