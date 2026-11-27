import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkDesignDecisions, checkReferences } from "../checks/plan/design.mjs";

const cli = fileURLToPath(new URL("../bin/site-kit.mjs", import.meta.url));
const TOKENS = ":root { --color-fg: currentColor; --space-2: 8px; --space-4: 16px; }\n";

function rules(config, css, tokens = TOKENS) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "spacing-"));
  mkdirSync(path.join(dir, "src", "styles"), { recursive: true });
  writeFileSync(path.join(dir, "site-kit.config.json"), JSON.stringify(config));
  writeFileSync(path.join(dir, "src", "styles", "tokens.css"), tokens);
  writeFileSync(path.join(dir, "src", "card.css"), css);
  return spawnSync(process.execPath, [cli, "rules"], { cwd: dir, encoding: "utf8" });
}

describe("site-kit rules: spacing scale", () => {
  it("is off unless the project turns it on", () => {
    expect(rules({}, ".a { padding: 14px; }").status).toBe(0);
  });

  it("fails literal spacing and names the property", () => {
    const run = rules({ spacingScale: true }, ".a { padding: 14px 1rem; }\n.b { gap: .75rem; }\n.c { margin-top: -10px; }");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("Literal spacing padding: 14px 1rem");
    expect(run.stderr).toContain("Literal spacing gap: .75rem");
    expect(run.stderr).toContain("Literal spacing margin-top: -10px");
  });

  it("accepts tokens, 0, auto, percentages and 1 or 2 px hairlines", () => {
    const css = ".a { padding: var(--space-4) var(--space-2); margin: 0 auto; gap: 0; }\n.b { padding: 1px var(--space-2); margin-inline: 5%; padding-top: calc(var(--space-4) * 2); }";
    const run = rules({ spacingScale: true }, css);
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });

  it("fails a spacing token that isn't on the scale", () => {
    const run = rules({ spacingScale: true }, ".a { padding: var(--space-3); }");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("--space-3 isn't on the spacing scale");
  });

  it("checks the tokens file outside its :root block", () => {
    const tokens = `${TOKENS}.wrap { padding: 0 24px; }\n.b { gap: var(--space-4); }\n`;
    const run = rules({ spacingScale: true, tokensFile: "src/styles/tokens.css" }, ".a { gap: 0; }", tokens);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("tokens.css:2");
    expect(run.stderr).toContain("Literal spacing padding: 0 24px");
  });

  it("lets the tokens file define spacing tokens", () => {
    const tokens = ":root { --space-2: 8px; --space-4: 16px; --pad: 28px; }\nbody { margin: 0; padding: var(--space-2); }\n";
    const run = rules({ spacingScale: true, tokensFile: "src/styles/tokens.css" }, ".a { gap: var(--space-2); }", tokens);
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });

  it("doesn't read other properties as spacing", () => {
    expect(rules({ spacingScale: true }, ".a { border-width: 3px; scroll-padding-top: 40px; line-height: 1.5; }").status).toBe(0);
  });
});

function context(files) {
  const failures = [];
  return {
    failures,
    json: (rel) => files[rel] ?? null,
    exists: (rel) => rel in files,
    fail: (rule, file, message) => void failures.push(`${rule}: ${message}`),
  };
}

const craft = { type: "Geist-like grotesk, 56 px h1, tight tracking", spacing: "8 px grid, 96 px between sections", icons: "Lucide 20 px, 1.5 stroke, on every control" };
const ref = (i, extra) => ({ url: `https://ref${i}.example/`, screenshot: `shot${i}.png`, borrow: "the way the tool sits in a calm first screen", ...extra });

function board(refs) {
  const files = { "docs/design/references.json": { version: 2, references: refs } };
  for (const r of refs) {
    files[r.screenshot] = true;
    if (r.measured) files[r.measured] = {};
  }
  return files;
}

const goodRefs = [
  ref(1, { source: "dribbble", craft }),
  ref(2, { source: "dribbble", craft }),
  ref(3, { source: "gallery", craft, measured: "m3.json" }),
  ref(4, { source: "gallery", craft, measured: "m4.json" }),
  ref(5, { source: "site", craft, measured: "m5.json" }),
  ref(6, { source: "site", craft, measured: "m6.json" }),
  ref(7, { source: "site", competitor: true }),
  ref(8, { source: "site", competitor: true }),
];

describe("site-kit plan: craft references (version 2 boards)", () => {
  it("passes a board with 6 measured craft references and competitors kept separate", () => {
    const ctx = context(board(goodRefs));
    checkReferences(ctx, true);
    expect(ctx.failures).toEqual([]);
  });

  it("doesn't let competitors count as craft references", () => {
    const refs = goodRefs.map((r, i) => (i >= 4 ? { ...r, competitor: true } : r));
    const ctx = context(board(refs));
    checkReferences(ctx, true);
    expect(ctx.failures.join("\n")).toContain("4 craft references, at least 6 needed");
  });

  it("needs craft notes and a measured file for live references", () => {
    const refs = goodRefs.map((r, i) => (i === 4 ? { ...r, craft: { type: "nice" }, measured: undefined } : r));
    const ctx = context(board(refs));
    checkReferences(ctx, true);
    const all = ctx.failures.join("\n");
    expect(all).toContain("craft.type says in 4+ words");
    expect(all).toContain("craft.spacing");
    expect(all).toContain("measured file missing");
  });

  it("leaves version 1 boards to the old rules", () => {
    const refs = goodRefs.map(({ craft: _c, measured: _m, ...r }) => r);
    const files = board(refs);
    files["docs/design/references.json"] = { references: refs };
    const ctx = context(files);
    checkReferences(ctx, true);
    expect(ctx.failures).toEqual([]);
  });
});

describe("site-kit plan: design critique", () => {
  const scores = { type: 4, spacing: 5, clutter: 4, icons: 4, hierarchy: 5, originality: 4 };
  const withCritique = (critique, audits) => ({ ...board(goodRefs), "docs/DESIGN-DECISIONS.md": true, "docs/design/critique.json": critique, ...audits });

  it("passes when every direction scores 4+ and its audit passes", () => {
    const ctx = context(withCritique({ directions: [{ id: "A", scores, audit: "a.json" }, { id: "B", scores, audit: "b.json" }] }, { "a.json": { pass: true }, "b.json": { pass: true } }));
    checkDesignDecisions(ctx, true);
    expect(ctx.failures).toEqual([]);
  });

  it("fails a low score, a failed audit and a missing critique", () => {
    const ctx = context(withCritique({ directions: [{ id: "A", scores: { ...scores, spacing: 3 }, audit: "a.json" }, { id: "B", scores, audit: "b.json" }] }, { "a.json": { pass: true }, "b.json": { pass: false } }));
    checkDesignDecisions(ctx, true);
    const all = ctx.failures.join("\n");
    expect(all).toContain("Direction A: spacing scored 3");
    expect(all).toContain("Direction B: its design audit (b.json) fails");

    const none = context({ ...board(goodRefs), "docs/DESIGN-DECISIONS.md": true });
    checkDesignDecisions(none, true);
    expect(none.failures.join("\n")).toContain("design-critique: Missing. The design-critic agent scores every direction");
  });
});
