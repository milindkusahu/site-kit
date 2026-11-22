import { type Locator, type Page } from "@playwright/test";
export type Step = {
    readonly click: string;
} | {
    readonly fill: {
        readonly label: string;
        readonly value: string;
    };
} | {
    readonly expectText: string;
} | {
    readonly expectNoText: string;
} | {
    readonly goto: string;
};
export type Feature = {
    readonly id: string;
    readonly description: string;
    readonly path: string;
    readonly proves: string;
    readonly steps: readonly Step[];
};
export declare function byName(page: Page, name: string): Locator;
export declare function runStep(page: Page, step: Step): Promise<void>;
