import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { parse } from "node-html-parser";

export const DEFAULT_TOOL_NOTE = "This page has an interactive tool that runs in the browser. Open {url} in a browser to use it.";
const DEFAULT_SKIP = ["offline"];
const DROP = "script, style, noscript, svg, template, dialog, canvas, input, select, textarea, [aria-hidden=true]";
const converter = new NodeHtmlMarkdown({ bulletMarker: "-", maxConsecutiveNewlines: 2 });

function pagesIn(dir, skip) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return skip.has(entry.name) ? [] : pagesIn(full, skip);
    return entry.name.endsWith(".html") ? [full] : [];
  });
}

function canonicalOf(root) {
  return root.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null;
}

function originOf(dir, configured) {
  if (configured) return new URL(configured).origin;
  const home = path.join(dir, "index.html");
  const canonical = existsSync(home) ? canonicalOf(parse(readFileSync(home, "utf8"))) : null;
  if (canonical === null) throw new Error(`No origin: ${home} has no canonical link. Set markdown.origin in site-kit.config.json.`);
  return new URL(canonical).origin;
}

function routeOf(dir, file) {
  const rel = path.relative(dir, file).split(path.sep).join("/");
  return `/${rel.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "")}`;
}

function absolute(main, origin) {
  for (const node of main.querySelectorAll("a[href], img[src]")) {
    const key = node.tagName === "A" ? "href" : "src";
    const value = node.getAttribute(key);
    if (value !== undefined && value.startsWith("/") && !value.startsWith("//")) node.setAttribute(key, new URL(value, origin).href);
  }
}

function simplify(main, url, origin, toolNote) {
  const note = toolNote.replace("{url}", `<a href="${url}">${url}</a>`);
  for (const tool of main.querySelectorAll("[data-tool]")) tool.replaceWith(`<p>${note}</p>`);
  for (const node of main.querySelectorAll(DROP)) node.remove();
  for (const button of main.querySelectorAll("button")) button.replaceWith(button.innerHTML);
  absolute(main, origin);
}

function header(root, url) {
  const title = root.querySelector("title")?.text.trim() ?? "";
  const description = root.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\nurl: ${url}\n---\n\n`;
}

function notFoundFooter(origin) {
  return `\n\nThis page does not exist. Every page is listed in the [sitemap](${origin}/sitemap.xml), and [llms.txt](${origin}/llms.txt) says what this site does.\n`;
}

function twin(file, { dir, origin, toolNote }) {
  const root = parse(readFileSync(file, "utf8"));
  const main = root.querySelector("main");
  if (main === null) return null;
  const url = canonicalOf(root) ?? new URL(routeOf(dir, file), origin).href;
  simplify(main, url, origin, toolNote);
  const body = converter.translate(main.innerHTML.replace(/<\/(b|strong)><(?!\/)/g, "</$1> <")).trim();
  const notFound = path.relative(dir, file) === "404.html";
  return `${header(root, url)}${body}${notFound ? notFoundFooter(origin) : "\n"}`;
}

export function twinPath(file) {
  return file.replace(/\.html$/, ".md");
}

export function writeMarkdownTwins(dir, options = {}) {
  if (!existsSync(dir)) throw new Error(`${dir} not found. Run the build first.`);
  const settings = { dir, origin: originOf(dir, options.origin), toolNote: options.toolNote ?? DEFAULT_TOOL_NOTE };
  const skip = new Set(options.skip ?? DEFAULT_SKIP);
  const written = [];
  for (const file of pagesIn(dir, skip)) {
    const markdown = twin(file, settings);
    if (markdown === null) continue;
    writeFileSync(twinPath(file), markdown);
    written.push(twinPath(file));
  }
  if (!written.includes(twinPath(path.join(dir, "404.html")))) throw new Error(`${path.join(dir, "404.html")} is missing or has no <main>. The Worker answers unknown paths with 404.md.`);
  return written;
}
