import { buildRouteMetadata, buildTitle, type MetaOptions, type RouteMeta } from "./metadata.ts";
import { breadcrumbTrail, findPage, indexable, type Crumb } from "./pages.ts";
import { registryProblems } from "./registry.ts";
import { llmsTxt, robotsTxt, sitemapXml, webManifest } from "./sitemap.ts";
import {
  articleNode,
  faqNode,
  howToNode,
  imageObjectNode,
  pageGraph,
  webApplicationNode,
  type FaqItem,
  type HowToStep,
  type ImageInfo,
  type JsonLdNode,
  type PageGraphOptions,
} from "./structured-data.ts";
import type { SiteConfig, SitePage } from "./types.ts";

export type GraphOptions = Omit<PageGraphOptions, "trail">;

export function createSeo(site: SiteConfig, pages: readonly SitePage[]) {
  return {
    site,
    pages,
    page: (path: string): SitePage => findPage(pages, path),
    indexable: (): readonly SitePage[] => indexable(pages),
    title: (title: string, bare = false): string => buildTitle(site, title, bare),
    meta: (path: string, options: MetaOptions = {}): RouteMeta => buildRouteMetadata(site, findPage(pages, path), options),
    trail: (path: string): readonly Crumb[] => breadcrumbTrail(pages, findPage(pages, path)),
    graph: (path: string, options: GraphOptions = {}): JsonLdNode => {
      const page = findPage(pages, path);
      return pageGraph(site, page, buildRouteMetadata(site, page), { ...options, trail: breadcrumbTrail(pages, page) });
    },
    webApplication: (path: string, app: { readonly category: string; readonly features: readonly string[] }): JsonLdNode =>
      webApplicationNode(site, buildRouteMetadata(site, findPage(pages, path)), app),
    article: (path: string): JsonLdNode => {
      const page = findPage(pages, path);
      return articleNode(site, page, buildRouteMetadata(site, page));
    },
    faq: (items: readonly FaqItem[]): JsonLdNode | null => faqNode(items),
    howTo: (name: string, steps: readonly HowToStep[]): JsonLdNode | null => howToNode(site, name, steps),
    image: (image: ImageInfo): JsonLdNode => imageObjectNode(site, image),
    sitemapXml: (): string => sitemapXml(site, pages),
    robotsTxt: (): string => robotsTxt(site),
    llmsTxt: (): string => llmsTxt(site, pages),
    webManifest: (): string => webManifest(site),
    problems: (): readonly string[] => registryProblems(site, pages),
  };
}

export type Seo = ReturnType<typeof createSeo>;
