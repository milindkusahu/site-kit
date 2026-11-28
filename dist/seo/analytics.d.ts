export declare const NO_COOKIE_REGIONS: readonly ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH"];
export type AnalyticsIds = {
    readonly gtmId?: string;
    readonly gaId?: string;
};
export type SnippetOptions = {
    /**
     * Query parameters removed from the page_location and same-site page_referrer that every Google tag on the page
     * records, for parameters that carry what a visitor typed, such as a share link's `?t=`. Works with a GA4 ID and
     * with a Tag Manager (Google tag) container: the values go in gtag("set") before any tag loads, because the
     * Google tag's own page_view ignores page_location passed to config.
     */
    readonly redactParams?: readonly string[];
};
export declare function gaSnippet(gaId: string, options?: SnippetOptions): string;
export declare function gtmSnippet(gtmId: string, options?: SnippetOptions): string;
/** The inline script for a page's <head>: Tag Manager when set, else GA4, else "" (no analytics). */
export declare function analyticsSnippet(ids: AnalyticsIds, options?: SnippetOptions): string;
export type VerificationCodes = {
    readonly google?: string;
    readonly bing?: string;
    readonly yandex?: string;
};
export type MetaTag = {
    readonly name: string;
    readonly content: string;
};
/** Search engine verification <meta> tags, skipping any code that is empty. */
export declare function verificationMeta(codes: VerificationCodes): readonly MetaTag[];
