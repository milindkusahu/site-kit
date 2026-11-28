import { type Route } from "@playwright/test";
export { expect } from "@playwright/test";
export type { Page } from "@playwright/test";
export declare const GA_HIT: RegExp;
export declare function answerHit(route: Route): Promise<void>;
export declare const test: import("@playwright/test").TestType<import("@playwright/test").PlaywrightTestArgs & import("@playwright/test").PlaywrightTestOptions & {
    noAnalyticsHits: undefined;
}, import("@playwright/test").PlaywrightWorkerArgs & import("@playwright/test").PlaywrightWorkerOptions>;
