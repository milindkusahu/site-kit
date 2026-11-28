#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { headerOptions, loadConfig } from "./config.mjs";

const [command, ...rest] = process.argv.slice(2);
const kitFile = (rel) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
// import() needs a file:// URL: Node on Windows rejects a C: path.
const kitModule = (rel) => import(new URL(`../${rel}`, import.meta.url).href);

function asScript(rel) {
  process.argv = [process.argv[0] ?? "node", kitFile(rel), ...rest];
  return kitModule(rel);
}

async function audit() {
  const { formatProblems, runAudit } = await kitModule("checks/audit/index.mjs");
  const base = rest.find((a) => !a.startsWith("--"));
  if (!base) {
    process.stderr.write("Usage: site-kit audit <base-url> [--launch]\n  --launch  also fail on placeholders, missing ads.txt and agent readiness (Content Signals, Link header; markdown on the live site)\n");
    return 1;
  }
  const { problems, pages } = await runAudit(base, { launch: rest.includes("--launch") });
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/audit.json", JSON.stringify({ base, pages, problems }, null, 2));
  if (problems.length > 0) {
    process.stdout.write(`Site audit: ${problems.length} problem(s) on ${pages} page(s)\n\n${formatProblems(problems)}\n`);
    return 1;
  }
  process.stdout.write(`Site audit: ${pages} page(s), no problems.\n`);
  return 0;
}

async function plan() {
  const { runPlanChecks } = await kitModule("checks/plan/index.mjs");
  const { problems, summary, ticked } = runPlanChecks(process.cwd());
  for (const line of summary) process.stdout.write(`${line}\n`);
  if (problems.length > 0) {
    process.stderr.write(`Plan check: ${problems.length} problem(s)\n${problems.map((p) => `  [${p.stage}] ${p.file}  ${p.message}`).join("\n")}\n`);
    return 1;
  }
  process.stdout.write(`Plan check: ${ticked.length} kickoff stage(s) ticked, all files complete.\n`);
  return 0;
}

async function secrets() {
  const { scanRepo } = await kitModule("checks/secrets.mjs");
  const findings = scanRepo(process.cwd());
  if (findings.length > 0) {
    process.stderr.write(`Possible secrets (${findings.length}). Move them to environment variables, rotate any real key, or add a deliberate fake to .secrets-allow:\n${findings.map((f) => `  ${f.file}:${f.line}  ${f.name}`).join("\n")}\n`);
    return 1;
  }
  process.stdout.write("Secrets: none found in tracked files.\n");
  return 0;
}

async function headers() {
  const { headersFile, securityHeaders } = await kitModule("headers/security.mjs");
  const options = headerOptions(loadConfig());
  process.stdout.write(rest.includes("--file") ? headersFile(options) : `${JSON.stringify(securityHeaders(options), null, 2)}\n`);
  return 0;
}

function assets() {
  const script = kitFile("assets/images.mjs");
  if (process.versions["bun"]) return import(script).then(() => 0);
  // shell: true on Windows joins the args unquoted, and the path can contain spaces.
  const win = process.platform === "win32";
  const bun = spawnSync("bun", [win ? `"${script}"` : script, ...rest], { stdio: "inherit", windowsHide: true, shell: win });
  if (bun.error === undefined) return bun.status ?? 1;
  return spawnSync(process.execPath, [script, ...rest], { stdio: "inherit" }).status ?? 1;
}

async function markdown() {
  const { writeMarkdownTwins } = await kitModule("assets/markdown.mjs");
  const options = loadConfig().markdown ?? {};
  const dir = rest.find((a) => !a.startsWith("--")) ?? options.dir ?? "dist";
  const written = writeMarkdownTwins(dir, options);
  process.stdout.write(`Markdown copies: ${written.length} written next to the HTML pages in ${dir}.\n`);
  return 0;
}

async function redirects() {
  const { writeRedirects } = await kitModule("assets/redirects.mjs");
  const dir = rest.find((a) => !a.startsWith("--")) ?? loadConfig().redirects?.dir ?? "dist";
  const { file, generated, kept } = writeRedirects(dir);
  process.stdout.write(`Redirects: ${generated.length} trailing-slash rule(s) written to ${file}${kept ? `, after ${kept} of the project's own` : ""}.
`);
  return 0;
}

async function sitemapUrls(origin) {
  const { loadSitemap } = await kitModule("checks/audit/technical.mjs");
  const problems = [];
  const urls = await loadSitemap({ base: origin, fail: (_rule, where, message) => problems.push(`${where}: ${message}`) });
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return urls;
}

async function indexnowPing(kit, key) {
  const origin = rest.slice(1).find((a) => !a.startsWith("--"));
  if (!origin?.startsWith("https://")) throw new Error("Usage: site-kit indexnow ping https://<domain> [--dry-run]");
  const bodies = kit.submissionBodies({ origin, key, urls: await sitemapUrls(origin) });
  const count = bodies.reduce((n, b) => n + b.urlList.length, 0);
  if (rest.includes("--dry-run")) {
    process.stdout.write(`IndexNow dry run: ${count} URL(s) from ${origin}/sitemap.xml in ${bodies.length} request(s), key file ${bodies[0]?.keyLocation ?? "none"}.\n`);
    return 0;
  }
  const keyProblem = await kit.liveKeyProblem({ origin, key });
  if (keyProblem) throw new Error(keyProblem);
  let failed = 0;
  for (const body of bodies) {
    const result = await kit.submit(body);
    process.stdout.write(`IndexNow: ${result.count} URL(s) -> ${result.status} ${result.message}\n`);
    if (!result.ok) failed += 1;
  }
  return failed > 0 || bodies.length === 0 ? 1 : 0;
}

async function indexnow() {
  const kit = await kitModule("assets/indexnow.mjs");
  const key = kit.checkKey(loadConfig().indexnow?.key);
  if (rest[0] === "ping") return indexnowPing(kit, key);
  if (rest[0] !== "key") throw new Error("Usage: site-kit indexnow key [dir] | ping https://<domain> [--dry-run]");
  const file = kit.writeKeyFile(rest[1] ?? "dist", key);
  process.stdout.write(`IndexNow key file written: ${file}\n`);
  return 0;
}

const COMMANDS = {
  rules: { run: () => asScript("checks/rules.mjs").then(() => process.exitCode ?? 0), help: "project rules: em dashes, colour and type tokens, banned classes, chrome headings, paragraph length" },
  plan: { run: plan, help: "kickoff files: research, silo, briefs, design references and decisions" },
  deps: { run: () => asScript("checks/deps.mjs").then(() => process.exitCode ?? 0), help: "dependency-cruiser with the project's .dependency-cruiser.cjs (Astro files included)" },
  secrets: { run: secrets, help: "scan tracked files for keys, tokens and private keys" },
  audit: { run: audit, help: "<base-url> [--launch]  crawl a running build: technical, on-page, content, security headers" },
  cwv: { run: () => asScript("checks/cwv.mjs").then(() => process.exitCode ?? 0), help: "<base-url> [/path ...]  Lighthouse median of 3, mobile and desktop budgets" },
  ui: { run: () => asScript("checks/ui.mjs").then(() => process.exitCode ?? 0), help: "<url> [actions]  screenshot a page at phone and desktop widths" },
  assets: { run: assets, help: "icons, favicon, OG card, public/sw.js and the headers file from site-kit.config.json" },
  markdown: { run: markdown, help: "[dir]  after the build, write a markdown copy of every page for site-kit's Worker to serve to agents" },
  redirects: { run: redirects, help: "[dir]  after the build, 301 each page without its trailing slash, and its index.html, in <dir>/_redirects" },
  indexnow: { run: indexnow, help: "key [dir] | ping https://<domain> [--dry-run]  write the key file after the build; ping IndexNow with the live sitemap's URLs" },
  headers: { run: headers, help: "[--file]  print the security headers this project ships" },
};

function usage() {
  const version = JSON.parse(readFileSync(kitFile("package.json"), "utf8")).version;
  const lines = Object.entries(COMMANDS).map(([name, c]) => `  ${name.padEnd(10)} ${c.help}`);
  process.stdout.write(`site-kit ${version}\n\nUsage: site-kit <command> [args]\n\n${lines.join("\n")}\n`);
}

const entry = command ? Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined : undefined;
if (!entry) {
  usage();
  process.exit(command && command !== "help" && command !== "--help" ? 1 : 0);
}
try {
  process.exitCode = await entry.run();
} catch (error) {
  process.stderr.write(`site-kit ${command}: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
