import { describe, expect, it, vi } from "vitest";

type Box = { x: number; y: number; width: number; height: number } | null;
type Registered = { name: string; fn: (args: { page: unknown }) => Promise<void> };

const registered = vi.hoisted((): Registered[] => []);

vi.mock("@playwright/test", async () => {
  const { expect: vitestExpect } = await import("vitest");
  return { test: (name: string, fn: Registered["fn"]) => registered.push({ name, fn }), expect: vitestExpect };
});

await import("../src/playwright/homepage.ts");

function fakePage(tool: Box, slots: Box[]) {
  const at = (box: Box) => ({ boundingBox: async () => box });
  return {
    setViewportSize: async () => undefined,
    goto: async () => undefined,
    locator: (selector: string) =>
      selector === "[data-tool]"
        ? { first: () => at(tool) }
        : { count: async () => slots.length, nth: (i: number) => at(slots[i] ?? null) },
  };
}

describe("homepage ad placement test", () => {
  const phone = registered.find((t) => t.name.startsWith("no ad sits") && t.name.includes("phone"));

  it("ignores an ad slot that is hidden at this width (no layout box)", async () => {
    const tool = { x: 0, y: 100, width: 390, height: 300 };
    const below = { x: 0, y: 900, width: 390, height: 280 };
    await expect(phone?.fn({ page: fakePage(tool, [below, null]) })).resolves.toBeUndefined();
  });

  it("still fails a visible ad above the tool", async () => {
    const tool = { x: 0, y: 400, width: 390, height: 300 };
    const above = { x: 0, y: 0, width: 390, height: 280 };
    await expect(phone?.fn({ page: fakePage(tool, [above]) })).rejects.toThrow("ad above the tool");
  });
});
