import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { headerOptions, loadConfig } from "../bin/config.mjs";
import { headersFile } from "../headers/security.mjs";

const root = process.cwd();
const config = loadConfig(root);
const { SITE } = await import(pathToFileURL(path.join(root, config.siteFile)).href);
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const initial = escape(SITE.name.trim().charAt(0).toUpperCase() || "S");

function iconSvg(size, padding) {
  const inner = size - padding * 2;
  const radius = Math.round(inner * 0.22);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${padding > 0 ? SITE.themeColor : "none"}"/>
  <rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${radius}" fill="${SITE.themeColor}"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-weight="700" font-size="${Math.round(inner * 0.58)}" fill="#ffffff">${initial}</text>
</svg>`;
}

function wrap(text, max) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if ((line + " " + word).trim().length > max) {
      lines.push(line.trim());
      line = word;
    } else {
      line = `${line} ${word}`;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines.slice(0, 3);
}

function ogSvg() {
  const desc = wrap(SITE.description.replace(/\[Replace:[^\]]*\]/g, "").trim(), 48)
    .map((l, i) => `<text x="80" y="${380 + i * 52}" font-size="38" fill="#c9cdd8">${escape(l)}</text>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${SITE.backgroundColor}"/><stop offset="1" stop-color="${SITE.themeColor}"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g font-family="system-ui, -apple-system, Segoe UI, sans-serif">
    <text x="80" y="170" font-size="34" fill="#c9cdd8">${escape(SITE.domain)}</text>
    <text x="80" y="290" font-size="84" font-weight="700" fill="#ffffff">${escape(SITE.name)}</text>
    ${desc}
  </g>
</svg>`;
}

const outputs = [
  { file: "public/icons/icon-192.png", svg: iconSvg(192, 0) },
  { file: "public/icons/icon-512.png", svg: iconSvg(512, 0) },
  { file: "public/icons/icon-maskable-512.png", svg: iconSvg(512, 64) },
  { file: "public/icons/apple-touch-icon.png", svg: iconSvg(180, 0) },
  { file: "public/icons/favicon-32.png", svg: iconSvg(32, 0) },
  { file: "public/og/default.png", svg: ogSvg() },
];

for (const { file, svg } of outputs) {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(target);
}
writeFileSync(path.join(root, "public", "favicon.svg"), iconSvg(64, 0));
copyFileSync(fileURLToPath(new URL("./sw.js", import.meta.url)), path.join(root, "public", "sw.js"));
const extra = ["public/sw.js"];
if (config.headersFile) {
  writeFileSync(path.join(root, config.headersFile), headersFile(headerOptions(config)));
  extra.push(config.headersFile);
}
process.stdout.write(`Assets: ${outputs.length + 1} images (icons, favicon, OG card) and ${extra.join(", ")} written.\n`);
