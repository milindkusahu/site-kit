import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const DEFAULTS = {
  siteFile: "src/lib/site.ts",
  tokensFile: "src/styles/tokens.css",
  sourceDirs: ["src", "content"],
  contentDirs: ["content", "src/content"],
  chromeDirs: [],
  maxLedeWords: 55,
  maxParagraphWords: 30,
  maxAnswerWords: 60,
  minTitleChars: 15,
  maxTitleChars: 55,
  minDescriptionChars: 70,
  maxDescriptionChars: 150,
  maxInlineClasses: 3,
  headersFile: null,
  analytics: false,
  spacingScale: false,
};

export function loadConfig(root = process.cwd()) {
  const file = path.join(root, "site-kit.config.json");
  if (!existsSync(file)) throw new Error(`site-kit.config.json not found in ${root}. Every project needs one; see the site-kit README.`);
  return { ...DEFAULTS, ...JSON.parse(readFileSync(file, "utf8")) };
}

export function paragraphLimits(config) {
  return { paragraph: config.maxParagraphWords, lede: config.maxLedeWords, answer: config.maxAnswerWords };
}

export function lengthLimits(config) {
  return {
    title: { min: config.minTitleChars, max: config.maxTitleChars },
    description: { min: config.minDescriptionChars, max: config.maxDescriptionChars },
  };
}

export function auditConfig(root) {
  return existsSync(path.join(root, "site-kit.config.json")) ? loadConfig(root) : DEFAULTS;
}

export function isAstro(root = process.cwd()) {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  return Boolean(pkg.dependencies?.astro ?? pkg.devDependencies?.astro);
}

export function headerOptions(config, env = process.env) {
  return { ads: env.PUBLIC_ADS_PROVIDER ?? "none", analytics: Boolean(config.analytics || env.PUBLIC_GA_ID || env.PUBLIC_GTM_ID), agentLinks: config.agentLinks !== false, wasm: config.wasm === true };
}
