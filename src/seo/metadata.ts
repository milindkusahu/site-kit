import type { SiteConfig, SitePage } from "./types.ts";
import { absoluteUrl } from "./url.ts";

export const TITLE_LIMITS = { min: 15, max: 55 } as const;
export const DESCRIPTION_LIMITS = { min: 70, max: 150 } as const;
export const DEFAULT_OG_IMAGE = "/og/default.png";

export type RouteMeta = {
  readonly title: string;
  readonly description: string;
  readonly canonical: string;
  readonly robots: string;
  readonly keywords: readonly string[];
  readonly ogImage: string;
  readonly ogType: "website" | "article";
  readonly lastUpdated: string;
};

export type MetaOptions = {
  readonly bareTitle?: boolean;
  readonly ogImage?: string;
  readonly canonicalPath?: string;
};

export function buildTitle(site: SiteConfig, title: string, bare = false): string {
  const suffix = ` | ${site.name}`;
  if (bare || title.endsWith(suffix)) return title;
  return `${title}${suffix}`;
}

export function buildRouteMetadata(site: SiteConfig, page: SitePage, options: MetaOptions = {}): RouteMeta {
  const isArticle = page.type === "howto" || page.type === "explainer" || page.type === "comparison";
  return {
    title: buildTitle(site, page.title, options.bareTitle === true || page.type === "home"),
    description: page.description,
    canonical: absoluteUrl(site.origin, options.canonicalPath ?? page.path),
    robots: page.indexable ? "index, follow, max-image-preview:large" : "noindex, follow",
    keywords: page.keywords,
    ogImage: absoluteUrl(site.origin, options.ogImage ?? DEFAULT_OG_IMAGE),
    ogType: isArticle ? "article" : "website",
    lastUpdated: page.lastUpdated,
  };
}
