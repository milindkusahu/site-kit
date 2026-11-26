// Google Analytics 4 or Tag Manager with Consent Mode v2: cookies stay off by default
// in the EEA, the UK and Switzerland, and the Google script loads only after the page
// `load` event so it never competes with the page's own resources.
export const NO_COOKIE_REGIONS = [
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
    "IS", "LI", "NO", "GB", "CH",
];
const GA_ID = /^G-[A-Z0-9]{4,20}$/;
const GTM_ID = /^GTM-[A-Z0-9]{4,12}$/;
function checkedId(value, pattern, label) {
    const id = value.trim();
    if (!pattern.test(id))
        throw new Error(`${label} "${value}" is not valid (expected ${pattern.source}). Fix the environment variable or leave it empty.`);
    return id;
}
// JSON is valid JavaScript; escaping "<" keeps a value from closing the inline <script>.
function literal(value) {
    return JSON.stringify(value).replaceAll("<", "\\u003c");
}
function consentAndStart() {
    const consent = { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", region: NO_COOKIE_REGIONS };
    return `window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag("consent","default",${literal(consent)});gtag("js",new Date());`;
}
function loadAfterPageLoad(src) {
    return `(function(){function s(){var e=document.createElement("script");e.async=true;e.src=${literal(src)};document.head.appendChild(e)}if(document.readyState==="complete")s();else addEventListener("load",s,{once:true})})();`;
}
export function gaSnippet(gaId) {
    const id = checkedId(gaId, GA_ID, "GA4 measurement ID");
    const src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    return `${consentAndStart()}gtag("config",${literal(id)});${loadAfterPageLoad(src)}`;
}
export function gtmSnippet(gtmId) {
    const id = checkedId(gtmId, GTM_ID, "Tag Manager container ID");
    const src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
    return `${consentAndStart()}dataLayer.push({"gtm.start":Date.now(),event:"gtm.js"});${loadAfterPageLoad(src)}`;
}
/** The inline script for a page's <head>: Tag Manager when set, else GA4, else "" (no analytics). */
export function analyticsSnippet(ids) {
    if (ids.gtmId?.trim())
        return gtmSnippet(ids.gtmId);
    return ids.gaId?.trim() ? gaSnippet(ids.gaId) : "";
}
const VERIFICATION_NAMES = { google: "google-site-verification", bing: "msvalidate.01", yandex: "yandex-verification" };
/** Search engine verification <meta> tags, skipping any code that is empty. */
export function verificationMeta(codes) {
    return Object.keys(VERIFICATION_NAMES)
        .map((engine) => ({ name: VERIFICATION_NAMES[engine], content: codes[engine]?.trim() ?? "" }))
        .filter((tag) => tag.content !== "");
}
