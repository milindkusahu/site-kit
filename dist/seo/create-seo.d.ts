import { type MetaOptions, type RouteMeta } from "./metadata.ts";
import { type Crumb } from "./pages.ts";
import { type FaqItem, type HowToStep, type ImageInfo, type JsonLdNode, type PageGraphOptions } from "./structured-data.ts";
import type { SiteConfig, SitePage } from "./types.ts";
export type GraphOptions = Omit<PageGraphOptions, "trail">;
export declare function createSeo(site: SiteConfig, pages: readonly SitePage[]): {
    site: SiteConfig;
    pages: readonly SitePage[];
    page: (path: string) => SitePage;
    indexable: () => readonly SitePage[];
    title: (title: string, bare?: boolean) => string;
    meta: (path: string, options?: MetaOptions) => RouteMeta;
    trail: (path: string) => readonly Crumb[];
    graph: (path: string, options?: GraphOptions) => JsonLdNode;
    webApplication: (path: string, app: {
        readonly category: string;
        readonly features: readonly string[];
    }) => JsonLdNode;
    article: (path: string) => JsonLdNode;
    faq: (items: readonly FaqItem[]) => JsonLdNode | null;
    howTo: (name: string, steps: readonly HowToStep[]) => JsonLdNode | null;
    image: (image: ImageInfo) => JsonLdNode;
    sitemapXml: () => string;
    robotsTxt: () => string;
    llmsTxt: () => string;
    webManifest: () => string;
    problems: () => readonly string[];
};
export type Seo = ReturnType<typeof createSeo>;
