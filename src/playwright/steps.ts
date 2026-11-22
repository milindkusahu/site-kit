import { expect, type Locator, type Page } from "@playwright/test";

export type Step =
  | { readonly click: string }
  | { readonly fill: { readonly label: string; readonly value: string } }
  | { readonly expectText: string }
  | { readonly expectNoText: string }
  | { readonly goto: string };

export type Feature = {
  readonly id: string;
  readonly description: string;
  readonly path: string;
  readonly proves: string;
  readonly steps: readonly Step[];
};

export function byName(page: Page, name: string): Locator {
  return page
    .getByRole("button", { name, exact: true })
    .or(page.getByRole("link", { name, exact: true }))
    .or(page.getByRole("tab", { name, exact: true }))
    .or(page.getByRole("checkbox", { name, exact: true }))
    .or(page.getByText(name, { exact: true }))
    .first();
}

export async function runStep(page: Page, step: Step): Promise<void> {
  if ("click" in step) {
    await byName(page, step.click).click();
  } else if ("fill" in step) {
    await page.getByLabel(step.fill.label, { exact: true }).fill(step.fill.value);
  } else if ("expectText" in step) {
    await expect(page.getByText(step.expectText).first()).toBeVisible();
  } else if ("expectNoText" in step) {
    await expect(page.getByText(step.expectNoText)).toHaveCount(0);
  } else {
    await page.goto(step.goto);
  }
}
