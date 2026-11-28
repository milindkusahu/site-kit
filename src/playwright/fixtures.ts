import { test as base, type Route } from "@playwright/test";

export { expect } from "@playwright/test";
export type { Page } from "@playwright/test";

export const GA_HIT = /^https:\/\/([a-z0-9-]+\.)*(google-analytics|google)\.com\/g\/collect/;

export function answerHit(route: Route): Promise<void> {
  return route.fulfill({ status: 204 });
}

export const test = base.extend<{ noAnalyticsHits: undefined }>({
  noAnalyticsHits: [
    async ({ context }, use) => {
      await context.route(GA_HIT, answerHit);
      await use(undefined);
    },
    { auto: true },
  ],
});
