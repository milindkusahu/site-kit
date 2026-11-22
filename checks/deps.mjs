import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { isAstro } from "../bin/config.mjs";

const root = process.cwd();
const require = createRequire(import.meta.url);
function packageRoot(name) {
  const found = (require.resolve.paths(name) ?? []).map((dir) => path.join(dir, name)).find((dir) => existsSync(path.join(dir, "package.json")));
  if (!found) throw new Error(`Can't find the ${name} package. Run bun install.`);
  return found;
}

const cruiserRoot = packageRoot("dependency-cruiser");
const depcruise = path.join(cruiserRoot, JSON.parse(readFileSync(path.join(cruiserRoot, "package.json"), "utf8")).bin.depcruise);
const extraArgs = process.argv.slice(2);

function astroToScript(source) {
  const frontmatter = /^\s*---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? "";
  const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  return [frontmatter, ...scripts].join("\n");
}

function mirror(shadow, dir) {
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(path.join(shadow, rel), { recursive: true });
      mirror(shadow, rel);
    } else if (entry.name.endsWith(".astro")) {
      writeFileSync(path.join(shadow, `${rel}.ts`), astroToScript(readFileSync(path.join(root, rel), "utf8")));
    } else {
      copyFileSync(path.join(root, rel), path.join(shadow, rel));
    }
  }
}

function run(cwd, rename) {
  const result = spawnSync(process.execPath, [depcruise, "src", "--config", path.join(root, ".dependency-cruiser.cjs"), ...extraArgs], { cwd, encoding: "utf8", windowsHide: true });
  process.stdout.write(rename(result.stdout ?? ""));
  process.stderr.write(rename(result.stderr ?? ""));
  return result.status ?? 1;
}

function runAstro() {
  const shadow = mkdtempSync(path.join(os.tmpdir(), "deps-"));
  try {
    mkdirSync(path.join(shadow, "src"));
    mirror(shadow, "src");
    copyFileSync(path.join(root, "tsconfig.json"), path.join(shadow, "tsconfig.json"));
    copyFileSync(path.join(root, "package.json"), path.join(shadow, "package.json"));
    symlinkSync(path.join(root, "node_modules"), path.join(shadow, "node_modules"), "junction");
    return run(shadow, (text) => text.replaceAll(".astro.ts", ".astro"));
  } finally {
    rmSync(shadow, { recursive: true, force: true });
  }
}

process.exitCode = isAstro(root) ? runAstro() : run(root, (text) => text);
