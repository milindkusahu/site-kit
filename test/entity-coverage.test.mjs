import { describe, expect, it } from "vitest";
import { entityCoverage, entityPattern } from "../checks/audit/content.mjs";
import { parsePage } from "../checks/audit/html.mjs";

const entities = ["aspect ratio", "pixel", "Instagram", "Etsy", "Shopify", "Amazon", "eBay", "letterbox", "square"].map((name) => ({ name }));

function statusOf(html, name) {
  const { main } = parsePage(`<html><body><main>${html}</main></body></html>`);
  return entityCoverage(main, entities).find((r) => r.entity.name === name)?.status;
}

describe("entity coverage", () => {
  it("counts an entity named in a heading as explained", () => {
    expect(statusOf("<h2>What aspect ratio means</h2><p>Short.</p>", "aspect ratio")).toBe("explained");
  });

  it("counts a real sentence about the entity as explained", () => {
    const html = "<p>A pixel is the smallest dot of colour in a photo, and a 1080 px square has 1,166,400 of them.</p>";
    expect(statusOf(html, "pixel")).toBe("explained");
  });

  it("accepts plurals and any case", () => {
    expect(statusOf("<p>Every photo is made of pixels, and the export keeps each one at the size you pick here.</p>", "pixel")).toBe("explained");
    expect(entityPattern("eBay").test("EBAY listings")).toBe(true);
  });

  it("treats a list of several entities as name-dropping for each of them", () => {
    const html = "<p>It works for Instagram, Etsy, Shopify, Amazon and eBay posts, listings and product photos alike.</p>";
    for (const name of ["Instagram", "Etsy", "Shopify", "Amazon", "eBay"]) expect(statusOf(html, name)).toBe("name-dropped");
  });

  it("treats a short fragment as name-dropping", () => {
    expect(statusOf("<ul><li>Letterbox bars</li></ul>", "letterbox")).toBe("name-dropped");
  });

  it("does not count the name inside another word", () => {
    expect(statusOf("<p>SquareFitImage resizes your photos in the browser and never uploads a single file to anyone.</p>", "square")).toBe("missing");
  });

  it("ignores navigation, footers and hidden text", () => {
    const html = "<nav><p>Etsy is one of the marketplaces where sellers list handmade goods for buyers.</p></nav><footer>Etsy</footer><p>Other text.</p>";
    expect(statusOf(html, "Etsy")).toBe("missing");
  });

  it("counts a glossary term with a real definition as explained, but not an empty one", () => {
    expect(statusOf("<dl><dt>Letterbox</dt><dd>Bars added above and below a wide photo so it fits a taller frame.</dd></dl>", "letterbox")).toBe("explained");
    expect(statusOf("<dl><dt>Letterbox</dt><dd>Bars.</dd></dl>", "letterbox")).toBe("name-dropped");
  });

  it("doesn't count an entity that sits inside this entity's own name", () => {
    const list = [{ name: "1080 x 1080 pixels" }, { name: "pixel" }, { name: "Instagram" }, { name: "square" }];
    const { main } = parsePage("<main><p>The Instagram square post size is 1080 x 1080 pixels, the size it shows on a phone.</p></main>");
    expect(entityCoverage(main, list)[0].status).toBe("explained");
  });

  it("counts a sentence with at most two other entities as explained", () => {
    const html = "<p>Etsy crops listing photos in its search results, so Shopify and Amazon sellers who reuse them should pad first.</p>";
    expect(statusOf(html, "Etsy")).toBe("explained");
  });
});
