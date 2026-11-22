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
  const bun = spawnSync("bun", [script, ...rest], { stdio: "inherit", windowsHide: true, shell: process.platform === "win32" });
  if (bun.error === undefined) return bun.status ?? 1;
  return spawnSync(process.execPath, [script, ...rest], { stdio: "inherit" }).status ?? 1;
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
  headers: { run: headers, help: "[--file]  print the security headers this project ships" },
};

function usage() {
  const version = JSON.parse(readFileSync(kitFile("package.json"), "utf8")).version;
  const lines = Object.entries(COMMANDS).map(([name, c]) => `  ${name.padEnd(8)} ${c.help}`);
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
