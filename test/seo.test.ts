import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createSeo } from "../src/seo/create-seo.ts";
import type { SiteConfig, SitePage } from "../src/seo/types.ts";
import { organizationNode } from "../src/seo/structured-data.ts";
import { withTrailingSlash } from "../src/seo/url.ts";

const site: SiteConfig = {
  name: "Test Site",
  domain: "test.example",
  origin: "https://test.example",
  contactEmail: "contact@test.example",
  defaultLocale: "en",
  description: "A test site.",
  themeColor: "#7c3aed",
  backgroundColor: "#0b0d12",
  author: { name: "Tester", slug: "tester", jobTitle: "Founder", bio: "Tests things.", sameAs: [] },
  sameAs: [],
  launched: "2026-01-01",
};

const page = (path: string, extra: Partial<SitePage> = {}): SitePage => ({
  path,
  title: `Title for the ${path} page here`,
  description: `A description for ${path} that is comfortably longer than seventy characters in total length.`,
  keywords: ["k"],
  type: "tool",
  breadcrumb: path,
  parent: path === "/" ? null : "/",
  lastUpdated: "2026-11-22",
  indexable: true,
  inNav: false,
  inFooter: false,
  ...extra,
});

describe("createSeo", () => {
  it("passes a valid registry", () => {
    const seo = createSeo(site, [page("/", { type: "home" }), page("/a/", { type: "howto" }), page("/b/", { type: "about" })]);
    expect(seo.problems()).toEqual([]);
  });

  it("reports lengths, duplicates, slashes and missing parents", () => {
    const seo = createSeo(site, [page("/", { type: "home" }), page("/x", { title: "A title that runs far past the fifty five character ceiling for titles", parent: "/missing/" }), page("/y/", { description: "too short" }), page("/z/", { title: "Title for the /y/ page here" })]);
    const problems = seo.problems().join("\n");
    expect(problems).toContain("title is");
    expect(problems).toContain("must end in a slash");
    expect(problems).toContain("parent /missing/");
    expect(problems).toContain("description is");
    expect(problems).toContain("Duplicate title");
  });

  it("reports a parent loop instead of hanging", () => {
    const seo = createSeo(site, [page("/", { type: "home", parent: "/" }), page("/a/", { parent: "/b/" }), page("/b/", { parent: "/a/" })]);
    const problems = seo.problems().join("\n");
    expect(problems).toContain("/: parent loop");
    expect(problems).toContain("/a/: parent loop");
    expect(() => seo.trail("/a/")).toThrow("Parent loop");
  });

  it("reports a missing ancestor further up instead of throwing", () => {
    const seo = createSeo(site, [page("/", { type: "home" }), page("/c/", { parent: "/a/" }), page("/a/", { parent: "/missing/" })]);
    const problems = seo.problems().join("\n");
    expect(problems).toContain("/a/: parent /missing/ isn't registered");
    expect(problems).toContain("/c/: ancestor /a/ has parent /missing/, which isn't registered");
  });

  it("names the loop when a page sits below one but isn't in it", () => {
    const seo = createSeo(site, [page("/", { type: "home" }), page("/c/", { parent: "/a/" }), page("/a/", { parent: "/b/" }), page("/b/", { parent: "/a/" })]);
    const problems = seo.problems();
    expect(problems).toContain("/a/: parent loop, the page is its own ancestor");
    expect(problems).toContain("/c/: its ancestors loop at /a/");
  });

  it("builds canonicals, trails and a sitemap of indexable pages only", () => {
    const seo = createSeo(site, [page("/", { type: "home" }), page("/a/"), page("/hidden/", { indexable: false })]);
    expect(seo.meta("/a/").canonical).toBe("https://test.example/a/");
    expect(seo.trail("/a/").map((c) => c.path)).toEqual(["/", "/a/"]);
    expect(seo.sitemapXml()).toContain("https://test.example/a/");
    expect(seo.sitemapXml()).not.toContain("/hidden/");
    expect(seo.meta("/hidden/").robots).toContain("noindex");
  });

  it("declares Content Signals inside the User-agent: * group of robots.txt", () => {
    const robots = createSeo(site, [page("/", { type: "home" })]).robotsTxt();
    const group = robots.split("\n\n")[0] ?? "";
    expect(group.startsWith("User-agent: *\n")).toBe(true);
    expect(group).toContain("\nContent-Signal: search=yes, ai-input=yes, ai-train=yes");
    const custom = createSeo({ ...site, contentSignal: "search=yes, ai-input=yes, ai-train=no" }, [page("/", { type: "home" })]).robotsTxt();
    expect(custom).toContain("Content-Signal: search=yes, ai-input=yes, ai-train=no\n");
  });

  it("falls back to the default Content Signals when contentSignal is blank", () => {
    for (const blank of ["", "   "]) {
      const robots = createSeo({ ...site, contentSignal: blank }, [page("/", { type: "home" })]).robotsTxt();
      expect(robots).toContain("Content-Signal: search=yes, ai-input=yes, ai-train=yes\n");
    }
  });

  it("title building is idempotent", () => {
    const seo = createSeo(site, [page("/", { type: "home" })]);
    fc.assert(fc.property(fc.string(), (t) => { expect(seo.title(seo.title(t))).toBe(seo.title(t)); }));
  });

  it("withTrailingSlash is idempotent and strips queries", () => {
    fc.assert(fc.property(fc.webPath(), (p) => {
      const once = withTrailingSlash(p);
      expect(withTrailingSlash(once)).toBe(once);
      expect(once.includes("?")).toBe(false);
    }));
  });
});

describe("organizationNode", () => {
  it("has a contact point from the contact email", () => {
    expect(organizationNode(site)["contactPoint"]).toEqual({ "@type": "ContactPoint", contactType: "customer support", email: "contact@test.example", availableLanguage: "en" });
  });

  it("adds a country-only address only when the site sets a country", () => {
    expect(organizationNode(site)["address"]).toBeUndefined();
    expect(organizationNode({ ...site, country: "IN" })["address"]).toEqual({ "@type": "PostalAddress", addressCountry: "IN" });
  });
});
