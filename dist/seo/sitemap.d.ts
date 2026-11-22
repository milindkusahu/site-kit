import type { SiteConfig, SitePage } from "./types.ts";
export declare function sitemapXml(site: SiteConfig, pages: readonly SitePage[]): string;
export declare const DEFAULT_CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=yes";
export declare function robotsTxt(site: SiteConfig): string;
export declare function llmsTxt(site: SiteConfig, pages: readonly SitePage[]): string;
export declare function webManifest(site: SiteConfig): string;
