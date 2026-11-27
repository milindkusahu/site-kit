import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { markdownTwin, pageOfTwin, prefersMarkdown } from "../src/agent/negotiate.ts";
import { handle, type AssetsEnv } from "../src/agent/worker.ts";

const HTML = "text/html; charset=utf-8";

function assets(files: Record<string, { body: string; type: string } | { redirect: string }>): AssetsEnv {
  return {
    ASSETS: {
      fetch: async (request) => {
        const file = files[new URL(request.url).pathname];
        if (file === undefined) return new Response("<h1>Not found</h1>", { status: 404, headers: { "Content-Type": HTML } });
        if ("redirect" in file) return new Response(null, { status: 307, headers: { Location: file.redirect } });
        return new Response(request.method === "HEAD" ? null : file.body, { headers: { "Content-Type": file.type } });
      },
    },
  };
}

const SITE = assets({
  "/": { body: "<h1>Home</h1>", type: HTML },
  "/index.md": { body: "# Home", type: "text/markdown" },
  "/tool/": { body: "<h1>Tool</h1>", type: HTML },
  "/tool/index.md": { body: "# Tool", type: "text/markdown" },
  "/tool": { redirect: "/tool/" },
  "/plain/": { body: "<h1>No twin</h1>", type: HTML },
  "/about.md": { body: "# About", type: "text/markdown" },
  "/404.md": { body: "# Not found\n\n[sitemap](/sitemap.xml)", type: "text/markdown" },
  "/llms.txt": { body: "# Site", type: "text/plain" },
  "/logo.svg": { body: "<svg/>", type: "image/svg+xml" },
});

const get = (path: string, accept?: string, method = "GET") =>
  handle(new Request(`https://x.example${path}`, { method, headers: accept === undefined ? {} : { Accept: accept } }), SITE);

describe("markdown negotiation", () => {
  it("answers agents that ask for markdown", () => {
    expect(prefersMarkdown("text/markdown")).toBe(true);
    expect(prefersMarkdown("text/markdown, text/html;q=0.9")).toBe(true);
    expect(prefersMarkdown("text/html;q=0.5, text/markdown;q=0.8")).toBe(true);
    expect(prefersMarkdown("Text/Markdown")).toBe(true);
  });

  it("keeps serving HTML to browsers", () => {
    expect(prefersMarkdown(null)).toBe(false);
    expect(prefersMarkdown("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")).toBe(false);
    expect(prefersMarkdown("text/html, text/markdown;q=0.5")).toBe(false);
    expect(prefersMarkdown("text/markdown;q=0")).toBe(false);
    expect(prefersMarkdown("*/*")).toBe(false);
  });

  it("never throws on any Accept header", () => {
    fc.assert(fc.property(fc.string(), (accept) => typeof prefersMarkdown(accept) === "boolean"));
  });

  it("maps a page path to its markdown copy", () => {
    expect(markdownTwin("/")).toBe("/index.md");
    expect(markdownTwin("/square-crop/")).toBe("/square-crop/index.md");
    expect(markdownTwin("/square-crop")).toBe("/square-crop.md");
    expect(markdownTwin("/llms.txt")).toBeNull();
    expect(markdownTwin("/images/a.b/photo")).toBe("/images/a.b/photo.md");
  });

  it("maps a markdown copy back to its page", () => {
    expect(pageOfTwin("/index.md")).toBe("/");
    expect(pageOfTwin("/square-crop/index.md")).toBe("/square-crop/");
    expect(pageOfTwin("/about.md")).toBe("/about");
    expect(pageOfTwin("/404.md")).toBeNull();
    expect(pageOfTwin("/square-crop/")).toBeNull();
    expect(pageOfTwin("/llms.txt")).toBeNull();
  });

  it("round-trips every page path through its copy", () => {
    const page = fc.stringMatching(/^(\/[a-z0-9-]{1,12}){0,3}\/?$/).map((p) => (p === "" ? "/" : p));
    fc.assert(fc.property(page, (path) => path === "/404" || pageOfTwin(markdownTwin(path) ?? "") === path));
  });
});

describe("markdown Worker", () => {
  it("serves the markdown copy to an agent, with Vary: Accept", async () => {
    const res = await get("/tool/", "text/markdown");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("vary")).toContain("Accept");
    expect(await res.text()).toBe("# Tool");
  });

  it("serves HTML to a browser, with Vary: Accept", async () => {
    const res = await get("/tool/", "text/html");
    expect(res.headers.get("content-type")).toBe(HTML);
    expect(res.headers.get("vary")).toContain("Accept");
    expect(await res.text()).toBe("<h1>Tool</h1>");
  });

  it("serves the copy for a .html page built without a folder", async () => {
    expect(await (await get("/about", "text/markdown")).text()).toBe("# About");
  });

  it("passes the trailing-slash redirect through, so the agent lands on the page", async () => {
    const res = await get("/tool", "text/markdown");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/tool/");
  });

  it("answers an unknown path with the markdown 404 page and a 404 status", async () => {
    for (const path of ["/missing", "/missing/"]) {
      const res = await get(path, "text/markdown");
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toContain("text/markdown");
      expect(await res.text()).toContain("/sitemap.xml");
    }
  });

  it("falls back to HTML for a page without a markdown copy", async () => {
    const res = await get("/plain/", "text/markdown");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(HTML);
  });

  it("answers HEAD like GET, and leaves non-HTML assets alone", async () => {
    const head = await get("/", "text/markdown", "HEAD");
    expect(head.headers.get("content-type")).toContain("text/markdown");
    expect((await get("/logo.svg")).headers.get("vary")).toBeNull();
    expect(await (await get("/llms.txt", "text/markdown")).text()).toBe("# Site");
  });

  it("never sends markdown for a POST", async () => {
    const res = await get("/tool/", "text/markdown", "POST");
    expect(res.headers.get("content-type")).toBe(HTML);
  });

  it("points the markdown copy at its page with a canonical Link", async () => {
    const res = await get("/tool/", "text/markdown");
    expect(res.headers.get("link")).toBe('<https://x.example/tool/>; rel="canonical"');
    expect((await get("/missing/", "text/markdown")).headers.get("link")).toBeNull();
  });

  it("keeps a copy fetched by its own URL out of the index", async () => {
    const res = await get("/tool/index.md");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(res.headers.get("link")).toBe('<https://x.example/tool/>; rel="canonical"');
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(await res.text()).toBe("# Tool");
    const notFound = await get("/404.md");
    expect(notFound.headers.get("x-robots-tag")).toBe("noindex");
    expect(notFound.headers.get("link")).toBeNull();
    expect((await get("/missing.md")).headers.get("x-robots-tag")).toBeNull();
  });
});
