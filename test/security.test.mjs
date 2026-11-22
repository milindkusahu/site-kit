import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanRepo, scanText } from "../checks/secrets.mjs";
import { headerProblems, headersFile, securityHeaders } from "../headers/security.mjs";

const fake = (...parts) => parts.join("");

describe("secret scanner", () => {
  it.each([
    ["AWS access key", fake("AKIA", "IOSFODNN7EXAMPLE")],
    ["GitHub token", fake("ghp_", "a".repeat(36))],
    ["Google API key", fake("AIza", "b".repeat(35))],
    ["Stripe live key", fake("sk_live_", "c".repeat(24))],
    ["Slack token", fake("xoxb-", "1234567890-abc")],
    ["Private key", fake("-----BEGIN RSA ", "PRIVATE KEY-----")],
    ["Credentials in a URL", fake("https://admin:", "hunter2pass@db.example.com")],
    ["Hard-coded secret", fake('const apiKey = "', "Zx9".repeat(8), '"')],
  ])("finds a %s", (name, line) => {
    expect(scanText(line)).toContain(name);
  });

  it("ignores ordinary code and env lookups", () => {
    expect(scanText('const apiKey = process.env["API_KEY"] ?? "";')).toEqual([]);
    expect(scanText("https://example.com/path?q=1")).toEqual([]);
    expect(scanText('password: "short"')).toEqual([]);
  });

  it("scans a repo, flags a tracked .env and honours .secrets-allow", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "secrets-"));
    execFileSync("git", ["init", "-q"], { cwd: dir });
    const token = fake("ghp_", "z".repeat(36));
    writeFileSync(path.join(dir, "a.ts"), `export const t = "${token}";\n`);
    writeFileSync(path.join(dir, ".env"), "X=1\n");
    writeFileSync(path.join(dir, ".env.example"), "X=\n");
    const found = scanRepo(dir).map((f) => `${f.file}:${f.name}`);
    expect(found).toContain("a.ts:GitHub token");
    expect(found).toContain(".env:.env file tracked by git");
    expect(found.some((f) => f.startsWith(".env.example"))).toBe(false);
    writeFileSync(path.join(dir, ".secrets-allow"), `${token}\n`);
    expect(scanRepo(dir).map((f) => f.file)).not.toContain("a.ts");
  });

  it("flags a tracked .env file with two suffixes, like .env.production.local", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "secrets-"));
    execFileSync("git", ["init", "-q"], { cwd: dir });
    writeFileSync(path.join(dir, ".env.production.local"), `TOKEN=${fake("ghp_", "y".repeat(36))}\n`);
    writeFileSync(path.join(dir, ".env.production.example"), "TOKEN=\n");
    const found = scanRepo(dir).map((f) => `${f.file}:${f.name}`);
    expect(found).toContain(".env.production.local:.env file tracked by git");
    expect(found.some((f) => f.startsWith(".env.production.example"))).toBe(false);
  });

  it("scans files whose names aren't ASCII", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "secrets-"));
    execFileSync("git", ["init", "-q"], { cwd: dir });
    writeFileSync(path.join(dir, "guía.md"), `token: ${fake("ghp_", "x".repeat(36))}\n`);
    expect(scanRepo(dir).map((f) => `${f.file}:${f.name}`)).toContain("guía.md:GitHub token");
  });
});

describe("security headers", () => {
  const asHeaders = (list) => new Headers(list.map((h) => [h.key, h.value]));

  it("ships a policy the audit accepts, with or without ads", () => {
    expect(headerProblems(asHeaders(securityHeaders()))).toEqual([]);
    expect(headerProblems(asHeaders(securityHeaders({ ads: "adsense", analytics: true })))).toEqual([]);
  });

  it("locks frames and plugins when ads are off, and opens frames only when ads are on", () => {
    const off = securityHeaders().find((h) => h.key === "Content-Security-Policy")?.value ?? "";
    const on = securityHeaders({ ads: "adsense" }).find((h) => h.key === "Content-Security-Policy")?.value ?? "";
    expect(off).toContain("frame-src 'none'");
    expect(off).toContain("object-src 'none'");
    expect(off).not.toContain("unsafe-eval");
    expect(on).toContain("frame-src https:");
    expect(securityHeaders({ dev: true }).find((h) => h.key === "Content-Security-Policy")?.value).toContain("unsafe-eval");
  });

  it("catches missing and weak headers", () => {
    const weak = new Headers({ "content-security-policy": "script-src *", "cross-origin-embedder-policy": "require-corp" });
    const problems = headerProblems(weak).join("\n");
    expect(problems).toContain("Missing strict-transport-security");
    expect(problems).toContain("object-src 'none'");
    expect(problems).toContain("any origin");
    expect(problems).toContain("Cross-Origin-Embedder-Policy");
  });

  it("points agents at llms.txt with a Link header on every path", () => {
    const link = securityHeaders().find((h) => h.key === "Link")?.value ?? "";
    expect(link).toContain('</llms.txt>; rel="describedby"; type="text/markdown"');
    expect(headersFile()).toContain('  Link: </llms.txt>; rel="describedby"');
  });

  it("writes a Cloudflare _headers file covering every path", () => {
    const file = headersFile();
    expect(file.startsWith("/*\n")).toBe(true);
    expect(file).toContain("  Content-Security-Policy: ");
    expect(file).toContain("immutable");
  });
});
