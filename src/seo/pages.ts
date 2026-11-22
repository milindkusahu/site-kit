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
    trail.unshift({ name: current.breadcrumb, path: current.path });
    current = current.parent === null ? null : findPage(pages, current.parent);
  }
  return trail;
}
