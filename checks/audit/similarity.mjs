import { headings, sentences } from "./html.mjs";

function shingles(text, size = 5) {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i + size <= words.length; i += 1) set.add(words.slice(i, i + size).join(" "));
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared += 1;
  return shared / (a.size + b.size - shared);
}

function outline(page) {
  const own = new Set((page.primaryQuery ?? "").toLowerCase().split(/\s+/));
  return headings(page.main)
    .filter((h) => h.level === 2)
    .map((h) => h.text.toLowerCase().split(/\s+/).filter((w) => !own.has(w)).join(" "));
}

function outlineSimilarity(a, b) {
  if (a.length < 4 || b.length < 4) return 0;
  const sb = new Set(b);
  return a.filter((x) => sb.has(x)).length / Math.max(a.length, b.length);
}

export function checkSimilarity(ctx, pages, limits = { text: 0.35, outline: 0.7, boilerplate: 3 }) {
  const content = pages.filter((p) => p.isContent);
  const sh = content.map((p) => shingles(p.copy.text));
  const ol = content.map(outline);
  for (let i = 0; i < content.length; i += 1) {
    for (let j = i + 1; j < content.length; j += 1) {
      const t = jaccard(sh[i], sh[j]);
      if (t > limits.text) ctx.fail("content/near-duplicate", content[i].url, `${Math.round(t * 100)}% of its wording matches ${content[j].url}.`);
      const o = outlineSimilarity(ol[i], ol[j]);
      if (o > limits.outline) ctx.fail("content/templated-outline", content[i].url, `Its h2 outline matches ${content[j].url} (${Math.round(o * 100)}%). Shape the page to its own intent.`);
    }
  }
  const counts = new Map();
  for (const p of content) for (const s of new Set(sentences(p.copy.text).map((x) => x.toLowerCase()))) counts.set(s, (counts.get(s) ?? 0) + 1);
  for (const [s, n] of counts) if (n >= limits.boilerplate) ctx.fail("content/boilerplate", "(site)", `Sentence repeated on ${n} pages: "${s.slice(0, 80)}..."`);
}
