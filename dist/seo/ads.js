export const AD_SLOTS = {
    "in-content-1": { minHeightMobile: 280, minHeightDesktop: 280 },
    "in-content-2": { minHeightMobile: 280, minHeightDesktop: 280 },
    sidebar: { minHeightMobile: 0, minHeightDesktop: 600 },
    footer: { minHeightMobile: 100, minHeightDesktop: 100 },
};
const PROVIDERS = ["none", "placeholder", "adsense", "journey"];
function isProvider(value) {
    return PROVIDERS.some((p) => p === value);
}
export function parseAdsConfig(env) {
    const raw = env["PUBLIC_ADS_PROVIDER"] ?? "none";
    return {
        provider: isProvider(raw) ? raw : "none",
        adsenseClient: env["PUBLIC_ADSENSE_CLIENT"] ?? "",
        scriptSrc: env["PUBLIC_ADS_SCRIPT_SRC"] ?? "",
        adsTxt: env["ADS_TXT"] ?? "",
    };
}
export function adsEnabled(config) {
    return config.provider !== "none";
}
export function adsTxtBody(config) {
    if (config.provider === "adsense" && config.adsenseClient) {
        return `google.com, ${config.adsenseClient.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`;
    }
    return config.adsTxt ? `${config.adsTxt.trim()}\n` : "";
}
export function parseTrackingConfig(env) {
    return {
        gaId: env["PUBLIC_GA_ID"] ?? "",
        gtmId: env["PUBLIC_GTM_ID"] ?? "",
        googleVerification: env["PUBLIC_GOOGLE_SITE_VERIFICATION"] ?? "",
        bingVerification: env["PUBLIC_BING_SITE_VERIFICATION"] ?? "",
        yandexVerification: env["PUBLIC_YANDEX_VERIFICATION"] ?? "",
    };
}
