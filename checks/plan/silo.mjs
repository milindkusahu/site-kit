import { arr, words } from "./util.mjs";

const DECISIONS = new Set(["page", "merged", "skipped"]);
export const PAGE_TYPES = new Set(["home", "tool", "howto", "comparison", "explainer", "hub", "about", "contact", "author", "legal", "changelog", "utility"]);

function checkClusters(ctx, silo, inventory) {
  const rel = "docs/silo.json";
  const pages = new Map(arr(silo.pages).map((p) => [p.path, p]));
  const placed = new Map();
  for (const c of arr(silo.clusters)) {
    for (const t of arr(c.topics)) {
      if (placed.has(t)) ctx.fail("silo", rel, `Topic ${t} is in clusters ${placed.get(t)} and ${c.id}.`);
      placed.set(t, c.id);
    }
    if (!DECISIONS.has(c.decision)) ctx.fail("silo", rel, `Cluster ${c.id}: decision must be page, merged or skipped.`);
    if (c.decision === "page" && pages.get(c.page)?.cluster !== c.id) ctx.fail("silo", rel, `Cluster ${c.id}: page ${c.page} isn't in pages with cluster ${c.id}.`);
    if (c.decision === "merged" && (!pages.has(c.mergedInto) || words(c.reason) < 6)) ctx.fail("silo", rel, `Cluster ${c.id}: merged needs mergedInto (a planned page) and a reason of 6+ words.`);
    if (c.decision === "skipped" && words(c.reason) < 8) ctx.fail("silo", rel, `Cluster ${c.id}: skipped needs a reason of 8+ words.`);
  }
  for (const t of arr(inventory?.topics)) if (!placed.has(t.id)) ctx.fail("silo", rel, `Topic ${t.id} ("${t.keyword}") isn't in any cluster. Nothing may silently disappear.`);
  return placed;
}

function checkCompetitorCoverage(ctx, silo, competitors, placed) {
  const rel = "docs/silo.json";
  const coveredBy = new Map();
  for (const c of arr(competitors?.competitors)) for (const p of arr(c.pages)) for (const t of arr(p.topics)) coveredBy.set(t, new Set([...(coveredBy.get(t) ?? []), c.domain]));
  const clusters = new Map(arr(silo.clusters).map((c) => [c.id, c]));
  for (const [topic, domains] of coveredBy) {
    if (domains.size < 2) continue;
    const cluster = clusters.get(placed.get(topic));
    if (!cluster || cluster.decision === "skipped") ctx.fail("silo", rel, `Topic ${topic} is covered by ${domains.size} competitors but skipped here. Cover at least what the top competitors cover.`);
  }
  const schemaTypes = new Set(arr(competitors?.competitors).flatMap((c) => arr(c.pages).flatMap((p) => arr(p.schemaTypes))));
  const planned = new Set([...arr(silo.schemaPlan?.types), ...arr(silo.schemaPlan?.skipped).map((s) => s.type)]);
  for (const type of schemaTypes) if (!planned.has(type)) ctx.fail("silo", rel, `Competitors use ${type} schema. Add it to schemaPlan.types, or to schemaPlan.skipped with a reason.`);
  for (const s of arr(silo.schemaPlan?.skipped)) if (words(s.reason) < 6) ctx.fail("silo", rel, `schemaPlan.skipped ${s.type}: reason of 6+ words needed.`);
}

function checkPages(ctx, silo) {
  const rel = "docs/silo.json";
  const queries = new Map();
  for (const p of arr(silo.pages)) {
    if (!/^\/([a-z0-9-]+\/)*$/.test(p.path ?? "")) ctx.fail("silo", rel, `Page path "${p.path}" must be lowercase, hyphenated and end in /.`);
    if (!PAGE_TYPES.has(p.type)) ctx.fail("silo", rel, `Page ${p.path}: unknown type "${p.type}".`);
    if (!p.primaryQuery) ctx.fail("silo", rel, `Page ${p.path}: no primaryQuery.`);
    const owner = queries.get(p.primaryQuery);
    if (owner) ctx.fail("silo", rel, `"${p.primaryQuery}" is the primary query of both ${owner} and ${p.path} (cannibalization).`);
    queries.set(p.primaryQuery, p.path);
    if (p.type !== "home" && p.type !== "legal" && !p.parent) ctx.fail("silo", rel, `Page ${p.path}: no parent (pillar) for internal linking.`);
  }
}

export function checkSilo(ctx, required, inventory, competitors) {
  const rel = "docs/silo.json";
  const silo = ctx.json(rel);
  if (!silo) return required ? (ctx.fail("silo", rel, "Missing. The silo plan is ticked but docs/silo.json doesn't exist."), null) : null;
  const placed = checkClusters(ctx, silo, inventory);
  checkCompetitorCoverage(ctx, silo, competitors, placed);
  checkPages(ctx, silo);
  const clusters = arr(silo.clusters);
  const count = (d) => clusters.filter((c) => c.decision === d).length;
  ctx.summary.push(`Silo: ${arr(inventory?.topics).length} topics, ${clusters.length} clusters, ${count("page")} pages, ${count("merged")} merged, ${count("skipped")} skipped.`);
  return silo;
}
