import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Cloudflare's auto-trailing-slash answers /page with a 307. These rules make it a 301
// to the canonical /page/ (and /page/index.html likewise), built from the pages that actually exist in the build output.
export const MARKER = "# site-kit redirects: generated after the build, do not edit below";
export const MAX_STATIC_RULES = 2000;

function pageDirs(dir, rel = "") {
  return readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name.startsWith(".")) return [];
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    const own = existsSync(path.join(dir, child, "index.html")) ? [child] : [];
    return [...own, ...pageDirs(dir, child)];
  });
}

export function trailingSlashRules(dir) {
  const rules = pageDirs(dir)
    .sort()
    .flatMap((rel) => [`/${rel} /${rel}/ 301`, `/${rel}/index.html /${rel}/ 301`]);
  return existsSync(path.join(dir, "index.html")) ? [...rules, "/index.html / 301"] : rules;
}

function ruleSource(line) {
  const trimmed = line.trim();
  return trimmed === "" || trimmed.startsWith("#") ? null : trimmed.split(/\s+/)[0];
}

/** Writes <dir>/_redirects: the project's own rules (from public/_redirects) first, then the generated ones. */
export function writeRedirects(dir) {
  if (!existsSync(dir)) throw new Error(`${dir} not found. Run the build first, then site-kit redirects.`);
  const file = path.join(dir, "_redirects");
  const existing = existsSync(file) ? readFileSync(file, "utf8").replace(/\r\n/g, "\n") : "";
  const own = existing.split(MARKER)[0].trimEnd();
  const taken = new Set(own.split("\n").map(ruleSource).filter((s) => s !== null));
  const generated = trailingSlashRules(dir).filter((rule) => !taken.has(ruleSource(rule)));
  const total = taken.size + generated.length;
  if (total > MAX_STATIC_RULES) throw new Error(`${total} redirect rules; Cloudflare allows ${MAX_STATIC_RULES} static rules. Move some to a Redirect Rule in the dashboard.`);
  writeFileSync(file, `${own ? `${own}\n\n` : ""}${MARKER}\n${generated.join("\n")}\n`);
  return { file, generated, kept: taken.size };
}
