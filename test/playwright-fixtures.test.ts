import { describe, expect, it, vi } from "vitest";

vi.mock("@playwright/test", () => ({ test: { extend: () => ({}) }, expect: () => undefined }));

const { GA_HIT, answerHit } = await import("../src/playwright/fixtures.ts");

describe("analytics hits in browser tests", () => {
  it("matches GA4 hits on every host GA sends to, including the www.google.com retry after a failed hit", () => {
    for (const url of [
      "https://www.google-analytics.com/g/collect?v=2&tid=G-X",
      "https://region1.google-analytics.com/g/collect?v=2",
      "https://analytics.google.com/g/collect?v=2",
      "https://www.google.com/g/collect?v=2&tid=G-X",
    ]) expect(url).toMatch(GA_HIT);
  });

  it("lets the tag itself load, so tests of what a build sends still run", () => {
    for (const url of [
      "https://www.googletagmanager.com/gtm.js?id=GTM-X",
      "https://www.googletagmanager.com/gtag/js?id=G-X",
      "https://www.google.com/search?q=g/collect",
      "https://example.com/g/collect",
    ]) expect(url).not.toMatch(GA_HIT);
  });

  it("answers a hit with an empty 204 instead of aborting it, because GA retries an aborted hit on another host", async () => {
    const fulfill = vi.fn(async () => undefined);
    await answerHit({ fulfill } as never);
    expect(fulfill).toHaveBeenCalledWith({ status: 204 });
  });
});
