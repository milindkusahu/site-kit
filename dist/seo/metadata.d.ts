import type { SiteConfig, SitePage } from "./types.ts";
export declare const TITLE_LIMITS: {
    readonly min: 15;
    readonly max: 55;
};
export declare const DESCRIPTION_LIMITS: {
    readonly min: 70;
    readonly max: 150;
};
export declare const DEFAULT_OG_IMAGE = "/og/default.png";
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
export declare function buildTitle(site: SiteConfig, title: string, bare?: boolean): string;
export declare function buildRouteMetadata(site: SiteConfig, page: SitePage, options?: MetaOptions): RouteMeta;
