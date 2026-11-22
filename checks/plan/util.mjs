import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function createContext(root) {
  const problems = [];
  return {
    root,
    problems,
    fail: (stage, file, message) => problems.push({ stage, file, message }),
    file: (rel) => path.join(root, rel),
    exists: (rel) => existsSync(path.join(root, rel)),
    json(rel) {
      const full = path.join(root, rel);
      if (!existsSync(full)) return null;
      try {
        return JSON.parse(readFileSync(full, "utf8"));
      } catch (error) {
        problems.push({ stage: "format", file: rel, message: `Not valid JSON: ${String(error)}` });
        return null;
      }
    },
  };
}

export const words = (s) => (typeof s === "string" ? s.trim().split(/\s+/).filter(Boolean).length : 0);
export const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isUrl = (s) => typeof s === "string" && /^https?:\/\/\S+$/.test(s);
export const arr = (v) => (Array.isArray(v) ? v : []);

export function median(values) {
  const sorted = values.filter((v) => typeof v === "number" && v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function tokens(text) {
  return String(text ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
}

export function tickedStages(ctx) {
  const rel = "docs/PROGRESS.md";
  if (!ctx.exists(rel)) return new Set();
  const text = readFileSync(ctx.file(rel), "utf8");
  return new Set([...text.matchAll(/^\s*-\s*\[[xX]\]\s*Kickoff:\s*([^(\n]+)/gm)].map((m) => m[1].trim().toLowerCase()));
}
