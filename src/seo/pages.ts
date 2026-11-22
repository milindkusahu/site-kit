import type { SitePage } from "./types.ts";

export function findPage(pages: readonly SitePage[], path: string): SitePage {
  const page = pages.find((p) => p.path === path);
  if (!page) throw new Error(`No page registered for ${path}. Add it to SITE_PAGES first.`);
  return page;
}

export function indexable(pages: readonly SitePage[]): readonly SitePage[] {
  return pages.filter((p) => p.indexable);
}

export type Crumb = { readonly name: string; readonly path: string };

export function breadcrumbTrail(pages: readonly SitePage[], page: SitePage): readonly Crumb[] {
  const trail: Crumb[] = [];
  let current: SitePage | null = page;
  while (current) {
    const path = current.path;
    if (trail.some((c) => c.path === path)) throw new Error(`Parent loop at ${path}. A page can't be its own ancestor; fix parent in SITE_PAGES.`);
    trail.unshift({ name: current.breadcrumb, path });
    current = current.parent === null ? null : findPage(pages, current.parent);
  }
  return trail;
}
