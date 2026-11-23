import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cli = fileURLToPath(new URL("../bin/site-kit.mjs", import.meta.url));

function project(files) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "rules-"));
  mkdirSync(path.join(dir, "src", "styles"), { recursive: true });
  mkdirSync(path.join(dir, "content"));
  writeFileSync(path.join(dir, "site-kit.config.json"), "{}");
  writeFileSync(path.join(dir, "src", "styles", "tokens.css"), ":root { --color-fg: currentColor; }\n");
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, name), text);
  return spawnSync(process.execPath, [cli, "rules"], { cwd: dir, encoding: "utf8" });
}

const article = (eol) =>
  ["---", "title: Compress PNG files", "description: A short guide.", "---", "", `${"word ".repeat(40).trim()}.`, "", "A short second paragraph.", ""].join(eol);

describe("site-kit rules: paragraph length", () => {
  it("treats the first paragraph after front matter as the lede with LF line endings", () => {
    expect(project({ "content/lf.md": article("\n") }).status).toBe(0);
  });

  it("does the same with CRLF line endings (files saved on Windows)", () => {
    const run = project({ "content/crlf.md": article("\r\n") });
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });

  it("strips front matter from a file saved as UTF-8 with BOM", () => {
    const BOM = String.fromCharCode(0xfeff);
    const run = project({ "content/bom.md": `${BOM}${article("\r\n")}` });
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });

  it("strips front matter whose closing --- ends the file", () => {
    const run = project({ "content/only.md": ["---", "title: Compress PNG files", `description: ${"word ".repeat(60).trim()}.`, "---"].join("\n") });
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });

  it("still fails a long paragraph after the lede", () => {
    const run = project({ "content/long.md": article("\r\n").replace("A short second paragraph.", `${"word ".repeat(40).trim()}.`) });
    expect(run.stderr).toContain("Paragraph has 40 words (max 30)");
  });
});
