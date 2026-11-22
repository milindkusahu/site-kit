import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../assets/sw.js", import.meta.url), "utf8");
const ORIGIN = "https://site.example";

function worker(respond) {
  const store = new Map();
  const key = (req) => new URL(typeof req === "string" ? req : req.url, ORIGIN).pathname;
  const cache = { put: async (req, res) => void store.set(key(req), res), add: async () => undefined };
  const caches = { open: async () => cache, match: async (req) => store.get(key(req)), keys: async () => [], delete: async () => true };
  const listeners = {};
  const self = { location: { origin: ORIGIN }, addEventListener: (type, fn) => void (listeners[type] = fn), skipWaiting() {}, clients: { claim() {} } };
  vm.runInNewContext(source, { self, caches, fetch: async (req) => respond(req), URL, Response, Promise });
  return async (path, mode = "no-cors") => {
    let pending;
    listeners.fetch({ request: { url: `${ORIGIN}${path}`, method: "GET", mode }, respondWith: (p) => void (pending = p) });
    const res = await pending;
    await new Promise((r) => setTimeout(r, 0));
    return res.status;
  };
}

describe("service worker", () => {
  it("doesn't keep serving an asset error after the origin recovers", async () => {
    let up = false;
    const get = worker(() => new Response(up ? "ok" : "down", { status: up ? 200 : 503 }));
    expect(await get("/_astro/app.js")).toBe(503);
    up = true;
    expect(await get("/_astro/app.js")).toBe(200);
  });

  it("caches a good asset and serves it when the network fails", async () => {
    let up = true;
    const get = worker(() => (up ? new Response("ok", { status: 200 }) : Promise.reject(new TypeError("offline"))));
    expect(await get("/_astro/app.js")).toBe(200);
    up = false;
    expect(await get("/_astro/app.js")).toBe(200);
  });

  it("falls back to the last good page, not a cached error page, when offline", async () => {
    let status = 200;
    const get = worker(() => (status === 0 ? Promise.reject(new TypeError("offline")) : new Response("page", { status })));
    expect(await get("/guide/", "navigate")).toBe(200);
    status = 500;
    expect(await get("/guide/", "navigate")).toBe(500);
    status = 0;
    expect(await get("/guide/", "navigate")).toBe(200);
  });
});
