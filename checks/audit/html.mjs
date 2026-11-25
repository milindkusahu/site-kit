import { parse } from "node-html-parser";

export function parsePage(html) {
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true } });
  const main = root.querySelector("main") ?? root.querySelector("body") ?? root;
  return { root, main };
}

export function meta(root, selector, attr = "content") {
  return root.querySelector(selector)?.getAttribute(attr) ?? null;
}

export const NOT_CONTENT ="nav, aside, footer, header, script, style, noscript, [data-ad-slot], [aria-hidden=true]";

export function mainText(main) {
  const clone = main.clone();
  for (const el of clone.querySelectorAll(NOT_CONTENT)) el.remove();
  return clone.structuredText.replace(/[ \t]+/g, " ").trim();
}

export function wordCount(text) {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function headings(main) {
  return main.querySelectorAll("h1, h2, h3, h4, h5, h6").map((h) => ({ level: Number(h.tagName.slice(1)), text: h.text.trim(), el: h }));
}

export function paragraphs(main) {
  const clone = main.clone();
  for (const el of clone.querySelectorAll(NOT_CONTENT)) el.remove();
  return clone.querySelectorAll("p").map((p) => p.text.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export function jsonLd(root) {
  return root.querySelectorAll('script[type="application/ld+json"]').map((s) => {
    try {
      return { ok: true, value: JSON.parse(s.textContent) };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });
}

export function walkJson(value, visit) {
  if (Array.isArray(value)) {
    for (const v of value) walkJson(v, visit);
    return;
  }
  if (value && typeof value === "object") {
    visit(value);
    for (const v of Object.values(value)) walkJson(v, visit);
  }
}

export function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.split(" ").length >= 12);
}
