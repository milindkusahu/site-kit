import { describe, expect, it } from "vitest";
import { DEFAULTS, paragraphLimits } from "../bin/config.mjs";
import { parsePage } from "../checks/audit/html.mjs";
import { checkParagraphs } from "../checks/audit/onpage.mjs";

const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

function audit(body, { type = "unknown", limits } = {}) {
  const problems = [];
  const ctx = { fail: (rule, url, message) => problems.push({ rule, url, message }) };
  const page = { url: "http://x/", main: parsePage(`<html><body><main>${body}</main></body></html>`).main };
  checkParagraphs(ctx, page, type, limits);
  return problems.map((p) => p.message.split(":")[0]);
}

describe("audit paragraph limits", () => {
  it("defaults to 30 words a paragraph, 55 a lede, 60 an answer", () => {
    expect(paragraphLimits(DEFAULTS)).toEqual({ paragraph: 30, lede: 55, answer: 60 });
    expect(audit(`<p>${words(10)}</p><p>${words(31)}</p>`)).toEqual(["Paragraph has 31 words (max 30)"]);
  });

  it("reads the limits from site-kit.config.json", () => {
    const limits = paragraphLimits({ ...DEFAULTS, maxParagraphWords: 45, maxLedeWords: 50, maxAnswerWords: 70 });
    expect(limits).toEqual({ paragraph: 45, lede: 50, answer: 70 });
    expect(audit(`<p>${words(10)}</p><p>${words(45)}</p><p>${words(46)}</p>`, { limits })).toEqual(["Paragraph has 46 words (max 45)"]);
  });

  it("treats a .lede after the first paragraph as a lede", () => {
    expect(audit(`<p>${words(10)}</p><p class="lede">${words(55)}</p>`)).toEqual([]);
    expect(audit(`<p>${words(10)}</p><p class="lede">${words(56)}</p>`)).toEqual(["Lede has 56 words (max 55)"]);
  });

  it("gives FAQ answers in <details> and [data-answer] paragraphs the answer limit", () => {
    const faq = (n) => `<details><summary>Q?</summary><p>${words(n)}</p></details>`;
    expect(audit(`<p>${words(10)}</p>${faq(60)}<p data-answer>${words(60)}</p>`)).toEqual([]);
    expect(audit(`<p>${words(10)}</p>${faq(61)}`)).toEqual(["Answer has 61 words (max 60)"]);
  });

  it("keeps the 25-word hero tagline on tool pages", () => {
    expect(audit(`<p class="lede">${words(26)}</p>`, { type: "tool" })).toEqual(["Hero tagline has 26 words (max 25)"]);
    expect(audit(`<p>${words(55)}</p>`)).toEqual([]);
  });
});
