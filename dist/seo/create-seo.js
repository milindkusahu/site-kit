import { buildRouteMetadata, buildTitle } from "./metadata.js";
import { breadcrumbTrail, findPage, indexable } from "./pages.js";
import { registryProblems } from "./registry.js";
import { llmsTxt, robotsTxt, sitemapXml, webManifest } from "./sitemap.js";
import { articleNode, faqNode, howToNode, imageObjectNode, pageGraph, webApplicationNode, } from "./structured-data.js";
export function createSeo(site, pages) {
    return {
        site,
        pages,
        page: (path) => findPage(pages, path),
        indexable: () => indexable(pages),
        title: (title, bare = false) => buildTitle(site, title, bare),
        meta: (path, options = {}) => buildRouteMetadata(site, findPage(pages, path), options),
        trail: (path) => breadcrumbTrail(pages, findPage(pages, path)),
        graph: (path, options = {}) => {
            const page = findPage(pages, path);
            return pageGraph(site, page, buildRouteMetadata(site, page), { ...options, trail: breadcrumbTrail(pages, page) });
        },
        webApplication: (path, app) => webApplicationNode(site, buildRouteMetadata(site, findPage(pages, path)), app),
        article: (path) => {
            const page = findPage(pages, path);
            return articleNode(site, page, buildRouteMetadata(site, page));
        },
        faq: (items) => faqNode(items),
        howTo: (name, steps) => howToNode(site, name, steps),
        image: (image) => imageObjectNode(site, image),
        sitemapXml: () => sitemapXml(site, pages),
        robotsTxt: () => robotsTxt(site),
        llmsTxt: () => llmsTxt(site, pages),
        webManifest: () => webManifest(site),
        problems: () => registryProblems(site, pages),
    };
}
