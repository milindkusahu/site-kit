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
  maxInlineClasses: 3,
  headersFile: null,
  analytics: false,
};

export function loadConfig(root = process.cwd()) {
  const file = path.join(root, "site-kit.config.json");
  if (!existsSync(file)) throw new Error(`site-kit.config.json not found in ${root}. Every project needs one; see the site-kit README.`);
  return { ...DEFAULTS, ...JSON.parse(readFileSync(file, "utf8")) };
}

export function isAstro(root = process.cwd()) {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  return Boolean(pkg.dependencies?.astro ?? pkg.devDependencies?.astro);
}

export function headerOptions(config, env = process.env) {
  return { ads: env.PUBLIC_ADS_PROVIDER ?? "none", analytics: Boolean(config.analytics || env.PUBLIC_GA_ID) };
}
