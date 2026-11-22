import { arr, isUrl } from "./util.mjs";

const INTENTS = new Set(["informational", "commercial", "transactional", "navigational"]);
const SOURCES = new Set(["dataforseo", "keyword-planner", "competitor", "paa", "ai-fanout", "ai-overview", "reddit", "autocomplete", "gsc"]);
export const MIN_TOPICS = 20;

export function checkInventory(ctx, required) {
  const rel = "docs/research/inventory.json";
  const inv = ctx.json(rel);
  if (!inv) return required ? (ctx.fail("research", rel, "Missing. Research is ticked but there's no topic inventory."), null) : null;
  const topics = arr(inv.topics);
  if (topics.length < MIN_TOPICS) ctx.fail("research", rel, `${topics.length} topics. A full inventory has at least ${MIN_TOPICS}: every keyword, competitor page, People Also Ask and AI fan-out question.`);
  const ids = new Set();
  for (const t of topics) {
    if (!t.id || ids.has(t.id)) ctx.fail("research", rel, `Topic id missing or duplicated: ${JSON.stringify(t.id)}`);
    ids.add(t.id);
    if (!t.keyword) ctx.fail("research", rel, `Topic ${t.id} has no keyword.`);
    if (!INTENTS.has(t.intent)) ctx.fail("research", rel, `Topic ${t.id} has intent "${t.intent}". Use ${[...INTENTS].join(", ")}.`);
    const bad = arr(t.sources).filter((s) => !SOURCES.has(s));
    if (arr(t.sources).length === 0 || bad.length > 0) ctx.fail("research", rel, `Topic ${t.id} needs sources from: ${[...SOURCES].join(", ")}.`);
  }
  const kinds = new Set(topics.flatMap((t) => arr(t.sources)));
  if (kinds.size < 3) ctx.fail("research", rel, `Topics come from ${kinds.size} source kind(s). Use at least 3 (for example dataforseo, competitor, paa).`);
  return inv;
}

export function checkCompetitors(ctx, required) {
  const rel = "docs/research/competitors.json";
  const data = ctx.json(rel);
  if (!data) return required ? (ctx.fail("research", rel, "Missing. Research is ticked but there's no competitor analysis."), null) : null;
  const list = arr(data.competitors);
  if (list.length < 3) ctx.fail("research", rel, `${list.length} competitors analysed, at least 3 needed.`);
  for (const c of list) {
    if (!c.domain) ctx.fail("research", rel, "A competitor has no domain.");
    if (arr(c.pages).length === 0) ctx.fail("research", rel, `${c.domain}: no pages analysed.`);
    for (const p of arr(c.pages)) {
      if (!isUrl(p.url)) ctx.fail("research", rel, `${c.domain}: a page has no URL.`);
      if (typeof p.wordCount !== "number") ctx.fail("research", rel, `${p.url}: no wordCount.`);
      if (!Array.isArray(p.schemaTypes)) ctx.fail("research", rel, `${p.url}: no schemaTypes list (read its JSON-LD).`);
      if (!Array.isArray(p.topics)) ctx.fail("research", rel, `${p.url}: no topics list (inventory ids it covers).`);
    }
  }
  return data;
}

export function checkAiAnswers(ctx, required) {
  const rel = "docs/research/ai-answers.json";
  const data = ctx.json(rel);
  if (!data) return required ? (ctx.fail("research", rel, "Missing. Research is ticked but AI Overview and LLM answers weren't collected."), null) : null;
  const list = arr(data.keywords);
  if (list.length === 0) ctx.fail("research", rel, "No keywords. Collect AI answers for at least the main keywords.");
  for (const k of list) {
    if (!k.keyword) ctx.fail("research", rel, "An entry has no keyword.");
    if (typeof k.aiOverview?.present !== "boolean") ctx.fail("research", rel, `${k.keyword}: aiOverview.present must be true or false.`);
    if (arr(k.llm).length === 0) ctx.fail("research", rel, `${k.keyword}: no LLM answers (ChatGPT, Perplexity, Gemini).`);
    for (const l of arr(k.llm)) if (!Array.isArray(l.cited) || !Array.isArray(l.fanOut)) ctx.fail("research", rel, `${k.keyword} / ${l.platform}: needs cited and fanOut lists.`);
  }
  return data;
}
