import { indexable } from "./pages.js";
import { absoluteUrl } from "./url.js";
function escapeXml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
export function sitemapXml(site, pages) {
    const urls = indexable(pages).map((p) => `  <url>\n    <loc>${escapeXml(absoluteUrl(site.origin, p.path))}</loc>\n    <lastmod>${p.lastUpdated}</lastmod>\n  </url>`);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
export const DEFAULT_CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=yes";
export function robotsTxt(site) {
    return `User-agent: *\nAllow: /\nDisallow: /offline/\nContent-Signal: ${site.contentSignal?.trim() || DEFAULT_CONTENT_SIGNAL}\n\nSitemap: ${absoluteUrl(site.origin, "/sitemap.xml")}\n`;
}
export function llmsTxt(site, pages) {
    const lines = indexable(pages).map((p) => `- [${p.title}](${absoluteUrl(site.origin, p.path)}): ${p.description}`);
    return `# ${site.name}\n\n> ${site.description}\n\n## Pages\n\n${lines.join("\n")}\n`;
}
export function webManifest(site) {
    return `${JSON.stringify({
        name: site.name,
        short_name: site.name,
        description: site.description,
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: site.themeColor,
        background_color: site.backgroundColor,
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    }, null, 2)}\n`;
}
