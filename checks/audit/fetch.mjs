export async function fetchRaw(url) {
  const response = await fetch(url, { redirect: "manual", headers: { "User-Agent": "workflow-site-audit" } });
  const location = response.headers.get("location");
  const type = response.headers.get("content-type") ?? "";
  const body = type.includes("text") || type.includes("xml") || type.includes("json") ? await response.text() : "";
  return { status: response.status, location: location ? new URL(location, url).href : null, type, body, headers: response.headers };
}

export async function follow(url, maxHops = 5) {
  const hops = [];
  let current = url;
  for (let i = 0; i <= maxHops; i += 1) {
    const res = await fetchRaw(current);
    if (res.status < 300 || res.status >= 400 || !res.location) return { ...res, url: current, hops };
    hops.push({ from: current, to: res.location, status: res.status });
    current = res.location;
  }
  return { status: 0, location: null, type: "", body: "", headers: new Headers(), url: current, hops };
}

export function makeMapper(base, productionOrigin) {
  const baseUrl = new URL(base);
  return {
    toLocal(href) {
      const u = new URL(href, baseUrl);
      if (productionOrigin && u.origin === productionOrigin) return new URL(u.pathname + u.search, baseUrl).href;
      return u.href;
    },
    isInternal(href) {
      const u = new URL(href, baseUrl);
      return u.origin === baseUrl.origin || (productionOrigin !== null && u.origin === productionOrigin);
    },
    pathOf(href) {
      const u = new URL(href, baseUrl);
      return u.pathname;
    },
  };
}

// Hosts where the markdown Worker may not be in front of the pages (astro preview, a dev server, a preview upload): local, private-network and Cloudflare preview hosts. The playwright/markdown helper tests it under wrangler dev.
export function isPreviewHost(base) {
  const host = new URL(base).hostname.toLowerCase();
  if (host === "localhost" || /\.(localhost|local)$/.test(host) || /\.(workers|pages)\.dev$/.test(host)) return true;
  if (host.startsWith("[")) return /^\[(::1|f[cd][0-9a-f]{0,2}:|fe[89ab][0-9a-f]:)/.test(host);
  const ip = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
