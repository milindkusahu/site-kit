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

type AncestorProblem = { kind: "loop"; at: string } | { kind: "missing"; ancestor: string; parent: string };

function ancestorProblem(pages: readonly SitePage[], page: SitePage): AncestorProblem | null {
  const seen = new Set<string>();
  let current: SitePage = page;
  while (current.parent !== null) {
    if (seen.has(current.path)) return { kind: "loop", at: current.path };
    seen.add(current.path);
    const parent: string = current.parent;
    const next = pages.find((p) => p.path === parent);
    if (!next) return { kind: "missing", ancestor: current.path, parent };
    current = next;
  }
  return null;
}

function ancestorMessage(page: SitePage, problem: AncestorProblem): string {
  if (problem.kind === "missing") return page.path === problem.ancestor ? `${page.path}: parent ${problem.parent} isn't registered` : `${page.path}: ancestor ${problem.ancestor} has parent ${problem.parent}, which isn't registered`;
  return problem.at === page.path ? `${page.path}: parent loop, the page is its own ancestor` : `${page.path}: its ancestors loop at ${problem.at}`;
}

function pageProblems(site: SiteConfig, pages: readonly SitePage[], page: SitePage): string[] {
  const problems: string[] = [];
  const meta = buildRouteMetadata(site, page);
  if (meta.title.length < TITLE_LIMITS.min || meta.title.length > TITLE_LIMITS.max) problems.push(`${page.path}: title is ${meta.title.length} characters (${TITLE_LIMITS.min} to ${TITLE_LIMITS.max}): "${meta.title}"`);
  if (page.description.length < DESCRIPTION_LIMITS.min || page.description.length > DESCRIPTION_LIMITS.max) problems.push(`${page.path}: description is ${page.description.length} characters (${DESCRIPTION_LIMITS.min} to ${DESCRIPTION_LIMITS.max})`);
  if (page.path !== withTrailingSlash(page.path)) problems.push(`${page.path}: path must end in a slash`);
  const ancestors = ancestorProblem(pages, page);
  if (ancestors) {
    problems.push(ancestorMessage(page, ancestors));
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
