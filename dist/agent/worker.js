import { MARKDOWN_TYPE, NOT_FOUND_TWIN, markdownTwin, pageOfTwin, prefersMarkdown } from "./negotiate.js";
function withVary(response) {
    const varied = new Response(response.body, response);
    varied.headers.append("Vary", "Accept");
    return varied;
}
function asMarkdown(response, status, page) {
    const headers = new Headers(response.headers);
    headers.set("Content-Type", MARKDOWN_TYPE);
    headers.set("Vary", "Accept");
    if (page !== undefined)
        headers.set("Link", `<${page.href}>; rel="canonical"`);
    return new Response(response.body, { status, headers });
}
function asTwin(response, url) {
    const headers = new Headers(response.headers);
    const page = pageOfTwin(url.pathname);
    headers.set("Content-Type", MARKDOWN_TYPE);
    headers.set("X-Robots-Tag", "noindex");
    if (page !== null)
        headers.set("Link", `<${new URL(page, url).href}>; rel="canonical"`);
    return new Response(response.body, { status: response.status, headers });
}
function asset(request, env, path) {
    return env.ASSETS.fetch(new Request(new URL(path, request.url), request));
}
async function markdownFor(request, env) {
    const url = new URL(request.url);
    const twin = markdownTwin(url.pathname);
    if (twin !== null) {
        const copy = await asset(request, env, twin);
        if (copy.ok)
            return asMarkdown(copy, 200, new URL(url.pathname, url));
    }
    const page = await env.ASSETS.fetch(request);
    if (page.status === 404)
        return asMarkdown(await asset(request, env, NOT_FOUND_TWIN), 404);
    return withVary(page);
}
export async function handle(request, env) {
    const readable = request.method === "GET" || request.method === "HEAD";
    if (readable && prefersMarkdown(request.headers.get("Accept")))
        return markdownFor(request, env);
    const response = await env.ASSETS.fetch(request);
    const url = new URL(request.url);
    if (response.ok && url.pathname.endsWith(".md"))
        return asTwin(response, url);
    return (response.headers.get("Content-Type") ?? "").startsWith("text/html") ? withVary(response) : response;
}
export default { fetch: handle };
