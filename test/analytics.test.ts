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

// The same, at a given URL, for snippets that read location.
function runAt(snippet: string, href: string, referrer = "") {
  const document = { referrer, readyState: "loading", createElement: () => ({}), head: { appendChild: () => 0 } };
  const context: Record<string, unknown> = { document, Date, URL, location: new URL(href), addEventListener: () => 0 };
  context["window"] = context;
  vm.runInNewContext(snippet, context);
  const raw = context["dataLayer"] as unknown[];
  return { raw, dataLayer: raw.map((args) => Array.from(args as ArrayLike<unknown>)) };
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

describe("redactParams", () => {
  // Query parameters that carry what a visitor typed (a share link's ?t=) must never reach Google. They go in
  // gtag("set"), before any tag loads: the Google tag's own page_view ignores page_location passed to config
  // (captured 2026-11-28 on a live GA4 property, through both gtag.js and a GTM container).
  function set(snippet: string, href: string, referrer = "") {
    return runAt(snippet, href, referrer).dataLayer.find((a) => a[0] === "set");
  }
  const SNIPPETS = { "GA4": (o = {}) => gaSnippet("G-TEST123", o), "Tag Manager": (o = {}) => gtmSnippet("GTM-TEST1", o) };

  for (const [name, snippet] of Object.entries(SNIPPETS)) {
    it(`${name}: sets page_location without the named parameters, keeping the rest, without the hash`, () => {
      expect(set(snippet({ redactParams: ["t"] }), "https://x.com/a/?t=Isabella&utm_source=news&s=rye#stencil")?.[1]).toEqual({ page_location: "https://x.com/a/?utm_source=news&s=rye", page_referrer: "" });
    });

    it(`${name}: sets the redacted URLs before anything that starts a tag`, () => {
      const commands = runAt(snippet({ redactParams: ["t"] }), "https://x.com/?t=a").raw.map((a) => (a as { event?: string }).event ?? (a as ArrayLike<unknown>)[0]);
      const setAt = commands.indexOf("set");
      expect(setAt).toBeGreaterThan(commands.indexOf("consent"));
      for (const later of ["js", "config", "gtm.js"]) if (commands.includes(later)) expect(commands.indexOf(later)).toBeGreaterThan(setAt);
    });

    it(`${name}: sets nothing without redactParams`, () => {
      expect(set(snippet(), "https://x.com/?t=a")).toBeUndefined();
    });
  }

  it("redacts a same-site referrer and leaves another site's alone", () => {
    const snippet = gaSnippet("G-TEST123", { redactParams: ["t"] });
    expect(set(snippet, "https://x.com/fonts/", "https://x.com/?t=Isabella&s=rye")?.[1]).toMatchObject({ page_referrer: "https://x.com/?s=rye" });
    expect(set(snippet, "https://x.com/fonts/", "https://other.org/?t=1")?.[1]).toMatchObject({ page_referrer: "https://other.org/?t=1" });
  });

  it("leaves config as the bare ID", () => {
    expect(runAt(gaSnippet("G-TEST123", { redactParams: ["t"] }), "https://x.com/?t=a").dataLayer.find((a) => a[0] === "config")).toEqual(["config", "G-TEST123"]);
  });

  it("refuses a parameter name that could break out of the script", () => {
    expect(() => gaSnippet("G-TEST123", { redactParams: ['t"]});alert(1)//'] })).toThrow(/not valid/);
    expect(() => gtmSnippet("GTM-TEST1", { redactParams: ['t"]});alert(1)//'] })).toThrow(/not valid/);
  });

  it("passes the option through analyticsSnippet for either ID", () => {
    expect(analyticsSnippet({ gaId: "G-TEST123" }, { redactParams: ["t"] })).toContain("page_location");
    expect(analyticsSnippet({ gtmId: "GTM-ABC1234" }, { redactParams: ["t"] })).toBe(gtmSnippet("GTM-ABC1234", { redactParams: ["t"] }));
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
