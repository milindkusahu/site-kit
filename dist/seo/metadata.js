import { absoluteUrl } from "./url.js";
export const TITLE_LIMITS = { min: 15, max: 55 };
export const DESCRIPTION_LIMITS = { min: 70, max: 150 };
export const DEFAULT_OG_IMAGE = "/og/default.png";
export function buildTitle(site, title, bare = false) {
    const suffix = ` | ${site.name}`;
    if (bare || title.endsWith(suffix))
        return title;
    return `${title}${suffix}`;
}
export function buildRouteMetadata(site, page, options = {}) {
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
