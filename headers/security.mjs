const ANALYTICS = ["https://www.googletagmanager.com", "https://*.google-analytics.com", "https://*.analytics.google.com"];

function csp({ dev = false, ads = "none", analytics = false, wasm = false } = {}) {
  const adsOn = ads !== "none" && ads !== "placeholder";
  const scripts = ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), ...(wasm && !dev ? ["'wasm-unsafe-eval'"] : []), ...(analytics ? ANALYTICS : []), ...(adsOn ? ["https:"] : [])];
  const connect = ["'self'", ...(analytics ? ANALYTICS : []), ...(adsOn ? ["https:"] : []), ...(dev ? ["ws:"] : [])];
  return [
    "default-src 'self'",
    `script-src ${scripts.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    `frame-src ${adsOn ? "https:" : "'none'"}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function securityHeaders(options = {}) {
  return [
    { key: "Content-Security-Policy", value: csp(options) },
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    ...(options.agentLinks === false ? [] : [{ key: "Link", value: '</llms.txt>; rel="describedby"; type="text/markdown", </sitemap.xml>; rel="sitemap"; type="application/xml"' }]),
  ];
}

export function headersFile(options = {}) {
  const lines = securityHeaders(options).map((h) => `  ${h.key}: ${h.value}`);
  return `/*\n${lines.join("\n")}\n\n/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/icons/*\n  Cache-Control: public, max-age=604800\n`;
}

export const REQUIRED_HEADERS = ["content-security-policy", "strict-transport-security", "x-content-type-options", "referrer-policy", "permissions-policy"];

export function headerProblems(headers) {
  const get = (name) => headers.get(name) ?? "";
  const problems = REQUIRED_HEADERS.filter((h) => !get(h)).map((h) => `Missing ${h} header.`);
  const policy = get("content-security-policy");
  if (policy) {
    for (const directive of ["object-src 'none'", "base-uri 'self'", "frame-ancestors"]) if (!policy.includes(directive)) problems.push(`CSP lacks ${directive}.`);
    if (/script-src[^;]*\*(\s|;|$)/.test(policy)) problems.push("CSP script-src allows any origin (*).");
  }
  if (get("x-content-type-options") && get("x-content-type-options") !== "nosniff") problems.push("X-Content-Type-Options must be nosniff.");
  if (get("cross-origin-embedder-policy")) problems.push("Cross-Origin-Embedder-Policy is set site-wide; it blocks ad iframes. Set it only on pages that need it.");
  return problems;
}
