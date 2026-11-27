import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "../bin/config.mjs";

const root = process.cwd();
const config = loadConfig(root);
const problems = [];

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const p = path.join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const rel = (p) => path.relative(root, p).split(path.sep).join("/");
const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const report = (file, text, index, message) => problems.push(`${rel(file)}:${lineOf(text, index)}  ${message}`);

const sourceFiles = config.sourceDirs.flatMap((d) => walk(path.join(root, d))).filter((f) => /\.(tsx?|jsx?|mjs|astro|css|mdx?|json|html)$/.test(f));
const tokensFile = path.join(root, config.tokensFile);
const tokensText = readFileSync(tokensFile, "utf8");
const definedTokens = new Set([...tokensText.matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

const EM_DASH = "—";
const hexColor = /(?<![\w&-])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])/g;
const fnColor = /\b(?:rgb|hsl|oklch|oklab|lab|lch)a?\(\s*(?!0\s*,\s*0\s*,\s*0\s*[,/)])/g;
const tokenUse = /var\(\s*(--color-[a-z0-9-]+)/g;
const definedSpace = new Set([...tokensText.matchAll(/(--space-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const spacingDecl = /(?<![\w-])((?:margin|padding)(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?|gap|row-gap|column-gap)\s*:\s*([^;}"'\n]+)/g;
const literalLength = /-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em)\b/g;
const HAIRLINE = new Set(["0px", "0rem", "0em", "1px", "2px"]);
const spaceUse = /var\(\s*(--space-[a-z0-9-]+)/g;
const tailwindToken = /\b(?:bg|text|border|ring|outline|fill|stroke|from|to|via|divide|placeholder|decoration|shadow|accent|caret)-((?:bg|surface|surface-2|line|fg|muted|brand|brand-fill|accent-2|on-accent|error|accent|foreground|background|border|primary)(?![\w-]))/g;

const literalStyle = /\b(font-size|font-weight|border-radius|box-shadow)\s*:\s*(?=\S)(?!var\(|inherit|initial|unset|0\s*;|none\s*;|100%)([^;}"'\n]+)/g;
const bannedClass =
  /^(?:[a-z0-9-]+:)*(?:text-(?:xs|sm|base|lg|xl|[2-9]xl)|rounded(?:-[a-z0-9]+)*|(?:bg|text|border|ring|outline|fill|stroke|from|to|via|divide|decoration|shadow|accent|caret|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d+)?(?:\/\d+)?)$/;
const classAttr = /\b(?:className|class)=(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\})/g;
const applyLine = /@apply\s+([^;]+);/g;

function classTokens(value) {
  return value.replace(/\$\{[^}]*\}/g, " ").split(/\s+/).filter(Boolean);
}

for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  const r = rel(file);
  const isTest = /\.test\.[cm]?[jt]sx?$/.test(r);

  let i = text.indexOf(EM_DASH);
  while (i !== -1 && !isTest) {
    report(file, text, i, "Em dash in user-facing source. Use a period, comma, colon or parentheses.");
    i = text.indexOf(EM_DASH, i + 1);
  }

  for (const m of text.matchAll(/overscroll-behavior(?:-[a-z]+)?\s*:\s*contain/gi)) {
    report(file, text, m.index, "overscroll-behavior: contain traps the mouse wheel. Remove it.");
  }

  if (file !== tokensFile && /\.(css|tsx|jsx|astro)$/.test(r)) {
    for (const m of text.matchAll(hexColor)) report(file, text, m.index, `Hard-coded colour ${m[0]}. Use a token from ${config.tokensFile}.`);
    for (const m of text.matchAll(fnColor)) report(file, text, m.index, `Hard-coded colour ${m[0]}...). Use a token from ${config.tokensFile}.`);
  }

  if (file !== tokensFile && /\.(css|astro)$/.test(r)) {
    for (const m of text.matchAll(literalStyle)) {
      report(file, text, m.index, `Literal ${m[1]}: ${m[2].trim()}. Use a token from ${config.tokensFile} (add one for light and dark if it's missing).`);
    }
  }

  if (config.spacingScale && /\.(css|astro)$/.test(r)) {
    for (const m of text.matchAll(spacingDecl)) {
      const literal = m[2].replace(/var\([^)]*\)/g, " ").match(literalLength)?.find((v) => !HAIRLINE.has(v.replace(/^-/, "")));
      if (literal) report(file, text, m.index, `Literal spacing ${m[1]}: ${m[2].trim()}. Use var(--space-N) from ${config.tokensFile}, so every gap sits on one scale.`);
    }
    for (const m of text.matchAll(spaceUse)) {
      if (!definedSpace.has(m[1])) report(file, text, m.index, `${m[1]} isn't on the spacing scale in ${config.tokensFile}.`);
    }
  }

  if (/\.(tsx|jsx|astro)$/.test(r)) {
    for (const m of text.matchAll(classAttr)) {
      const tokens = classTokens(m[1] ?? m[2] ?? m[3] ?? "");
      if (tokens.length > config.maxInlineClasses) {
        report(file, text, m.index, `${tokens.length} inline classes. More than ${config.maxInlineClasses} go in a co-located .module.css (or a scoped <style>).`);
      }
      for (const t of tokens.filter((t) => bannedClass.test(t))) report(file, text, m.index, `Class '${t}' bypasses the tokens. Use a token in CSS instead.`);
    }
  }
  if (/\.css$/.test(r)) {
    for (const m of text.matchAll(applyLine)) {
      for (const t of classTokens(m[1]).filter((t) => bannedClass.test(t))) report(file, text, m.index, `@apply '${t}' bypasses the tokens. Use var(--...) from ${config.tokensFile}.`);
    }
  }

  for (const m of text.matchAll(tokenUse)) {
    if (!definedTokens.has(m[1])) report(file, text, m.index, `${m[1]} isn't defined in ${config.tokensFile}. Use an existing token or add it for light and dark.`);
  }
  for (const m of text.matchAll(tailwindToken)) {
    if (!definedTokens.has(`--color-${m[1]}`)) report(file, text, m.index, `Tailwind colour '${m[0]}' uses --color-${m[1]}, which isn't a token.`);
  }

  const isChrome = config.chromeDirs.some((d) => r.startsWith(`${d}/`)) || /(^|\/)(header|footer|nav|navbar|site-header|site-footer)\.(tsx|astro)$/i.test(r);
  if (isChrome) {
    for (const m of text.matchAll(/<h[1-6][\s>]/g)) report(file, text, m.index, "Heading in site chrome (header, footer, nav). Use <p> with aria-labelledby for group labels.");
  }
}

for (const file of config.contentDirs.flatMap((d) => walk(path.join(root, d))).filter((f) => /\.mdx?$/.test(f))) {
  const text = readFileSync(file, "utf8");
  const body = text.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
  const offset = text.length - body.length;
  let seenLede = false;
  let cursor = 0;
  for (const block of body.split(/\n\s*\n/)) {
    const start = body.indexOf(block, cursor);
    cursor = start + block.length;
    const trimmed = block.trim();
    if (!trimmed || /^(#|[-*+] |\d+\. |\||```|<|!\[|import |export )/.test(trimmed)) continue;
    const words = trimmed.split(/\s+/).length;
    const limit = seenLede ? config.maxParagraphWords : config.maxLedeWords;
    if (words > limit) {
      report(file, text, offset + start, `${seenLede ? "Paragraph" : "Lede"} has ${words} words (max ${limit}). Split it at an idea boundary.`);
    }
    seenLede = true;
  }
}

if (problems.length > 0) {
  process.stderr.write(`Project rule violations (${problems.length}):\n${problems.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`Project rules: ${sourceFiles.length} files clean.\n`);
