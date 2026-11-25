export const MARKDOWN_TYPE = "text/markdown; charset=utf-8";
export const NOT_FOUND_TWIN = "/404.md";
function weightOf(accept, type) {
    const entry = accept
        .split(",")
        .map((part) => part.trim().split(";").map((piece) => piece.trim().toLowerCase()))
        .find(([name]) => name === type);
    if (entry === undefined)
        return 0;
    const q = entry.find((piece) => piece.startsWith("q="));
    const weight = q === undefined ? 1 : Number(q.slice(2));
    return Number.isFinite(weight) ? weight : 0;
}
export function prefersMarkdown(accept) {
    if (accept === null)
        return false;
    const markdown = weightOf(accept, "text/markdown");
    return markdown > 0 && markdown >= weightOf(accept, "text/html");
}
export function markdownTwin(pathname) {
    if (pathname.endsWith("/"))
        return `${pathname}index.md`;
    const last = pathname.slice(pathname.lastIndexOf("/") + 1);
    return last.includes(".") ? null : `${pathname}.md`;
}
