import { buildRouteMetadata, DESCRIPTION_LIMITS, TITLE_LIMITS } from "./metadata.js";
import { breadcrumbTrail } from "./pages.js";
import { pageGraph } from "./structured-data.js";
import { withTrailingSlash } from "./url.js";
function collectIds(value, defined, referenced) {
    if (Array.isArray(value)) {
        value.forEach((v) => { collectIds(v, defined, referenced); });
        return;
    }
    if (typeof value !== "object" || value === null)
        return;
    const keys = Object.keys(value);
    const id = Reflect.get(value, "@id");
    if (typeof id === "string")
        (keys.length === 1 ? referenced : defined).add(id);
    keys.forEach((k) => {
        const child = Reflect.get(value, k);
        collectIds(child, defined, referenced);
    });
}
function hasParentLoop(pages, page) {
    const seen = new Set();
    let current = page;
    while (current && current.parent !== null) {
        if (seen.has(current.path))
            return true;
        seen.add(current.path);
        const parent = current.parent;
        current = pages.find((p) => p.path === parent);
    }
    return false;
}
function pageProblems(site, pages, page) {
    const problems = [];
    const meta = buildRouteMetadata(site, page);
    if (meta.title.length < TITLE_LIMITS.min || meta.title.length > TITLE_LIMITS.max)
        problems.push(`${page.path}: title is ${meta.title.length} characters (${TITLE_LIMITS.min} to ${TITLE_LIMITS.max}): "${meta.title}"`);
    if (page.description.length < DESCRIPTION_LIMITS.min || page.description.length > DESCRIPTION_LIMITS.max)
        problems.push(`${page.path}: description is ${page.description.length} characters (${DESCRIPTION_LIMITS.min} to ${DESCRIPTION_LIMITS.max})`);
    if (page.path !== withTrailingSlash(page.path))
        problems.push(`${page.path}: path must end in a slash`);
    if (page.parent !== null && !pages.some((p) => p.path === page.parent)) {
        problems.push(`${page.path}: parent ${page.parent} isn't registered`);
        return problems;
    }
    if (hasParentLoop(pages, page)) {
        problems.push(`${page.path}: parent loop, the page is its own ancestor`);
        return problems;
    }
    const defined = new Set();
    const referenced = new Set();
    const image = { src: "/og/default.png", alt: "Preview", width: 1200, height: 630 };
    collectIds(pageGraph(site, page, meta, { trail: breadcrumbTrail(pages, page), primaryImage: image }), defined, referenced);
    for (const ref of referenced)
        if (!defined.has(ref))
            problems.push(`${page.path}: schema references ${ref}, which isn't defined`);
    return problems;
}
export function registryProblems(site, pages) {
    const problems = pages.flatMap((p) => pageProblems(site, pages, p));
    for (const key of ["title", "description", "path"]) {
        const seen = new Set();
        for (const p of pages) {
            if (seen.has(p[key]))
                problems.push(`Duplicate ${key}: "${p[key]}"`);
            seen.add(p[key]);
        }
    }
    return problems;
}
