export declare const NO_COOKIE_REGIONS: readonly ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH"];
export type AnalyticsIds = {
    readonly gtmId?: string;
    readonly gaId?: string;
};
export declare function gaSnippet(gaId: string): string;
export declare function gtmSnippet(gtmId: string): string;
/** The inline script for a page's <head>: Tag Manager when set, else GA4, else "" (no analytics). */
export declare function analyticsSnippet(ids: AnalyticsIds): string;
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
