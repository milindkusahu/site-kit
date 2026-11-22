import { expect, test, type Locator, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const AD_GAP_PX = 24;

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("Element has no layout box");
  return b;
}

async function adSlots(page: Page) {
  const slots = page.locator("[data-ad-slot]");
  const count = await slots.count();
  return Promise.all(Array.from({ length: count }, (_, i) => box(slots.nth(i))));
}

for (const vp of VIEWPORTS) {
  test(`homepage tool is fully usable above the fold on ${vp.name} (${vp.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/");
    const tool = page.locator("[data-tool]").first();
    await expect(tool, "the homepage has a [data-tool] element").toBeVisible();
    const primary = tool.locator("[data-tool-primary]").first();
    await expect(primary, "the tool marks its main control with [data-tool-primary]").toBeVisible();
    const p = await box(primary);
    expect(p.y, "main control starts on screen").toBeGreaterThanOrEqual(0);
    expect(p.y + p.height, `main control ends above the fold (${vp.height}px)`).toBeLessThanOrEqual(vp.height);
    const t = await box(tool);
    expect(t.y, "tool starts in the top 60% of the first screen").toBeLessThanOrEqual(vp.height * 0.6);
  });

  test(`no ad sits above, inside or next to the tool on ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/");
    const t = await box(page.locator("[data-tool]").first());
    for (const ad of await adSlots(page)) {
      const overlapsX = ad.x < t.x + t.width && ad.x + ad.width > t.x;
      expect(ad.y + ad.height <= t.y && overlapsX, "ad above the tool").toBe(false);
      expect(ad.y < t.y + t.height + AD_GAP_PX && ad.y + ad.height > t.y - AD_GAP_PX && overlapsX, "ad inside or touching the tool").toBe(false);
    }
  });
}
