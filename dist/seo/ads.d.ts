export type AdsProvider = "none" | "placeholder" | "adsense" | "journey";
export type AdsConfig = {
    readonly provider: AdsProvider;
    readonly adsenseClient: string;
    readonly scriptSrc: string;
    readonly adsTxt: string;
};
export type AdSlotId = "in-content-1" | "in-content-2" | "sidebar" | "footer";
export declare const AD_SLOTS: Readonly<Record<AdSlotId, {
    readonly minHeightMobile: number;
    readonly minHeightDesktop: number;
}>>;
export declare function parseAdsConfig(env: Readonly<Record<string, string | undefined>>): AdsConfig;
export declare function adsEnabled(config: AdsConfig): boolean;
export declare function adsTxtBody(config: AdsConfig): string;
export type TrackingConfig = {
    readonly gaId: string;
    readonly googleVerification: string;
    readonly bingVerification: string;
};
export declare function parseTrackingConfig(env: Readonly<Record<string, string | undefined>>): TrackingConfig;
