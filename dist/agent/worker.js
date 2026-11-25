import { MARKDOWN_TYPE, NOT_FOUND_TWIN, markdownTwin, prefersMarkdown } from "./negotiate.js";
function withVary(response) {
    const varied = new Response(response.body, response);
    varied.headers.append("Vary", "Accept");
    return varied;
}
function asMarkdown(response, status) {
    const headers = new Headers(response.headers);
    headers.set("Content-Type", MARKDOWN_TYPE);
    headers.set("Vary", "Accept");
    return new Response(response.body, { status, headers });
}
function asset(request, env, path) {
    return env.ASSETS.fetch(new Request(new URL(path, request.url), request));
}
async function markdownFor(request, env) {
    const twin = markdownTwin(new URL(request.url).pathname);
    if (twin !== null) {
        const copy = await asset(request, env, twin);
        if (copy.ok)
            return asMarkdown(copy, 200);
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
    return (response.headers.get("Content-Type") ?? "").startsWith("text/html") ? withVary(response) : response;
}
export default { fetch: handle };
