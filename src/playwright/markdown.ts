import { expect, test } from "@playwright/test";

export type MarkdownCheck = {
  readonly path: string;
  readonly heading: RegExp;
};

const MARKDOWN = { Accept: "text/markdown" };

export function markdownTests({ path, heading }: MarkdownCheck): void {
  test(`agents asking for markdown get ${path} as markdown, browsers still get HTML`, async ({ request }) => {
    const markdown = await request.get(path, { headers: MARKDOWN });
    expect(markdown.status()).toBe(200);
    expect(markdown.headers()["content-type"]).toContain("text/markdown");
    expect(markdown.headers()["vary"]).toContain("Accept");
    expect(await markdown.text()).toMatch(heading);
    const html = await request.get(path, { headers: { Accept: "text/html" } });
    expect(html.headers()["content-type"]).toContain("text/html");
    expect(html.headers()["vary"]).toContain("Accept");
  });

  test("a missing page answers 404 in markdown with links to the sitemap and llms.txt", async ({ request }) => {
    for (const missingPath of ["/no-such-page-here", "/no-such-page/"]) {
      const missing = await request.get(missingPath, { headers: MARKDOWN });
      expect(missing.status()).toBe(404);
      expect(missing.headers()["content-type"]).toContain("text/markdown");
      const body = await missing.text();
      expect(body).toContain("/sitemap.xml");
      expect(body).toContain("/llms.txt");
    }
  });
}
