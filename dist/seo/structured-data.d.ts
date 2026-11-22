import type { RouteMeta } from "./metadata.ts";
import type { Crumb } from "./pages.ts";
import type { SiteConfig, SitePage } from "./types.ts";
export type JsonLdNode = {
    readonly [key: string]: unknown;
};
export type Entity = {
    readonly name: string;
    readonly sameAs?: string;
};
export type ImageInfo = {
    readonly src: string;
    readonly alt: string;
    readonly width: number;
    readonly height: number;
};
export type FaqItem = {
    readonly question: string;
    readonly answer: string;
};
export type HowToStep = {
    readonly name: string;
    readonly text: string;
    readonly image: string;
};
export declare function nodeIds(site: SiteConfig): {
    readonly organization: `${string}/#organization`;
    readonly website: `${string}/#website`;
    readonly author: `${string}/about/#author`;
};
export declare const PAGE_NODE_ID: {
    readonly webpage: (canonical: string) => string;
    readonly breadcrumb: (canonical: string) => string;
    readonly primaryImage: (canonical: string) => string;
    readonly app: (canonical: string) => string;
};
export declare function organizationNode(site: SiteConfig): JsonLdNode;
export declare function websiteNode(site: SiteConfig): JsonLdNode;
export declare function authorNode(site: SiteConfig): JsonLdNode;
export type WebPageOptions = {
    readonly about?: readonly Entity[];
    readonly mentions?: readonly Entity[];
    readonly hasBreadcrumb?: boolean;
    readonly primaryImage?: boolean;
};
export declare function webPageNode(site: SiteConfig, page: SitePage, meta: RouteMeta, options?: WebPageOptions): JsonLdNode;
export declare function breadcrumbNode(site: SiteConfig, trail: readonly Crumb[], canonical: string): JsonLdNode | null;
export declare function imageObjectNode(site: SiteConfig, image: ImageInfo, id?: string): JsonLdNode;
export declare function webApplicationNode(site: SiteConfig, meta: RouteMeta, app: {
    readonly category: string;
    readonly features: readonly string[];
}): JsonLdNode;
export declare function faqNode(items: readonly FaqItem[]): JsonLdNode | null;
export declare function howToNode(site: SiteConfig, name: string, steps: readonly HowToStep[]): JsonLdNode | null;
export declare function articleNode(site: SiteConfig, page: SitePage, meta: RouteMeta): JsonLdNode;
export declare function graph(nodes: readonly (JsonLdNode | null)[]): JsonLdNode;
export declare function serializeJsonLd(value: JsonLdNode): string;
export type PageGraphOptions = {
    readonly trail: readonly Crumb[];
    readonly about?: readonly Entity[];
    readonly mentions?: readonly Entity[];
    readonly primaryImage?: ImageInfo;
    readonly extra?: readonly (JsonLdNode | null)[];
};
export declare function pageGraph(site: SiteConfig, page: SitePage, meta: RouteMeta, options: PageGraphOptions): JsonLdNode;
