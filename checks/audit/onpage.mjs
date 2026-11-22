import { headings, mainText, meta, paragraphs, wordCount } from "./html.mjs";

export const STOCK_PHRASES = [
  "in today's digital world",
  "in today's fast-paced",
  "in today's world",
  "in the digital age",
  "dive into",
  "deep dive",
  "delve",
  "unlock the power",
  "unleash",
  "harness the power",
  "game-changer",
  "game changer",
  "look no further",
  "whether you're a",
  "in conclusion",
  "it's important to note",
  "it is important to note",
  "navigate the complexities",
  "elevate your",
  "ever-evolving",
  "ever evolving",
  "a testament to",
  "plays a crucial role",
  "at the end of the day",
  "seamlessly",
  "embark on",
  "the world of",
  "comprehensive guide",
  "without further ado",
];

export function checkTitleAndDescription(ctx, page) {
  const title = page.root.querySelector("title")?.text.trim() ?? "";
  const description = meta(page.root, 'meta[name="description"]') ?? "";
  if (title.length < 15 || title.length > 55) ctx.fail("onpage/title", page.url, `Title is ${title.length} characters (15 to 55): "${title}"`);
  if (description.length < 70 || description.length > 150) ctx.fail("onpage/description", page.url, `Description is ${description.length} characters (70 to 150).`);
  return { title, description };
}

export function checkDuplicates(ctx, pages, key, rule) {
  const seen = new Map();
  for (const p of pages) {
    const value = p[key];
    if (!value) continue;
    if (seen.has(value)) ctx.fail(rule, p.url, `Same ${key} as ${seen.get(value)}: "${value}"`);
    else seen.set(value, p.url);
  }
}

export function checkHeadings(ctx, page) {
  const all = headings(page.root);
  const h1s = all.filter((h) => h.level === 1);
  if (h1s.length !== 1) ctx.fail("onpage/h1", page.url, `${h1s.length} h1 elements (exactly 1).`);
  for (let i = 1; i < all.length; i += 1) {
    const prev = all[i - 1];
    const curr = all[i];
    if (prev && curr && curr.level > prev.level + 1) ctx.fail("onpage/heading-skip", page.url, `h${prev.level} followed by h${curr.level} ("${curr.text}").`);
  }
  for (const chrome of page.root.querySelectorAll("header, footer, nav")) {
    if (chrome.querySelector("h1, h2, h3, h4, h5, h6")) ctx.fail("onpage/chrome-heading", page.url, `A heading inside <${chrome.tagName.toLowerCase()}>.`);
  }
  return h1s[0]?.text ?? "";
}

const CONTENT_IMAGE = /\.(webp|avif|svg)(\?|$)/i;

export function checkImages(ctx, page) {
  for (const img of page.root.querySelectorAll("img")) {
    const src = img.getAttribute("src") ?? "";
    const alt = img.getAttribute("alt");
    const inMain = page.main.querySelectorAll("img").includes(img);
    if (alt === undefined || alt === null) ctx.fail("onpage/img-alt", page.url, `Image without alt: ${src}`);
    else if (inMain && alt.trim() === "" && img.getAttribute("role") !== "presentation") ctx.fail("onpage/img-alt", page.url, `Content image with empty alt: ${src}`);
    if (!img.getAttribute("width") || !img.getAttribute("height")) ctx.fail("onpage/img-size", page.url, `Image without width and height (layout shift): ${src}`);
    if (inMain && !CONTENT_IMAGE.test(src) && !src.startsWith("data:")) ctx.fail("onpage/img-format", page.url, `Content image isn't WebP, AVIF or SVG: ${src}`);
  }
}

export function checkLinks(ctx, page) {
  for (const a of page.root.querySelectorAll("a[target=_blank]")) {
    const rel = a.getAttribute("rel") ?? "";
    if (!rel.includes("noopener")) ctx.fail("onpage/link-rel", page.url, `target=_blank without rel=noopener: ${a.getAttribute("href")}`);
  }
}

export function checkCopy(ctx, page) {
  const text = mainText(page.main);
  if (text.includes("—")) ctx.fail("content/em-dash", page.url, "Em dash in the page copy.");
  const lower = text.toLowerCase();
  for (const phrase of STOCK_PHRASES) if (lower.includes(phrase)) ctx.fail("content/stock-phrase", page.url, `Stock AI phrase: "${phrase}"`);
  return { text, words: wordCount(text), paragraphs: paragraphs(page.main) };
}

export function checkParagraphs(ctx, page, type) {
  const ps = page.copy.paragraphs;
  const isTool = type === "home" || type === "tool";
  ps.forEach((p, i) => {
    const words = p.split(/\s+/).length;
    const limit = i === 0 ? (isTool ? 25 : 55) : 30;
    if (words > limit) ctx.fail("content/paragraph-length", page.url, `${i === 0 ? (isTool ? "Hero tagline" : "Lede") : "Paragraph"} has ${words} words (max ${limit}): "${p.slice(0, 60)}..."`);
  });
}

export function checkPlaceholders(ctx, page, html) {
  for (const marker of ["[Replace:", "__SITE_NAME__", "__DOMAIN__", "__AUTHOR_NAME__", "__domain__"]) {
    if (html.includes(marker)) ctx.fail("launch/placeholder", page.url, `Placeholder left on the page: ${marker}`);
  }
}

export function checkAds(ctx, page) {
  const tool = page.root.querySelector("[data-tool]");
  for (const slot of page.root.querySelectorAll("[data-ad-slot]")) {
    if (!/--ad-min-mobile/.test(slot.getAttribute("style") ?? "")) ctx.fail("ads/reserve", page.url, `Ad slot ${slot.getAttribute("data-ad-slot")} reserves no height.`);
    if (tool && tool.querySelector("[data-ad-slot]")) ctx.fail("ads/placement", page.url, "An ad slot is inside the tool.");
  }
  if (tool) {
    const html = page.root.toString();
    const toolAt = html.indexOf("data-tool");
    const firstAd = html.indexOf("data-ad-slot");
    if (firstAd !== -1 && firstAd < toolAt) ctx.fail("ads/placement", page.url, "An ad slot comes before the tool.");
  }
}
