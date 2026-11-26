// Google Analytics 4 or Tag Manager with Consent Mode v2: cookies stay off by default
// in the EEA, the UK and Switzerland, and the Google script loads only after the page
// `load` event so it never competes with the page's own resources.

export const NO_COOKIE_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "IS", "LI", "NO", "GB", "CH",
] as const;

export type AnalyticsIds = { readonly gtmId?: string; readonly gaId?: string };

const GA_ID = /^G-[A-Z0-9]{4,20}$/;
const GTM_ID = /^GTM-[A-Z0-9]{4,12}$/;

function checkedId(value: string, pattern: RegExp, label: string): string {
  const id = value.trim();
  if (!pattern.test(id)) throw new Error(`${label} "${value}" is not valid (expected ${pattern.source}). Fix the environment variable or leave it empty.`);
  return id;
}

// JSON is valid JavaScript; escaping "<" keeps a value from closing the inline <script>.
function literal(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function consentAndStart(): string {
  const consent = { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", region: NO_COOKIE_REGIONS };
  return `window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag("consent","default",${literal(consent)});gtag("js",new Date());`;
}

function loadAfterPageLoad(src: string): string {
  return `(function(){function s(){var e=document.createElement("script");e.async=true;e.src=${literal(src)};document.head.appendChild(e)}if(document.readyState==="complete")s();else addEventListener("load",s,{once:true})})();`;
}

export function gaSnippet(gaId: string): string {
  const id = checkedId(gaId, GA_ID, "GA4 measurement ID");
  const src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  return `${consentAndStart()}gtag("config",${literal(id)});${loadAfterPageLoad(src)}`;
}

export function gtmSnippet(gtmId: string): string {
  const id = checkedId(gtmId, GTM_ID, "Tag Manager container ID");
  const src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
  return `${consentAndStart()}dataLayer.push({"gtm.start":Date.now(),event:"gtm.js"});${loadAfterPageLoad(src)}`;
}

/** The inline script for a page's <head>: Tag Manager when set, else GA4, else "" (no analytics). */
export function analyticsSnippet(ids: AnalyticsIds): string {
  if (ids.gtmId?.trim()) return gtmSnippet(ids.gtmId);
  return ids.gaId?.trim() ? gaSnippet(ids.gaId) : "";
}

export type VerificationCodes = { readonly google?: string; readonly bing?: string; readonly yandex?: string };

export type MetaTag = { readonly name: string; readonly content: string };

const VERIFICATION_NAMES = { google: "google-site-verification", bing: "msvalidate.01", yandex: "yandex-verification" } as const;

/** Search engine verification <meta> tags, skipping any code that is empty. */
export function verificationMeta(codes: VerificationCodes): readonly MetaTag[] {
  return (Object.keys(VERIFICATION_NAMES) as (keyof VerificationCodes)[])
    .map((engine) => ({ name: VERIFICATION_NAMES[engine], content: codes[engine]?.trim() ?? "" }))
    .filter((tag) => tag.content !== "");
}
