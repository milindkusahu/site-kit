export type AdsProvider = "none" | "placeholder" | "adsense" | "journey";

export type AdsConfig = {
  readonly provider: AdsProvider;
  readonly adsenseClient: string;
  readonly scriptSrc: string;
  readonly adsTxt: string;
};

export type AdSlotId = "in-content-1" | "in-content-2" | "sidebar" | "footer";

export const AD_SLOTS: Readonly<Record<AdSlotId, { readonly minHeightMobile: number; readonly minHeightDesktop: number }>> = {
  "in-content-1": { minHeightMobile: 280, minHeightDesktop: 280 },
  "in-content-2": { minHeightMobile: 280, minHeightDesktop: 280 },
  sidebar: { minHeightMobile: 0, minHeightDesktop: 600 },
  footer: { minHeightMobile: 100, minHeightDesktop: 100 },
};

const PROVIDERS: readonly AdsProvider[] = ["none", "placeholder", "adsense", "journey"];

function isProvider(value: string): value is AdsProvider {
  return PROVIDERS.some((p) => p === value);
}

export function parseAdsConfig(env: Readonly<Record<string, string | undefined>>): AdsConfig {
  const raw = env["PUBLIC_ADS_PROVIDER"] ?? "none";
  return {
    provider: isProvider(raw) ? raw : "none",
    adsenseClient: env["PUBLIC_ADSENSE_CLIENT"] ?? "",
    scriptSrc: env["PUBLIC_ADS_SCRIPT_SRC"] ?? "",
    adsTxt: env["ADS_TXT"] ?? "",
  };
}

export function adsEnabled(config: AdsConfig): boolean {
  return config.provider !== "none";
}

export function adsTxtBody(config: AdsConfig): string {
  if (config.provider === "adsense" && config.adsenseClient) {
    return `google.com, ${config.adsenseClient.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`;
  }
  return config.adsTxt ? `${config.adsTxt.trim()}\n` : "";
}

export type TrackingConfig = {
  readonly gaId: string;
  readonly googleVerification: string;
  readonly bingVerification: string;
};

export function parseTrackingConfig(env: Readonly<Record<string, string | undefined>>): TrackingConfig {
  return {
    gaId: env["PUBLIC_GA_ID"] ?? "",
    googleVerification: env["PUBLIC_GOOGLE_SITE_VERIFICATION"] ?? "",
    bingVerification: env["PUBLIC_BING_SITE_VERIFICATION"] ?? "",
  };
}
