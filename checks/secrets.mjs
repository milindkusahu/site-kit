import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const SECRET_PATTERNS = [
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub token", re: /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "Stripe live key", re: /\b(sk|rk)_live_[0-9a-zA-Z]{20,}\b/ },
  { name: "Slack token", re: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/ },
  { name: "OpenAI or Anthropic key", re: /\bsk-(proj-|ant-)?[A-Za-z0-9_-]{32,}\b/ },
  { name: "Private key", re: /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY( BLOCK)?-----/ },
  { name: "Credentials in a URL", re: /\bhttps?:\/\/[^\s/:@]+:[^\s/@]{6,}@[^\s/]+/ },
  { name: "Hard-coded secret", re: /\b(api[_-]?key|secret|password|passwd|auth[_-]?token|access[_-]?token)\b\s*[:=]\s*["'][A-Za-z0-9_\-+/=]{20,}["']/i },
];

const SKIP = /(^|\/)(node_modules|dist|\.next|\.astro|\.wrangler|test-results|playwright-report|docs\/research\/raw)\/|\.(png|jpe?g|webp|avif|gif|ico|woff2?|lock|pdf|zip)$/i;
const ALLOW_FILE = ".secrets-allow";

function gitFiles(root, flags) {
  const git = spawnSync("git", ["ls-files", "-z", ...flags], { cwd: root, encoding: "utf8", windowsHide: true });
  return git.status === 0 ? git.stdout.split("\0").filter(Boolean) : [];
}

// Tracked plus untracked files that .gitignore doesn't cover: everything that could be committed.
const trackedFiles = (root) => gitFiles(root, ["-co", "--exclude-standard"]);

export function scanText(text) {
  return SECRET_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name);
}

export function scanRepo(root) {
  const allowFile = path.join(root, ALLOW_FILE);
  const allow = existsSync(allowFile) ? readFileSync(allowFile, "utf8").split("\n").map((l) => l.trim()).filter(Boolean) : [];
  const findings = [];
  for (const rel of trackedFiles(root)) {
    if (SKIP.test(rel) || /(^|\/)\.env(\.|$)/.test(rel) && !rel.endsWith(".example")) continue;
    const full = path.join(root, rel);
    if (!existsSync(full) || statSync(full).size > 2_000_000) continue;
    const lines = readFileSync(full, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const name of scanText(line)) if (!allow.some((a) => line.includes(a))) findings.push({ file: rel, line: i + 1, name });
    });
  }
  const committed = new Set(gitFiles(root, ["-c"]));
  const envFiles = trackedFiles(root).filter((f) => /(^|\/)\.env(\.[^/]+)?$/.test(f) && !f.endsWith(".example"));
  for (const f of envFiles) findings.push({ file: f, line: 0, name: committed.has(f) ? ".env file tracked by git" : ".env file not ignored by git" });
  return findings;
}
