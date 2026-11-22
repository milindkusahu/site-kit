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
}
