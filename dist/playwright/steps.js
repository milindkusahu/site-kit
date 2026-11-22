import { expect } from "@playwright/test";
export function byName(page, name) {
    return page
        .getByRole("button", { name, exact: true })
        .or(page.getByRole("link", { name, exact: true }))
        .or(page.getByRole("tab", { name, exact: true }))
        .or(page.getByRole("checkbox", { name, exact: true }))
        .or(page.getByText(name, { exact: true }))
        .first();
}
export async function runStep(page, step) {
    if ("click" in step) {
        await byName(page, step.click).click();
    }
    else if ("fill" in step) {
        await page.getByLabel(step.fill.label, { exact: true }).fill(step.fill.value);
    }
    else if ("expectText" in step) {
        await expect(page.getByText(step.expectText).first()).toBeVisible();
    }
    else if ("expectNoText" in step) {
        await expect(page.getByText(step.expectNoText)).toHaveCount(0);
    }
    else {
        await page.goto(step.goto);
    }
}
