export function findPage(pages, path) {
    const page = pages.find((p) => p.path === path);
    if (!page)
        throw new Error(`No page registered for ${path}. Add it to SITE_PAGES first.`);
    return page;
}
export function indexable(pages) {
    return pages.filter((p) => p.indexable);
}
export function breadcrumbTrail(pages, page) {
    const trail = [];
    let current = page;
    while (current) {
        trail.unshift({ name: current.breadcrumb, path: current.path });
        current = current.parent === null ? null : findPage(pages, current.parent);
    }
    return trail;
}
