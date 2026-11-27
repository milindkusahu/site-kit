export declare const NO_COOKIE_REGIONS: readonly ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH"];
export type AnalyticsIds = {
    readonly gtmId?: string;
    readonly gaId?: string;
};
export type SnippetOptions = {
    /**
     * Query parameters removed from the page_location GA4 records (and from every event of the page), for parameters
     * that carry what a visitor typed, such as a share link's `?t=`. GA4 only: a Tag Manager container reads the URL
     * itself, so analyticsSnippet refuses the option with a GTM ID rather than promise a redaction it can't make.
     */
    readonly redactParams?: readonly string[];
};
export declare function gaSnippet(gaId: string, options?: SnippetOptions): string;
export declare function gtmSnippet(gtmId: string): string;
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
