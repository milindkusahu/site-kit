import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { parseTrackingConfig } from "../src/seo/ads.ts";
import { analyticsSnippet, gaSnippet, gtmSnippet, NO_COOKIE_REGIONS, verificationMeta } from "../src/seo/analytics.ts";

// Runs a snippet the way a browser would, with just enough of window and document.
function run(snippet: string, readyState = "loading") {
  const appended: { async: boolean; src: string }[] = [];
  const listeners: Record<string, () => void> = {};
  const document = {
    readyState,
    createElement: () => ({ async: false, src: "" }),
    head: { appendChild: (el: { async: boolean; src: string }) => appended.push(el) },
  };
  const context: Record<string, unknown> = { document, Date, addEventListener: (type: string, fn: () => void) => (listeners[type] = fn) };
  context["window"] = context;
  vm.runInNewContext(snippet, context);
  const raw = context["dataLayer"] as unknown[];
  const dataLayer = raw.map((args) => Array.from(args as ArrayLike<unknown>));
  return { appended, raw, dataLayer, fireLoad: () => listeners["load"]?.() };
}

describe("gaSnippet", () => {
  it("sets consent denied by default for the EEA, UK and Switzerland before config runs", () => {
    const { dataLayer } = run(gaSnippet("G-TEST123"));
    expect(dataLayer[0]?.slice(0, 2)).toEqual(["consent", "default"]);
    const consent = dataLayer[0]?.[2] as Record<string, unknown>;
    expect(consent["analytics_storage"]).toBe("denied");
    expect(consent["ad_user_data"]).toBe("denied");
    for (const region of ["DE", "FR", "GB", "CH", "NO"]) expect(consent["region"]).toContain(region);
    expect(dataLayer.findIndex((a) => a[0] === "config")).toBeGreaterThan(0);
    expect(NO_COOKIE_REGIONS).toHaveLength(32);
  });

  it("loads gtag only after the page load event", () => {
    const page = run(gaSnippet("G-TEST123"));
    expect(page.appended).toEqual([]);
    page.fireLoad();
    expect(page.appended).toEqual([{ async: true, src: "https://www.googletagmanager.com/gtag/js?id=G-TEST123" }]);
  });

  it("loads at once when the snippet runs after load already fired", () => {
    expect(run(gaSnippet("G-TEST123"), "complete").appended).toHaveLength(1);
  });

  it("refuses a malformed ID instead of shipping it into a script", () => {
    expect(() => gaSnippet('G-1</script><script>alert(1)')).toThrow(/not valid/);
    expect(() => gaSnippet("UA-1234-1")).toThrow(/GA4 measurement ID/);
    expect(gaSnippet(" G-TEST123 ")).toBe(gaSnippet("G-TEST123"));
  });
});

describe("gtmSnippet", () => {
  it("sets consent before Tag Manager, pushes gtm.js so page view triggers fire, and waits for load", () => {
    const page = run(gtmSnippet("GTM-TEST1"));
    expect(page.dataLayer[0]?.slice(0, 2)).toEqual(["consent", "default"]);
    expect(page.dataLayer.some((a) => a[0] === "config")).toBe(false);
    expect(page.raw).toContainEqual(expect.objectContaining({ event: "gtm.js" }));
    expect(page.appended).toEqual([]);
    page.fireLoad();
    expect(page.appended[0]?.src).toBe("https://www.googletagmanager.com/gtm.js?id=GTM-TEST1");
  });
});

describe("analyticsSnippet", () => {
  it("prefers Tag Manager over GA4 and is empty with neither", () => {
    expect(analyticsSnippet({ gtmId: "GTM-TEST1", gaId: "G-TEST123" })).toBe(gtmSnippet("GTM-TEST1"));
    expect(analyticsSnippet({ gtmId: "", gaId: "G-TEST123" })).toBe(gaSnippet("G-TEST123"));
    expect(analyticsSnippet({ gaId: "  " })).toBe("");
    expect(analyticsSnippet({})).toBe("");
  });

  it("reads both IDs from the environment", () => {
    const tracking = parseTrackingConfig({ PUBLIC_GA_ID: "G-TEST123", PUBLIC_GTM_ID: "GTM-TEST1", PUBLIC_YANDEX_VERIFICATION: "y1" });
    expect(analyticsSnippet(tracking)).toBe(gtmSnippet("GTM-TEST1"));
    expect(tracking.yandexVerification).toBe("y1");
  });
});

describe("verificationMeta", () => {
  it("returns a tag per engine with a code and skips empty ones", () => {
    expect(verificationMeta({ google: "g1", bing: " ", yandex: "y1" })).toEqual([
      { name: "google-site-verification", content: "g1" },
      { name: "yandex-verification", content: "y1" },
    ]);
    expect(verificationMeta({})).toEqual([]);
  });
});
