import { buildRouteMetadata, DESCRIPTION_LIMITS, TITLE_LIMITS } from "./metadata.ts";
import { breadcrumbTrail } from "./pages.ts";
import { pageGraph } from "./structured-data.ts";
import type { SiteConfig, SitePage } from "./types.ts";
import { withTrailingSlash } from "./url.ts";

function collectIds(value: unknown, defined: Set<string>, referenced: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((v: unknown) => { collectIds(v, defined, referenced); });
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const keys = Object.keys(value);
  const id: unknown = Reflect.get(value, "@id");
  if (typeof id === "string") (keys.length === 1 ? referenced : defined).add(id);
  keys.forEach((k) => {
    const child: unknown = Reflect.get(value, k);
    collectIds(child, defined, referenced);
  });
}

function hasParentLoop(pages: readonly SitePage[], page: SitePage): boolean {
  const seen = new Set<string>();
  let current: SitePage | undefined = page;
  while (current && current.parent !== null) {
    if (seen.has(current.path)) return true;
    seen.add(current.path);
    const parent: string = current.parent;
    current = pages.find((p) => p.path === parent);
  }
  return false;
}

function pageProblems(site: SiteConfig, pages: readonly SitePage[], page: SitePage): string[] {
  const problems: string[] = [];
  const meta = buildRouteMetadata(site, page);
  if (meta.title.length < TITLE_LIMITS.min || meta.title.length > TITLE_LIMITS.max) problems.push(`${page.path}: title is ${meta.title.length} characters (${TITLE_LIMITS.min} to ${TITLE_LIMITS.max}): "${meta.title}"`);
  if (page.description.length < DESCRIPTION_LIMITS.min || page.description.length > DESCRIPTION_LIMITS.max) problems.push(`${page.path}: description is ${page.description.length} characters (${DESCRIPTION_LIMITS.min} to ${DESCRIPTION_LIMITS.max})`);
  if (page.path !== withTrailingSlash(page.path)) problems.push(`${page.path}: path must end in a slash`);
  if (page.parent !== null && !pages.some((p) => p.path === page.parent)) {
    problems.push(`${page.path}: parent ${page.parent} isn't registered`);
    return problems;
  }
  if (hasParentLoop(pages, page)) {
    problems.push(`${page.path}: parent loop, the page is its own ancestor`);
    return problems;
  }
  const defined = new Set<string>();
  const referenced = new Set<string>();
  const image = { src: "/og/default.png", alt: "Preview", width: 1200, height: 630 };
  collectIds(pageGraph(site, page, meta, { trail: breadcrumbTrail(pages, page), primaryImage: image }), defined, referenced);
  for (const ref of referenced) if (!defined.has(ref)) problems.push(`${page.path}: schema references ${ref}, which isn't defined`);
  return problems;
}

export function registryProblems(site: SiteConfig, pages: readonly SitePage[]): readonly string[] {
  const problems = pages.flatMap((p) => pageProblems(site, pages, p));
  for (const key of ["title", "description", "path"] as const) {
    const seen = new Set<string>();
    for (const p of pages) {
      if (seen.has(p[key])) problems.push(`Duplicate ${key}: "${p[key]}"`);
      seen.add(p[key]);
    }
  }
  return problems;
}
